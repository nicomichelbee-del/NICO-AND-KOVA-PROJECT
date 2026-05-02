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

interface UrlAttempt {
  url: string
  status: number | string
  parsed: boolean
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
  status: 'success' | 'no-program' | 'failed' | 'partial' | 'ai-inferred' | 'email-inferred'
  reason?: string
  urlAttempts?: UrlAttempt[]
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
  // Bare-noun slug. JUCO Presto/Site-Improve sites use "msoccer"/"wsoccer".
  const slugNoun = gender === 'mens' ? 'msoccer' : 'wsoccer'
  // Hyphen-noun slug. Some institutional .edu sites use "men-soccer".
  const slugHyphen = gender === 'mens' ? 'men-soccer' : 'women-soccer'
  // Presto sport= query value.
  const prestoSport = gender === 'mens' ? "men's+soccer" : "women's+soccer"
  const base = domain.startsWith('http') ? domain : `https://${domain}`
  return [
    // ── SIDEARM (highest hit rate; .com athletic sites) ──
    `${base}/sports/${slug}/coaches`,
    `${base}/sports/${slugShort}/coaches`,
    `${base}/sports/${slug}/staff`,
    `${base}/sports/${slugShort}/staff`,
    `${base}/sports/${slugCompact}/coaches`,
    `${base}/sports/${slug}/roster`,
    `${base}/sports/${slug}`,
    `${base}/sports/${slugShort}`,
    // ── Presto Sports (JUCO + smaller D3/NAIA programs) ──
    // Presto encodes the sport as a path or query param. Both variants seen.
    `${base}/coaches.aspx?path=${slugCompact}`,
    `${base}/coaches.aspx?sport=${prestoSport}`,
    `${base}/sports/${slugNoun}/coaches`,
    `${base}/staff.aspx?path=${slugCompact}`,
    // ── WordPress / Site Improve / institutional .edu CMSes ──
    // Common on D3 and NAIA where athletics sits under a department URL.
    `${base}/athletics/${slug}/coaches`,
    `${base}/athletics/${slug}/staff`,
    `${base}/athletics/sports/${slug}/coaches`,
    `${base}/programs/${slug}/staff`,
    `${base}/programs/${slug}/coaches`,
    `${base}/${slug}/coaches`,
    `${base}/${slug}/staff`,
    `${base}/${slugHyphen}/coaches`,
    `${base}/${slugHyphen}/staff`,
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
  await page.waitForFunction('document.readyState === "complete"', { timeout: 8000 }).catch(() => {})

  // Wait for SIDEARM AJAX coach cards to render, with a 5s timeout fallback.
  // Without this, the 1800ms fixed wait often fires before the XHR completes.
  await page.waitForSelector(
    '.sidearm-staff-member, .s-person-card, .person-card, [class*="staff-card"], [class*="coach-card"]',
    { timeout: 3000 }
  ).catch(() => {})

  // Minimum floor so non-SIDEARM sites also get time to hydrate.
  await new Promise((r) => setTimeout(r, 300))

  await page.evaluate(`window.__TARGET_GENDER__ = ${JSON.stringify(gender)};`)

  const result = (await page.evaluate(PARSER_SOURCE)) as ParseResult | null
  return result
}

// ── Search-engine fallback for unknown domains ────────────────────────────
//
// Returns up to 3 ranked candidate URLs. The caller tries them in order and
// uses the first one that parses. Single-result returns hurt small-school
// recall: Phase 3 of the scraper plan.

const SOCIAL_RE = /twitter|x\.com|youtube|wikipedia|facebook|instagram|linkedin|tiktok|reddit|pinterest/i

function rankSearchResults(links: string[], schoolName: string): string[] {
  // Build a normalized school root: "University of Notre Dame" → "notredame".
  const root = schoolName
    .toLowerCase()
    .replace(/\b(university|college|institute|of|the|state|community|technical|polytechnic|saint|st\.?)\b/g, ' ')
    .replace(/[^a-z]/g, '')
    .slice(0, 12)

  const seen = new Set<string>()
  const unique = links.filter((l) => {
    if (!l || SOCIAL_RE.test(l)) return false
    if (seen.has(l)) return false
    seen.add(l)
    return true
  })

  return unique
    .map((l) => {
      let score = 0
      if (/\bcoach(es)?\b|\bstaff\b|\broster\b/i.test(l)) score += 3
      if (/soccer|msoc|wsoc/i.test(l)) score += 3
      if (root && root.length >= 4 && l.toLowerCase().includes(root)) score += 2
      if (/\.edu(\/|$)/i.test(l)) score += 1
      // Penalize obvious news / press / podcast hits
      if (/\b(news|story|article|press|podcast|youtube|video|gallery|photo)\b/i.test(l)) score -= 2
      return { url: l, score }
    })
    .sort((a, b) => b.score - a.score)
    .map((r) => r.url)
}

function looksLikeAthleticsPage(url: string, schoolName: string): boolean {
  if (!url || SOCIAL_RE.test(url)) return false
  if (!/coach|staff|roster|sports|athletic/i.test(url)) return false
  return true
}

async function searchDDG(page: Page, schoolName: string, gender: 'mens' | 'womens'): Promise<string[]> {
  const q = encodeURIComponent(`${schoolName} ${gender === 'mens' ? "men's" : "women's"} soccer head coach site:edu OR site:com`)
  const url = `https://duckduckgo.com/html/?q=${q}`
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await new Promise((r) => setTimeout(r, 300))
    const links = (await page.evaluate(`(function(){
      var out = [];
      document.querySelectorAll('a.result__a, a.result__url, .result__title a').forEach(function(a){
        var href = a.href;
        if (href && /^https?:\\/\\//.test(href) && href.indexOf('duckduckgo.com') === -1) out.push(href);
      });
      return out;
    })()`)) as string[]
    return links
  } catch {
    return []
  }
}

