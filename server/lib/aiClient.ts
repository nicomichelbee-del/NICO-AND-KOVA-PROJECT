import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

const PERSONA = `You are a college soccer recruitment counselor with 15+ years of experience.
Tone: encouraging, direct, and soccer-specific. Never generic. Tailor everything to soccer positions, stats, and recruiting culture.`

// Automatically retry rate-limit (429) and transient 5xx errors. Anthropic
// returns a `retry-after` header in seconds when known; otherwise we back off
// exponentially. This stops the video rater from failing on the user's screen
// just because the org's per-minute token budget was momentarily exhausted by
// a prior call still in the rolling window.
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (e) {
      attempt++
      const err = e as { status?: number; headers?: Record<string, string>; message?: string }
      const status = err?.status
      const retriable = status === 429 || (typeof status === 'number' && status >= 500 && status <= 599)
      if (!retriable || attempt >= maxAttempts) throw e
      const headerWait = Number(err.headers?.['retry-after'])
      const waitMs = Number.isFinite(headerWait) && headerWait > 0
        ? Math.min(headerWait * 1000, 65_000)
        : Math.min(2_000 * 2 ** (attempt - 1), 30_000)
      console.warn(`[aiClient] ${status} on attempt ${attempt} — waiting ${waitMs}ms before retry`)
      await new Promise((r) => setTimeout(r, waitMs))
    }
  }
}

export async function chat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemAddendum = '',
  maxTokens = 600,
): Promise<string> {
  const response = await withRetry(() => client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: maxTokens,
    system: PERSONA + systemAddendum,
    messages,
  }))
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return block.text
}

export async function ask(prompt: string, maxTokens = 1024): Promise<string> {
  const response = await withRetry(() => client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: maxTokens,
    system: PERSONA,
    messages: [{ role: 'user', content: prompt }],
  }))
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return block.text
}

export async function askWithImage(
  textPrompt: string,
  imageBase64: string,
  mediaType: string,
  maxTokens = 1024,
): Promise<string> {
  return askWithImages(textPrompt, [{ data: imageBase64, mediaType }], maxTokens)
}

export async function askWithImages(
  textPrompt: string,
  images: Array<{ data: string; mediaType: string; label?: string }>,
  maxTokens = 2000,
): Promise<string> {
  type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } }
  type TextBlock = { type: 'text'; text: string }
  const content: Array<ImageBlock | TextBlock> = []

  for (const img of images) {
    if (img.label) content.push({ type: 'text', text: img.label })
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: img.data,
      },
    })
  }
  content.push({ type: 'text', text: textPrompt })

  const response = await withRetry(() => client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: PERSONA,
    messages: [{ role: 'user', content }],
  }))
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
    if (objMatch) {
      try { return JSON.parse(objMatch[0]) as T } catch { /* fall through */ }
      // Last-ditch repair: models sometimes truncate, leave trailing commas, or
      // include smart quotes. Apply a few cheap fixes and retry.
      const repaired = objMatch[0]
        .replace(/[“”]/g, '"')   // smart double quotes → "
        .replace(/[‘’]/g, "'")   // smart single quotes → '
        .replace(/,\s*([}\]])/g, '$1')     // strip trailing commas before } or ]
      try { return JSON.parse(repaired) as T } catch { /* fall through */ }
      // If response was truncated mid-string, try closing it. Find the last
      // complete "key": "value" pair and close out the object.
      const lastComma = repaired.lastIndexOf(',')
      if (lastComma > 0) {
        const truncated = repaired.slice(0, lastComma) + '}'
        try { return JSON.parse(truncated) as T } catch { /* fall through */ }
      }
    }
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
    `Soccer recruit inbox. For each email, decide: was this PERSONALLY sent by a real college coach or assistant coach directly to this athlete?

ACCEPT only if: a real human coach/assistant coach wrote this directly to this specific athlete (even if slightly templated, it must feel directed at them).

REJECT if ANY of these apply:
- Sent from or forwarded through a recruiting platform (NCSA, TopDrawer, BeRecruited, FieldLevel, 247Sports, Rivals, etc.)
- A platform notification ("a coach viewed your profile", "coach wants to connect", "recruiting update")
- A mass/bulk ID camp blast sent to hundreds of athletes with no personal details about THIS athlete
- An automated system notification or auto-generated email
- Spam or promotional email
- The sender does not appear to know who this athlete is specifically (no name, no stats, no club reference)

${JSON.stringify(compact)}
JSON only: [{"threadId":"..","isReal":true,"note":"one sentence"}]`,
    Math.min(200 + candidates.length * 55, 1800),
  )
  const fallback: CoachEmailCheckResult[] = candidates.map((c) => ({ threadId: c.threadId, isReal: false, note: '' }))
  return parseJSON<CoachEmailCheckResult[]>(text, fallback)
}

