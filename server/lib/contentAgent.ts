/**
 * KickrIQ daily content agent.
 *
 * Generates ready-to-post drafts for TikTok and Instagram Reels promoting
 * KickrIQ to high school soccer players and their parents. Each draft includes:
 *   - Hook (first 1.5 sec)
 *   - Full script with shot list
 *   - On-screen text overlays w/ timing
 *   - Suggested trending sound (matched from server/data/trendingSounds.json)
 *   - Caption + hashtags for both TikTok and Instagram
 *   - Posting notes (best time, CTA)
 *
 * Important: this agent does NOT auto-post. TikTok and Instagram do not allow
 * third-party tools to attach platform-licensed trending audio (it must be
 * picked inside the native app). The agent prepares everything, you tap-publish
 * from your phone in ~10 seconds per post.
 */

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'

const MODEL = 'claude-haiku-4-5'

export interface TrendingSound {
  id: string
  platform: 'tiktok' | 'instagram' | 'both'
  title: string
  vibe: string
  bestFor: string[]
  exampleTrack: string
  active: boolean
}

export interface ContentDraft {
  draftNumber: number
  format: 'tiktok' | 'reel' | 'both'
  angle: string
  audience: 'athlete' | 'parent' | 'both'
  hook: string
  script: ScriptBeat[]
  onScreenText: TextOverlay[]
  shotList: string[]
  suggestedSound: {
    soundId: string
    soundTitle: string
    whyThisSound: string
  }
  captions: {
    tiktok: string
    instagram: string
  }
  hashtags: {
    tiktok: string[]
    instagram: string[]
  }
  postingNotes: {
    bestTime: string
    cta: string
    coverFrameAdvice: string
  }
}

export interface ScriptBeat {
  timeSec: string
  visual: string
  voiceover: string | null
}

export interface TextOverlay {
  timeSec: string
  text: string
  position: 'top' | 'middle' | 'bottom'
}

const PERSONA = `You are the head of growth marketing for KickrIQ, an AI-powered college soccer recruitment counselor.
KickrIQ helps high school soccer players (grades 9-12) get recruited to college teams (D1, D2, D3, NAIA, JUCO).
Core features: athlete profile builder, school matcher, AI coach email generator, outreach tracker, highlight video rater.
Pricing: Free (3 emails, 5 matches), Pro $19/mo (unlimited + tracker + video rater), Family $29/mo (Pro + parent dashboard).

You write short-form video content for TikTok and Instagram Reels that:
- Hooks teen soccer players or their parents in the first 1.5 seconds
- Speaks like a real recruiting expert who has been there — never corporate, never preachy
- Surfaces a real recruiting pain point (rejection, no responses, late starts, D1 dreams vs reality, parent stress)
- Pays it off with a specific KickrIQ capability — never a generic "use our app"
- Ends with a clear, soft CTA (link in bio, comment a position, etc.)

Tone: confident, direct, soccer-fluent. Use real recruiting vocabulary (ID camps, club > HS for D1, NCAA Eligibility Center, official visit, verbal commit). Avoid hype-bro energy and avoid corporate jargon.`

function loadSounds(): TrendingSound[] {
  const file = path.join(__dirname, '..', 'data', 'trendingSounds.json')
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'))
  return (raw.sounds as TrendingSound[]).filter((s) => s.active)
}

function buildPrompt(numDrafts: number, sounds: TrendingSound[], focusFeature?: string): string {
  const soundLines = sounds
    .map((s) => `  - ${s.id} | ${s.platform} | ${s.vibe} | best for: ${s.bestFor.join(', ')}`)
    .join('\n')

  const focusLine = focusFeature
    ? `\nFOCUS: This batch should center on "${focusFeature}" as the KickrIQ feature payoff.\n`
    : '\nVary the KickrIQ feature across drafts (school matcher, video rater, coach emails, outreach tracker, profile builder). Do not repeat the same feature twice in this batch.\n'

  return `Generate ${numDrafts} ready-to-post short-form video drafts for KickrIQ.

Available trending sound types you may match to (pick by id):
${soundLines}
${focusLine}
For EACH draft, return a JSON object with these exact keys:
{
  "draftNumber": 1,
  "format": "tiktok" | "reel" | "both",
  "angle": "one-line summary of the creative angle",
  "audience": "athlete" | "parent" | "both",
  "hook": "exact words spoken or shown in first 1.5 seconds — must stop a thumb",
  "script": [
    { "timeSec": "0-1.5", "visual": "what the camera shows", "voiceover": "exact words or null if no VO" }
    // 4-7 beats covering 0-30 seconds (or 0-60 max)
  ],
  "onScreenText": [
    { "timeSec": "0-3", "text": "exact text on screen", "position": "top" | "middle" | "bottom" }
    // 2-5 overlays
  ],
  "shotList": [
    "specific clip the user needs to film or pull (be concrete: 'phone screen recording of school matcher returning 5 schools', 'B-roll of athlete training at sunset', etc.)"
  ],
  "suggestedSound": {
    "soundId": "must match one of the available ids exactly",
    "soundTitle": "human-readable",
    "whyThisSound": "1 sentence on why this sound fits"
  },
  "captions": {
    "tiktok": "TikTok caption — punchy, lowercase ok, can be longer (~150 chars), include CTA",
    "instagram": "Instagram caption — slightly more polished, can include line breaks, 1-2 line hook + CTA"
  },
  "hashtags": {
    "tiktok": ["5-8 hashtags, mix broad (#soccer #college) and niche (#collegesoccer #recruiting #d1soccer #highschoolsoccer)"],
    "instagram": ["8-15 hashtags including some niche club/academy tags"]
  },
  "postingNotes": {
    "bestTime": "e.g. 'Tue-Thu 7-9pm ET' — when target audience is on the app",
    "cta": "the in-video or in-caption call to action",
    "coverFrameAdvice": "which frame to set as cover so it stops scrolling on profile grid"
  }
}

Return ONLY a JSON array of ${numDrafts} draft objects. No markdown, no commentary, no code fences.

Constraints:
- The hook MUST be specific to soccer recruiting, not generic motivation
- At least one draft should target the parent audience (parents pay for Family tier)
- Scripts should hit the KickrIQ payoff naturally, not feel like an ad until the last 5 seconds
- On-screen text must be readable: <8 words per overlay, big sans-serif assumed
- shotList items must be filmable in a teenager's bedroom or at a soccer field — no studio shoots`
}

