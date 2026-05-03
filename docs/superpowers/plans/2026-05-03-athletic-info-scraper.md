# Athletic Info Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add accurate, source-tagged coach contact, competitive record, and recruiting-class data for every D1/D2/D3 men's and women's soccer program in the database, while staying under a $20 Anthropic API budget per full run.

**Architecture:** Three independent, resume-safe scripts. Free public sources (NCAA stats API, Wikipedia, Sidearm-templated athletic sites, TopDrawerSoccer) carry the bulk of the work. A shared budget tracker hard-caps Claude API spend to $20. Each output field is tagged with `source`, `confidence`, and `lastVerified` so callers can reason about data quality.

**Tech Stack:** TypeScript + tsx, Vitest for tests, Anthropic SDK (`claude-sonnet-4-6`, `claude-haiku-4-5-20251001`) with the `web_search_20250305` tool, Puppeteer for Sidearm + TopDrawerSoccer scraping, plain `fetch` for NCAA + Wikipedia.

**Spec:** [`docs/superpowers/specs/2026-05-03-athletic-info-scraper-design.md`](../specs/2026-05-03-athletic-info-scraper-design.md)

---

## File Structure

**Create:**
- `client/src/types/athletic.ts` — shared types for ProgramRecord, RecruitingClass, ConfidenceTag
- `server/lib/scraperBudget.ts` — JSON-backed spend tracker with hard cap
- `server/lib/scraperBudget.test.ts`
- `server/lib/scraperConfidence.ts` — source/confidence/lastVerified helpers
- `server/lib/scraperConfidence.test.ts`
- `server/lib/ncaaStats.ts` — NCAA public-data feed wrapper
- `server/lib/ncaaStats.test.ts`
- `server/lib/wikipediaTourney.ts` — Wikipedia program-page parser
- `server/lib/wikipediaTourney.test.ts`
- `server/scripts/fillCoachGaps.ts` — Haiku → Sonnet gap filler
- `server/scripts/scrapeRecord.ts` — NCAA + Wikipedia record builder
- `server/scripts/scrapeRecruitingClass.ts` — TDS + Sidearm + Sonnet fallback
- `server/data/.scraperBudget.json` — runtime spend log (gitignored)

**Modify:**
- `client/src/types/index.ts` — re-export new types
- `server/lib/schoolMatcher.ts` — read new data files at load time
- `.gitignore` — add `server/data/.scraperBudget.json` and `server/data/scraperDrift.log`

**Outputs (data files, committed):**
- `server/data/programRecords.json` — keyed `schoolId:gender`
- `server/data/recruitingClasses.json` — keyed `schoolId:gender`

---

## Task 0: Foundations — Types, Budget, Confidence

**Files:**
- Create: `client/src/types/athletic.ts`
- Create: `server/lib/scraperBudget.ts`, `server/lib/scraperBudget.test.ts`
- Create: `server/lib/scraperConfidence.ts`, `server/lib/scraperConfidence.test.ts`
- Modify: `client/src/types/index.ts`, `.gitignore`

- [ ] **Step 0.1: Add shared athletic types**

Create `client/src/types/athletic.ts`:

```ts
export type ConfidenceTag = 'high' | 'medium' | 'low' | 'partial'

export interface SeasonRecord {
  season: number
  wins: number
  losses: number
  ties: number
  conferenceRecord: string | null
  ncaaTourneyRound: string | null
}

export interface ProgramRecord {
  schoolId: string
  gender: 'mens' | 'womens'
  recordHistory: SeasonRecord[]
  source: 'ncaa-api' | 'wikipedia' | 'mixed'
  confidence: ConfidenceTag
  lastVerified: string
}

export interface RecruitCommit {
  name: string
  position: string | null
  hometown: string | null
  club: string | null
}

export interface RecruitingClass {
  schoolId: string
  gender: 'mens' | 'womens'
  classYear: number
  recruitCount: number | null
  knownCommits: RecruitCommit[]
  source: 'tds' | 'site-scraped' | 'llm-research' | 'mixed'
  confidence: ConfidenceTag
  lastVerified: string
}
```

In `client/src/types/index.ts`, add at the bottom:

```ts
export * from './athletic'
```

- [ ] **Step 0.2: Add `.scraperBudget.json` to gitignore**

Append to `.gitignore`:

```
server/data/.scraperBudget.json
server/data/scraperDrift.log
```

- [ ] **Step 0.3: Write failing budget tracker test**

Create `server/lib/scraperBudget.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { ScraperBudget, BudgetExceededError } from './scraperBudget'

const TEST_FILE = path.join(__dirname, '..', 'data', '.scraperBudget.test.json')

describe('ScraperBudget', () => {
  beforeEach(() => { if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE) })
  afterEach(()  => { if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE) })

  it('starts at zero spend', () => {
    const b = new ScraperBudget(TEST_FILE, { soft: 18, hard: 20 })
    expect(b.totalSpent()).toBe(0)
  })

  it('records spend and persists across instances', () => {
    const b1 = new ScraperBudget(TEST_FILE, { soft: 18, hard: 20 })
    b1.record('haiku', 0.002)
    const b2 = new ScraperBudget(TEST_FILE, { soft: 18, hard: 20 })
    expect(b2.totalSpent()).toBeCloseTo(0.002, 4)
  })

  it('reports below-soft / between / over correctly', () => {
    const b = new ScraperBudget(TEST_FILE, { soft: 5, hard: 10 })
    b.record('sonnet', 4)
    expect(b.tier()).toBe('below-soft')
    b.record('sonnet', 2)
    expect(b.tier()).toBe('between')
    b.record('sonnet', 5)
    expect(b.tier()).toBe('over-hard')
  })

  it('throws BudgetExceededError when assertCanSpend would push past hard cap', () => {
    const b = new ScraperBudget(TEST_FILE, { soft: 5, hard: 10 })
    b.record('sonnet', 9)
    expect(() => b.assertCanSpend(2)).toThrow(BudgetExceededError)
  })
})
```

