/**
 * Email inference for coaches with a known name but no email.
 *
 * Reads coachesScraped.json, finds entries where coachName is set but
 * coachEmail is empty, and asks Claude Haiku to generate the most likely
 * institutional email address based on naming conventions + school domain.
 *
 * This is intentional guessing, not recall. Results are marked
 * status: 'email-inferred' so the app shows a "Verify before sending" badge.
 *
 * Usage:
 *   npx tsx server/scripts/inferEmails.ts             # all name-only entries
 *   npx tsx server/scripts/inferEmails.ts --dry-run   # preview counts, no writes
 *   npx tsx server/scripts/inferEmails.ts --limit=20  # cap at N entries
 *   npx tsx server/scripts/inferEmails.ts --school=stanford
 *
 * Requires ANTHROPIC_API_KEY in .env.
 */

import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { ATHLETICS_DOMAINS } from './athleticsDomains'

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const CACHE_PATH = path.join(__dirname, '..', 'data', 'coachesScraped.json')
const BATCH_SIZE = 20

// ── CLI args ──────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }),
)

const DRY_RUN   = args['dry-run'] === 'true'
const ARG_LIMIT = args.limit  ? parseInt(args.limit,  10) : Infinity
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
  status:     'success' | 'no-program' | 'failed' | 'partial' | 'ai-inferred' | 'email-inferred'
  reason?:    string
}

type Cache = Record<string, ScrapedCoach>