export interface BatchEmailRating {
  threadId: string
  score: number          // 1–10 interest: forward momentum / concrete asks toward THIS athlete
  rating: 'hot' | 'warm' | 'cold' | 'not_interested'
  interestLevel: string
  genuineness: number    // 1–10 genuineness: personal engagement vs. mass-send quality
  ratingNote: string     // one-sentence summary of the email
  nextAction: string
}

// ONE Claude call rates every confirmed coach email in the scan.
// Uses the coach message's own snippet for accurate analysis.
//
// INTEREST factors: concrete asks (film/transcript/scores/visit/call/questionnaire),
//   proposed next steps or timelines, direct expressions of interest in THIS specific player,
//   prompt and sustained replies over time.
//
// GENUINENESS factors: thread reply depth (back-and-forth > 1 reply = real engagement),
//   uses athlete name/club/stats/position, asks personal follow-up questions about them,
//   conversational vs. boilerplate tone, length+specificity suggesting a human wrote it,
//   head coach's real name in From vs. generic/department address.
export async function batchRateCoachEmails(
  emails: { threadId: string; senderName: string; subject: string; snippet: string; messageCount?: number; isIdCamp?: boolean }[]
): Promise<BatchEmailRating[]> {
  if (emails.length === 0) return []

  // Chunk to keep each Claude call's output well under the model's max_tokens.
  // Rating output is ~120-150 tokens per email (threadId + ratingNote + nextAction);
  // a single 50+ email call truncates and parseJSON falls back to all-cold.
  const CHUNK = 20
  if (emails.length > CHUNK) {
    const chunks: typeof emails[] = []
    for (let i = 0; i < emails.length; i += CHUNK) chunks.push(emails.slice(i, i + CHUNK))
    const results = await Promise.allSettled(chunks.map((c) => batchRateCoachEmails(c)))
    const out: BatchEmailRating[] = []
    for (const r of results) {
      if (r.status === 'fulfilled') out.push(...r.value)
    }
    return out
  }

  const compact = emails.map((e) => ({
    threadId: e.threadId,
    from: e.senderName,
    subj: e.subject,
    msg: e.snippet.slice(0, 400),
    // replies > 1 means real back-and-forth occurred — weight heavily in genuineness
    replies: e.messageCount ?? 1,
    idcamp: e.isIdCamp ?? false,
  }))
  const text = await ask(
    `HS soccer recruit inbox. Rate each email on TWO INDEPENDENT scores. Scores MUST diverge when signals differ. Return one JSON object per email — use the exact threadId from the input.

INTEREST (1-10) — forward momentum: does this coach want THIS athlete on their roster?
  High signals: requests film/transcript/test scores/visit/call/questionnaire; proposes timelines or decision points; directly says they want this player; replies field > 1 (sustained back-and-forth)
  Low signals: informational only, no concrete ask, acknowledgement without next step, single send with no follow-through
  10=scholarship/visit offered  8-9=strong explicit asks+interest  6-7=forward momentum/questionnaire  4-5=mild/no concrete ask  2-3=no forward ask  1=rejection

GENUINENESS (1-10) — personal engagement vs. mass-send quality:
  High signals: replies > 1 (REAL back-and-forth — weight this heavily); uses athlete name/club/stats/position; asks personal follow-up questions specifically about them; conversational not boilerplate; length+specificity suggests a human typed it; head coach's real name in From field
  Low signals: replies=1 (single blast, never engaged again); generic opener (Dear Athlete/Player); no personal details; form-letter language; department/generic address in From
  10=deep personal thread (replies>2, highly specific)  7-9=clearly personal or personalized  5-6=mixed  3-4=mostly template  1-2=mass blast/bulk send

DIVERGENCE REQUIRED — examples of correct scoring:
  Mass camp blast asking for film → interest=5, genuineness=1  (has ask but zero personalization)
  Warm personal reply with no next steps → interest=3, genuineness=7
  Multi-reply thread (replies>2), no offer yet → interest=5, genuineness=8
  Templated "we're interested" with visit offer → interest=9, genuineness=3
  Back-and-forth thread (replies=3), coach asks follow-up questions → interest=6, genuineness=9

RULES (apply before scoring):
  idcamp=true with no athlete name/stats/club: score max 3, genuineness=1, rating="not_interested"
  Generic "Dear Athlete/Player": score max 3, genuineness max 2
  Only interest 7+: coach demonstrates they know this specific athlete (name/club/stats/prior interaction)
  Personalized ID camp invite (uses name, references play): interest max 6, genuineness 5-7
  replies >= 3: genuineness minimum 6 unless mass blast evidence
  replies >= 2: genuineness minimum 4

rating: hot(8-10)/warm(5-7)/cold(3-4)/not_interested(1-2)  — based on interest score
interestLevel: "Actively Recruiting"|"Very Interested"|"High Interest"|"Moderate Interest"|"Mild Interest"|"Low Interest"|"Not Interested"
ratingNote: one sentence describing what the coach said
nextAction: one sentence telling the athlete what to do next

Emails to rate:
${JSON.stringify(compact)}

Return a JSON array only, no markdown, no explanation:
[{"threadId":"<exact id from input>","score":7,"rating":"warm","interestLevel":"High Interest","genuineness":3,"ratingNote":"...","nextAction":"..."}]`,
    400 + emails.length * 160,
  )
  const fallback: BatchEmailRating[] = emails.map((e) => ({
    threadId: e.threadId, score: 5, rating: 'cold', interestLevel: 'Mild Interest',
    genuineness: 5, ratingNote: '', nextAction: 'Send a follow-up within two weeks.',
  }))
  const parsed = parseJSON<BatchEmailRating[]>(text, fallback)
  // If AI returned items but threadIds don't match (e.g. abbreviated keys), align by position
  const hasValidIds = parsed.some((r) => emails.some((e) => e.threadId === r.threadId))
  if (!hasValidIds && parsed.length === emails.length) {
    return parsed.map((r, i) => ({ ...r, threadId: emails[i].threadId }))
  }
  return parsed
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

Scoring — two INDEPENDENT scores (they must diverge when signals differ):

score (INTEREST 1-10) — forward momentum toward recruiting THIS athlete:
  High: requests film/transcript/test scores/visit/call/questionnaire; proposes timelines; directly expresses interest in this player
  Low: informational only, no concrete ask, single acknowledge with no next step
  1-2=rejection  3-4=polite pass  5-6=mild/no concrete ask  7-8=forward asks+interest  9-10=visit/scholarship offered

genuineness (PERSONAL ENGAGEMENT 1-10) — how personally engaged vs. mass-send:
  High: thread has multiple exchanges (sustained replies); uses athlete name/club/stats/position; asks personal follow-up questions; conversational not boilerplate; real coach name in From
  Low: first contact only; generic opener; no personal details; form-letter language; department/generic address
  1-2=mass blast  3-4=mostly template  5-6=mixed  7-9=clearly personal  10=deep personal ongoing thread

DIVERGENCE REQUIRED: e.g. mass blast asking for film → score=5, genuineness=1
- rating: hot=9-10 (visit/scholarship), warm=6-8 (positive, forward asks), cold=3-5 (noncommittal), not_interested=1-2 (no/form rejection)
- interestLevel: "Not Interested"|"Low Interest"|"Mild Interest"|"Moderate Interest"|"High Interest"|"Very Interested"|"Actively Recruiting"`,
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
