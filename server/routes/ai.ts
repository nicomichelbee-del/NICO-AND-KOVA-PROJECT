import { Router } from 'express'
import type { AthleteProfile, Division, RosterProgram, PositionNeed, SchoolRecord } from '../../client/src/types/index'
import { matchSchools, listSchools } from '../lib/schoolMatcher'
import { getProgramIntel } from '../lib/programIntel'
import { getScrapedCoach } from '../lib/scrapedCoaches'
import { ask, chat, parseJSON, rateCoachReply } from '../lib/aiClient'
import rosterData from '../data/rosterPrograms.json'
import idEventsData from '../data/idEvents.json'
import idCampsData from '../data/idCamps.json'

const router = Router()

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
    const scraped = getScrapedCoach(school, gender)
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
    const text = await ask(`Rate this athlete's highlight video for ${profile.targetDivision} recruiting.
Video: ${videoUrl}
Athlete: ${profile.position}, ${profile.gradYear} grad, ${profile.clubTeam}

Note: You cannot watch the video. Provide best-practice feedback for a ${profile.position} targeting ${profile.targetDivision}.

Respond with JSON only: { "score": 7, "summary": "...", "openingClip": "...", "clipVariety": "...", "videoLength": "...", "production": "...", "statOverlay": "...", "positionSkills": "...", "improvements": ["...", "...", "..."] }`, 800)
    res.json(parseJSON(text, {}))
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/followup', async (req, res) => {
  try {
    const { profile, context, type } = req.body as { profile: AthleteProfile; context: string; type: 'followup' | 'thankyou' | 'answer' }
    const typeInstruction = type === 'followup' ? 'a follow-up email to a coach who has not responded in 2 weeks'
      : type === 'thankyou' ? 'a thank-you email after a campus visit or call'
      : 'a response to a coach question or inquiry'
    const text = await ask(`Write ${typeInstruction} for: ${profile.name}, ${profile.position}, Class of ${profile.gradYear}, ${profile.clubTeam}. Target: ${profile.targetDivision}.
Context: ${context}

Respond with JSON only: { "body": "..." }`, 450)
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
