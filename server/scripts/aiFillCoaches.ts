/**
 * AI gap-fill for coach data.
 *
 * Reads coachesScraped.json, finds entries that the scraper couldn't resolve
 * (status: 'failed' | 'no-program'), and asks Claude in batches for the
 * current head coach name and email. Results are saved with status: 'ai-inferred'
 * so the app can surface a "Verify before sending" badge.
 *
 * Usage:
 *   npx tsx server/scripts/aiFillCoaches.ts              # fill all failed
 *   npx tsx server/scripts/aiFillCoaches.ts --partial    # also fill partial (has name, no email)
 *   npx tsx server/scripts/aiFillCoaches.ts --dry-run    # preview counts, no writes
 *   npx tsx server/scripts/aiFillCoaches.ts --limit=20   # cap at N entries
 *   npx tsx server/scripts/aiFillCoaches.ts --school=unc # single school (both genders)
 *
 * Requires ANTHROPIC_API_KEY in .env.
 */

import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const CACHE_PATH = path.join(__dirname, '..', 'data', 'coachesScraped.json')
const BATCH_SIZE = 25   // schools per Claude call

// ── CLI args ──────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }),
)

const DRY_RUN  = args['dry-run'] === 'true'
const PARTIAL  = args['partial'] === 'true'   // also fill entries with name but no email
const ARG_LIMIT  = args.limit  ? parseInt(args.limit,  10) : Infinity
const ARG_SCHOOL = args.school as string | undefined

// ── Types ─────────────────────────────────────────────────────────────────

interface ScrapedCoach {
  schoolId:   string
  schoolName: string
  gender:     'mens' | 'womens'
  coachName:  string
  coachTitle: string
  coachEmail: string
  sourceUrl:  string
  scrapedAt:  string
  status:     'success' | 'no-program' | 'failed' | 'partial' | 'ai-inferred'
  reason?:    string
}

type Cache = Record<string, ScrapedCoach>

interface AiResult {
  id:        string   // "${schoolId}:${gender}"
  coachName: string | null
  coachEmail: string | null
}

// ── Cache I/O ─────────────────────────────────────────────────────────────

function loadCache(): Cache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function saveCache(cache: Cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
}

// ── Claude batch call ─────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

async function askBatch(
  entries: Array<{ id: string; school: string; gender: 'mens' | 'womens' }>,
): Promise<AiResult[]> {
  const list = entries.map((e) => ({
    id:     e.id,
    school: e.school,
    program: `${e.gender === 'mens' ? "Men's" : "Women's"} Soccer`,
  }))

  const prompt = `You are a factual database assistant. For each college soccer program below, return the current head coach's full name and their official athletics email address.

Rules:
- Only return data you have genuine, specific knowledge of. Do NOT guess or fabricate.
- If you don't know the coach's name, return null for both fields.
- If you know the name but not the email, return the name and null for email.
- Emails follow patterns like firstName.lastName@school.edu or coach@athletics.school.edu — only return one you actually know, not a guessed pattern.
- Coaches retire and change jobs. If a well-known coach left a program years ago, mark their replacement as unknown unless you specifically know the new hire.

Programs:
${JSON.stringify(list, null, 2)}

Respond with JSON only — an array with one entry per program, preserving the same order:
[{ "id": "...", "coachName": "Jane Smith" | null, "coachEmail": "jsmith@school.edu" | null }]`

  const response = await client.messages.create({
    model:      'claude-haiku-4-5',
    max_tokens: 150 + entries.length * 40,
    messages:   [{ role: 'user', content: prompt }],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected block type')

  const text    = block.text.trim()
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  try {
    const arrMatch = cleaned.match(/\[[\s\S]*\]/)
    if (arrMatch) return JSON.parse(arrMatch[0]) as AiResult[]
    return JSON.parse(cleaned) as AiResult[]
  } catch {
    console.warn('  ⚠️  Failed to parse Claude response for batch, skipping.')
    return []
  }
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  const cache = loadCache()

  // Build work queue
  const queue: Array<{ id: string; entry: ScrapedCoach }> = []
  for (const [key, entry] of Object.entries(cache)) {
    if (ARG_SCHOOL && entry.schoolId !== ARG_SCHOOL) continue
    const shouldFill =
      entry.status === 'failed'     ||
      entry.status === 'no-program' ||
      (PARTIAL && entry.status === 'partial' && !entry.coachEmail)
    if (shouldFill) queue.push({ id: key, entry })
  }

  const limited = queue.slice(0, ARG_LIMIT)

  console.log('══ AI FILL PREVIEW ══')
  console.log(`Entries to fill: ${limited.length}  (--partial=${PARTIAL})`)
  if (DRY_RUN) {
    console.log('Dry run — no writes.')
    limited.slice(0, 10).forEach(({ id }) => console.log('  ', id))
    if (limited.length > 10) console.log(`  ... and ${limited.length - 10} more`)
    return
  }
  console.log()

  // Chunk into batches
  let filled = 0
  let skipped = 0

  for (let i = 0; i < limited.length; i += BATCH_SIZE) {
    const batch = limited.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(limited.length / BATCH_SIZE)

    console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} entries)...`)

    const inputs = batch.map(({ id, entry }) => ({
      id,
      school: entry.schoolName,
      gender: entry.gender,
    }))

    let results: AiResult[] = []
    try {
      results = await askBatch(inputs)
    } catch (e) {
      console.error(`  ❌ Claude call failed: ${(e as Error).message}`)
      continue
    }

    // Apply results back to cache
    for (const result of results) {
      const item = cache[result.id]
      if (!item) continue

      if (!result.coachName) {
        skipped++
        console.log(`  ⬜ ${result.id} — Claude has no knowledge`)
        continue
      }

      const hadEmail = !!result.coachEmail
      cache[result.id] = {
        ...item,
        coachName:  result.coachName,
        coachTitle: item.coachTitle || 'Head Coach',
        coachEmail: result.coachEmail ?? '',
        scrapedAt:  new Date().toISOString(),
        status:     'ai-inferred',
        reason:     hadEmail ? 'AI batch lookup (verify before sending)' : 'AI batch lookup — name only, email unknown',
      }

      filled++
      const tag = hadEmail ? '🤖✅' : '🤖🟡'
      console.log(`  ${tag} ${result.id} — ${result.coachName}${hadEmail ? ' / ' + result.coachEmail : ' (no email)'}`)
    }

    // Persist after each batch so a crash doesn't lose work
    saveCache(cache)

    // Polite pause between batches to avoid hammering the API
    if (i + BATCH_SIZE < limited.length) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  console.log()
  console.log('══ DONE ══')
  console.log(`Filled:  ${filled}`)
  console.log(`Skipped: ${skipped}  (Claude had no knowledge)`)
  console.log()
  console.log('Next steps:')
  console.log('  1. Run the seed script to push updates to Supabase:')
  console.log('     npx tsx server/scripts/seedSchools.ts')
  console.log('  2. Entries marked ai-inferred will show "⚠️ Verify before sending" in the app.')
}

main().catch((e) => {
  console.error('AI FILL CRASHED:', e)
  process.exit(1)
})
