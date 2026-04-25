import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import type { AthleteProfile, Division } from '../../client/src/types/index'

const router = Router()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = 'claude-sonnet-4-20250514'

const PERSONA = `You are a college soccer recruitment counselor with 15+ years of experience.
Tone: encouraging, direct, and soccer-specific. Never generic. Tailor everything to soccer positions, stats, and recruiting culture.`

router.post('/email', async (req, res) => {
  try {
    const { profile, school, division, coachName } = req.body as {
      profile: AthleteProfile; school: string; division: Division; coachName: string
    }
    const divisionTone =
      division === 'D1' ? 'professional, concise, and stat-heavy. Club team matters more than high school.'
      : division === 'D2' || division === 'D3' ? 'warm and emphasizing both athletic and academic fit.'
      : 'emphasizing immediate playing time potential and roster fit.'

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `${PERSONA}\n\nWrite a cold outreach email from the athlete below to ${coachName} at ${school} (${division}).\nTone: ${divisionTone}\n\nAthlete:\n- Name: ${profile.name}\n- Grad Year: ${profile.gradYear}\n- Position: ${profile.position}\n- Club: ${profile.clubTeam} (${profile.clubLeague})\n- Stats: ${profile.goals}G / ${profile.assists}A (${profile.season})\n- GPA: ${profile.gpa}\n- Major: ${profile.intendedMajor}\n- Highlight: ${profile.highlightUrl}\n\nMust include: grad year, position, club+league, stats, GPA, major, highlight link, why this school, clear ask (visit/camp/call).\n\nRespond with JSON: { "subject": "...", "body": "..." }`,
      }],
    })
    const text = (message.content[0] as { text: string }).text
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
    res.json(json)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/schools', async (req, res) => {
  try {
    const { profile } = req.body as { profile: AthleteProfile }
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `${PERSONA}\n\nGenerate 12 college soccer programs: 4 reach, 5 target, 3 safety for this athlete targeting ${profile.targetDivision}.\n\nAthlete: ${profile.position}, GPA ${profile.gpa}, ${profile.goals}G/${profile.assists}A, Club: ${profile.clubTeam}, Division: ${profile.targetDivision}, Location: ${profile.locationPreference}, Size: ${profile.sizePreference}\n\nRespond with JSON: { "schools": [{ "id": "uuid", "name": "...", "division": "D1|D2|D3|NAIA|JUCO", "location": "City, ST", "enrollment": 15000, "conferece": "...", "coachName": "...", "coachEmail": "coach@school.edu", "category": "reach|target|safety", "matchScore": 87, "notes": "one sentence on fit" }] }`,
      }],
    })
    const text = (message.content[0] as { text: string }).text
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{"schools":[]}')
    res.json(json)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/video', async (req, res) => {
  try {
    const { videoUrl, profile } = req.body as { videoUrl: string; profile: AthleteProfile }
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `${PERSONA}\n\nRate this athlete's highlight video for ${profile.targetDivision} recruiting.\nVideo: ${videoUrl}\nAthlete: ${profile.position}, ${profile.gradYear} grad, ${profile.clubTeam}\n\nNote: You cannot watch the video. Provide best-practice feedback for a ${profile.position} targeting ${profile.targetDivision}.\n\nRespond with JSON: { "score": 7, "summary": "...", "openingClip": "...", "clipVariety": "...", "videoLength": "...", "production": "...", "statOverlay": "...", "positionSkills": "...", "improvements": ["...", "...", "..."] }`,
      }],
    })
    const text = (message.content[0] as { text: string }).text
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
    res.json(json)
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
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `${PERSONA}\n\nWrite ${typeInstruction} for: ${profile.name}, ${profile.position}, Class of ${profile.gradYear}, ${profile.clubTeam}. Target: ${profile.targetDivision}.\nContext: ${context}\n\nRespond with JSON: { "body": "..." }`,
      }],
    })
    const text = (message.content[0] as { text: string }).text
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
    res.json(json)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

export default router
