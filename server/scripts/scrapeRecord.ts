/**
 * Competitive record scraper — D1/D2/D3 men's & women's soccer.
 *
 * Source order per school+gender:
 *   1. Wikipedia opensearch title resolution → wikitext → tourney appearances
 *   2. Haiku web_search fallback (if Wikipedia yields nothing)
 *
 * Usage:
 *   npx tsx server/scripts/scrapeRecord.ts --limit=20
 *   npx tsx server/scripts/scrapeRecord.ts --school=unc
 *   npx tsx server/scripts/scrapeRecord.ts --resume        # skip fresh entries
 */
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'
import { resolveWikipediaTitle, fetchWikipediaWikitext, extractTourneyAppearances } from '../lib/wikipediaTourney'
import { tagField, isFresh } from '../lib/scraperConfidence'
import { ScraperBudget, BudgetExceededError } from '../lib/scraperBudget'
import type { ProgramRecord, SeasonRecord } from '../../client/src/types/athletic'

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const SCHOOLS_PATH = path.join(__dirname, '..', 'data', 'schools.json')
const RECORDS_PATH = path.join(__dirname, '..', 'data', 'programRecords.json')
const BUDGET_PATH  = path.join(__dirname, '..', 'data', '.scraperBudget.json')

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true']
}))
const ARG_LIMIT  = args.limit ? parseInt(args.limit, 10) : Infinity
const ARG_SCHOOL = args.school as string | undefined
const ARG_RESUME = args.resume === 'true'
const FRESHNESS_DAYS = 180

interface School { id: string; name: string; division: string }

function loadJson<T>(p: string, fallback: T): T {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback
}

// ─── Haiku fallback ──────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
const budget = new ScraperBudget(BUDGET_PATH, { soft: 18, hard: 20 })

interface HaikuRecordResult { recordHistory: SeasonRecord[]; reason: string }

async function haikuRecord(school: School, gender: 'mens' | 'womens'): Promise<HaikuRecordResult | null> {
  budget.assertCanSpend(0.005)
  const gl = gender === 'mens' ? "men's" : "women's"
  const prompt = `Find the recent W-L-T season records for the ${gl} soccer program at ${school.name}.
Search official athletic websites and reliable sources. Look at the 2024, 2023, and 2022 seasons.
Do NOT invent records. If you cannot find verified data for a season, omit it.
Return ONLY JSON: {"recordHistory":[{"season":2024,"wins":N,"losses":N,"ties":N,"conferenceRecord":"X-X-X"|null,"ncaaTourneyRound":"First Round"|"Second Round"|"Final Four"|"Champion"|null}],"reason":"one sentence"}`
  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    tools: [{ type: 'web_search_20250305' as any, name: 'web_search', max_uses: 4 }],
    messages: [{ role: 'user', content: prompt }],
  })
  budget.record('haiku-record', 0.005)
  let txt = ''; for (const b of resp.content) if (b.type === 'text') txt = b.text
  const m = txt.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const parsed = JSON.parse(m[0])
    return { recordHistory: Array.isArray(parsed.recordHistory) ? parsed.recordHistory : [], reason: String(parsed.reason ?? '') }
  } catch { return null }
}

// ─── Build record ────────────────────────────────────────────────────────────

async function buildRecord(school: School, gender: 'mens' | 'womens'): Promise<ProgramRecord | null> {
  const queries = [
    `${school.name} ${gender === 'mens' ? "men's" : "women's"} soccer`,
    `${school.name} soccer ${gender === 'mens' ? 'men' : 'women'}`,
  ]
  let wikitext: string | null = null
  for (const q of queries) {
    const title = await resolveWikipediaTitle(q)
    if (!title) continue
    wikitext = await fetchWikipediaWikitext(title)
    if (wikitext) break
  }
  const tourney = wikitext ? extractTourneyAppearances(wikitext) : {}

  let seasons: SeasonRecord[] = []
  let source: ProgramRecord['source'] = 'wikipedia'
  let confidence: ProgramRecord['confidence'] = 'low'

  if (Object.keys(tourney).length > 0) {
    seasons = Object.entries(tourney).slice(-3).map(([y, round]) => ({
      season: parseInt(y, 10), wins: 0, losses: 0, ties: 0,
      conferenceRecord: null, ncaaTourneyRound: round,
    }))
    confidence = 'medium' // tourney appearances are a strong proxy
  }

  // If Wikipedia gave us nothing useful (no tourney info), fall back to Haiku web_search.
  if (seasons.length === 0) {
    try {
      const fallback = await haikuRecord(school, gender)
      if (fallback && fallback.recordHistory.length > 0) {
        seasons = fallback.recordHistory
        source = 'mixed' // Haiku-grounded, attribute as mixed
        confidence = fallback.recordHistory.length >= 2 ? 'medium' : 'low'
      }
    } catch (e) {
      if (e instanceof BudgetExceededError) {
        console.log('  ⛔ budget cap — no haiku fallback')
      } else { throw e }
    }
  }

  if (seasons.length === 0 && Object.keys(tourney).length === 0) return null

  return tagField(
    { schoolId: school.id, gender, recordHistory: seasons },
    source,
    confidence,
  ) as ProgramRecord
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const schools = (loadJson<School[]>(SCHOOLS_PATH, [])).filter(s => ['D1','D2','D3'].includes(s.division))
  const filtered = ARG_SCHOOL ? schools.filter(s => s.id === ARG_SCHOOL) : schools
  const records = loadJson<Record<string, ProgramRecord>>(RECORDS_PATH, {})

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
    const rec = await buildRecord(school, gender)
    if (rec) { records[`${school.id}:${gender}`] = rec; ok++ }
    else miss++
    const tag = rec ? '✅' : '❌'
    console.log(`[${counter}/${limited.length}] ${tag} ${school.id}:${gender}`)
    if (counter % 20 === 0) fs.writeFileSync(RECORDS_PATH, JSON.stringify(records, null, 2))
    await new Promise(r => setTimeout(r, 250)) // be nice to Wikipedia
  }
  fs.writeFileSync(RECORDS_PATH, JSON.stringify(records, null, 2))
  console.log(`\nDone — ok:${ok} miss:${miss}`)
  console.log(`Budget spend: $${budget.totalSpent().toFixed(4)}`)
}

main().catch(e => { console.error('CRASHED:', e); process.exit(1) })
