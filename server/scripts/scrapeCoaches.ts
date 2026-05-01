/**
 * Coach scraper.
 *
 * For each school × gender, attempts to find the head coach's name and email
 * by visiting common athletics-site URL patterns with Puppeteer and parsing
 * the rendered DOM. Output: server/data/coachesScraped.json keyed by
 * `${schoolId}:${gender}`.
 *
 * Usage:
 *   npx tsx server/scripts/scrapeCoaches.ts                # all schools
 *   npx tsx server/scripts/scrapeCoaches.ts --limit=10     # first 10
 *   npx tsx server/scripts/scrapeCoaches.ts --school=unc   # single school
 *   npx tsx server/scripts/scrapeCoaches.ts --resume       # skip already-scraped
 *
 * The scraper is honest about failure. Schools that can't be parsed are
 * recorded with status="failed" and the reason. The /api/ai/find-coach
 * endpoint reads from this file first; failed entries fall back to the
 * existing AI-recall path.
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
  conference: string
}

interface ScrapedCoach {
  schoolId: string
  schoolName: string
  gender: 'mens' | 'womens'
  coachName: string
  coachTitle: string
  coachEmail: string
  sourceUrl: string
  scrapedAt: string
  status: 'success' | 'no-program' | 'failed' | 'partial'
  reason?: string
}

type Cache = Record<string, ScrapedCoach>

const CACHE_PATH = path.join(__dirname, '..', 'data', 'coachesScraped.json')

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
const ARG_CONCURRENCY = args.concurrency ? parseInt(args.concurrency, 10) : 3

// ── cache ─────────────────────────────────────────────────────────────────

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

// ── URL pattern attempts ──────────────────────────────────────────────────

function urlPatterns(domain: string, gender: 'mens' | 'womens'): string[] {
  // Only gender-specific URLs. Generic staff directories cause cross-gender
  // contamination because most pages list "Head Coach" titles without a gender
  // qualifier — e.g., Stanford's staff directory had Patrick Ruden (men's
  // coach) returned for women's queries because the title was just "Head Coach".
  const slug = gender === 'mens' ? 'mens-soccer' : 'womens-soccer'
  const slugShort = gender === 'mens' ? 'm-soccer' : 'w-soccer'
  const slugCompact = gender === 'mens' ? 'msoc' : 'wsoc'
  const base = domain.startsWith('http') ? domain : `https://${domain}`
  return [
    `${base}/sports/${slug}/coaches`,
    `${base}/sports/${slugShort}/coaches`,
    `${base}/sports/${slug}/staff`,
    `${base}/sports/${slugShort}/staff`,
    `${base}/sports/${slugCompact}/coaches`,
    `${base}/sports/${slug}/roster`,
    `${base}/sports/${slug}`,
    `${base}/sports/${slugShort}`,
  ]
}

// ── parsing ───────────────────────────────────────────────────────────────

interface ParseResult {
  coachName: string
  coachTitle: string
  coachEmail: string
}

// The parser body is loaded from a plain JS file so esbuild/tsx cannot inject
// `__name` helpers (which are undefined in the browser context). The file is
// already wrapped as an IIFE that returns the result.
const PARSER_SOURCE = fs.readFileSync(path.join(__dirname, 'parserBody.js'), 'utf8')

async function parseStaffFromPage(page: Page, gender: 'mens' | 'womens'): Promise<ParseResult | null> {
  // Wait briefly for SIDEARM JS frameworks to hydrate. Use string form to dodge
  // tsx __name injection (same reason we load the parser body from a .js file).
  await page.waitForFunction('document.readyState === "complete"', { timeout: 8000 }).catch(() => {})
  await new Promise((r) => setTimeout(r, 1800))

  // Tell the parser which gender we're scraping so it can reject mismatched
  // staff entries when scraping a generic staff-directory page.
  await page.evaluate(`window.__TARGET_GENDER__ = ${JSON.stringify(gender)};`)

  const result = (await page.evaluate(PARSER_SOURCE)) as ParseResult | null
  return result
}

// ── Google search fallback for unknown domains ────────────────────────────

async function discoverCoachPage(page: Page, schoolName: string, gender: 'mens' | 'womens'): Promise<string | null> {
  const q = encodeURIComponent(`${schoolName} ${gender === 'mens' ? "men's" : "women's"} soccer head coach site:edu OR site:com`)
  // DuckDuckGo HTML results are scrape-friendly — Google blocks WebFetch and
  // is iffy from headless Chrome. DDG is consistent.
  const url = `https://duckduckgo.com/html/?q=${q}`

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await new Promise((r) => setTimeout(r, 800))
    // Pass as a string to avoid tsx esbuild __name injection.
    const links = (await page.evaluate(`(function(){
      var out = [];
      document.querySelectorAll('a.result__a, a.result__url, .result__title a').forEach(function(a){
        var href = a.href;
        if (href && /^https?:\\/\\//.test(href) && href.indexOf('duckduckgo.com') === -1) out.push(href);
      });
      return out;
    })()`)) as string[]

    // Prefer URLs that look like coach/staff pages
    const ranked = links
      .filter((l) => !/twitter|youtube|wikipedia|facebook|instagram|linkedin/i.test(l))
      .sort((a, b) => {
        const aScore = (/coach|staff|roster/i.test(a) ? 1 : 0) + (/soccer/i.test(a) ? 1 : 0)
        const bScore = (/coach|staff|roster/i.test(b) ? 1 : 0) + (/soccer/i.test(b) ? 1 : 0)
        return bScore - aScore
      })

    return ranked[0] ?? null
  } catch {
    return null
  }
}

// ── per-school scrape ─────────────────────────────────────────────────────

async function scrapeOne(
  browser: Browser,
  school: SchoolRecord,
  gender: 'mens' | 'womens',
): Promise<ScrapedCoach> {
  const base: Pick<ScrapedCoach, 'schoolId' | 'schoolName' | 'gender' | 'scrapedAt'> = {
    schoolId: school.id,
    schoolName: school.name,
    gender,
    scrapedAt: new Date().toISOString(),
  }

  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36')
  await page.setViewport({ width: 1280, height: 800 })
  // Note: request interception causes a tsx/Puppeteer interaction bug
  // ("__name is not defined") — skipping it. Pages load slightly slower but
  // reliably. We do not need fonts/images for parsing the staff text anyway.

  try {
    const domain = ATHLETICS_DOMAINS[school.id]
    const candidateUrls: string[] = domain ? urlPatterns(domain, gender) : []

    // If we don't have a domain in our map, try discovery first.
    if (!domain) {
      const discovered = await discoverCoachPage(page, school.name, gender)
      if (discovered) candidateUrls.push(discovered)
    }

    const urlAttempts: { url: string; status: number | string; parsed: boolean }[] = []
    const oppositeSlug = gender === 'mens' ? /\/(womens-soccer|w-soccer|wsoc)\b/i : /\/(mens-soccer|m-soccer|msoc)\b/i
    for (const url of candidateUrls) {
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
        const status = response?.status() ?? 'no-response'
        if (!response || response.status() >= 400) {
          urlAttempts.push({ url, status, parsed: false })
          continue
        }

        // Silent redirect detection — e.g., FSU has no men's soccer, so
        // /sports/mens-soccer/staff returns 200 but the page is for women's.
        const finalUrl = page.url()
        if (oppositeSlug.test(finalUrl)) {
          urlAttempts.push({ url, status: `redirected-to-opposite-gender:${finalUrl}`, parsed: false })
          continue
        }

        const parsed = await parseStaffFromPage(page, gender)
        urlAttempts.push({ url, status, parsed: !!parsed?.coachName })
        if (parsed && parsed.coachName) {
          return {
            ...base,
            coachName: parsed.coachName,
            coachTitle: parsed.coachTitle,
            coachEmail: parsed.coachEmail,
            sourceUrl: finalUrl,
            status: parsed.coachEmail ? 'success' : 'partial',
            reason: parsed.coachEmail ? undefined : 'name extracted, email not found',
          }
        }
      } catch (e) {
        const err = e as Error
        urlAttempts.push({ url, status: `error: ${err.message.slice(0, 60)}`, parsed: false })
        if (process.env.DEBUG_SCRAPE) console.log('  full err:', err.stack?.split('\n').slice(0, 5).join(' | '))
      }
    }
    if (process.env.DEBUG_SCRAPE) console.log(`  ↳ ${school.id}:${gender} attempts:`, JSON.stringify(urlAttempts))

    // If domain was known but no URL pattern matched, try discovery as fallback
    if (domain) {
      const discovered = await discoverCoachPage(page, school.name, gender)
      if (discovered) {
        try {
          await page.goto(discovered, { waitUntil: 'domcontentloaded', timeout: 15000 })
          const parsed = await parseStaffFromPage(page, gender)
          if (parsed && parsed.coachName) {
            return {
              ...base,
              coachName: parsed.coachName,
              coachTitle: parsed.coachTitle,
              coachEmail: parsed.coachEmail,
              sourceUrl: page.url(),
              status: parsed.coachEmail ? 'success' : 'partial',
              reason: parsed.coachEmail ? 'discovered via search' : 'name extracted via search; email not found',
            }
          }
        } catch { /* fall through */ }
      }
    }

    return {
      ...base,
      coachName: '',
      coachTitle: '',
      coachEmail: '',
      sourceUrl: '',
      status: 'failed',
      reason: domain ? 'no URL pattern returned a parseable head-coach card' : 'no domain mapping and search discovery failed',
    }
  } finally {
    await page.close().catch(() => {})
  }
}

