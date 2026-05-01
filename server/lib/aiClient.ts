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
    // Try raw parse first (handles both objects and arrays)
    try { return JSON.parse(cleaned) as T } catch { /* fall through */ }
    // Try extracting an array
    const arrMatch = cleaned.match(/\[[\s\S]*\]/)
    if (arrMatch) { try { return JSON.parse(arrMatch[0]) as T } catch { /* fall through */ } }
    // Try extracting an object
    const objMatch = cleaned.match(/\{[\s\S]*\}/)
    if (objMatch) { try { return JSON.parse(objMatch[0]) as T } catch { /* fall through */ } }
    return fallback
  } catch {
    return fallback
  }
}

export interface CoachEmailCheckResult {
  threadId: string
  isReal: boolean
  note: string
}

// Only called for UNCERTAIN cases — hard accepts/rejects handled deterministically first.
// Compact input (snippets truncated to 90 chars) keeps the batch token-efficient.
export async function filterRealCoachEmails(
  candidates: { threadId: string; senderEmail: string; subject: string; snippet: string }[]
): Promise<CoachEmailCheckResult[]> {
  if (candidates.length === 0) return []
  const compact = candidates.map((c) => ({
    t: c.threadId,
    from: c.senderEmail,
    subj: c.subject,
    preview: c.snippet.slice(0, 90),
  }))
  const text = await ask(
    `Soccer recruit inbox. For each: real human at a college (coach/staff)?\nINCLUDE any reply even generic. EXCLUDE platforms (NCSA/BeRecruited/etc), auto-notifications, mass blasts.\n${JSON.stringify(compact)}\nJSON only: [{"threadId":"..","isReal":true,"note":"one sentence"}]`,
    Math.min(150 + candidates.length * 45, 1800),
  )
  const fallback: CoachEmailCheckResult[] = candidates.map((c) => ({ threadId: c.threadId, isReal: false, note: '' }))
  return parseJSON<CoachEmailCheckResult[]>(text, fallback)
}

export interface BatchEmailRating {
  threadId: string
  score: number          // 1–10 interest
  rating: 'hot' | 'warm' | 'cold' | 'not_interested'
  interestLevel: string
  genuineness: number    // 1–10
  ratingNote: string     // one-sentence summary of the email
  nextAction: string
}

// ONE Claude call rates every confirmed coach email in the scan.
// Uses the coach message's own snippet for accurate analysis.
export async function batchRateCoachEmails(
  emails: { threadId: string; senderName: string; subject: string; snippet: string }[]
): Promise<BatchEmailRating[]> {
  if (emails.length === 0) return []
  const compact = emails.map((e) => ({
    t: e.threadId,
    from: e.senderName,
    subj: e.subject,
    msg: e.snippet.slice(0, 150),
  }))
  const text = await ask(
    `HS soccer recruit inbox. Rate each coach email. All fields required per item.
score 1-10: 10=scholarship/visit offered,8-9=strong interest,6-7=genuine interest,4-5=mild/form letter,2-3=polite pass,1=rejection
genuineness 1-10: 10=knows athlete specifically,7-9=personal,5-6=some personalization,3-4=mostly template,1-2=mass blast
rating: hot(8-10)/warm(5-7)/cold(3-4)/not_interested(1-2)
interestLevel: "Actively Recruiting"|"Very Interested"|"High Interest"|"Moderate Interest"|"Mild Interest"|"Low Interest"|"Not Interested"
ratingNote: one sentence describing what the coach said
nextAction: one sentence telling the athlete what to do next
${JSON.stringify(compact)}
JSON only:[{"threadId":"..","score":7,"rating":"warm","interestLevel":"High Interest","genuineness":6,"ratingNote":"..","nextAction":".."}]`,
    Math.min(250 + emails.length * 50, 2500),
  )
  const fallback: BatchEmailRating[] = emails.map((e) => ({
    threadId: e.threadId, score: 5, rating: 'cold', interestLevel: 'Mild Interest',
    genuineness: 5, ratingNote: '', nextAction: 'Send a follow-up within two weeks.',
  }))
  return parseJSON<BatchEmailRating[]>(text, fallback)
}

export interface CoachReplyAnalysis {
  rating: 'hot' | 'warm' | 'cold' | 'not_interested'
  score: number          // 1–10 overall interest score
  interestLevel: string  // e.g. "Very Interested", "Mildly Interested"
  confidence: number     // 0–100
  signals: string[]
  nextAction: string
  genuineness: number        // 1–10 how personal/genuine vs. form-letter
  genuinenessReason: string  // one sentence explaining the genuineness score
  scoreReason: string        // one sentence explaining the interest score
}

export async function rateCoachReply(
  school: string,
  coachName: string,
  replyText: string,
): Promise<CoachReplyAnalysis> {
  const text = await ask(
    `Analyze this coach reply for a high school soccer recruit and return a detailed JSON assessment.

School: ${school}
Coach: ${coachName}
Reply:
${replyText}

Return JSON only (no markdown):
{
  "rating": "hot|warm|cold|not_interested",
  "score": 7,
  "interestLevel": "Very Interested",
  "confidence": 85,
  "signals": ["invited to visit", "asked for film"],
  "nextAction": "Schedule a campus visit — they want to meet you in person.",
  "genuineness": 8,
  "genuinenessReason": "Coach referenced specific stats and used the athlete's first name, not a form letter.",
  "scoreReason": "Invited a campus visit and mentioned roster needs — strong buying signals."
}

Scoring guides:
- score 1–10: 1–2=clear rejection, 3–4=polite form letter, 5–6=mildly interested, 7–8=genuinely interested, 9–10=hot pursuit (visit/scholarship mentioned)
- interestLevel: "Not Interested" | "Low Interest" | "Mild Interest" | "Moderate Interest" | "High Interest" | "Very Interested" | "Actively Recruiting"
- rating: hot=9–10 (visit invite, scholarship mention), warm=6–8 (positive, asked questions), cold=3–5 (noncommittal), not_interested=1–2 (explicit no or form rejection)
- genuineness 1–10: 1–3=obvious mass email with no personalization, 4–6=some personalization, 7–9=clearly read the athlete's profile, 10=highly personal and specific`,
    700,
  )
  return parseJSON<CoachReplyAnalysis>(text, {
    rating: 'cold',
    score: 4,
    interestLevel: 'Low Interest',
    confidence: 50,
    signals: [],
    nextAction: 'Send a follow-up in two weeks.',
    genuineness: 4,
    genuinenessReason: 'Unable to parse the reply.',
    scoreReason: 'Unable to parse the reply.',
  })
}