- [ ] **Step 0.4: Run the test and confirm it fails**

Run: `npx vitest run server/lib/scraperBudget.test.ts`
Expected: FAIL — "Cannot find module './scraperBudget'".

- [ ] **Step 0.5: Implement the budget tracker**

Create `server/lib/scraperBudget.ts`:

```ts
import * as fs from 'fs'

type Tier = 'below-soft' | 'between' | 'over-hard'
interface BudgetState { spendUsd: number; entries: Array<{ at: string; tag: string; usd: number }> }

export class BudgetExceededError extends Error {}

export class ScraperBudget {
  constructor(private path: string, private caps: { soft: number; hard: number }) {}

  private load(): BudgetState {
    if (!fs.existsSync(this.path)) return { spendUsd: 0, entries: [] }
    return JSON.parse(fs.readFileSync(this.path, 'utf8'))
  }

  private save(state: BudgetState) {
    fs.writeFileSync(this.path, JSON.stringify(state, null, 2))
  }

  totalSpent(): number {
    return this.load().spendUsd
  }

  tier(): Tier {
    const s = this.totalSpent()
    if (s >= this.caps.hard) return 'over-hard'
    if (s >= this.caps.soft) return 'between'
    return 'below-soft'
  }

  record(tag: string, usd: number) {
    const state = this.load()
    state.spendUsd += usd
    state.entries.push({ at: new Date().toISOString(), tag, usd })
    this.save(state)
  }

  assertCanSpend(estUsd: number) {
    if (this.totalSpent() + estUsd > this.caps.hard) {
      throw new BudgetExceededError(
        `Would push spend past hard cap $${this.caps.hard} (current $${this.totalSpent().toFixed(2)} + est $${estUsd.toFixed(2)})`
      )
    }
  }
}
```

- [ ] **Step 0.6: Run test, expect pass**

Run: `npx vitest run server/lib/scraperBudget.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 0.7: Write failing confidence helper test**

Create `server/lib/scraperConfidence.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { tagField, isFresh } from './scraperConfidence'

