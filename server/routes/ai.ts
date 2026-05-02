import { Router } from 'express'
import type { AthleteProfile, Division, RosterProgram, PositionNeed, SchoolRecord } from '../../client/src/types/index'
import { matchSchools, listSchools } from '../lib/schoolMatcher'
import { getProgramIntel } from '../lib/programIntel'
import { getScrapedCoach } from '../lib/scrapedCoaches'
import { ask, askWithImages, chat, parseJSON, rateCoachReply } from '../lib/aiClient'
import { captureYouTubeFrames } from '../lib/videoAnalyzer'
import rosterData from '../data/rosterPrograms.json'
import idEventsData from '../data/idEvents.json'
import idCampsData from '../data/idCamps.json'

const router = Router()

// ── Video rating helpers ────────────────────────────────────────────────────

function getPositionSkills(position: string): string {
  const p = position.toLowerCase()
  if (p.includes('goalkeeper') || p.includes('gk')) return 'distribution, shot-stopping angles, dealing with crosses, footwork with the ball'
  if (p.includes('center back') || p.includes('cb')) return 'aerial duels, 1v1 defending, stepping to win the ball, composure in possession, switching the field'
  if (p.includes('fullback') || p.includes('outside back') || p.includes('rb') || p.includes('lb')) return 'overlapping runs, crossing quality, 1v1 defending, recovery runs'
  if (p.includes('defensive mid') || p.includes('cdm') || p.includes('dm')) return 'winning balls, range of passing, pressing triggers, positional discipline'
  if (p.includes('central mid') || p.includes('cm') || p.includes('midfielder')) return 'technical ability in tight spaces, vision, range of passing, runs off the ball'
  if (p.includes('attacking mid') || p.includes('cam') || p.includes('10')) return 'combination play, dribbling in tight spaces, through balls, shots from range'
  if (p.includes('winger') || p.includes('wide') || p.includes('lw') || p.includes('rw')) return '1v1 dribbling, crossing, cutting inside, pace in behind, tracking back'
  if (p.includes('striker') || p.includes('forward') || p.includes('st') || p.includes('cf')) return 'finishing technique, movement off the ball, hold-up play, link-up, pressing from front'
  return 'technical quality, composure on the ball, positioning, decision-making under pressure'
}

interface PositionRubric {
  role: string
  technical: string
  tactical: string
  composure: string
  positionPlay: string
  ignore: string
}

