/**
 * Roster scraper — companion to scrapeCoaches.
 *
 * For each school × gender, fetches the team roster page and extracts
 * { name, position, classYear } for each player. The matcher uses this to
 * compute "open spots" — how many players at the athlete's position are
 * graduating, vs. how stocked the team is now.
 *
 * Output: server/data/rostersScraped.json keyed by `${schoolId}:${gender}`.
 *
 * Usage:
 *   npx tsx server/scripts/scrapeRosters.ts                # all schools
 *   npx tsx server/scripts/scrapeRosters.ts --resume       # skip cached
 *   npx tsx server/scripts/scrapeRosters.ts --limit=10
 *   npx tsx server/scripts/scrapeRosters.ts --school=unc
 *   npx tsx server/scripts/scrapeRosters.ts --concurrency=10
 *
 * The scraper is honest about failure: schools whose roster pages can't be
 * parsed land in status='failed' with a reason. The matcher gracefully
 * handles missing roster data.
 */

import fs from 'fs'
import path from 'path'
import puppeteer, { Browser, Page } from 'puppeteer'
import schoolsData from '../data/schools.json'
import { ATHLETICS_DOMAINS } from './athleticsDomains'

interface SchoolRecord {
  id: string
  name: string
  division: string
}

interface Player {
  name: string
  position: 'GK' | 'D' | 'M' | 'F' | 'U'
  classYear: string  // 'Fr' | 'So' | 'Jr' | 'Sr' | 'Gr' | '2027' | ''
}

interface ScrapedRoster {
  schoolId:   string
  schoolName: string
  gender:     'mens' | 'womens'
  players:    Player[]
  sourceUrl:  string
  scrapedAt:  string
  status:     'success' | 'failed' | 'no-program'
  reason?:    string
}

type Cache = Record<string, ScrapedRoster>

const CACHE_PATH = path.join(__dirname, '..', 'data', 'rostersScraped.json')

// ── CLI args ──────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }),
)

const ARG_LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity
const ARG_SCHOOL = args.school as string | undefined
const ARG_RESUME = args.resume === 'true'
const ARG_CONCURRENCY = args.concurrency ? parseInt(args.concurrency, 10) : 5
const ARG_DIVISION = args.division as string | undefined

// ── Cache I/O ─────────────────────────────────────────────────────────────

