import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import type { AthleteProfile, Division } from '../../client/src/types/index'

const router = Router()

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

const PERSONA = `You are a college soccer recruitment counselor with 15+ years of experience.
Tone: encouraging, direct, and soccer-specific. Never generic. Tailor everything to soccer positions, stats, and recruiting culture.`

async function ask(prompt: string, maxTokens = 1024): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: maxTokens,
    system: PERSONA,
    messages: [{ role: 'user', content: prompt }]
  })
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return block.text
}

function parseJSON<T>(text: string, fallback: T): T {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    try { return JSON.parse(cleaned) as T } catch { /* fall through */ }
    const objMatch = cleaned.match(/\{[\s\S]*\}/)
    if (objMatch) return JSON.parse(objMatch[0]) as T
    return fallback
  } catch {
    return fallback
  }
}

router.post('/email', async (req, res) => {
  try {
    const { profile, school, division, coachName } = req.body as {
      profile: AthleteProfile; school: string; division: Division; coachName: string
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
- Stats: ${profile.goals}G / ${profile.assists}A (${profile.season})
- GPA: ${profile.gpa}
- Major: ${profile.intendedMajor}
- Highlight: ${profile.highlightUrl}

Must include: grad year, position, club+league, stats, GPA, major, highlight link, why this school, clear ask (visit/camp/call).

Respond with JSON only: { "subject": "...", "body": "..." }`, 1500)
    res.json(parseJSON(text, {}))
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/schools', async (req, res) => {
  try {
    const { profile } = req.body as { profile: AthleteProfile }
    const text = await ask(`Match this athlete to 15 real college soccer programs (4 reach, 7 target, 4 safety).

Athlete: ${profile.name}, ${profile.position}, Class of ${profile.gradYear}, GPA ${profile.gpa}, ${profile.goals}G/${profile.assists}A (${profile.season}), Club: ${profile.clubTeam} (${profile.clubLeague}), Major: ${profile.intendedMajor}, Target: ${profile.targetDivision}, Location: ${profile.locationPreference}, Size: ${profile.sizePreference}

Division benchmarks to classify reach/target/safety:
- D1: GPA 3.2+, 15+ goals for forwards, ECNL/MLS Next club
- D2: GPA 2.8+, 10+ goals, strong club
- D3: GPA 2.5+, balanced athlete
- NAIA: GPA 2.0+, immediate impact
- JUCO: Open, stepping stone

REACH = athlete stats below program's typical recruit. TARGET = stats align well. SAFETY = athlete would be recruited immediately.

Return JSON only, no markdown: { "schools": [{ "id": "1", "name": "School Name", "division": "D1", "location": "City, ST", "enrollment": 15000, "conferece": "ACC", "coachName": "Coach Name", "coachEmail": "coach@school.edu", "category": "reach", "matchScore": 85, "notes": "Why reach/target/safety based on their GPA and stats" }] }`, 3000)
    res.json(parseJSON(text, { schools: [] }))
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

Respond with JSON only: { "body": "..." }`, 800)
    res.json(parseJSON(text, {}))
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/rate-response', async (req, res) => {
  try {
    const { school, coachName, text: replyText } = req.body as { school: string; coachName: string; text: string }
    const text = await ask(`Analyze this coach reply and rate their interest level in the athlete.

School: ${school}
Coach: ${coachName}
Reply:
${replyText}

Respond with JSON only: { "rating": "hot|warm|cold|not_interested", "confidence": 85, "signals": ["invited to visit", "asked for film"], "nextAction": "Schedule a campus visit — they want to meet you in person." }

Rating guide: hot=very interested (visit invite, scholarship mention, follow-up questions), warm=interested but cautious (generic positive reply, asked one question), cold=polite decline or noncommittal, not_interested=explicit no.`, 512)
    const json = parseJSON(text, {})
    res.json({ ...json, id: crypto.randomUUID(), school, coachName, date: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/find-camps', async (req, res) => {
  try {
    const { profile, schools } = req.body as {
      profile: AthleteProfile
      schools: import('../../client/src/types/index').School[]
    }
    const schoolList = (schools as { name: string; division: string }[]).map((s) => `${s.name} (${s.division})`).join(', ')
    const text = await ask(`Find ID camps for a ${profile.position} (Class ${profile.gradYear}, targeting ${profile.targetDivision}) at these schools: ${schoolList || 'top programs in their division'}.

Return 6-10 camps across these schools plus 2-3 major open ID camps. Include realistic camp details.

Respond with JSON only: { "camps": [{ "id": "uuid", "school": "...", "division": "D1", "campName": "...", "date": "June 14-16, 2026", "location": "City, ST", "cost": "$250", "url": "https://example.edu/soccercamp", "coaches": [{ "name": "Coach Smith", "title": "Head Coach" }, { "name": "Coach Lee", "title": "Assistant Coach" }] }] }`, 2500)
    res.json(parseJSON(text, { camps: [] }))
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

Respond with JSON only: { "emails": [{ "coachName": "...", "subject": "...", "body": "..." }] }`, 2000)
    res.json(parseJSON(text, { emails: [] }))
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/roster-intel', async (req, res) => {
  try {
    const { gender, division, athletePosition } = req.body as { gender: 'mens' | 'womens'; division: string; athletePosition: string }
    const divFilter = division === 'all' ? 'across D1, D2, D3, NAIA' : division
    const genderLabel = gender === 'mens' ? "Men's" : "Women's"
    const text = await ask(`List 20 ${genderLabel} college soccer programs ${divFilter} that have significant roster openings for the 2025-2026 recruiting cycle due to graduating seniors.

Athlete position: ${athletePosition}

For each program list ALL seniors leaving by specific position (e.g. "Defensive Mid" not just "Midfielder"). Use real programs and real conferences.

Return JSON only, no markdown:
{"programs":[{"school":"UNC Chapel Hill","conference":"ACC","division":"D1","seniorsLeaving":[{"position":"Striker","count":2},{"position":"Center Back","count":1}],"predictedNeed":[{"position":"Striker","level":"High"},{"position":"Center Back","level":"High"}],"coachName":"Anson Dorrance"}],"positionSummary":[{"position":"Striker","demand":"High","schoolCount":14}]}`, 3500)
    res.json(parseJSON(text, { programs: [], positionSummary: [] }))
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

export default router