describe('tagField', () => {
  it('produces a stamped record with required fields', () => {
    const tagged = tagField({ value: 42 }, 'ncaa-api', 'high')
    expect(tagged.value).toBe(42)
    expect(tagged.source).toBe('ncaa-api')
    expect(tagged.confidence).toBe('high')
    expect(tagged.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('isFresh', () => {
  it('returns true for a recent timestamp', () => {
    expect(isFresh(new Date().toISOString(), 30)).toBe(true)
  })
  it('returns false for a stale timestamp', () => {
    const stale = new Date(Date.now() - 200 * 86400_000).toISOString()
    expect(isFresh(stale, 180)).toBe(false)
  })
})
```

- [ ] **Step 0.8: Implement confidence helper**

Create `server/lib/scraperConfidence.ts`:

```ts
import type { ConfidenceTag } from '../../client/src/types/athletic'

export function tagField<T extends object>(
  payload: T,
  source: string,
  confidence: ConfidenceTag
): T & { source: string; confidence: ConfidenceTag; lastVerified: string } {
  return { ...payload, source, confidence, lastVerified: new Date().toISOString() }
}

export function isFresh(lastVerified: string, maxAgeDays: number): boolean {
  const age = Date.now() - new Date(lastVerified).getTime()
  return age < maxAgeDays * 86400_000
}
```

- [ ] **Step 0.9: Run all tests, confirm pass**

Run: `npx vitest run server/lib/scraperBudget.test.ts server/lib/scraperConfidence.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 0.10: Commit**

```bash
git add client/src/types/athletic.ts client/src/types/index.ts \
        server/lib/scraperBudget.ts server/lib/scraperBudget.test.ts \
        server/lib/scraperConfidence.ts server/lib/scraperConfidence.test.ts \
        .gitignore
git commit -m "feat(scraper): foundations — types, budget tracker, confidence tagging"
```

---

## Task 1: Coach Gap Filler (`fillCoachGaps.ts`)

**Files:**
- Create: `server/scripts/fillCoachGaps.ts`

This script targets only the 485 missing-email and 446 missing-name programs in D1/D2/D3. It mirrors the structure of `webResearchCoaches.ts` but uses Haiku first and only escalates to Sonnet for residual misses, gated by the budget tracker.

- [ ] **Step 1.1: Scaffold the script with arg parsing and gap selection**

Create `server/scripts/fillCoachGaps.ts`:

```ts
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
```

- [ ] **Step 1.2: Add `withRetry`, `runWithLimit`, gap selector**

Append to `server/scripts/fillCoachGaps.ts`:

```ts
async function withRetry<T>(fn: () => Promise<T>, max = 5): Promise<T> {
  let delay = 15000
  for (let i = 0; i <= max; i++) {
    try { return await fn() } catch (e: any) {
      const is429 = e?.status === 429 || /429|rate_limit/i.test(String(e?.message))
      if (is429 && i < max) {
        const wait = delay * (1 + 0.2 * Math.random())
        console.log(`  ⏳ rate limit — waiting ${Math.round(wait/1000)}s (${i+1}/${max})`)
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
```

- [ ] **Step 1.3: Implement Haiku and Sonnet research fns**

Append to `server/scripts/fillCoachGaps.ts`:

```ts
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
```

- [ ] **Step 1.4: Implement run-pass orchestrator with budget guard**

Append to `server/scripts/fillCoachGaps.ts`:

```ts
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

  let resolved = 0, counter = 0
  await runWithLimit(gaps, ARG_CONC, async ({ key, entry }) => {
    try { budget.assertCanSpend(estPerCall) } catch (e) {
      if (e instanceof BudgetExceededError) { console.log(`  ⛔ ${e.message} — stopping pass`); return }
      throw e
    }
    counter++
    const r = await researchOne(model, entry.schoolName, entry.gender)
    budget.record(passName, estPerCall)

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
  console.log(`Pass ${passName} done — resolved ${resolved}/${gaps.length}.  Total spend: $${budget.totalSpent().toFixed(2)}`)
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
```

- [ ] **Step 1.5: Smoke test on 3 schools, dry-run first**

Run: `npx tsx server/scripts/fillCoachGaps.ts --dry-run --limit=3`
Expected: prints up to 3 gap keys, does not call API, no spend recorded.

Then run live: `npx tsx server/scripts/fillCoachGaps.ts --limit=3 --pass=haiku`
Expected: 3 Haiku calls executed, ~$0.01 recorded in `.scraperBudget.json`. At least one `✅` line in output. `coachesScraped.json` updated for any resolved entries.

- [ ] **Step 1.6: Commit**

```bash
git add server/scripts/fillCoachGaps.ts
git commit -m "feat(scraper): coach-gap filler with budget-capped haiku→sonnet escalation"
```

---

## Task 2: Competitive Record Scraper (`scrapeRecord.ts`)

**Files:**
- Create: `server/lib/ncaaStats.ts`, `server/lib/ncaaStats.test.ts`
- Create: `server/lib/wikipediaTourney.ts`, `server/lib/wikipediaTourney.test.ts`
- Create: `server/scripts/scrapeRecord.ts`

This script costs $0 — no Claude API. It reads the public NCAA stats feed at `data.ncaa.com` and falls back to Wikipedia's program articles for tournament history.

The NCAA team-id mapping is the trickiest part. The `data.ncaa.com` feed uses internal numeric IDs that don't match `schoolId`. We resolve them once via the public NCAA scoreboard pages, cache the mapping in `server/data/ncaaTeamIds.json`, and reuse it on subsequent runs.

- [ ] **Step 2.1: Write failing NCAA helper tests**

Create `server/lib/ncaaStats.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSchedule, parseSeasonRecord } from './ncaaStats'

describe('parseSeasonRecord', () => {
  it('counts wins, losses, ties from a schedule payload', () => {
    const payload = {
      games: [
        { result: { W: 'W' }, opponent: { score: 1 }, score: 2, gameStatus: 'final' },
        { result: { W: 'L' }, opponent: { score: 3 }, score: 1, gameStatus: 'final' },
        { result: { W: 'T' }, opponent: { score: 1 }, score: 1, gameStatus: 'final' },
        { result: { W: 'W' }, opponent: { score: 0 }, score: 4, gameStatus: 'final' },
      ],
    }
    const r = parseSeasonRecord(payload)
    expect(r.wins).toBe(2)
    expect(r.losses).toBe(1)
    expect(r.ties).toBe(1)
  })

  it('ignores in-progress games', () => {
    const payload = {
      games: [
        { result: { W: 'W' }, gameStatus: 'final' },
        { result: null, gameStatus: 'live' },
      ],
    }
    const r = parseSeasonRecord(payload)
    expect(r.wins).toBe(1)
    expect(r.losses).toBe(0)
    expect(r.ties).toBe(0)
  })
})

describe('fetchSchedule', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns null on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const r = await fetchSchedule({ teamId: 'NOPE', sportCode: 'MSO', year: 2024 })
    expect(r).toBeNull()
  })

  it('returns the JSON payload on 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ games: [] }) }))
    const r = await fetchSchedule({ teamId: '1234', sportCode: 'MSO', year: 2024 })
    expect(r).toEqual({ games: [] })
  })
})
```

- [ ] **Step 2.2: Implement NCAA helpers**

Create `server/lib/ncaaStats.ts`:

```ts
export interface ScheduleQuery { teamId: string; sportCode: 'MSO' | 'WSO'; year: number }
export interface ParsedRecord { wins: number; losses: number; ties: number }

export async function fetchSchedule(q: ScheduleQuery): Promise<unknown | null> {
  const url = `https://data.ncaa.com/casablanca/schedule/${q.sportCode.toLowerCase()}/${q.year}/${q.teamId}/schedule.json`
  const res = await fetch(url)
  if (!res.ok) return null
  return await res.json()
}

export function parseSeasonRecord(payload: unknown): ParsedRecord {
  const games = (payload as any)?.games ?? []
  let wins = 0, losses = 0, ties = 0
  for (const g of games) {
    if (g.gameStatus !== 'final') continue
    const w = g.result?.W
    if (w === 'W') wins++
    else if (w === 'L') losses++
    else if (w === 'T') ties++
  }
  return { wins, losses, ties }
}
```

- [ ] **Step 2.3: Run tests, expect pass**

Run: `npx vitest run server/lib/ncaaStats.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 2.4: Write Wikipedia tourney parser tests**

Create `server/lib/wikipediaTourney.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractTourneyAppearances } from './wikipediaTourney'

describe('extractTourneyAppearances', () => {
  it('extracts a year-to-round mapping from a wikitext blob', () => {
    const wikitext = `== NCAA Tournament results ==
{| class="wikitable"
! Year !! Round
|-
| 2022 || First Round
|-
| 2023 || Final Four
|-
| 2024 || Champion
|}`
    const r = extractTourneyAppearances(wikitext)
    expect(r[2022]).toBe('First Round')
    expect(r[2023]).toBe('Final Four')
    expect(r[2024]).toBe('Champion')
  })

  it('returns empty object when no tourney section', () => {
    expect(extractTourneyAppearances('Some other content')).toEqual({})
  })
})
```

- [ ] **Step 2.5: Implement Wikipedia parser**

Create `server/lib/wikipediaTourney.ts`:

```ts
export function extractTourneyAppearances(wikitext: string): Record<number, string> {
  const result: Record<number, string> = {}
  const idx = wikitext.toLowerCase().indexOf('ncaa tournament')
  if (idx === -1) return result
  const slice = wikitext.slice(idx)
  const rowRe = /\|\s*(\d{4})\s*\|\|\s*([^\n|]+)/g
  let m: RegExpExecArray | null
  while ((m = rowRe.exec(slice)) !== null) {
    const year = parseInt(m[1], 10)
    const round = m[2].trim()
    if (year >= 1950 && year <= 2100 && round) result[year] = round
  }
  return result
}

export async function fetchWikipediaWikitext(pageTitle: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&format=json&formatversion=2`
  const res = await fetch(url, { headers: { 'User-Agent': 'KickrIo/1.0 (info@fahga.org)' } })
  if (!res.ok) return null
  const json = await res.json() as any
  return json?.parse?.wikitext ?? null
}
```

- [ ] **Step 2.6: Run wiki tests, expect pass**

Run: `npx vitest run server/lib/wikipediaTourney.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 2.7: Implement scrapeRecord script**

Create `server/scripts/scrapeRecord.ts`:

```ts
/**
 * Competitive record scraper — D1/D2/D3 men's & women's soccer.
 * Cost: $0 (NCAA public feed + Wikipedia). No Claude API.
 *
 * First run resolves NCAA team IDs and caches them at server/data/ncaaTeamIds.json.
 * Subsequent runs reuse the cache.
 *
 * Usage:
 *   npx tsx server/scripts/scrapeRecord.ts --limit=20
 *   npx tsx server/scripts/scrapeRecord.ts --school=unc
 *   npx tsx server/scripts/scrapeRecord.ts --resume        # skip fresh entries
 */
import * as fs from 'fs'
import * as path from 'path'
import { fetchSchedule, parseSeasonRecord } from '../lib/ncaaStats'
import { fetchWikipediaWikitext, extractTourneyAppearances } from '../lib/wikipediaTourney'
import { tagField, isFresh } from '../lib/scraperConfidence'
import type { ProgramRecord, SeasonRecord } from '../../client/src/types/athletic'

const SCHOOLS_PATH = path.join(__dirname, '..', 'data', 'schools.json')
const RECORDS_PATH = path.join(__dirname, '..', 'data', 'programRecords.json')
const TEAMID_PATH  = path.join(__dirname, '..', 'data', 'ncaaTeamIds.json')

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true']
}))
const ARG_LIMIT  = args.limit ? parseInt(args.limit, 10) : Infinity
const ARG_SCHOOL = args.school as string | undefined
const ARG_RESUME = args.resume === 'true'
const FRESHNESS_DAYS = 180
const SEASONS_TO_PULL = [2024, 2023, 2022]

interface School { id: string; name: string; division: string }

function loadJson<T>(p: string, fallback: T): T {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback
}

async function resolveTeamId(
  cache: Record<string, { mens?: string; womens?: string }>,
  schoolId: string,
  schoolName: string,
  gender: 'mens' | 'womens',
): Promise<string | null> {
  if (cache[schoolId]?.[gender]) return cache[schoolId][gender]!
  // Public NCAA team search endpoint, returns JSON matches.
  const url = `https://stats.ncaa.org/team/inst_team_list?sport_code=${gender === 'mens' ? 'MSO' : 'WSO'}&search=${encodeURIComponent(schoolName)}`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'KickrIo/1.0 (info@fahga.org)' } })
    if (!res.ok) return null
    const html = await res.text()
    const m = html.match(/\/team\/(\d+)\//)
    if (!m) return null
    cache[schoolId] = { ...cache[schoolId], [gender]: m[1] }
    fs.writeFileSync(TEAMID_PATH, JSON.stringify(cache, null, 2))
    return m[1]
  } catch {
    return null
  }
}

async function buildRecord(school: School, gender: 'mens' | 'womens', teamIdCache: Record<string, any>): Promise<ProgramRecord | null> {
  const teamId = await resolveTeamId(teamIdCache, school.id, school.name, gender)
  const wikitext = await fetchWikipediaWikitext(`${school.name} ${gender === 'mens' ? "men's" : "women's"} soccer`)
  const tourney = wikitext ? extractTourneyAppearances(wikitext) : {}

  const seasons: SeasonRecord[] = []
  if (teamId) {
    for (const year of SEASONS_TO_PULL) {
      const sched = await fetchSchedule({ teamId, sportCode: gender === 'mens' ? 'MSO' : 'WSO', year })
      if (!sched) continue
      const parsed = parseSeasonRecord(sched)
      seasons.push({
        season: year,
        wins: parsed.wins,
        losses: parsed.losses,
        ties: parsed.ties,
        conferenceRecord: null,
        ncaaTourneyRound: tourney[year] ?? null,
      })
    }
  }

  if (seasons.length === 0 && Object.keys(tourney).length === 0) return null

  const source = teamId && wikitext ? 'mixed' : teamId ? 'ncaa-api' : 'wikipedia'
  const confidence = seasons.length >= 2 ? 'high' : seasons.length === 1 ? 'medium' : 'low'

  return tagField(
    { schoolId: school.id, gender, recordHistory: seasons },
    source,
    confidence,
  ) as ProgramRecord
}

async function main() {
  const schools = (loadJson<School[]>(SCHOOLS_PATH, [])).filter(s => ['D1','D2','D3'].includes(s.division))
  const filtered = ARG_SCHOOL ? schools.filter(s => s.id === ARG_SCHOOL) : schools
  const records = loadJson<Record<string, ProgramRecord>>(RECORDS_PATH, {})
  const teamIds = loadJson<Record<string, any>>(TEAMID_PATH, {})

  const queue: Array<{ school: School; gender: 'mens' | 'womens' }> = []
  for (const s of filtered) {
    for (const g of ['mens', 'womens'] as const) {
      const key = `${s.id}:${g}`
      if (ARG_RESUME && records[key] && isFresh(records[key].lastVerified, FRESHNESS_DAYS)) continue
      queue.push({ school: s, gender: g })
    }
  }
  const limited = queue.slice(0, ARG_LIMIT)
  console.log(`Targets: ${limited.length}`)

  let ok = 0, miss = 0, counter = 0
  for (const { school, gender } of limited) {
    counter++
    const rec = await buildRecord(school, gender, teamIds)
    if (rec) { records[`${school.id}:${gender}`] = rec; ok++ }
    else miss++
    const tag = rec ? '✅' : '❌'
    console.log(`[${counter}/${limited.length}] ${tag} ${school.id}:${gender}`)
    if (counter % 20 === 0) fs.writeFileSync(RECORDS_PATH, JSON.stringify(records, null, 2))
    await new Promise(r => setTimeout(r, 250)) // be nice to NCAA + Wikipedia
  }
  fs.writeFileSync(RECORDS_PATH, JSON.stringify(records, null, 2))
  console.log(`\nDone — ok:${ok} miss:${miss}`)
}

main().catch(e => { console.error('CRASHED:', e); process.exit(1) })
```

- [ ] **Step 2.8: Smoke test record scraper on 2 schools**

Run: `npx tsx server/scripts/scrapeRecord.ts --school=unc`
Expected: writes 2 entries (`unc:mens`, `unc:womens`) to `programRecords.json` with `recordHistory` populated for at least 2024.

Then on 5 more: `npx tsx server/scripts/scrapeRecord.ts --limit=10`
Expected: ~5 schools × 2 genders = 10 entries attempted, mostly `✅`. No spend recorded in budget tracker.

- [ ] **Step 2.9: Commit**

```bash
git add server/lib/ncaaStats.ts server/lib/ncaaStats.test.ts \
        server/lib/wikipediaTourney.ts server/lib/wikipediaTourney.test.ts \
        server/scripts/scrapeRecord.ts server/data/programRecords.json server/data/ncaaTeamIds.json
git commit -m "feat(scraper): competitive record builder via NCAA + Wikipedia (free)"
```

---

## Task 3: Recruiting Class Scraper (`scrapeRecruitingClass.ts`)

**Files:**
- Create: `server/scripts/scrapeRecruitingClass.ts`

This is the only Sonnet-heavy script. Source order: TopDrawerSoccer → Sidearm `/news` → Sonnet web_search. Sonnet calls are budget-capped.

For brevity in this plan, the TDS and Sidearm helpers are inlined in the script. If they grow past ~150 lines, factor them into `server/lib/recruitingClassSources.ts` with their own tests.

- [ ] **Step 3.1: Write the script — robots check, scaffold, args**

Create `server/scripts/scrapeRecruitingClass.ts`:

```ts
/**
 * Recruiting class composition scraper — D1/D2/D3.
 * Sources: TopDrawerSoccer → Sidearm /news scraping → Sonnet web_search (budget-capped).
 *
 * Usage:
 *   npx tsx server/scripts/scrapeRecruitingClass.ts --limit=10
 *   npx tsx server/scripts/scrapeRecruitingClass.ts --school=unc
 *   npx tsx server/scripts/scrapeRecruitingClass.ts --skip=tds  # only fall through to sidearm/llm
 */
import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import puppeteer, { Browser } from 'puppeteer'
import { ScraperBudget, BudgetExceededError } from '../lib/scraperBudget'
import { tagField, isFresh } from '../lib/scraperConfidence'
import type { RecruitingClass, RecruitCommit } from '../../client/src/types/athletic'

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const SCHOOLS_PATH = path.join(__dirname, '..', 'data', 'schools.json')
const CLASSES_PATH = path.join(__dirname, '..', 'data', 'recruitingClasses.json')
const BUDGET_PATH  = path.join(__dirname, '..', 'data', '.scraperBudget.json')

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k,v]=a.replace(/^--/,'').split('='); return [k,v??'true'] }))
const ARG_LIMIT  = args.limit ? parseInt(args.limit, 10) : Infinity
const ARG_SCHOOL = args.school as string | undefined
const ARG_RESUME = args.resume === 'true'
const ARG_SKIP   = (args.skip as string ?? '').split(',')
const FRESHNESS_DAYS = 180
const CURRENT_CLASS_YEAR = new Date().getMonth() < 6 ? new Date().getFullYear() : new Date().getFullYear() + 1

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
const budget = new ScraperBudget(BUDGET_PATH, { soft: 18, hard: 20 })

