import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

const PERSONA = `You are a college soccer recruitment counselor with 15+ years of experience.
Tone: encouraging, direct, and soccer-specific. Never generic. Tailor everything to soccer positions, stats, and recruiting culture.`

export async function ask(prompt: string, maxTokens = 1024): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: maxTokens,
    system: PERSONA,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return block.text
}

export function parseJSON<T>(text: string, fallback: T): T {
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

export async function rateCoachReply(
  school: string,
  coachName: string,
  replyText: string,
): Promise<{ rating: string; confidence: number; signals: string[]; nextAction: string }> {
  const text = await ask(
    `Analyze this coach reply and rate their interest level in the athlete.

School: ${school}
Coach: ${coachName}
Reply:
${replyText}

Respond with JSON only: { "rating": "hot|warm|cold|not_interested", "confidence": 85, "signals": ["invited to visit", "asked for film"], "nextAction": "Schedule a campus visit — they want to meet you in person." }

Rating guide: hot=very interested (visit invite, scholarship mention, follow-up questions), warm=interested but cautious (generic positive reply, asked one question), cold=polite decline or noncommittal, not_interested=explicit no.`,
    512,
  )
  return parseJSON(text, { rating: 'cold', confidence: 50, signals: [], nextAction: 'Send a follow-up in two weeks.' })
}
