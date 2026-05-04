/**
 * Coach-gap filler — Haiku first, Sonnet for residual misses.
 *
 * Usage:
 *   npx tsx server/scripts/fillCoachGaps.ts --dry-run
 *   npx tsx server/scripts/fillCoachGaps.ts --limit=20 --concurrency=2
 *   npx tsx server/scripts/fillCoachGaps.ts --school=unc
 *   npx tsx server/scripts/fillCoachGaps.ts                # full run, both passes
 *   npx tsx server/scripts/fillCoachGaps.ts --pass=haiku   # haiku-only pass
 *   npx tsx server/scripts/fillCoachGaps.ts --pass=sonnet  # sonnet-only pass
 */
import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { ScraperBudget, BudgetExceededError } from '../lib/scraperBudget'

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const COACHES_PATH = path.join(__dirname, '..', 'data', 'coachesScraped.json')
const SCHOOLS_PATH = path.join(__dirname, '..', 'data', 'schools.json')
const BUDGET_PATH  = path.join(__dirname, '..', 'data', '.scraperBudget.json')

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=')
  return [k, v ?? 'true']
}))
const DRY_RUN = args['dry-run'] === 'true'
const ARG_LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity
const ARG_CONC  = args.concurrency ? parseInt(args.concurrency, 10) : 2
const ARG_SCHOOL = args.school as string | undefined
const ARG_PASS = (args.pass as 'haiku' | 'sonnet' | 'both') ?? 'both'

const TARGET_DIVISIONS = new Set(['D1', 'D2', 'D3'])

interface ScrapedCoach {
  schoolId: string; schoolName: string; gender: 'mens' | 'womens'
  coachName: string; coachTitle: string; coachEmail: string
  sourceUrl: string; scrapedAt: string; status: string; reason?: string
}
interface School { id: string; name: string; division: string }

const FREE_RE = /^(gmail|yahoo|hotmail|outlook|aol|icloud|msn|protonmail|ymail|live|me|mac)\.(com|net)$/i
function isInstitutional(email: string): boolean {
  const m = email.toLowerCase().match(/@([^@\s>]+)\s*$/)
  if (!m) return false
  const d = m[1]
  if (FREE_RE.test(d)) return false
  return /\.(edu|gov|mil)$/.test(d) || /\.ac\.[a-z]{2}$/.test(d)
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
const budget = new ScraperBudget(BUDGET_PATH, { soft: 18, hard: 20 })

async function withRetry<T>(fn: () => Promise<T>, max = 5): Promise<T> {
  let delay = 8000
  for (let i = 0; i <= max; i++) {
    try { return await fn() } catch (e: any) {
      const msg = String(e?.message ?? '')
      const name = String(e?.name ?? e?.constructor?.name ?? '')
      const is429 = e?.status === 429 || /429|rate_limit/i.test(msg)
      const isTransient = is429
        || /timeout|timed out|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed/i.test(msg)
        || /ConnectionTimeout|APIConnectionError/i.test(name)
        || (typeof e?.status === 'number' && e.status >= 500)
      if (isTransient && i < max) {
        const wait = delay * (1 + 0.2 * Math.random())
        const why = is429 ? 'rate limit' : 'transient error'
        console.log(`  ⏳ ${why} (${msg.slice(0, 60)}) — waiting ${Math.round(wait/1000)}s (${i+1}/${max})`)
        await new Promise(r => setTimeout(r, wait))
        delay = Math.min(delay * 2, 120000)
        continue
      }
      throw e
    }
  }
  throw new Error('unreachable')
}

async function runWithLimit<T, U>(items: T[], limit: number, fn: (item: T, i: number) => Promise<U>): Promise<U[]> {
  const results: (U | undefined)[] = new Array(items.length); let cursor = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) { const i = cursor++; results[i] = await fn(items[i], i) }
  }))
  return results as U[]
}

function selectGaps(coaches: Record<string, ScrapedCoach>, schools: School[]) {
  const targetIds = new Set(schools.filter(s => TARGET_DIVISIONS.has(s.division)).map(s => s.id))
  const gaps: Array<{ key: string; entry: ScrapedCoach }> = []
  for (const [key, entry] of Object.entries(coaches)) {
    if (!targetIds.has(entry.schoolId)) continue
    if (ARG_SCHOOL && entry.schoolId !== ARG_SCHOOL) continue
    const hasGoodEmail = entry.coachEmail && isInstitutional(entry.coachEmail) &&
      ['success', 'web-verified', 'email-inferred', 'haiku-verified', 'sonnet-verified'].includes(entry.status)
    if (hasGoodEmail) continue
    gaps.push({ key, entry })
  }
  return gaps
}

const COACH_PROMPT = (school: string, gender: 'mens' | 'womens') => {
  const gl = gender === 'mens' ? "men's" : "women's"
  return `Find the CURRENT head coach of the ${gl} soccer program at ${school}.
Search the official athletic department page (.edu or official athletics domain).
Extract: head coach full name, email (ONLY if printed on the official page, must end in .edu), page URL.
If no ${gl} varsity soccer program exists: return coachName="NO_PROGRAM".
Return ONLY JSON: {"coachName":"Full Name","coachEmail":"coach@school.edu","sourceUrl":"https://...","reason":"one sentence"}`
}

interface ResearchResult { coachName: string; coachEmail: string; sourceUrl: string; reason: string }