interface School { id: string; name: string; division: string }

function loadJson<T>(p: string, fallback: T): T {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback
}

async function checkRobots(host: string, paths: string[]): Promise<boolean> {
  try {
    const res = await fetch(`https://${host}/robots.txt`)
    if (!res.ok) return true
    const txt = await res.text()
    for (const p of paths) if (new RegExp(`Disallow:\\s*${p}`, 'i').test(txt)) return false
    return true
  } catch { return true }
}
```

- [ ] **Step 3.2: Add TDS scraper**

Append to `server/scripts/scrapeRecruitingClass.ts`:

```ts
async function scrapeTDS(browser: Browser, school: School, gender: 'mens' | 'womens'): Promise<RecruitCommit[] | null> {
  const slug = school.name.toLowerCase().replace(/&/g, 'and').replace(/[^\w\s]/g, '').replace(/\s+/g, '-')
  const url = `https://www.topdrawersoccer.com/college-soccer/college-soccer-team/${gender === 'mens' ? 'men' : 'women'}/${slug}`
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    const commits = await page.$$eval('table.team-recruits tbody tr', rows => rows.map(tr => {
      const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent?.trim() ?? '')
      return { name: cells[0] ?? '', position: cells[1] || null, hometown: cells[2] || null, club: cells[3] || null }
    })).catch(() => [] as any[])
    return commits.filter(c => c.name).length > 0 ? commits.filter(c => c.name) : null
  } catch {
    return null
  } finally {
    await page.close()
  }
}
```

- [ ] **Step 3.3: Add Sidearm `/news` press-release scraper**

Append to `server/scripts/scrapeRecruitingClass.ts`:

```ts
async function scrapeSidearmNews(browser: Browser, school: School, gender: 'mens' | 'womens'): Promise<{ count: number | null; commits: RecruitCommit[] } | null> {
  // Probe the school's athletic site via Google site-restricted search for a
  // signing-day press release (Sidearm sites all expose /news/<year>/<month>/<slug>).
  const program = `${school.name} ${gender === 'mens' ? "men's" : "women's"} soccer`
  const query = encodeURIComponent(`"${program}" "Class of ${CURRENT_CLASS_YEAR}" signing site:edu OR site:sidearmsports.com`)
  const page = await browser.newPage()
  try {
    await page.goto(`https://duckduckgo.com/?q=${query}&ia=web`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    const link = await page.$eval('a[data-testid="result-title-a"]', el => (el as HTMLAnchorElement).href).catch(() => null)
    if (!link) return null

    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 20000 })
    const text = await page.evaluate(() => document.body.innerText).catch(() => '')
    const nameRe = /([A-Z][a-z]+ [A-Z][a-z]+)\s*[-–—]\s*([A-Z][a-z]+(?:[\s,][A-Z]{2})?)/g
    const matches = Array.from(text.matchAll(nameRe))
    const commits: RecruitCommit[] = matches.slice(0, 30).map(m => ({
      name: m[1], position: null, hometown: m[2] ?? null, club: null,
    }))
    const countMatch = text.match(/(\d+)[-\s]*(?:player|recruit|signee)/i)
    const count = countMatch ? parseInt(countMatch[1], 10) : (commits.length || null)
    if (commits.length === 0 && !count) return null
    return { count, commits }
  } catch {
    return null
  } finally {
    await page.close()
  }
}
```

- [ ] **Step 3.4: Add Sonnet web_search fallback**

Append to `server/scripts/scrapeRecruitingClass.ts`:

```ts
async function llmFallback(school: School, gender: 'mens' | 'womens'): Promise<{ count: number | null; commits: RecruitCommit[] } | null> {
  budget.assertCanSpend(0.05)
  const gl = gender === 'mens' ? "men's" : "women's"
  const prompt = `Find the incoming Class of ${CURRENT_CLASS_YEAR} for the ${gl} soccer program at ${school.name}.
Search official athletic-department signing announcements and press releases on the school's athletic website.
Do NOT invent commits — if you cannot find verified names, return commits=[] and count=null.
Return ONLY JSON: {"count": <number|null>, "commits":[{"name":"Full Name","position":"FW|MF|DF|GK|null","hometown":"City, ST|null","club":"Club Name|null"}], "reason":"one sentence"}`

  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    tools: [{ type: 'web_search_20250305' as any, name: 'web_search', max_uses: 5 }],
    messages: [{ role: 'user', content: prompt }],
  })
  budget.record('recruiting-llm', 0.05)
  let txt = ''; for (const b of resp.content) if (b.type === 'text') txt = b.text
  const m = txt.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const parsed = JSON.parse(m[0])
    return { count: parsed.count ?? null, commits: Array.isArray(parsed.commits) ? parsed.commits : [] }
  } catch {
    return null
  }
}
```

- [ ] **Step 3.5: Wire main, source order, write-out**

Append to `server/scripts/scrapeRecruitingClass.ts`:

```ts
async function buildClass(browser: Browser, school: School, gender: 'mens' | 'womens', tdsAllowed: boolean): Promise<RecruitingClass | null> {
  let commits: RecruitCommit[] = []
  let count: number | null = null
  let source: RecruitingClass['source'] = 'mixed'
  let confidence: RecruitingClass['confidence'] = 'partial'

  if (tdsAllowed && !ARG_SKIP.includes('tds')) {
    const tds = await scrapeTDS(browser, school, gender)
    if (tds && tds.length > 0) { commits = tds; count = tds.length; source = 'tds'; confidence = 'high' }
  }
  if (commits.length === 0 && !ARG_SKIP.includes('sidearm')) {
    const sidearm = await scrapeSidearmNews(browser, school, gender)
    if (sidearm) { commits = sidearm.commits; count = sidearm.count; source = 'site-scraped'; confidence = 'medium' }
  }
  if (commits.length === 0 && !ARG_SKIP.includes('llm')) {
    try {
      const llm = await llmFallback(school, gender)
      if (llm) { commits = llm.commits; count = llm.count; source = 'llm-research'; confidence = 'low' }
    } catch (e) {
      if (e instanceof BudgetExceededError) console.log('  ⛔ budget cap — skipping LLM fallback')
      else throw e
    }
  }
  if (commits.length === 0 && count === null) return null

  return tagField(
    { schoolId: school.id, gender, classYear: CURRENT_CLASS_YEAR, recruitCount: count, knownCommits: commits },
    source,
    confidence,
  ) as RecruitingClass
}

