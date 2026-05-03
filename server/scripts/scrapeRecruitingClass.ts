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