async function researchOne(model: string, school: string, gender: 'mens' | 'womens'): Promise<ResearchResult> {
  const resp = await withRetry(() => client.messages.create({
    model,
    max_tokens: 1024,
    tools: [{ type: 'web_search_20250305' as any, name: 'web_search', max_uses: 5 }],
    messages: [{ role: 'user', content: COACH_PROMPT(school, gender) }],
  }))
  let txt = ''; for (const b of resp.content) if (b.type === 'text') txt = b.text
  if (!txt) return { coachName: '', coachEmail: '', sourceUrl: '', reason: 'no text' }
  const cleaned = txt.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const m = cleaned.match(/\{[\s\S]*\}/)
  if (!m) return { coachName: '', coachEmail: '', sourceUrl: '', reason: 'no JSON' }
  let parsed: any
  try { parsed = JSON.parse(m[0]) } catch { return { coachName: '', coachEmail: '', sourceUrl: '', reason: 'bad JSON' } }
  const raw = typeof parsed.coachEmail === 'string' ? parsed.coachEmail.trim() : ''
  const email = raw && isInstitutional(raw) ? raw : ''
  const note = raw && !email ? ` (rejected "${raw}")` : ''
  return {
    coachName: typeof parsed.coachName === 'string' ? parsed.coachName.trim() : '',
    coachEmail: email,
    sourceUrl: typeof parsed.sourceUrl === 'string' ? parsed.sourceUrl.trim() : '',
    reason: (typeof parsed.reason === 'string' ? parsed.reason.trim() : '') + note,
  }
}

const COST_PER_CALL: Record<string, number> = {
  'claude-haiku-4-5-20251001': 0.003,
  'claude-sonnet-4-6': 0.04,
}

async function runPass(
  passName: 'haiku' | 'sonnet',
  model: string,
  cache: Record<string, ScrapedCoach>,
  gaps: Array<{ key: string; entry: ScrapedCoach }>,
) {
  const newStatus = passName === 'haiku' ? 'haiku-verified' : 'sonnet-verified'
  const estPerCall = COST_PER_CALL[model]
  console.log(`\n══ PASS: ${passName.toUpperCase()} (${model}) ══`)
  console.log(`Targets: ${gaps.length}  Concurrency: ${ARG_CONC}  Est cost: $${(estPerCall * gaps.length).toFixed(2)}`)
  if (DRY_RUN) { gaps.slice(0, 10).forEach(g => console.log(' ', g.key)); return { resolved: 0 } }

  let resolved = 0, counter = 0, errors = 0
  await runWithLimit(gaps, ARG_CONC, async ({ key, entry }) => {
    try { budget.assertCanSpend(estPerCall) } catch (e) {
      if (e instanceof BudgetExceededError) { console.log(`  ⛔ ${e.message} — stopping pass`); return }
      throw e
    }
    counter++
    let r: ResearchResult
    try {
      r = await researchOne(model, entry.schoolName, entry.gender)
      budget.record(passName, estPerCall)
    } catch (e: any) {
      errors++
      const reason = `error after retries: ${String(e?.message ?? e).slice(0, 100)}`
      console.log(`  [${counter}/${gaps.length}] 💥 ${entry.schoolId}:${entry.gender}  ${reason}`)
      // Don't update the cache on error — entry stays in 'failed' status for next run.
      return
    }

    let status = entry.status
    if (r.coachName === 'NO_PROGRAM') { status = 'no-program' }
    else if (r.coachName && r.coachEmail) { status = newStatus; resolved++ }

    if (status === 'no-program' || status === newStatus) {
      cache[key] = {
        ...entry,
        coachName: status === 'no-program' ? '' : r.coachName,
        coachTitle: entry.coachTitle || 'Head Coach',
        coachEmail: status === 'no-program' ? '' : r.coachEmail,
        sourceUrl: r.sourceUrl || entry.sourceUrl,
        scrapedAt: new Date().toISOString(),
        status, reason: r.reason,
      }
    }
    const tag = status === newStatus ? '✅' : status === 'no-program' ? '⛔' : '❌'
    console.log(`  [${counter}/${gaps.length}] ${tag} ${entry.schoolId}:${entry.gender}  ${r.coachName||'(no name)'}  ${r.coachEmail||'(no email)'}`)
    if (counter % 10 === 0) fs.writeFileSync(COACHES_PATH, JSON.stringify(cache, null, 2))
  })
  fs.writeFileSync(COACHES_PATH, JSON.stringify(cache, null, 2))
  console.log(`Pass ${passName} done — resolved ${resolved}/${gaps.length}, errors ${errors}.  Total spend: $${budget.totalSpent().toFixed(2)}`)
  return { resolved }
}

async function main() {
  const cache = JSON.parse(fs.readFileSync(COACHES_PATH, 'utf8')) as Record<string, ScrapedCoach>
  const schools = JSON.parse(fs.readFileSync(SCHOOLS_PATH, 'utf8')) as School[]
  let gaps = selectGaps(cache, schools).slice(0, ARG_LIMIT)
  console.log(`Total D1/D2/D3 coach gaps: ${gaps.length}.  Budget so far: $${budget.totalSpent().toFixed(2)}`)
  if (gaps.length === 0) return

  if (ARG_PASS === 'haiku' || ARG_PASS === 'both') {
    await runPass('haiku', 'claude-haiku-4-5-20251001', cache, gaps)
    gaps = selectGaps(cache, schools).slice(0, ARG_LIMIT)
  }
  if (ARG_PASS === 'sonnet' || ARG_PASS === 'both') {
    await runPass('sonnet', 'claude-sonnet-4-6', cache, gaps)
  }
  console.log(`\n══ ALL DONE ══  Final spend: $${budget.totalSpent().toFixed(2)}`)
}

main().catch(e => { console.error('CRASHED:', e); process.exit(1) })