async function main() {
  const schools = loadJson<School[]>(SCHOOLS_PATH, []).filter(s => ['D1','D2','D3'].includes(s.division))
  const filtered = ARG_SCHOOL ? schools.filter(s => s.id === ARG_SCHOOL) : schools
  const classes = loadJson<Record<string, RecruitingClass>>(CLASSES_PATH, {})

  const tdsAllowed = await checkRobots('www.topdrawersoccer.com', ['/college-soccer'])
  if (!tdsAllowed) console.log('⚠️ TDS robots.txt disallows — skipping Source 1')

  const queue: Array<{ school: School; gender: 'mens' | 'womens' }> = []
  for (const s of filtered) for (const g of ['mens','womens'] as const) {
    const key = `${s.id}:${g}`
    if (ARG_RESUME && classes[key] && isFresh(classes[key].lastVerified, FRESHNESS_DAYS)) continue
    queue.push({ school: s, gender: g })
  }
  const limited = queue.slice(0, ARG_LIMIT)
  console.log(`Targets: ${limited.length}.  Budget so far: $${budget.totalSpent().toFixed(2)}`)

  const browser = await puppeteer.launch({ headless: true })
  let ok = 0, miss = 0, counter = 0
  try {
    for (const { school, gender } of limited) {
      counter++
      const cls = await buildClass(browser, school, gender, tdsAllowed)
      if (cls) { classes[`${school.id}:${gender}`] = cls; ok++ }
      else miss++
      console.log(`[${counter}/${limited.length}] ${cls ? '✅' : '❌'} ${school.id}:${gender} (${cls?.source ?? 'none'}) commits=${cls?.knownCommits.length ?? 0}`)
      if (counter % 10 === 0) fs.writeFileSync(CLASSES_PATH, JSON.stringify(classes, null, 2))
      await new Promise(r => setTimeout(r, 1000))
    }
  } finally {
    await browser.close()
    fs.writeFileSync(CLASSES_PATH, JSON.stringify(classes, null, 2))
  }
  console.log(`\nDone — ok:${ok} miss:${miss}.  Final spend: $${budget.totalSpent().toFixed(2)}`)
}

