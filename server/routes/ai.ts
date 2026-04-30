import { Router } from 'express'
import type { AthleteProfile, Division, RosterProgram, PositionNeed, SchoolRecord } from '../../client/src/types/index'
import { matchSchools, listSchools } from '../lib/schoolMatcher'
import { getProgramIntel } from '../lib/programIntel'
import { ask, parseJSON, rateCoachReply } from '../lib/aiClient'
import rosterData from '../data/rosterPrograms.json'

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

router.get('/schools-directory', (_req, res) => {
  try {
    res.json({ schools: listSchools() })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
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
