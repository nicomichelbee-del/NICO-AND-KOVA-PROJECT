import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import type { AthleteProfile, Division, RosterProgram, PositionNeed, SchoolRecord } from '../../client/src/types/index'
import { matchSchools } from '../lib/schoolMatcher'
import rosterData from '../data/rosterPrograms.json'
import schoolsData from '../data/schools.json'

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
- Stats: ${profile.goals}G / ${profile.assists}A (${profile.season})
- GPA: ${profile.gpa}
- Major: ${profile.intendedMajor}
- Highlight: ${profile.highlightUrl}

Must include: grad year, position, club+league, stats, GPA, major, highlight link, why this school, clear ask (visit/camp/call).

Respond with JSON only: { "subject": "...", "body": "..." }`, 800)
    res.json(parseJSON(text, {}))
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/find-coach', async (req, res) => {
  try {
    const { school, division, gender } = req.body as { school: string; division: Division; gender: 'mens' | 'womens' }
    const genderLabel = gender === 'womens' ? "Women's" : "Men's"
    const text = await ask(`Find the current head coach for the ${genderLabel} soccer program at ${school} (${division}).

Return JSON only: { "coachName": "First Last", "coachEmail": "email@school.edu", "confidence": "high" }

Rules:
- coachEmail should follow the school's standard email format
- Set confidence "high" only if you are certain this is current (2024-2025 season) information
- Set confidence "low" if you are unsure or this may be outdated
- If unknown, return { "coachName": "Head Coach", "coachEmail": "", "confidence": "low" }
- Never fabricate a name you are not confident about`, 300)
    res.json(parseJSON(text, { coachName: 'Head Coach', coachEmail: '', confidence: 'low' }))
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
      schools: { name: string; division: string }[]
    }
    const schoolList = schools.map((s) => `${s.name} (${s.division})`).join(', ')
    const text = await ask(`Find ID camps for a ${profile.position} (Class ${profile.gradYear}, targeting ${profile.targetDivision}) at these schools: ${schoolList || 'top programs in their division'}.

Return 4-6 camps across these schools. Include realistic camp details.

Respond with JSON only: { "camps": [{ "id": "uuid", "school": "...", "division": "D1", "campName": "...", "date": "June 14-16, 2026", "location": "City, ST", "cost": "$250", "url": "https://example.edu/soccercamp", "coaches": [{ "name": "Coach Smith", "title": "Head Coach" }] }] }`, 1200)
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

export default router