async function searchBing(page: Page, schoolName: string, gender: 'mens' | 'womens'): Promise<string[]> {
  const q = encodeURIComponent(`${schoolName} ${gender === 'mens' ? "men's" : "women's"} soccer head coach`)
  const url = `https://www.bing.com/search?q=${q}`
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await new Promise((r) => setTimeout(r, 300))
    const links = (await page.evaluate(`(function(){
      var out = [];
      document.querySelectorAll('#b_results li.b_algo h2 a, #b_results .b_title a').forEach(function(a){
        var href = a.href;
        if (href && /^https?:\\/\\//.test(href) && href.indexOf('bing.com') === -1) out.push(href);
      });
      return out;
    })()`)) as string[]
    return links
  } catch {
    return []
  }
}

async function discoverCoachPages(
  page: Page,
  schoolName: string,
  gender: 'mens' | 'womens',
  maxResults = 3,
): Promise<string[]> {
  const ddgLinks = await searchDDG(page, schoolName, gender)
  let ranked = rankSearchResults(ddgLinks, schoolName).filter((u) => looksLikeAthleticsPage(u, schoolName))

  // Bing fallback when DDG returns nothing usable. DDG is sparser for very
  // small schools (JUCO, NAIA), and Bing's small-site coverage tends to be
  // better there.
  if (ranked.length < maxResults) {
    const bingLinks = await searchBing(page, schoolName, gender)
    const bingRanked = rankSearchResults(bingLinks, schoolName).filter((u) => looksLikeAthleticsPage(u, schoolName))
    const seen = new Set(ranked)
    for (const u of bingRanked) {
      if (!seen.has(u)) {
        ranked.push(u)
        seen.add(u)
      }
    }
  }

  return ranked.slice(0, maxResults)
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

    // If we don't have a domain in our map, try discovery first. Top 3 results
    // are queued in rank order; the first to parse wins.
    if (!domain) {
      const discovered = await discoverCoachPages(page, school.name, gender, 3)
      candidateUrls.push(...discovered)
    }

    const urlAttempts: UrlAttempt[] = []
    const oppositeSlug = gender === 'mens' ? /\/(womens-soccer|w-soccer|wsoc)\b/i : /\/(mens-soccer|m-soccer|msoc)\b/i
    for (const url of candidateUrls) {
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
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
        urlAttempts.push({ url, status, parsed: !!(parsed?.coachName || parsed?.coachEmail) })
        if (parsed && (parsed.coachName || parsed.coachEmail)) {
          return {
            ...base,
            coachName: parsed.coachName,
            coachTitle: parsed.coachTitle,
            coachEmail: parsed.coachEmail,
            sourceUrl: finalUrl,
            status: parsed.coachName && parsed.coachEmail ? 'success' : 'partial',
            reason: !parsed.coachName ? 'program email only; coach name not found'
                  : !parsed.coachEmail ? 'name extracted, email not found'
                  : undefined,
          }
        }
      } catch (e) {
        const err = e as Error
        urlAttempts.push({ url, status: `error: ${err.message.slice(0, 60)}`, parsed: false })
        if (process.env.DEBUG_SCRAPE) console.log('  full err:', err.stack?.split('\n').slice(0, 5).join(' | '))
      }
    }
    if (process.env.DEBUG_SCRAPE) console.log(`  ↳ ${school.id}:${gender} attempts:`, JSON.stringify(urlAttempts))

    // If domain was known but no URL pattern matched, try discovery as fallback.
    // Top 3 ranked results are tried in order; first to parse wins.
    if (domain) {
      const discovered = await discoverCoachPages(page, school.name, gender, 3)
      for (const url of discovered) {
        try {
          const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
          const status = response?.status() ?? 'no-response'
          if (!response || response.status() >= 400) {
            urlAttempts.push({ url, status, parsed: false })
            continue
          }
          const parsed = await parseStaffFromPage(page, gender)
          urlAttempts.push({ url, status, parsed: !!(parsed?.coachName || parsed?.coachEmail) })
          if (parsed && (parsed.coachName || parsed.coachEmail)) {
            return {
              ...base,
              coachName: parsed.coachName,
              coachTitle: parsed.coachTitle,
              coachEmail: parsed.coachEmail,
              sourceUrl: page.url(),
              status: parsed.coachName && parsed.coachEmail ? 'success' : 'partial',
              reason: !parsed.coachName ? 'program email only via search'
                    : !parsed.coachEmail ? 'name extracted via search; email not found'
                    : 'discovered via search',
              urlAttempts,
            }
          }
        } catch (e) {
          const err = e as Error
          urlAttempts.push({ url, status: `error: ${err.message.slice(0, 60)}`, parsed: false })
        }
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
      urlAttempts,
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
      // Skip terminal-good states on --resume. `email-inferred` is preserved
      // because re-scraping the same site is what produced the partial in the
      // first place — it would just clobber the Haiku-inferred email back to
      // empty. To force-refresh inferred entries, run without --resume.
      if (ARG_RESUME && cache[key] && (cache[key].status === 'success' || cache[key].status === 'email-inferred')) continue
      tasks.push({ school, gender })
    }
  }

  // Recruiting priority: D1 > D3 > D2 > NAIA > JUCO. D1 has the most users
  // and the strictest data freshness needs; D3 second because parents care a
  // lot about academic-fit schools. D2/NAIA/JUCO are smaller user segments.
  const DIVISION_PRIORITY: Record<string, number> = { D1: 0, D3: 1, D2: 2, NAIA: 3, JUCO: 4 }
  tasks.sort((a, b) => {
    const ap = DIVISION_PRIORITY[a.school.division] ?? 99
    const bp = DIVISION_PRIORITY[b.school.division] ?? 99
    return ap - bp
  })

  const limited = tasks.slice(0, ARG_LIMIT)

  console.log(`Scraping ${limited.length} (school, gender) pairs with concurrency=${ARG_CONCURRENCY}`)
  console.log(`Schools in DB: ${allSchools.length}, cached: ${Object.keys(cache).length}`)

  const LAUNCH_OPTS = {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    protocolTimeout: 60000,
  }

  let browser = await puppeteer.launch(LAUNCH_OPTS)

  const launchBrowser = async () => {
    try { await browser.close() } catch { /* already dead */ }
    browser = await puppeteer.launch(LAUNCH_OPTS)
    console.log('  ↺ browser restarted')
  }

  let success = 0
  let partial = 0
  let failed = 0
  let counter = 0

  try {
    await runWithLimit(limited, ARG_CONCURRENCY, async ({ school, gender }) => {
      const key = `${school.id}:${gender}`
      let result: ScrapedCoach
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