function loadCache(): Cache {
  try {
    if (!fs.existsSync(CACHE_PATH)) return {}
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function saveCache(cache: Cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
}

// ── URL patterns ──────────────────────────────────────────────────────────

function urlPatterns(domain: string, gender: 'mens' | 'womens'): string[] {
  const slug = gender === 'mens' ? 'mens-soccer' : 'womens-soccer'
  const slugShort = gender === 'mens' ? 'm-soccer' : 'w-soccer'
  const slugCompact = gender === 'mens' ? 'msoc' : 'wsoc'
  const base = domain.startsWith('http') ? domain : `https://${domain}`
  return [
    `${base}/sports/${slug}/roster`,
    `${base}/sports/${slugShort}/roster`,
    `${base}/sports/${slugCompact}/roster`,
    `${base}/roster.aspx?path=${slugCompact}`,
    `${base}/sports/${slug}/roster/2025-26`,
    `${base}/sports/${slug}/roster/2024-25`,
  ]
}

// ── Parser ────────────────────────────────────────────────────────────────

const PARSER_SOURCE = fs.readFileSync(path.join(__dirname, 'parseRosterBody.js'), 'utf8')

interface ParseResult {
  players: Player[]
  rosterPage: boolean
}

async function parseRosterFromPage(page: Page): Promise<ParseResult | null> {
  await page.waitForFunction('document.readyState === "complete"', { timeout: 8000 }).catch(() => {})
  // Wait briefly for SIDEARM-style hydration.
  await page.waitForSelector(
    '.sidearm-roster-player, .s-person-card, .person-card, [class*="player-card"], table',
    { timeout: 3000 }
  ).catch(() => {})
  await new Promise((r) => setTimeout(r, 300))
  return (await page.evaluate(PARSER_SOURCE)) as ParseResult | null
}

// ── Per-school scrape ─────────────────────────────────────────────────────

async function scrapeOne(
  browser: Browser,
  school: SchoolRecord,
  gender: 'mens' | 'womens',
): Promise<ScrapedRoster> {
  const base = {
    schoolId: school.id,
    schoolName: school.name,
    gender,
    scrapedAt: new Date().toISOString(),
  }

  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36')
  await page.setViewport({ width: 1280, height: 800 })

  try {
    const domain = ATHLETICS_DOMAINS[school.id]
    if (!domain) {
      return {
        ...base,
        players: [], sourceUrl: '',
        status: 'failed',
        reason: 'no domain mapping',
      }
    }

    const candidateUrls = urlPatterns(domain, gender)
    const opposite = gender === 'mens' ? /\/(womens-soccer|w-soccer|wsoc)\b/i : /\/(mens-soccer|m-soccer|msoc)\b/i

    for (const url of candidateUrls) {
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
        if (!response || response.status() >= 400) continue
        const finalUrl = page.url()
        if (opposite.test(finalUrl)) continue  // silent redirect to opposite gender

        const parsed = await parseRosterFromPage(page)
        if (parsed && parsed.players.length >= 6) {
          return {
            ...base,
            players: parsed.players,
            sourceUrl: finalUrl,
            status: 'success',
          }
        }
      } catch { /* try next URL */ }
    }

    return {
      ...base,
      players: [], sourceUrl: '',
      status: 'failed',
      reason: 'no URL pattern returned a parseable roster',
    }
  } finally {
    await page.close().catch(() => {})
  }
}

// ── Concurrency-limited driver ────────────────────────────────────────────

async function runWithLimit<T, U>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<U>): Promise<U[]> {
  const results: U[] = []
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++
      results[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return results
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const allSchools = schoolsData as SchoolRecord[]
  const cache = loadCache()

  // Build queue: (school, gender) pairs.
  const tasks: Array<{ school: SchoolRecord; gender: 'mens' | 'womens' }> = []
  for (const school of allSchools) {
    if (ARG_SCHOOL && school.id !== ARG_SCHOOL) continue
    if (ARG_DIVISION && school.division !== ARG_DIVISION) continue
    for (const gender of ['mens', 'womens'] as const) {
      const key = `${school.id}:${gender}`
      if (ARG_RESUME && cache[key] && cache[key].status === 'success') continue
      tasks.push({ school, gender })
    }
  }

  // Priority: D1 → D3 → D2 → NAIA → JUCO (matches the coach scraper).
  const DIVISION_PRIORITY: Record<string, number> = { D1: 0, D3: 1, D2: 2, NAIA: 3, JUCO: 4 }
  tasks.sort((a, b) => (DIVISION_PRIORITY[a.school.division] ?? 99) - (DIVISION_PRIORITY[b.school.division] ?? 99))

  const limited = tasks.slice(0, ARG_LIMIT)

  console.log(`Scraping rosters for ${limited.length} (school, gender) pairs with concurrency=${ARG_CONCURRENCY}`)
  console.log(`Schools in DB: ${allSchools.length}, cached: ${Object.keys(cache).length}`)

  const LAUNCH_OPTS = {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    protocolTimeout: 60000,
  }
  let browser = await puppeteer.launch(LAUNCH_OPTS)
  const launchBrowser = async () => {
    try { await browser.close() } catch { /* dead */ }
    browser = await puppeteer.launch(LAUNCH_OPTS)
    console.log('  ↺ browser restarted')
  }

  let success = 0
  let failed = 0
  let counter = 0

  try {
    await runWithLimit(limited, ARG_CONCURRENCY, async ({ school, gender }) => {
      const key = `${school.id}:${gender}`
      let result: ScrapedRoster
      try {
        result = await scrapeOne(browser, school, gender)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (/connection closed|protocol error|session closed|timed out|target closed/i.test(msg)) {
          await launchBrowser()
          result = await scrapeOne(browser, school, gender)
        } else {
          throw e
        }
      }
      cache[key] = result

      counter++
      if (result.status === 'success') success++
      else failed++

      const tag = result.status === 'success' ? '✅' : '❌'
      const meta = result.status === 'success'
        ? `${result.players.length} players`
        : (result.reason ?? 'unknown failure')
      console.log(`[${counter}/${limited.length}] ${tag} ${school.id}:${gender} — ${meta}`)

      if (counter % 10 === 0) saveCache(cache)
    })
  } finally {
    await browser.close()
    saveCache(cache)
  }

  console.log('\n══ FINAL REPORT ══')
  console.log(`Success: ${success}`)
  console.log(`Failed:  ${failed}`)
  console.log(`Total:   ${counter}`)
  console.log(`Cache:   ${CACHE_PATH}`)
}

main().catch((e) => {
  console.error('ROSTER SCRAPER CRASHED:', e)
  process.exit(1)
})