function getPositionRubric(position: string): PositionRubric {
  const p = position.toLowerCase()
  if (p.includes('goalkeeper') || p.includes('gk')) return {
    role: 'Goalkeeper',
    technical: 'handling (collecting and parrying cleanly), shot-stopping technique (set position, hand selection), distribution accuracy on short rolls AND long kicks, footwork with the ball under press',
    tactical: 'command of area on crosses, when to come off the line vs. stay, organizing the back line (visible by gestures/body language), positioning relative to ball and goal, reading through balls',
    composure: 'staying set under shots, calm playing out from the back when pressed, no panic clearances, body language commanding the area',
    positionPlay: 'do they look like a modern keeper — comfortable with the ball, brave on crosses, set on shots — or a line-keeper who only stops shots?',
    ignore: 'do NOT score them on dribbling, finishing, recovery runs, or anything an outfield player would do',
  }
  if (p.includes('center back') || p.includes('cb')) return {
    role: 'Center back',
    technical: 'passing range and weight (short retention + switches), first touch in deep buildup, aerial technique on jumps and headers, clean tackling technique without lunging',
    tactical: 'when to step vs. drop, marking responsibilities, denying passing lanes, coordinating the back line, reading through balls early, switching play to break pressure',
    composure: 'calm on the ball when pressed, no panic clearances under pressure, body shape open to receive, confidence in 1v1 defending duels',
    positionPlay: 'are they a modern ball-playing CB or a "just clear it" defender? Do they win duels without diving in?',
    ignore: 'do NOT score them on attacking 1v1 dribbles, finishing, or wing play. Recovery pace matters less than reading the game early',
  }
  if (p.includes('fullback') || p.includes('outside back') || p.includes('rb') || p.includes('lb')) return {
    role: 'Fullback / Outside back',
    technical: 'crossing technique (whip, target), 1v1 defending technique, first touch on the touchline, passing into the half-space',
    tactical: 'when to overlap vs. hold shape, defensive recovery angles, marking the winger 1v1 vs. tucking inside, balance with the center backs',
    composure: 'composed receiving on the touchline, not rushed when pressed near the corner, calm on the ball in transition',
    positionPlay: 'do they contribute both ways — defend their side AND deliver attacking value (overlaps, crosses, cut-ins)?',
    ignore: 'do NOT expect striker-level finishing or central playmaking. Recovery runs DO matter',
  }
  if (p.includes('defensive mid') || p.includes('cdm') || p.includes('dm')) return {
    role: 'Defensive midfielder',
    technical: 'passing in tight spaces, ball-winning technique without fouling, first touch with back to goal, range of passing',
    tactical: 'screening the back four, pressing triggers, breaking lines with vertical passes, covering for advancing fullbacks, scanning before receiving',
    composure: 'calm with back to goal when pressed, no rushed passes, body shape open between the lines, doesn\'t hide from the ball',
    positionPlay: 'do they protect the defense AND start attacks? Or only one of those?',
    ignore: 'do NOT score them on attacking dribbling or finishing. Defensive reading > duel-winning aggression',
  }
  if (p.includes('central mid') || p.includes('cm') || p.includes('midfielder')) return {
    role: 'Central midfielder',
    technical: 'first touch in tight spaces, range of passing (short and long), dribbling out of pressure, finishing from distance',
    tactical: 'scanning before receiving, box-to-box rhythm, supporting attack AND defense, third-man runs, body shape to play forward',
    composure: 'calm receiving under pressure, doesn\'t rush, body shape open to play forward, picks the right pass',
    positionPlay: 'are they a true 8 — contributing in both boxes — or just defensive or just attacking?',
    ignore: 'judge them on two-way contribution, not just goals or just tackles',
  }
  if (p.includes('attacking mid') || p.includes('cam') || p.includes('10')) return {
    role: 'Attacking midfielder / #10',
    technical: 'tight-space dribbling, through-ball weight and timing, finishing from the edge of the box, set-piece quality',
    tactical: 'finding pockets between lines, timing runs into the box, combination play in the final third, when to shoot vs. release',
    composure: 'composed in tight spaces with multiple defenders close, doesn\'t panic when pressed, picks the right moment',
    positionPlay: 'are they the creative pivot — turning, finding runners, finishing — or just a goalscorer who hangs forward?',
    ignore: 'do NOT score them heavily on tracking back or defensive duels. Creativity > work rate for this role',
  }
  if (p.includes('winger') || p.includes('wide') || p.includes('lw') || p.includes('rw')) return {
    role: 'Winger',
    technical: '1v1 dribbling, crossing technique, cutting inside and finishing, change of pace, first touch at speed',
    tactical: 'starting wide and arriving central, isolating defenders 1v1, tracking back to support the fullback, recognizing when to commit vs. recycle',
    composure: 'composed in 1v1 isolations, doesn\'t panic when doubled, picks the right end-product (cross, shot, cut-back)',
    positionPlay: 'do they actually beat their fullback consistently and produce end-product? Or run into trouble?',
    ignore: 'do NOT expect midfield-level retention or central #10 creativity. Beating the fullback is the job',
  }
  if (p.includes('striker') || p.includes('forward') || p.includes('st') || p.includes('cf')) return {
    role: 'Striker / Forward',
    technical: 'finishing technique (one-touch, far post, headers), hold-up play with back to goal, first touch on long balls, link-up touches',
    tactical: 'movement off the ball (timing offside line, near-post runs, dropping in), pressing from the front, run selection, when to peel vs. attack the cross',
    composure: 'composed in front of goal, doesn\'t rush finishes, holds the ball calmly with back to goal, decisive in the box',
    positionPlay: 'are they a true 9 — finishing AND linking AND pressing — or one-dimensional?',
    ignore: 'do NOT score them on tracking back to defend or central playmaking. Goals + movement + hold-up matter most',
  }
  return {
    role: position,
    technical: 'first touch, passing weight and accuracy, finishing/shooting if applicable, dribbling under pressure',
    tactical: 'decision-making, off-ball movement, scanning, positional discipline, defensive reads',
    composure: 'first touch when pressed, calm decisions in tight spaces, body language in challenges',
    positionPlay: `are they doing what a ${position} is supposed to do, or playing it like a different role?`,
    ignore: 'judge them on what their position demands, not what other positions do',
  }
}