// ── concurrency-limited driver ────────────────────────────────────────────

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

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  const allSchools = schoolsData as SchoolRecord[]
  const cache = loadCache()

  // Build the work queue: (school, gender) pairs.
  const tasks: Array<{ school: SchoolRecord; gender: 'mens' | 'womens' }> = []
  for (const school of allSchools) {
    if (ARG_SCHOOL && school.id !== ARG_SCHOOL) continue
    for (const gender of ['mens', 'womens'] as const) {
      const key = `${school.id}:${gender}`
      if (ARG_RESUME && cache[key] && cache[key].status === 'success') continue
      tasks.push({ school, gender })
    }
  }
  const limited = tasks.slice(0, ARG_LIMIT)

  console.log(`Scraping ${limited.length} (school, gender) pairs with concurrency=${ARG_CONCURRENCY}`)
  console.log(`Schools in DB: ${allSchools.length}, cached: ${Object.keys(cache).length}`)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  let success = 0
  let partial = 0
  let failed = 0
  let counter = 0

  try {
    await runWithLimit(limited, ARG_CONCURRENCY, async ({ school, gender }) => {
      const key = `${school.id}:${gender}`
      const result = await scrapeOne(browser, school, gender)
      cache[key] = result

      counter++
      if (result.status === 'success') success++
      else if (result.status === 'partial') partial++
      else failed++

      const tag =
        result.status === 'success' ? '✅' :
        result.status === 'partial' ? '🟡' : '❌'
      const emailFmt = result.coachEmail || '(no email)'
      console.log(
        `[${counter}/${limited.length}] ${tag} ${school.id}:${gender} ` +
        `${result.coachName || '(no name)'} ${emailFmt}` +
        (result.reason ? ` — ${result.reason}` : ''),
      )

      // Persist incrementally so a crash doesn't lose work.
      if (counter % 10 === 0) saveCache(cache)
    })
  } finally {
    await browser.close()
    saveCache(cache)
  }

  console.log('\n══ FINAL REPORT ══')
  console.log(`Success (name + email):    ${success}`)
  console.log(`Partial (name only):       ${partial}`)
  console.log(`Failed:                    ${failed}`)
  console.log(`Total processed:           ${counter}`)
  console.log(`Cache file:                ${CACHE_PATH}`)
}

main().catch((e) => {
  console.error('SCRAPER CRASHED:', e)
  process.exit(1)
})