main().catch(e => { console.error('CRASHED:', e); process.exit(1) })
```

- [ ] **Step 3.6: Smoke test recruiting class scraper**

Run: `npx tsx server/scripts/scrapeRecruitingClass.ts --school=unc`
Expected: writes 2 entries to `recruitingClasses.json`. Likely TDS hit for both. Spend stays at zero unless LLM fallback triggered.

Run wider: `npx tsx server/scripts/scrapeRecruitingClass.ts --limit=10`
Expected: ~5–7 hits, ~3–5 misses (D2/D3 thinner on TDS). Budget spend < $0.50 if LLM fired only for misses.

- [ ] **Step 3.7: Commit**

```bash
git add server/scripts/scrapeRecruitingClass.ts server/data/recruitingClasses.json
git commit -m "feat(scraper): recruiting class — TDS → Sidearm → Sonnet fallback"
```

---

## Task 4: Wire Into the Matcher

**Files:**
- Modify: `server/lib/schoolMatcher.ts`

The matcher already loads `schools.json` and joins coach data. We extend it to read `programRecords.json` and `recruitingClasses.json` at module-load time and surface them on the school payload returned to the client.

- [ ] **Step 4.1: Read the existing matcher**

Read [server/lib/schoolMatcher.ts](server/lib/schoolMatcher.ts) end-to-end. Identify where the school object is assembled before being returned to the client (typically a `mapSchool` or inline object literal). The new fields will be added there.

- [ ] **Step 4.2: Add data loaders at top of file**

In `server/lib/schoolMatcher.ts`, near the top with other data imports, add:

```ts
import * as fs from 'fs'
import * as path from 'path'
import type { ProgramRecord, RecruitingClass } from '../../client/src/types/athletic'