interface InferResult {
  id:    string
  email: string | null  // best guess, or null if truly uninferable
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

// ── Domain helpers ────────────────────────────────────────────────────────

// Attempt to derive the institutional .edu domain from the athletics domain.
// e.g. "gostanford.com" → "stanford.edu", "hokiesports.com" → "vt.edu"
// Falls back to null; Claude will use the school name to infer the domain.
function guessEduDomain(schoolId: string, schoolName: string): string | null {
  const athleticsDomain = ATHLETICS_DOMAINS[schoolId]
  if (!athleticsDomain) return null

  // Explicit overrides for schools where the athletics domain is opaque
  const overrides: Record<string, string> = {
    'gostanford.com':       'stanford.edu',
    'virginiasports.com':   'virginia.edu',
    'gopsu.com':            'psu.edu',
    'portlandpilots.com':   'up.edu',
    'iuhoosiers.com':       'indiana.edu',
    'umichigan.com':        'umich.edu',
    'scarletknights.com':   'rutgers.edu',
    'clemsontigers.com':    'clemson.edu',
    'hokiesports.com':      'vt.edu',
    'texassports.com':      'utexas.edu',
    'wvusports.com':        'mail.wvu.edu',
    'tcuhornedfrog.com':    'tcu.edu',
    'byucougars.com':       'byu.edu',
    'baylorbears.com':      'baylor.edu',
    'georgiadogs.com':      'uga.edu',
    'arkansasrazorbacks.com': 'uark.edu',
    'aggieathletics.com':   'tamu.edu',
    'cubuffs.com':          'colorado.edu',
    'vutoday.com':          'vanderbilt.edu',
    'lsusports.net':        'lsu.edu',
    'huskers.com':          'unl.edu',
    'fightingillini.com':   'illinois.edu',
    'hawkeyesports.com':    'uiowa.edu',
    'usctrojans.com':       'usc.edu',
    'uhcougars.com':        'uh.edu',
    'floridagators.com':    'ufl.edu',
    'seminoles.com':        'fsu.edu',
    'goduke.com':           'duke.edu',
    'goheels.com':          'unc.edu',
    'gopack.com':           'ncsu.edu',
    'godeacs.com':          'wfu.edu',
    'bceagles.com':         'bc.edu',
    'gocards.com':          'louisville.edu',
    'pittsburghpanthers.com': 'pitt.edu',
    'syracuseorange.com':   'syr.edu',
    'notredame.com':        'nd.edu',
    'michiganstatesparta':  'msu.edu',
    'ohiostatebuckeyes.com':'osu.edu',
    'mgoblue.com':          'umich.edu',
  }

  if (overrides[athleticsDomain]) return overrides[athleticsDomain]

  // Try to extract a .edu subdomain from the athletics URL itself
  const match = athleticsDomain.match(/([a-z0-9-]+)\.edu/)
  if (match) return match[0]

  return null
}

// ── Claude batch call ─────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

async function inferBatch(
  entries: Array<{ id: string; coachName: string; schoolName: string; eduDomain: string | null }>,
): Promise<InferResult[]> {
  const list = entries.map((e) => ({
    id:         e.id,
    coachName:  e.coachName,
    school:     e.schoolName,
    ...(e.eduDomain ? { emailDomain: e.eduDomain } : {}),
  }))

  const prompt = `You are generating likely college coach email addresses based on naming conventions.

For each entry below, return the single most likely email address for the coach at that school.

Rules:
- Use the emailDomain if provided. If not, infer the institution's email domain from the school name (e.g. Stanford → stanford.edu, Virginia Tech → vt.edu).
- Apply the most common pattern for that school or institution type:
  * Large universities: firstname.lastname@school.edu
  * Smaller schools: flastname@school.edu or first.last@school.edu
- Normalize names: remove ALL CAPS (e.g. "JEREMY GUNN" → jeremy.gunn), handle hyphenated last names
- Always return an email — this is intentional inference, not recall. Only return null if the school name is so ambiguous you cannot determine its email domain.

Entries:
${JSON.stringify(list, null, 2)}

Respond with JSON only — same order as input:
[{ "id": "...", "email": "coach@school.edu" }]`

  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 100 + entries.length * 30,
    messages:   [{ role: 'user', content: prompt }],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected block type')

  const text    = block.text.trim()
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  try {
    const arrMatch = cleaned.match(/\[[\s\S]*\]/)
    if (arrMatch) return JSON.parse(arrMatch[0]) as InferResult[]
    return JSON.parse(cleaned) as InferResult[]
  } catch {
    console.warn('  ⚠️  Failed to parse Claude response, skipping batch.')
    return []
  }
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  const cache = loadCache()

  const queue: Array<{ id: string; entry: ScrapedCoach }> = []
  for (const [key, entry] of Object.entries(cache)) {
    if (ARG_SCHOOL && entry.schoolId !== ARG_SCHOOL) continue
    if (entry.coachName && !entry.coachEmail) {
      queue.push({ id: key, entry })
    }
  }

  const limited = queue.slice(0, ARG_LIMIT)

  console.log('══ EMAIL INFERENCE PREVIEW ══')
  console.log(`Entries with name but no email: ${limited.length}`)
  if (DRY_RUN) {
    console.log('Dry run — no writes.')
    limited.slice(0, 10).forEach(({ id, entry }) =>
      console.log(`  ${id}: ${entry.coachName}`)
    )
    if (limited.length > 10) console.log(`  ... and ${limited.length - 10} more`)
    return
  }
  console.log()

  let filled = 0
  let skipped = 0

  for (let i = 0; i < limited.length; i += BATCH_SIZE) {
    const batch = limited.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(limited.length / BATCH_SIZE)

    console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} entries)...`)

    const inputs = batch.map(({ id, entry }) => ({
      id,
      coachName:  entry.coachName,
      schoolName: entry.schoolName,
      eduDomain:  guessEduDomain(entry.schoolId, entry.schoolName),
    }))

    let results: InferResult[] = []
    try {
      results = await inferBatch(inputs)
    } catch (e) {
      console.error(`  ❌ Claude call failed: ${(e as Error).message}`)
      continue
    }

    for (const result of results) {
      const item = cache[result.id]
      if (!item) continue

      if (!result.email) {
        skipped++
        console.log(`  ⬜ ${result.id} — could not infer domain`)
        continue
      }

      cache[result.id] = {
        ...item,
        coachEmail: result.email,
        scrapedAt:  new Date().toISOString(),
        status:     'email-inferred',
        reason:     'email format inferred from coach name + school domain (verify before sending)',
      }

      filled++
      console.log(`  📧 ${result.id} — ${item.coachName} → ${result.email}`)
    }

    saveCache(cache)

    if (i + BATCH_SIZE < limited.length) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  console.log()
  console.log('══ DONE ══')
  console.log(`Inferred: ${filled}`)
  console.log(`Skipped:  ${skipped}  (domain unresolvable)`)
  console.log()
  console.log('Entries are marked email-inferred — show "⚠️ Verify before sending" in the app.')
}

main().catch((e) => {
  console.error('INFER EMAILS CRASHED:', e)
  process.exit(1)
})