function extractJsonArray(text: string): unknown {
  // Strip code fences if model added them despite instructions
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  // Find first '[' and last ']'
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1) {
    throw new Error('Model response did not contain a JSON array')
  }
  return JSON.parse(cleaned.slice(start, end + 1))
}

export async function generateDrafts(opts: {
  count?: number
  focusFeature?: string
} = {}): Promise<ContentDraft[]> {
  const count = opts.count ?? 3
  const sounds = loadSounds()
  if (sounds.length === 0) {
    throw new Error('No active trending sounds in trendingSounds.json — add some before running')
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set in environment')
  }

  const client = new Anthropic({ apiKey })
  const prompt = buildPrompt(count, sounds, opts.focusFeature)

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: PERSONA,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Expected text response from Claude')

  const parsed = extractJsonArray(block.text) as ContentDraft[]
  // Validate sound ids resolve
  const validIds = new Set(sounds.map((s) => s.id))
  for (const draft of parsed) {
    if (!validIds.has(draft.suggestedSound?.soundId)) {
      console.warn(`[contentAgent] draft ${draft.draftNumber} suggested unknown sound ${draft.suggestedSound?.soundId} — keeping anyway`)
    }
  }
  return parsed
}

export function renderDraftMarkdown(draft: ContentDraft, sound: TrendingSound | undefined): string {
  const lines: string[] = []
  lines.push(`# Draft ${draft.draftNumber} — ${draft.angle}`)
  lines.push('')
  lines.push(`**Format:** ${draft.format} · **Audience:** ${draft.audience}`)
  lines.push('')
  lines.push(`## Hook (0-1.5s)`)
  lines.push(`> ${draft.hook}`)
  lines.push('')
  lines.push(`## Suggested Sound`)
  if (sound) {
    lines.push(`- **${sound.title}** (\`${sound.id}\`)`)
    lines.push(`- Vibe: ${sound.vibe}`)
    lines.push(`- Example to search in app: ${sound.exampleTrack}`)
  } else {
    lines.push(`- **${draft.suggestedSound.soundTitle}** (\`${draft.suggestedSound.soundId}\`)`)
  }
  lines.push(`- Why: ${draft.suggestedSound.whyThisSound}`)
  lines.push('')
  lines.push(`## Script`)
  for (const beat of draft.script) {
    lines.push(`- **${beat.timeSec}s** — ${beat.visual}`)
    if (beat.voiceover) lines.push(`  - VO: "${beat.voiceover}"`)
  }
  lines.push('')
  lines.push(`## On-screen Text`)
  for (const t of draft.onScreenText) {
    lines.push(`- **${t.timeSec}s** [${t.position}] "${t.text}"`)
  }
  lines.push('')
  lines.push(`## Shot list (what to film/capture)`)
  for (const s of draft.shotList) lines.push(`- [ ] ${s}`)
  lines.push('')
  lines.push(`## Captions`)
  lines.push(`### TikTok`)
  lines.push(draft.captions.tiktok)
  lines.push('')
  lines.push(`Hashtags: ${draft.hashtags.tiktok.map((h) => h.startsWith('#') ? h : `#${h}`).join(' ')}`)
  lines.push('')
  lines.push(`### Instagram`)
  lines.push(draft.captions.instagram)
  lines.push('')
  lines.push(`Hashtags: ${draft.hashtags.instagram.map((h) => h.startsWith('#') ? h : `#${h}`).join(' ')}`)
  lines.push('')
  lines.push(`## Posting notes`)
  lines.push(`- **Best time:** ${draft.postingNotes.bestTime}`)
  lines.push(`- **CTA:** ${draft.postingNotes.cta}`)
  lines.push(`- **Cover frame:** ${draft.postingNotes.coverFrameAdvice}`)
  lines.push('')
  return lines.join('\n')
}