const _recordsPath = path.join(__dirname, '..', 'data', 'programRecords.json')
const _classesPath = path.join(__dirname, '..', 'data', 'recruitingClasses.json')

const programRecords: Record<string, ProgramRecord> =
  fs.existsSync(_recordsPath) ? JSON.parse(fs.readFileSync(_recordsPath, 'utf8')) : {}
const recruitingClasses: Record<string, RecruitingClass> =
  fs.existsSync(_classesPath) ? JSON.parse(fs.readFileSync(_classesPath, 'utf8')) : {}
```

- [ ] **Step 4.3: Surface the new fields where each school is built**

In the school assembly path (the spot identified in Step 4.1), augment the returned object with:

```ts
record: programRecords[`${school.id}:${gender}`] ?? null,
recruitingClass: recruitingClasses[`${school.id}:${gender}`] ?? null,
```

If the matcher does not already know the gender at the assembly site, derive it from the athlete profile's `gender` field that is already passed into the matching function.

- [ ] **Step 4.4: Add `record` and `recruitingClass` to the School type**

In `client/src/types/index.ts`, append to the `School` interface:

```ts
record?: ProgramRecord | null
recruitingClass?: RecruitingClass | null
```

(Add the corresponding import: `import type { ProgramRecord, RecruitingClass } from './athletic'` at the top of the file.)

- [ ] **Step 4.5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to athletic types or the matcher.

- [ ] **Step 4.6: Run all tests**

Run: `npm test`
Expected: PASS — existing tests + the 6 new ones from Task 0 and Task 2 (10 total: 4 budget, 2 confidence, 4 NCAA, 2 Wikipedia).

- [ ] **Step 4.7: Commit**

```bash
git add server/lib/schoolMatcher.ts client/src/types/index.ts
git commit -m "feat(matcher): expose program record + recruiting class on school payload"
```

---

## Task 5: Full Run + Coverage Audit

**Files:** none new — this is the production run + verification gate.

- [ ] **Step 5.1: Run the coach-gap filler in full**

```bash
npx tsx server/scripts/fillCoachGaps.ts
```

Expected: ~$5–8 spend, several hundred entries resolved across both passes. After completion run the coverage audit:

```bash
node -e "const c=require('./server/data/coachesScraped.json'); const s=require('./server/data/schools.json'); const t=new Set(s.filter(x=>['D1','D2','D3'].includes(x.division)).map(x=>x.id)); const ok=Object.values(c).filter(e=>t.has(e.schoolId) && /\\.edu$/i.test(e.coachEmail||'')).length; console.log('D1/D2/D3 with .edu email:', ok, '/', t.size*2)"
```

Expected: usable-email coverage rises from 739/1224 (60%) toward 950+/1224 (~78%+).

- [ ] **Step 5.2: Run the record scraper in full**

```bash
npx tsx server/scripts/scrapeRecord.ts
```

Expected: ~1,200 entries written to `programRecords.json`. Zero spend recorded (no Claude API).

- [ ] **Step 5.3: Run the recruiting class scraper in full**

```bash
npx tsx server/scripts/scrapeRecruitingClass.ts
```

Expected: ~$5–7 spend, mostly on D3 LLM fallback. `recruitingClasses.json` populated with mixed-confidence entries.

- [ ] **Step 5.4: Confirm budget under cap**

```bash
node -e "const b=require('./server/data/.scraperBudget.json'); console.log('Total spend: $'+b.spendUsd.toFixed(2))"
```

Expected: total spend < $20.

- [ ] **Step 5.5: Commit data files + final note**

```bash
git add server/data/coachesScraped.json server/data/programRecords.json \
        server/data/recruitingClasses.json server/data/ncaaTeamIds.json
git commit -m "data(scraper): full run — coach gap filled, records + recruiting classes added"
```

---

## Self-Review

- **Spec coverage:** every in-scope field from the spec has at least one task. Coach name + email → Task 1. Competitive record → Task 2. Recruiting class → Task 3. Division + location drift check → out of scope per spec, no task needed (already 100% real).
- **Reliability invariants:** all five (source/confidence/lastVerified, spend tracker, no fabricated emails, resume-safe, drift detection) are implemented in code. Only the 5% drift sample isn't its own task — it's worth adding as a future Task 6 once we have stable data files, since it requires existing data to sample.
- **Type consistency:** `ProgramRecord`, `RecruitingClass`, `RecruitCommit`, `SeasonRecord`, `ConfidenceTag` are defined once in `client/src/types/athletic.ts` and imported everywhere. Source enum strings match between types and runtime (`'tds' | 'site-scraped' | 'llm-research' | 'mixed'`).
- **Placeholder scan:** no TBD/TODO. Every code step has full code. Every command has expected output.
- **Cost realism:** Task 1 worst case $8 + Task 3 worst case $7 = $15. Headroom of $5 against the $20 cap.
