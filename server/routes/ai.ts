import { Router } from 'express'
import type { AthleteProfile, Division, RosterProgram, PositionNeed, SchoolRecord } from '../../client/src/types/index'
import { matchSchools, listSchools, scoreSingleSchool } from '../lib/schoolMatcher'
import { getProgramIntel } from '../lib/programIntel'
import { getScrapedCoach } from '../lib/scrapedCoaches'
import { ask, askWithImages, chat, parseJSON, rateCoachReply } from '../lib/aiClient'
import { captureYouTubeFrames } from '../lib/videoAnalyzer'
import rosterData from '../data/rosterPrograms.json'
import schoolsData from '../data/schools.json'
import coachesData from '../data/coachesScraped.json'
import idEventsData from '../data/idEvents.json'
import idCampsData from '../data/idCamps.json'

const router = Router()

// ── Video rating helpers ────────────────────────────────────────────────────
// Position rubric is embedded directly in the prompt now. The AI detects the
// player's position from the footage instead of relying on the profile, so the
// listed `profile.position` does not bias the evaluation.

interface CachedRating { result: Record<string, unknown>; cachedAt: number }
const videoCache = new Map<string, CachedRating>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

// ───────────────────────────────────────────────────────────────────────────

router.post('/coach-reply-draft', async (req, res) => {
  try {
    const { athleteName, athletePosition, athleteGradYear, athleteClub, athleteHighlight,
            athleteLastMessage, programName, programDivision, coachName, programNotes } = req.body as {
      athleteName: string; athletePosition: string | null; athleteGradYear: number | null
      athleteClub: string | null; athleteHighlight: string | null
      athleteLastMessage: string; programName: string; programDivision: string
      coachName: string; programNotes: string | null
    }

    const prompt = `You are ${coachName}, a college soccer coach at ${programName} (${programDivision}).
A high-school recruit emailed you through KickrIQ. Draft a SHORT, warm, personal reply (80-120 words).

Recruit:
- Name: ${athleteName}
- Position: ${athletePosition ?? 'unspecified'}
- Grad year: ${athleteGradYear ?? 'unspecified'}
- Club: ${athleteClub ?? 'unspecified'}
- Highlight video: ${athleteHighlight ?? 'not provided'}
- Their email said: "${athleteLastMessage.slice(0, 600)}"

Your program notes (for tone/positioning, do not quote verbatim): ${programNotes ?? '(none)'}

Rules:
- Coach-to-recruit voice — first name, conversational, no corporate language
- Reference one specific thing about the recruit (position, club, video)
- Make ONE clear next step (camp invite, phone call, request more video, request transcripts)
- Sign off with the coach's first name only
- 80-120 words, no preamble, no bullet points

Respond with JSON only: { "subject": "...", "body": "..." }`

    const text = await ask(prompt, 600)
    res.json(parseJSON(text, { subject: '', body: '' }))
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/email', async (req, res) => {
  try {
    const { profile, school, division, coachName, gender } = req.body as {
      profile: AthleteProfile; school: string; division: Division; coachName: string; gender?: string
    }
    const divisionTone =
      division === 'D1' ? 'professional, concise, and stat-heavy. Club team matters more than high school.'
      : division === 'D2' || division === 'D3' ? 'warm and emphasizing both athletic and academic fit.'
      : 'emphasizing immediate playing time potential and roster fit.'

    const text = await ask(`Write a cold outreach email from the athlete below to ${coachName} at ${school} (${division}).
Tone: ${divisionTone}

Athlete:
- Name: ${profile.name}
- Grad Year: ${profile.gradYear}
- Position: ${profile.position}
- Club: ${profile.clubTeam} (${profile.clubLeague})
- Stats: ${profile.goals}G / ${profile.assists}A
- GPA: ${profile.gpa}
- Major: ${profile.intendedMajor || 'undecided'}
- Highlight: ${profile.highlightUrl || 'not provided'}

Must include: grad year, position, club+league, stats, GPA, why this school, clear ask (visit/camp/call). Include major and highlight link only if provided above.

Respond with JSON only: { "subject": "...", "body": "..." }`, 800)
    res.json(parseJSON(text, {}))
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/find-coach', async (req, res) => {
  try {
    const { school, division, gender } = req.body as { school: string; division: Division; gender: 'mens' | 'womens' }

    // Scraped data from official athletics sites takes priority over AI recall.
    const scraped = await getScrapedCoach(school, gender)
    if (scraped?.coachName) {
      const isFullHit = scraped.status === 'success' && !!scraped.coachEmail
      const isWebVerified = scraped.status === 'web-verified' && !!scraped.coachEmail
      const isInferredEmail = scraped.status === 'email-inferred' && !!scraped.coachEmail
      // Web-verified entries are grounded in real .edu/.com pages via search,
      // so they're treated as high-confidence alongside puppeteer scrapes.
      const hasGoodEmail = isFullHit || isWebVerified || isInferredEmail
      const source = isFullHit ? 'scraped'
                   : isWebVerified ? 'scraped'
                   : isInferredEmail ? 'email-inferred'
                   : 'scraped-partial'
      return res.json({
        coachName: scraped.coachName,
        coachEmail: hasGoodEmail ? scraped.coachEmail : '',
        confidence: isFullHit || isWebVerified ? 'high' : 'low',
        source,
        sourceUrl: scraped.sourceUrl,
        scrapedAt: scraped.scrapedAt,
      })
    }

    // Fall back to AI inference for schools the scraper couldn't reach.
    const genderLabel = gender === 'womens' ? "Women's" : "Men's"
    const text = await ask(`Find the head coach for the ${genderLabel} soccer program at ${school} (${division}).

Return JSON only: { "coachName": "First Last", "coachEmail": "email@school.edu", "confidence": "high" }

Rules:
- Provide the head coach's name if you have any reasonable knowledge of this program. Use the most recent name you know — even from 2022 or 2023 — and let the confidence field reflect uncertainty.
- For email: only include one if you can derive it from a known school-wide format (e.g. "firstinitial+lastname@school.edu" patterns common at most schools). If you don't know the email format, return empty string — better than guessing.
- Confidence calibration:
  • "high" → you are confident this is the current (within the last year) head coach AND the email follows a documented pattern.
  • "low" → you know a name but coach turnover is possible, OR the email is uncertain. Use this for most programs; the UI badges low-confidence results so the user verifies.
- Only return { "coachName": "Head Coach", "coachEmail": "", "confidence": "low" } if you genuinely have no recall of any coach for this specific program (rare for D1, common for small NAIA/JUCO/D3 programs).
- Do not invent a plausible-sounding name. If you don't actually know the program, fall back to the "Head Coach" placeholder.
- Note: longtime coaches do retire. When recalling famous names from years past, mark confidence "low" so the user verifies.`, 300)
    const aiResult = parseJSON(text, { coachName: 'Head Coach', coachEmail: '', confidence: 'low' })
    res.json({ ...aiResult, source: 'ai-recall' })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/schools', async (req, res) => {
  try {
    const { profile, video, topN, preferences } = req.body as {
      profile: AthleteProfile
      video?: import('../../client/src/types/index').VideoRating | null
      topN?: number
      // Affinity-from-ratings payload. Optional. Validated below before use.
      preferences?: unknown
    }
    // Hard-cap topN at 100. The matcher is pure local logic (no AI cost),
    // so this is purely a safety bound — a 100-item list is already past
    // the point most athletes will scroll.
    const requested = typeof topN === 'number' && topN > 0 ? Math.min(100, Math.floor(topN)) : 25
    const { isValidPreferences } = await import('../lib/affinityBoost')
    const validPrefs = isValidPreferences(preferences) ? preferences : null
    const schools = matchSchools(profile, requested, video ?? null, validPrefs)
    res.json({ schools })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

// Score a single school by id — used by the search-a-school UI so users can
// look up any program in the dataset and see their match score immediately,
// regardless of whether it would have made the top-25 list. No AI cost.
router.post('/score-school', async (req, res) => {
  try {
    const { profile, schoolId, video } = req.body as {
      profile: AthleteProfile
      schoolId: string
      video?: import('../../client/src/types/index').VideoRating | null
    }
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' })
    const school = scoreSingleSchool(profile, schoolId, video ?? null)
    if (!school) return res.status(404).json({ error: 'school not found' })
    res.json({ school })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.get('/schools-directory', (_req, res) => {
  try {
    res.json({ schools: listSchools() })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.get('/showcase-events', (_req, res) => {
  res.json({ events: idEventsData })
})

router.get('/id-camps', (_req, res) => {
  res.json({ camps: idCampsData })
})

router.post('/program-intel', async (req, res) => {
  try {
    const { schoolId, gender, refresh } = req.body as {
      schoolId: string; gender: 'mens' | 'womens'; refresh?: boolean
    }
    if (!schoolId) return res.status(400).json({ error: 'schoolId required' })
    const intel = await getProgramIntel(schoolId, gender ?? 'womens', { refresh: !!refresh })
    res.json({ intel })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/video', async (req, res) => {
  try {
    const { videoUrl, profile } = req.body as { videoUrl: string; profile: AthleteProfile }

    if (!/youtube\.com|youtu\.be/.test(videoUrl)) {
      return res.status(400).json({ error: 'Only YouTube URLs are supported at this time.' })
    }

    // Check cache. The "v" prefix is a schema version — bump it whenever the
    // rating output shape changes. v3 dropped profile.position from the cache
    // key; v9 switched the AI from individual frames to grid composites.
    const cacheKey = `v10::${videoUrl}::${profile.targetDivision}`
    const cached = videoCache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return res.json(cached.result)
    }

    // Capture actual video frames via Puppeteer, then composite them into
    // grid montages so the AI can see ~48 frames worth of footage at the
    // token cost of just 4 images.
    console.log(`[video] starting capture for ${videoUrl} (target: ${profile.targetDivision})`)
    const { frames, grids, duration, title } = await captureYouTubeFrames(videoUrl)
    console.log(`[video] captured ${frames.length} frames, ${grids.length} grids, duration=${duration}s`)

    if (!frames || frames.length === 0) {
      console.error('[video] puppeteer returned 0 frames for', videoUrl)
      return res.status(500).json({ error: 'Could not capture frames from this video — make sure it is a public, non-age-restricted YouTube video and try again.' })
    }
    if (!grids || grids.length === 0) {
      console.error('[video] grid composer produced 0 grids for', videoUrl)
      return res.status(500).json({ error: 'Could not assemble video frames for analysis — please try again.' })
    }

    const divisionNote =
      profile.targetDivision === 'D1' ? 'D1: coaches skip videos in 10 seconds — opening clip must be elite. Stat overlay required. Club > HS footage.' :
      profile.targetDivision === 'D2' || profile.targetDivision === 'D3' ? `${profile.targetDivision}: show fit + versatility, not just goals. Academic info on overlay is a plus.` :
      'NAIA/JUCO: show physical and tactical readiness for immediate playing time.'

    const prompt = `You are an experienced college soccer recruiting coordinator with 15+ years of evaluating player tape. You have ${grids.length} grid montages, each one a 4-column × 3-row composite of up to 12 video frames. Across all grids you are seeing ${frames.length} frames spanning the ENTIRE video.

GRID FORMAT — read this carefully:
Each grid image is a 4×3 grid of frames. Read them left-to-right, top-to-bottom. Every cell has a yellow timestamp badge in the top-left corner (formatted M:SS) so you can identify which moment is which. Frames are in chronological order across all grids — earliest in the first cell of the first grid, latest in the last cell of the last grid. When you cite an observation, reference it with the timestamp from that cell's badge (e.g., "at 1:24 the player drives the byline").

Your job is to evaluate THE PLAYER — what position they play on tape, how they play it, and the quality of their play. You are NOT a video producer. Do not grade the editing, the camera angle, the title card, the music, the stat overlay, or the video length. Coaches care about the soccer; that is what you are here to assess.

Target division (the level you are calibrating against): ${profile.targetDivision}
Grad year: ${profile.gradYear}

CRITICAL — IGNORE ANY OFF-TAPE PROFILE:
You are NOT told the player's listed position, club, or stats. Even if you have prior context that says otherwise, do NOT use it. The recruit's listed position can be wrong, outdated, or from a different team. Your evaluation must come ONLY from what is visible in these frames. Trust the tape, not a profile.

WHAT TO IGNORE (do not mention, do not score, do not include in improvements):
- Camera angle of any kind (high-angle / drone / sideline / Veo / Trace / Pixellot / handheld / phone — ALL FINE, ALL EQUIVALENT)
- Video resolution, sharpness, lighting, motion blur, or compression artifacts
- Production polish (editing, pacing, music, transitions, title card)
- Whether there's a stat overlay
- Video length

CAMERA / VIDEO-QUALITY RULE — non-negotiable:
The camera angle and image quality have ZERO influence on the score. A blurry sideline phone clip and a crisp drone shot are evaluated identically. Do NOT mention the camera. Do NOT mention the angle. Do NOT mention image clarity. Do NOT downgrade a score because a clip is hard to see — if you genuinely can't tell what happened in a frame, just rely on the frames you CAN read. The player's qualities at their position are the ONLY thing being scored.

STEP 1 — IDENTIFY THE RECRUIT FROM THE TAPE:
Across the full set of frames (earliest to latest), pick out the recruit by who is consistently at the center of the action. Use circles/arrows/spotlights only as a tiebreaker — the primary signal is which player the camera and clip selection follow. Do NOT score-down because of marker presence.

STEP 2 — DETECT THEIR ACTUAL ON-FIELD POSITION FROM THE TAPE:
Watch what they do. Where do they start each clip? Where do the actions happen on the pitch? What roles do the touches imply? Pick the SINGLE position that best matches what they actually do in the footage. Choose from:
  - Goalkeeper
  - Center back
  - Fullback / Outside back
  - Defensive midfielder
  - Central midfielder
  - Attacking midfielder / #10
  - Winger
  - Striker / Forward

Position-evidence cues:
  - Striker / Forward: starts on/near the last defender, finishes in the box, hold-up with back to goal, shots and headers in the 18.
  - Winger: starts wide, 1v1s on the touchline, cut-ins, crosses, runs in behind the fullback.
  - Attacking mid / #10: receives between lines, through balls, late runs into the box, shots from the edge of the area.
  - Central mid: box-to-box, switches play, supports both halves, tackles AND attacking touches.
  - Defensive mid: screens the back four, ball-winning, deeper position, recycles possession.
  - Fullback / Outside back: defends the touchline, overlaps, crosses, recovery runs.
  - Center back: deepest outfield position, aerial duels, blocks, plays out from the back.
  - Goalkeeper: in the goal, handles, distributes.

If clips show genuine multi-role play (e.g. wing AND striker), pick the role they play MOST.

STEP 3 — EVALUATE AGAINST THAT POSITION'S RUBRIC:
Use the rubric below for the position you detected. Do NOT use a generic outfield checklist.

GOALKEEPER — technical: handling, shot-stopping technique, distribution accuracy, footwork under press. tactical: command of area, when to come off the line, organizing the back line, reading through balls. composure: staying set under shots, calm playing out from the back, no panic clearances. positionPlay: modern keeper (brave, comfortable with the ball) vs. line-keeper. IGNORE: dribbling, finishing, recovery runs.

CENTER BACK — technical: passing range and weight, first touch in deep buildup, aerial technique, clean tackling without lunging. tactical: when to step vs. drop, marking responsibilities, denying lanes, switching play. composure: calm under press, no panic clearances, body shape open, confident in 1v1 duels. positionPlay: ball-playing CB vs. "just clear it" defender. IGNORE: attacking 1v1 dribbles, finishing, wing play.

FULLBACK / OUTSIDE BACK — technical: crossing technique, 1v1 defending technique, first touch on the touchline, passing into the half-space. tactical: overlap timing, recovery angles, marking the winger 1v1. composure: composed receiving on the touchline, calm in transition. positionPlay: defends side AND delivers attacking value. IGNORE: striker-level finishing, central playmaking.

DEFENSIVE MIDFIELDER — technical: passing in tight spaces, ball-winning without fouling, first touch with back to goal, range of passing. tactical: screening the back four, pressing triggers, breaking lines, scanning before receiving. composure: calm with back to goal, no rushed passes, body shape open. positionPlay: protects defense AND starts attacks. IGNORE: attacking dribbling, finishing.

CENTRAL MIDFIELDER — technical: first touch in tight spaces, range of passing, dribbling out of pressure, finishing from distance. tactical: scanning, box-to-box rhythm, third-man runs, body shape. composure: calm receiving under pressure, body shape open to play forward. positionPlay: true 8 — contributing in both boxes. IGNORE: judging on just goals or just tackles.

ATTACKING MIDFIELDER / #10 — technical: tight-space dribbling, through-ball weight, finishing from the edge, set-piece quality. tactical: finding pockets between lines, timing runs into the box, combination play. composure: composed in tight spaces with multiple defenders close. positionPlay: creative pivot — turning, finding runners, finishing. IGNORE: tracking back / defensive duels.

WINGER — technical: 1v1 dribbling, crossing technique, cutting inside and finishing, change of pace. tactical: starting wide and arriving central, isolating fullbacks 1v1, tracking back. composure: composed in 1v1 isolations, picks the right end-product. positionPlay: actually beats the fullback and produces end-product. IGNORE: midfield-level retention, central #10 creativity.

STRIKER / FORWARD — technical: finishing technique, hold-up play with back to goal, first touch on long balls, link-up touches. tactical: movement off the ball (offside line, near-post runs, dropping in), pressing from front, run selection. composure: composed in front of goal, calm hold-up, decisive in the box. positionPlay: true 9 — finishing AND linking AND pressing. IGNORE: tracking back to defend, central playmaking.

POSITION-FAIRNESS RULE: do not penalize the player for not doing things outside the detected role's job description. A center back without 1v1 dribbling is not a weakness; a striker without recovery runs is not a weakness.

SCORING — every score is a 1.0–10.0 number on this scale, with ONE decimal place (e.g. 7.6, 8.2, 9.0), calibrated to ${profile.targetDivision} level:
  1.0–2.9 = wrong level entirely for ${profile.targetDivision} (clear evidence of major technical/tactical gaps; reserve for plain unreadiness)
  3.0–3.9 = clearly below ${profile.targetDivision} (would not contribute at this level)
  4.0–4.9 = somewhat below ${profile.targetDivision} (gap is visible but bridgeable)
  5.0–5.9 = at the lower edge of ${profile.targetDivision} (could fit the bench of a weaker program at this division)
  6.0–6.9 = competitive at ${profile.targetDivision} — would fit a typical roster at this division
  7.0–7.9 = solid ${profile.targetDivision} contributor — would compete for minutes at a typical program
  8.0–8.9 = above ${profile.targetDivision} — clear impact player, could start at most programs at this level (this is the band for top-program commits like Stanford / Duke / UNC / UCLA at D1)
  9.0–9.9 = well above ${profile.targetDivision} — top-program starter, could play a level higher
  10.0  = elite for ${profile.targetDivision} — best-in-class, plays well above this level

DECIMAL PRECISION: every sub-score must use one decimal place. Use the .x to express fine differences — a player who is "above D1 contributor but not quite top-program starter" is 8.4, not 8. A player who is "solid but not flashy" is 7.6 or 7.8, not 7 or 8. Whole numbers are allowed when the score is genuinely on the line, but most scores should land on .1–.9. Do NOT just emit integers and trust the server to add decimals.

HIGHLIGHT-TAPE SELECTION BIAS — read carefully:
You are watching a HIGHLIGHT REEL. The player (or their family/coach) has hand-picked their best moments. By construction, this is their A-game. Players whose actual level is well below their target division do NOT typically have a polished highlight reel. So your prior should be: "this player is at or somewhat above their target division" UNLESS the tape itself contradicts that.

DEFAULT-UPWARD RULE — read this twice:
Anchor the typical highlight-tape rating around 8.0 for a player auditing for their target division — most highlights you score should land in the 7.5–9.0 band, with the CENTER of that distribution at 8.0. Reserve scores below 6.0 for clear, specific deficiencies you can name from the tape (e.g. "first touch consistently bounces off them at 0:42, 1:18, 2:05 — well below D1 cleanliness"). If a clip looks competent and you have no concrete reason to mark it down, the score for that dimension is at least 7.5. If the play is fluid, decisions are sound, and there are no visible technical breakdowns — i.e. the player just looks like they belong at the level — the floor is 8.0, even when there isn't a flashy "wow" moment to hang a higher number on. A clean, controlled, tactically-aware tape is an 8, not a 7.

CALIBRATION ANCHORS — what each band actually looks like:
  • 8.5–9.0: visibly the best player on the field in most clips. Multiple flashes of high-end ability — a goal that requires real technique, a defensive read other players miss, a pass that breaks lines. Could play higher.
  • 8.0–8.4: clearly a level above their teammates. Plays at the speed of the division. Mistakes are rare and minor. No glaring weakness on tape.
  • 7.5–7.9: solid for the division. Plays cleanly, decisions are sound, but the tape doesn't show standout moments — they look like a contributor, not a star.
  • 7.0–7.4: competent for the division but with one or two visible rough edges (e.g. occasional heavy touch, slightly slow off the mark, decisions sometimes hurried). Belongs but isn't standing out.
  • 6.5–6.9: at-or-just-below division level — would need to keep developing to consistently contribute.
  • Below 6.0: needs a NAMED, timestamped, repeated deficiency to justify.

ANTI-HARSH RULE — non-negotiable:
Do not punish a player for things you didn't see. Lack of evidence is not evidence of weakness. If you only see a striker finish three times and you don't see hold-up play, that is NOT a 4 in technical — score what you saw, not what was absent. The tape is short by design. A 3-minute reel will never show every dimension — that's normal, and it does NOT mean the player lacks those dimensions.

ANTI-HEDGE RULE — read carefully:
You are not allowed to default to 7 just because you're uncertain. Every score must be backed by a specific observation. If you find yourself wanting to give a 7.x, decide between 7 and 8 by asking: do they look like a typical contributor at this level, or do they look like they're a step ahead of the competition on this tape? Pick. The full scale exists for a reason — most players auditing for their target division on tape land somewhere between 7.5 and 9.

You score every dimension independently. Every dimension uses different evidence — technique vs. decision-making vs. composure vs. role-fit vs. level — so the scores almost never line up. A player can be technical=8 / composure=5. That's normal.

HARD DIVERGENCE CONSTRAINT — non-negotiable:
The five sub-scores (technicalScore, tacticalScore, composureScore, positionPlayScore, divisionFitScore) MUST span a range of at least 3 (max minus min ≥ 3). Identical scores across all five, or all five within ±1 of each other, means you hedged and the output is rejected.
After you draft your five scores, perform this CHECK:
  1. Find max sub-score and min sub-score.
  2. If max − min < 3, you hedged. Identify the player's STRONGEST visible trait and raise that score by 1–2. Identify their WEAKEST visible trait and lower that score by 1–2. Re-check.
  3. Do not "split the difference" — pick a clear strongest and clear weakest based on what you actually saw in the frames.
Output only AFTER the range constraint is satisfied.

Five evaluation dimensions — for EACH, describe what you see and assign a 1.0–10.0 score with ONE decimal place. Use the rubric for the position you detected, not a generic checklist:

1. technical (for the detected role) — technique judged for that position. Is the technique clean or scrappy?

2. tactical (for the detected role) — tactical understanding judged for that position. Do they understand the game from this position?

3. composure (for the detected role) — poise under pressure for that position. This is visible at any camera angle, unlike pure athletic traits like top-end pace which a highlight tape rarely shows reliably. Do NOT score-down for unseen athletic traits — judge what is actually on tape.

4. positionPlay (for the detected role) — how they play that position specifically.

5. divisionFit — direct level assessment. Do they look like a ${profile.targetDivision} player at the position you detected, higher, or lower?

${divisionNote}

ANTI-MISTAKE RULES:
- Do NOT make markers/circles part of any of the 5 dimensions or sub-scores.
- Do NOT comment on title cards, stat overlays, music, editing, or video length.
- Do NOT comment on or score-down for camera angle, video resolution, lighting, or image clarity. The camera is invisible to your evaluation.
- The 5 dimensions and their scores are about SOCCER only — the player's qualities at their position.
- Do NOT use any pre-supplied profile position to drive your evaluation. Detect the role from the tape.
- Do NOT score-down for traits not visible. Score what you saw, not what was missing from the edit.

IMPROVEMENTS LIST:
- 1–2 items must be soccer-specific: a part of their game to work on, a type of clip to add, a weakness to address.
- Player-identifier exception: if you saw NO circle/arrow/spotlight/glow/marker on any player in any frame, you MAY include — as a LATER item, never #1 — "Add a circle or arrow on yourself in each clip so coaches can find you immediately." If you saw any marker, don't mention markers.
- Do not recommend "shorten the video," "add a stat overlay," "add a title card," or any other production polish.

PROCESS — do this internally, but DO NOT write it out:
Walk through every frame in time order. Identify the recruit by recurring action focus. Detect their position from where they play and what they do. Then score each dimension on the 1.0–10.0 scale above (one decimal place) using that position's rubric. The server will overwrite the overall "score" field with the average of your 5 sub-scores, so still fill it in but don't agonize over it.

OUTPUT — your reply must be ONLY the JSON object below, with no preamble, no analysis, no markdown fences, no explanation. Start your reply with the opening "{" and end with the closing "}". Anything else and the parser fails.

JSON shape (return this exact structure — every score is a number with ONE decimal place, e.g. 6.4 or 7.0, never an integer alone):
{"detectedPosition":"<one of: Goalkeeper, Center back, Fullback / Outside back, Defensive midfielder, Central midfielder, Attacking midfielder / #10, Winger, Striker / Forward>","score":<number 1.0-10.0 with one decimal — your overall, will be overwritten by server with avg of sub-scores>,"summary":"<2-3 sentences — open by stating the detected position with one piece of evidence (e.g. 'Plays as a striker — consistently the furthest forward, finishes inside the 18 at 1:24 and 2:51'), then give an honest verdict on their level relative to ${profile.targetDivision}, with at least one more specific observation referencing a timestamp>","technical":"<technique judged for the detected role, with timestamps>","technicalScore":<number 1.0-10.0 with one decimal>,"tactical":"<tactical understanding judged for the detected role, with timestamps>","tacticalScore":<number 1.0-10.0 with one decimal>,"composure":"<poise under pressure judged for the detected role>","composureScore":<number 1.0-10.0 with one decimal>,"positionPlay":"<how they play the detected role specifically>","positionPlayScore":<number 1.0-10.0 with one decimal>,"divisionFit":"<direct assessment: ${profile.targetDivision} caliber at the detected position, above, or below>","divisionFitScore":<number 1.0-10.0 with one decimal>,"improvements":["<#1 specific to the detected role>","<#2 specific to the detected role>","<#3 specific to the detected role or marker note>"]}`

    const fmtTs = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
    const imageInputs = grids.map((g, i) => ({
      data: g.data,
      mediaType: 'image/jpeg',
      label: `[Grid ${i + 1} of ${grids.length} — ${g.cellCount} frames covering ${fmtTs(g.firstTimestamp)} through ${fmtTs(g.lastTimestamp)}, read left-to-right top-to-bottom]`,
    }))

    console.log(`[video] sending ${imageInputs.length} grid(s) to Claude Vision`)
    let text = await askWithImages(prompt, imageInputs, 3500)
    console.log(`[video] received response: ${text.length} chars`)
    let result = parseJSON<Record<string, unknown>>(text, {})

    // If the parser got nothing usable, log raw response and bail.
    if (!result || typeof result !== 'object' || Object.keys(result).length === 0) {
      console.error('[video] failed to parse JSON. Raw response (first 1500 chars):\n', text.slice(0, 1500))
      return res.status(500).json({ error: 'Could not parse video rating — please try again.' })
    }

    // Hedge guard: if the model collapsed all five sub-scores to the same number
    // (or within ±1), force a single retry with the prior scores quoted back at it.
    const subKeysAll = ['technicalScore', 'tacticalScore', 'composureScore', 'positionPlayScore', 'divisionFitScore'] as const
    const firstSubs = subKeysAll.map(k => Number(result[k])).filter(n => Number.isFinite(n) && n >= 1 && n <= 10)
    if (firstSubs.length === 5 && Math.max(...firstSubs) - Math.min(...firstSubs) < 2) {
      const flat = subKeysAll.map(k => `${k}=${result[k]}`).join(', ')
      const retryPrompt = `${prompt}

PRIOR ATTEMPT REJECTED — you violated the divergence constraint. You returned: ${flat}. The range was ${Math.max(...firstSubs) - Math.min(...firstSubs)}, which is below the required minimum of 3.

You hedged. Re-evaluate. Pick the player's clearest STRENGTH from what you actually saw in the frames and raise that score by 2. Pick their clearest WEAKNESS and lower that score by 2. Other dimensions adjust to reflect their actual evidence. The new five scores must span max − min ≥ 3. Output the corrected JSON only.`
      text = await askWithImages(retryPrompt, imageInputs, 3500)
      const retried = parseJSON<Record<string, unknown>>(text, {})
      if (retried && typeof retried === 'object' && Object.keys(retried).length > 0) {
        result = retried
      }
    }

    // Backfill any missing string field with a placeholder so a partial JSON
    // doesn't kill the whole request. Better to show what we got than 500.
    const stringFields: { key: string; fallback: string }[] = [
      { key: 'detectedPosition', fallback: 'Position unclear from the footage' },
      { key: 'summary', fallback: 'Analysis incomplete — try rating this video again.' },
      { key: 'technical', fallback: 'No technical assessment available.' },
      { key: 'tactical', fallback: 'No tactical assessment available.' },
      { key: 'composure', fallback: 'No composure assessment available.' },
      { key: 'positionPlay', fallback: 'No position-play assessment available.' },
      { key: 'divisionFit', fallback: 'No division-fit assessment available.' },
    ]
    for (const { key, fallback } of stringFields) {
      if (typeof result[key] !== 'string' || !(result[key] as string).trim()) result[key] = fallback
    }
    if (!Array.isArray(result.improvements) || result.improvements.length === 0) {
      result.improvements = ['Re-run the rating for fresh feedback — the model returned an incomplete response.']
    }

    // Overall score = mechanical average of the sub-scores. Forces commitment
    // and prevents the model from defaulting to 5/10 for everything.
    // Scores are kept to 1 decimal place (e.g. 7.0, 6.4) so the UI can show
    // calibrated ratings instead of coarse integers.
    const round1 = (n: number) => Math.round(n * 10) / 10
    const subKeys = ['technicalScore', 'tacticalScore', 'composureScore', 'positionPlayScore', 'divisionFitScore'] as const
    const subs = subKeys.map(k => Number(result[k])).filter(n => Number.isFinite(n) && n >= 1 && n <= 10)
    if (subs.length >= 3) {
      const avg = subs.reduce((a, b) => a + b, 0) / subs.length
      result.score = Math.max(1, Math.min(10, round1(avg)))
    } else {
      const overall = Number(result.score)
      result.score = Number.isFinite(overall) && overall >= 1 && overall <= 10 ? round1(overall) : 5.0
    }
    // Backfill any missing sub-score with the overall so the UI doesn't show NaN.
    for (const k of subKeys) {
      const v = Number(result[k])
      result[k] = Number.isFinite(v) && v >= 1 && v <= 10 ? round1(v) : result.score
    }

    // Attach screenshots and metadata so the client can display them
    result.screenshots = frames
    result.duration = duration
    result.videoTitle = title

    videoCache.set(cacheKey, { result, cachedAt: Date.now() })
    res.json(result)
  } catch (e) {
    const err = e as { status?: number; message?: string; error?: { message?: string }; stack?: string }
    console.error('[video] FAILED:', {
      message: err?.message,
      status: err?.status,
      anthropicError: err?.error?.message,
      stack: err?.stack?.split('\n').slice(0, 5).join('\n'),
    })
    const msg = e instanceof Error ? e.message : 'Failed to analyze video'
    // Anthropic 429s arrive as errors with status 429 and "rate_limit" in the
    // body. Surface a friendlier message so the user knows to retry shortly.
    const isRateLimit = err?.status === 429 || /rate.?limit|429/i.test(msg)
    if (isRateLimit) {
      // We've already auto-retried with backoff inside the AI client, so a
      // 429 surfacing here means the limit is genuinely sustained.
      return res.status(429).json({
        error: 'AI is busy right now — please wait 2–3 minutes and try again.',
      })
    }
    res.status(500).json({ error: msg })
  }
})

router.post('/followup', async (req, res) => {
  try {
    const { profile, context, type } = req.body as { profile: AthleteProfile; context: string; type: 'followup' | 'thankyou' | 'answer' }
    const typeInstruction = type === 'followup' ? 'a follow-up email to a coach who has not responded in 2 weeks'
      : type === 'thankyou' ? 'a thank-you email after a campus visit or call'
      : 'a response to a coach question or inquiry'
    const text = await ask(`You are a college soccer recruitment counselor with 15+ years of experience.

Write ${typeInstruction} for: ${profile.name}, ${profile.position}, Class of ${profile.gradYear}, ${profile.clubTeam}. Target: ${profile.targetDivision}.
Context: ${context || 'No additional context provided.'}

Also provide brief counselor advice (2–3 sentences) on strategy, timing, or tone the athlete should know about this specific situation — not generic tips, but insight specific to the context above.

Respond with JSON only: { "body": "...", "advice": "..." }`, 600)
    res.json(parseJSON(text, {}))
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/rate-response', async (req, res) => {
  try {
    const { school, coachName, text: replyText } = req.body as { school: string; coachName: string; text: string }
    const json = await rateCoachReply(school, coachName, replyText)
    res.json({ ...json, id: crypto.randomUUID(), school, coachName, date: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/find-camps', async (req, res) => {
  try {
    const { profile, schools } = req.body as {
      profile: AthleteProfile
      schools: { name: string; division: string }[]
    }

    // For each school the user adds, return a generic ID-camp record. We DO
    // NOT ask the AI to invent registration URLs, dates, or coach names — those
    // change yearly and the AI hallucinates them. Instead, every entry points
    // to a Google search that returns the real, current registration page.
    // The curated /id-camps directory is the source of truth for major
    // programs; this endpoint is the fallback for arbitrary user-added schools.
    const enc = (s: string) => encodeURIComponent(s)
    const gender = profile.gender === 'mens' ? 'men' : 'women'
    const camps = schools.map((s) => ({
      id: `search-${s.name.replace(/\W+/g, '-').toLowerCase()}`,
      school: s.name,
      division: s.division,
      campName: `${s.name} ${gender === 'men' ? "Men's" : "Women's"} Soccer ID Camp`,
      date: 'Dates change yearly — check the registration page',
      location: 'Verify on the registration page',
      cost: 'Verify on the registration page',
      url: `https://www.google.com/search?q=${enc(`${s.name} ${gender} soccer ID camp register`)}`,
      coaches: [{ name: 'Head Coach', title: `${s.name} ${gender === 'men' ? "Men's" : "Women's"} Soccer` }],
    }))

    res.json({ camps })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/camp-emails', async (req, res) => {
  try {
    const { profile, camp, coaches } = req.body as {
      profile: AthleteProfile
      camp: { campName: string; school: string; date: string; location: string }
      coaches: { name: string; title: string }[]
    }
    const coachList = coaches.map((c) => `${c.name} (${c.title})`).join('; ')
    const text = await ask(`Write personalized ID camp outreach emails from this athlete to each coach.

Athlete: ${profile.name}, ${profile.position}, Class of ${profile.gradYear}, ${profile.clubTeam} (${profile.clubLeague}), ${profile.goals}G/${profile.assists}A, GPA ${profile.gpa}, Highlight: ${profile.highlightUrl}

Camp: ${camp.campName} at ${camp.school} on ${camp.date} in ${camp.location}

Coaches: ${coachList}

For each coach, write a concise email (under 200 words) mentioning: attending their specific camp on the date, key stats, highlight link, why their program, and a clear ask to connect at camp.

Respond with JSON only: { "emails": [{ "coachName": "...", "subject": "...", "body": "..." }] }`, 900)
    res.json(parseJSON(text, { emails: [] }))
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

// Curated roster overrides keyed by `${schoolName}:${gender}` (case-insensitive).
// Hand-tuned recruiting needs / formations for the 70 highest-profile programs;
// every other school falls back to a generic profile sourced from schools.json.
const CURATED_ROSTER = new Map<string, RosterProgram>()
for (const p of rosterData as RosterProgram[]) {
  CURATED_ROSTER.set(`${p.school.toLowerCase()}:${p.gender}`, p)
}

const DEFAULT_RECRUITING_NEEDS: RosterProgram['typicalRecruitingNeeds'] = [
  { position: 'Forward',            level: 'Medium' },
  { position: 'Central Midfielder', level: 'Medium' },
  { position: 'Center Back',        level: 'Medium' },
  { position: 'Outside Back',       level: 'Medium' },
  { position: 'Goalkeeper',         level: 'Low' },
]

interface CoachEntry { coachName: string; coachEmail: string; status: string }
const COACH_LOOKUP = coachesData as Record<string, CoachEntry>
// Statuses that produced a real coach name (and usually an email). Must stay in
// sync with fillCoachGaps.ts, which writes 'haiku-verified' / 'sonnet-verified'
// when the AI research pass fills gaps left by the initial scrape.
const USEFUL_COACH_STATUSES = new Set([
  'success', 'partial', 'email-inferred',
  'web-verified', 'web-name-only',
  'haiku-verified', 'sonnet-verified',
])

function buildRosterPrograms(gender: 'mens' | 'womens', division: string): RosterProgram[] {
  const schools = schoolsData as SchoolRecord[]
  const filtered = division === 'all' ? schools : schools.filter((s) => s.division === division)
  const out: RosterProgram[] = []
  for (const s of filtered) {
    const coach = COACH_LOOKUP[`${s.id}:${gender}`]
    // Skip schools confirmed not to sponsor this gender's program.
    if (coach?.status === 'no-program') continue
    const curated = CURATED_ROSTER.get(`${s.name.toLowerCase()}:${gender}`)
    const usefulCoach = coach && USEFUL_COACH_STATUSES.has(coach.status) ? coach : null
    const location = s.location ?? ''
    const stateParts = location.split(',').map((x) => x.trim())
    out.push({
      id: curated?.id ?? `${s.id}-${gender}`,
      school: s.name,
      conference: s.conference,
      division: s.division,
      location,
      region: s.region,
      state: stateParts[stateParts.length - 1] || '',
      gender,
      coachName: curated?.coachName ?? usefulCoach?.coachName ?? '',
      coachEmail: curated?.coachEmail ?? usefulCoach?.coachEmail ?? '',
      typicalRecruitingNeeds: curated?.typicalRecruitingNeeds ?? DEFAULT_RECRUITING_NEEDS,
      formationStyle: curated?.formationStyle ?? 'Varies by class',
      notes: curated?.notes ?? 'Recruiting needs vary year to year. Contact the program directly to confirm current openings.',
    })
  }
  return out
}

// Athlete profile positions ("Right Back", "Left Wing") don't always match the
// terminology used in roster recruiting needs ("Outside Back", "Winger").
// Normalize to the substrings our data actually uses so the sort works.
function normalizeAthletePosition(raw: string): string {
  const p = raw.toLowerCase().trim()
  if (p.includes('right back') || p.includes('left back') || p === 'fullback' || p === 'full back') return 'outside back'
  if (p.includes('wing') && !p.includes('back')) return 'winger'
  if (p === 'central mid' || p === 'center mid' || p.includes('central midfield')) return 'central midfielder'
  if (p === 'defensive mid' || p.includes('defensive midfield')) return 'defensive midfielder'
  if (p === 'attacking mid' || p.includes('attacking midfield')) return 'attacking midfielder'
  return p
}

router.post('/roster-intel', async (req, res) => {
  try {
    const { gender, division, athletePosition } = req.body as { gender: 'mens' | 'womens'; division: string; athletePosition: string }

    let programs = buildRosterPrograms(gender, division)

    if (athletePosition) {
      const pos = normalizeAthletePosition(athletePosition)
      programs.sort((a, b) => {
        const aHigh = a.typicalRecruitingNeeds.some((n) => n.position.toLowerCase().includes(pos) && n.level === 'High') ? 1 : 0
        const bHigh = b.typicalRecruitingNeeds.some((n) => n.position.toLowerCase().includes(pos) && n.level === 'High') ? 1 : 0
        return bHigh - aHigh
      })
    }

    const posMap = new Map<string, { high: number; medium: number }>()
    for (const prog of programs) {
      for (const need of prog.typicalRecruitingNeeds) {
        const entry = posMap.get(need.position) ?? { high: 0, medium: 0 }
        if (need.level === 'High') entry.high++
        else if (need.level === 'Medium') entry.medium++
        posMap.set(need.position, entry)
      }
    }
    const positionSummary: PositionNeed[] = Array.from(posMap.entries())
      .map(([position, counts]) => ({
        position,
        demand: (counts.high >= 5 ? 'High' : counts.high + counts.medium >= 3 ? 'Medium' : 'Low') as 'High' | 'Medium' | 'Low',
        schoolCount: counts.high + counts.medium,
      }))
      .sort((a, b) => b.schoolCount - a.schoolCount)

    res.json({ programs, positionSummary })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

// Beeko chat addendum: human tone + accuracy guardrails. The base PERSONA gives
// the counselor identity; this layer fixes the voice so replies don't read as
// AI and pins the model to verifiable recruiting facts instead of plausible-
// sounding filler.
const BEEKO_STYLE = `

You are "Beeko" inside a chat widget. Talk like a real coach texting a player back, not like an assistant writing a memo.

VOICE RULES (strict):
- Never use em dashes (—). Use a period, comma, "and", "or", parentheses, or just a regular hyphen with spaces if you need a pause.
- No corporate or AI filler. Cut phrases like "Great question", "Absolutely", "I'd be happy to", "Let's dive in", "It's important to note", "In conclusion", "I hope this helps".
- No bold headers or section titles for short answers. Plain sentences. Use a short bulleted list only when the answer is genuinely a list of items (3+).
- Contractions are good (you're, don't, it's). Short sentences. Sound like a person, not a brochure.
- Don't restate the question back. Just answer.
- Length: 2 to 5 sentences for most questions. Only go longer if they actually asked for a breakdown or step-by-step.

ACCURACY RULES (strict):
- Stick to things that are actually true about US college soccer recruiting. If you don't know a specific fact (a coach's email, a roster spot, a specific school's policy, a deadline that changes year to year), say you don't know and tell them where to check (the school's athletics site, NCAA Eligibility Center, their club DOC, etc.).
- Never invent stats, school requirements, scholarship numbers, GPA cutoffs, or coach names. If they ask about a specific school you don't have data on, say so plainly.
- NCAA rules and contact dates change. If they ask about a specific date or rule, give the general shape of the rule and tell them to verify on ncaa.org.
- D1 men's soccer is equivalency (9.9 scholarships split). D1 women's is headcount (14 full). D2 is equivalency for both. D3 has zero athletic scholarships, only academic and need-based aid. Get this right when it comes up.
- Recruiting timeline reality: D1 contact opens June 15 after sophomore year; most D1 verbal commits land junior year; D2/D3/NAIA timelines run later (junior into senior year is normal). Don't push athletes to panic.
- If they ask something outside soccer recruiting (homework help, life advice, other sports), gently redirect back to recruiting.

WHEN A USER ASKS FOR HELP THE APP CAN ACTUALLY DO:
- Coach email writing: point them to the Coach Email Generator.
- Finding schools: point them to the School Matcher.
- Rating their highlight tape: point them to the Highlight Video Rater (Pro/Family).
- Tracking responses: point them to the Outreach Tracker.

WHEN TO HAND OFF TO A REAL COUNSELOR:
- If the athlete or parent asks to speak with a real person, says it's urgent, mentions an injury/eligibility crisis, a deadline today, a scholarship offer they need to respond to immediately, billing/account problems, or anything emotional that goes beyond recruiting Q&A, give them the human contact channel:
  - Phone: (415) 619-9477 (Mon to Fri, 9am to 6pm PT)
  - Email: infokickriq@gmail.com (replies within 1 business day)
- Do not invent other contact methods. Do not promise specific response times beyond what's stated above.
- For everyday recruiting questions, just answer. Don't push the contact info on every message.

If their profile is attached below, use it. Reference their position, grad year, division goal, and stats when it helps. If something in their profile is missing and matters for the answer, ask one short follow-up.`

router.post('/chat', async (req, res) => {
  try {
    const { messages, profile } = req.body as {
      messages: { role: 'user' | 'assistant'; content: string }[]
      profile?: AthleteProfile
    }
    const profileContext = profile
      ? `\n\nAthlete context: ${profile.name}, ${profile.position}, Class of ${profile.gradYear}, ${profile.clubTeam} (${profile.clubLeague}), ${profile.goals}G/${profile.assists}A, GPA ${profile.gpa}, targeting ${profile.targetDivision}.`
      : ''
    const reply = await chat(messages, BEEKO_STYLE + profileContext, 500)
    // Belt-and-suspenders: even with the prompt rule, models occasionally slip an
    // em or en dash through. Strip them on the way out so the user never sees one.
    const cleaned = reply.replace(/[—–]/g, ', ').replace(/ ,/g, ',').replace(/,\s*,/g, ',')
    res.json({ reply: cleaned })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

export default router