interface CachedRating { result: Record<string, unknown>; cachedAt: number }
const videoCache = new Map<string, CachedRating>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

// ───────────────────────────────────────────────────────────────────────────

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
      const isFullHit = scraped.status === 'success' && scraped.coachEmail
      return res.json({
        coachName: scraped.coachName,
        coachEmail: isFullHit ? scraped.coachEmail : '',
        confidence: isFullHit ? 'high' : 'low',
        source: isFullHit ? 'scraped' : 'scraped-partial',
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
    const { profile } = req.body as { profile: AthleteProfile }
    const schools = matchSchools(profile)
    res.json({ schools })
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
    // rating output shape changes so old cached entries (e.g. athleticism →
    // composure migration) cannot be returned with the wrong shape.
    const cacheKey = `v2::${videoUrl}::${profile.position}::${profile.targetDivision}`
    const cached = videoCache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return res.json(cached.result)
    }

    // Capture actual video frames via Puppeteer
    const { frames, duration, title } = await captureYouTubeFrames(videoUrl)

    if (!frames || frames.length === 0) {
      console.error('[video] puppeteer returned 0 frames for', videoUrl)
      return res.status(500).json({ error: 'Could not capture frames from this video — make sure it is a public, non-age-restricted YouTube video and try again.' })
    }

    const posSkills = getPositionSkills(profile.position)
    const rubric = getPositionRubric(profile.position)

    const divisionNote =
      profile.targetDivision === 'D1' ? 'D1: coaches skip videos in 10 seconds — opening clip must be elite. Stat overlay required. Club > HS footage.' :
      profile.targetDivision === 'D2' || profile.targetDivision === 'D3' ? `${profile.targetDivision}: show fit + versatility, not just goals. Academic info on overlay is a plus.` :
      'NAIA/JUCO: show physical and tactical readiness for immediate playing time.'

    const prompt = `You are an experienced college soccer recruiting coordinator with 15+ years of evaluating player tape. You have ${frames.length} screenshots labeled with their timestamps, spanning the ENTIRE video.

Your job is to evaluate THE PLAYER — their position, how they play, and the quality of their play. You are NOT a video producer. Do not grade the editing, the camera angle, the title card, the music, the stat overlay, or the video length. Coaches care about the soccer; that is what you are here to assess.

Athlete being evaluated:
- Position: ${profile.position}
- Target division: ${profile.targetDivision}
- Grad year: ${profile.gradYear}
- Club: ${profile.clubTeam}${profile.clubLeague ? ` (${profile.clubLeague})` : ''}
- Self-reported stats: ${profile.goals ?? '?'}G / ${profile.assists ?? '?'}A

WHAT TO IGNORE (do not mention, do not score, do not include in improvements):
- Camera angle (high-angle / drone / sideline / Veo / Trace / Pixellot — all fine)
- Production polish (editing, pacing, music, transitions, title card)
- Whether there's a stat overlay
- Video length

IDENTIFY THE PLAYER YOURSELF: assume the recruit is whoever is consistently the focus of the action across clips. Pick them out by play pattern. Do NOT score, score-down, or center your evaluation on whether they are circled.

WHAT TO EVALUATE — soccer only:
You are watching the player work. Across the full set of frames (earliest to latest), pick out the recruit by who is consistently at the center of the action. Then judge their soccer.

Frame of reference — what ${profile.targetDivision} coaches expect from a ${profile.position}: ${posSkills}

POSITION-SPECIFIC LENS — this is critical:
You are evaluating a ${rubric.role}. Score them ONLY against what their position demands. Do NOT score them against a generic outfield checklist.
- For this role, IGNORE: ${rubric.ignore}
- Do not penalize a ${rubric.role} for not doing things outside their job description. A center back without 1v1 dribbling is not a weakness; a striker without recovery runs is not a weakness.

SCORING — every score is a 1–10 INTEGER on this scale, calibrated to ${profile.targetDivision} level:
  1 = wrong level entirely for ${profile.targetDivision}
  2 = well below ${profile.targetDivision}
  3 = clearly below ${profile.targetDivision}
  4 = somewhat below ${profile.targetDivision}
  5 = on the edge of ${profile.targetDivision} — borderline
  6 = competitive at ${profile.targetDivision} — could fit a roster
  7 = solid ${profile.targetDivision} level
  8 = above ${profile.targetDivision} — would be a contributor
  9 = well above ${profile.targetDivision} — impact starter
  10 = elite for ${profile.targetDivision} — could play higher

CALIBRATION NOTE — be fair, not harsh:
Players who put a highlight tape together are usually at least near their target level. Default reasonable when evidence is mixed. If you're genuinely torn between two adjacent scores (e.g. 6 vs 7), lean to the HIGHER one unless you saw a specific weakness on tape that justifies the lower number.

ANTI-HEDGE RULE — read carefully:
You are not allowed to default to 5 or 6 just because you're uncertain. Every score must be backed by a specific observation. If you find yourself wanting to give a 5, decide between 5 and 6 by asking: do they look closer to "borderline" or "could compete"? Pick. The full scale exists for a reason — most players land somewhere between 5 and 8.

You score every dimension independently. Every dimension uses different evidence — technique vs. decision-making vs. composure vs. role-fit vs. level — so the scores almost never line up. A player can be technical=8 / composure=5. That's normal.

HARD DIVERGENCE CONSTRAINT — non-negotiable:
The five sub-scores (technicalScore, tacticalScore, composureScore, positionPlayScore, divisionFitScore) MUST span a range of at least 3 (max minus min ≥ 3). Identical scores across all five, or all five within ±1 of each other, means you hedged and the output is rejected.
After you draft your five scores, perform this CHECK:
  1. Find max sub-score and min sub-score.
  2. If max − min < 3, you hedged. Identify the player's STRONGEST visible trait and raise that score by 1–2. Identify their WEAKEST visible trait and lower that score by 1–2. Re-check.
  3. Do not "split the difference" — pick a clear strongest and clear weakest based on what you actually saw in the frames.
Output only AFTER the range constraint is satisfied.

Five evaluation dimensions — for EACH, describe what you see and assign a 1–10 score. Each dimension below is REWRITTEN for a ${rubric.role}. Use these definitions, not generic ones:

1. technical (for a ${rubric.role}) — ${rubric.technical}. Is the technique clean or scrappy?

2. tactical (for a ${rubric.role}) — ${rubric.tactical}. Do they understand the game from this position?

3. composure (for a ${rubric.role}) — ${rubric.composure}. This is visible at any camera angle, unlike pure athletic traits like top-end pace which a highlight tape rarely shows reliably. Do NOT score-down for unseen athletic traits — judge what is actually on tape.

4. positionPlay (for a ${rubric.role}) — ${rubric.positionPlay} Frame of reference: ${posSkills}.

5. divisionFit — direct level assessment. Do they look like a ${profile.targetDivision} ${rubric.role}, higher, or lower?

${divisionNote}

ANTI-MISTAKE RULES:
- Do NOT make markers/circles part of any of the 5 dimensions or sub-scores.
- Do NOT comment on title cards, stat overlays, music, editing, or video length.
- The 5 dimensions and their scores are about SOCCER only.

IMPROVEMENTS LIST:
- 1–2 items must be soccer-specific: a part of their game to work on, a type of clip to add, a weakness to address.
- Player-identifier exception: if you saw NO circle/arrow/spotlight/glow/marker on any player in any frame, you MAY include — as a LATER item, never #1 — "Add a circle or arrow on yourself in each clip so coaches can find you immediately." If you saw any marker, don't mention markers.
- Do not recommend "shorten the video," "add a stat overlay," "add a title card," or any other production polish.

PROCESS — do this internally, but DO NOT write it out:
Walk through every frame in time order. Identify the recruit by recurring action focus. Note what they did, the technique, the decisions, and the physical traits shown. Then score each dimension on the 1–10 scale above. The server will overwrite the overall "score" field with the rounded average of your 5 sub-scores, so still fill it in but don't agonize over it.

OUTPUT — your reply must be ONLY the JSON object below, with no preamble, no analysis, no markdown fences, no explanation. Start your reply with the opening "{" and end with the closing "}". Anything else and the parser fails.

JSON shape (return this exact structure):
{"score":<integer 1-10 — your overall, will be overwritten by server with avg of sub-scores>,"summary":"<2-3 sentences — honest verdict on the ${rubric.role}'s level relative to ${profile.targetDivision}, with at least one specific observation referencing a timestamp>","technical":"<technique judged for a ${rubric.role}, with timestamps>","technicalScore":<integer 1-10>,"tactical":"<tactical understanding judged for a ${rubric.role}, with timestamps>","tacticalScore":<integer 1-10>,"composure":"<poise under pressure judged for a ${rubric.role}>","composureScore":<integer 1-10>,"positionPlay":"<how they play ${rubric.role} specifically>","positionPlayScore":<integer 1-10>,"divisionFit":"<direct assessment: ${profile.targetDivision} ${rubric.role} caliber, above, or below>","divisionFitScore":<integer 1-10>,"improvements":["<#1 ${rubric.role}-specific>","<#2 ${rubric.role}-specific>","<#3 ${rubric.role}-specific or marker note>"]}`

    const imageInputs = frames.map(f => ({
      data: f.data,
      mediaType: 'image/jpeg',
      label: `[Screenshot at ${Math.floor(f.timestamp / 60)}:${String(Math.floor(f.timestamp % 60)).padStart(2, '0')}]`,
    }))

    let text = await askWithImages(prompt, imageInputs, 3500)
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
    const subKeys = ['technicalScore', 'tacticalScore', 'composureScore', 'positionPlayScore', 'divisionFitScore'] as const
    const subs = subKeys.map(k => Number(result[k])).filter(n => Number.isFinite(n) && n >= 1 && n <= 10)
    if (subs.length >= 3) {
      const avg = subs.reduce((a, b) => a + b, 0) / subs.length
      result.score = Math.max(1, Math.min(10, Math.round(avg)))
    } else {
      const overall = Number(result.score)
      result.score = Number.isFinite(overall) && overall >= 1 && overall <= 10 ? Math.round(overall) : 5
    }
    // Backfill any missing sub-score with the overall so the UI doesn't show NaN.
    for (const k of subKeys) {
      const v = Number(result[k])
      result[k] = Number.isFinite(v) && v >= 1 && v <= 10 ? Math.round(v) : result.score
    }

    // Attach screenshots and metadata so the client can display them
    result.screenshots = frames
    result.duration = duration
    result.videoTitle = title

    videoCache.set(cacheKey, { result, cachedAt: Date.now() })
    res.json(result)
  } catch (e) {
    console.error('[video]', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to analyze video' })
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

router.post('/roster-intel', async (req, res) => {
  try {
    const { gender, division, athletePosition } = req.body as { gender: 'mens' | 'womens'; division: string; athletePosition: string }

    let programs = (rosterData as RosterProgram[]).filter((p) => p.gender === gender)
    if (division !== 'all') programs = programs.filter((p) => p.division === division)

    if (athletePosition) {
      const pos = athletePosition.toLowerCase()
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

    res.json({ programs: programs.slice(0, 20), positionSummary })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/chat', async (req, res) => {
  try {
    const { messages, profile } = req.body as {
      messages: { role: 'user' | 'assistant'; content: string }[]
      profile?: AthleteProfile
    }
    const profileContext = profile
      ? `\n\nAthlete context: ${profile.name}, ${profile.position}, Class of ${profile.gradYear}, ${profile.clubTeam} (${profile.clubLeague}), ${profile.goals}G/${profile.assists}A, GPA ${profile.gpa}, targeting ${profile.targetDivision}.`
      : ''
    const reply = await chat(messages, profileContext, 500)
    res.json({ reply })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

export default router
