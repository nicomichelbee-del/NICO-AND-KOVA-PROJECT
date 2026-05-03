/**
 * Expand the school database by querying college conferences via Sonnet + web_search.
 *
 * Usage:
 *   npx tsx server/scripts/expandSchoolDB.ts                    # all divisions
 *   npx tsx server/scripts/expandSchoolDB.ts --div=D1           # one division
 *   npx tsx server/scripts/expandSchoolDB.ts --dry-run          # preview, no writes
 *   npx tsx server/scripts/expandSchoolDB.ts --concurrency=3
 */
import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const SCHOOLS_PATH  = path.join(__dirname, '..', 'data', 'schools.json')
const COACHES_PATH  = path.join(__dirname, '..', 'data', 'coachesScraped.json')

const args = Object.fromEntries(
  process.argv.slice(2).map(a => { const [k,v]=a.replace(/^--/,'').split('='); return [k,v??'true'] })
)
const DRY_RUN  = args['dry-run'] === 'true'
const ARG_DIV  = (args.div as string|undefined)?.toUpperCase()
const ARG_CONC = args.concurrency ? parseInt(args.concurrency,10) : 2

// ── Division defaults ────────────────────────────────────────────────────────

const DIV_DEFAULTS: Record<string, Partial<SchoolJSON>> = {
  D1:   { gpaMin:3.0, gpaAvg:3.4, programStrength:7, scholarships:true,  goalsForwardAvg:14, goalsMidAvg:6, enrollment:18000, size:'large'  },
  D2:   { gpaMin:2.8, gpaAvg:3.2, programStrength:5, scholarships:true,  goalsForwardAvg:12, goalsMidAvg:5, enrollment:8000,  size:'medium' },
  D3:   { gpaMin:2.8, gpaAvg:3.3, programStrength:4, scholarships:false, goalsForwardAvg:10, goalsMidAvg:4, enrollment:4000,  size:'small'  },
  NAIA: { gpaMin:2.5, gpaAvg:3.0, programStrength:3, scholarships:true,  goalsForwardAvg:10, goalsMidAvg:4, enrollment:2500,  size:'small'  },
  JUCO: { gpaMin:2.0, gpaAvg:2.8, programStrength:2, scholarships:true,  goalsForwardAvg:10, goalsMidAvg:4, enrollment:3000,  size:'small'  },
}

// ── State → region ───────────────────────────────────────────────────────────

const STATE_REGION: Record<string,string> = {
  ME:'Northeast',NH:'Northeast',VT:'Northeast',MA:'Northeast',RI:'Northeast',CT:'Northeast',
  NY:'Northeast',NJ:'Northeast',PA:'Northeast',DE:'Northeast',MD:'Northeast',
  VA:'Southeast',WV:'Southeast',NC:'Southeast',SC:'Southeast',GA:'Southeast',FL:'Southeast',
  AL:'Southeast',MS:'Southeast',TN:'Southeast',KY:'Southeast',
  OH:'Midwest',IN:'Midwest',IL:'Midwest',MI:'Midwest',WI:'Midwest',MN:'Midwest',
  IA:'Midwest',MO:'Midwest',ND:'Midwest',SD:'Midwest',NE:'Midwest',KS:'Midwest',
  TX:'South',OK:'South',AR:'South',LA:'South',
  MT:'West',WY:'West',CO:'West',NM:'West',AZ:'West',UT:'West',NV:'West',
  ID:'West',WA:'West',OR:'West',CA:'West',AK:'West',HI:'West',
  DC:'Northeast',PR:'Southeast',
}

function inferRegion(location: string): string {
  const m = location.match(/,\s*([A-Z]{2})\s*$/)
  if (m) return STATE_REGION[m[1]] ?? 'Other'
  return 'Other'
}

// ── Slug generation ──────────────────────────────────────────────────────────

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/university of /g,'')
    .replace(/university$/,'')
    .replace(/college$/,'')
    .replace(/[^a-z0-9]+/g,'')
    .slice(0,24)
}

// ── Conference lists ─────────────────────────────────────────────────────────

const CONFERENCES: Record<string, string[]> = {
  D1: [
    'ACC (Atlantic Coast Conference)',
    'Big Ten Conference',
    'Big 12 Conference',
    'SEC (Southeastern Conference)',
    'Pac-12 Conference',
    'Big East Conference',
    'American Athletic Conference',
    'Mountain West Conference',
    'Sun Belt Conference',
    'Conference USA',
    'MAC (Mid-American Conference)',
    'WAC (Western Athletic Conference)',
    'Atlantic 10 Conference',
    'Colonial Athletic Association',
    'Horizon League',
    'Missouri Valley Conference',
    'Summit League',
    'Big South Conference',
    'Southern Conference',
    'Southland Conference',
    'Ohio Valley Conference',
    'SWAC (Southwestern Athletic Conference)',
    'MEAC (Mid-Eastern Athletic Conference)',
    'Northeast Conference',
    'Patriot League',
    'America East Conference',
    'ASUN Conference',
    'West Coast Conference',
    'Big West Conference',
    'Ivy League',
    'MAAC (Metro Atlantic Athletic Conference)',
    'Pioneer Football League (PFL)',
    'Atlantic Sun Conference',
  ],
  D2: [
    'GLIAC (Great Lakes Intercollegiate Athletic Conference)',
    'GNAC (Great Northwest Athletic Conference)',
    'Gulf South Conference',
    'Lone Star Conference',
    'MEC (Mountain East Conference)',
    'MIAA (Michigan Intercollegiate Athletic Association)',
    'NE10 (Northeast-10 Conference)',
    'NSIC (Northern Sun Intercollegiate Conference)',
    'PEACH BELT Conference',
    'PSAC (Pennsylvania State Athletic Conference)',
    'RMAC (Rocky Mountain Athletic Conference)',
    'SAC (South Atlantic Conference)',
    'SIAC (Southern Intercollegiate Athletic Conference)',
    'SSC (Sunshine State Conference)',
    'CIAA (Central Intercollegiate Athletic Association)',
    'CCAA (California Collegiate Athletic Association)',
    'GSAC (Golden State Athletic Conference)',
    'Great American Conference',
    'Great Midwest Athletic Conference',
    'Central Atlantic Collegiate Conference',
    'East Coast Conference',
    'Southern Athletic Association',
    'Tran South Athletic Conference',
    'Mid-America Intercollegiate Athletics Association',
  ],
  D3: [
    'NESCAC (New England Small College Athletic Conference)',
    'UAA (University Athletic Association)',
    'SCIAC (Southern California Intercollegiate Athletic Conference)',
    'Liberty League',
    'Centennial Conference',
    'ODAC (Old Dominion Athletic Conference)',
    'NEWMAC (New England Women\'s and Men\'s Athletic Conference)',
    'Landmark Conference',
    'Great Northeast Athletic Conference',
    'MAC (Massachusetts Athletic Conference)',
    'NWAC (North West Athletic Conference) D3',
    'NJAC (New Jersey Athletic Conference)',
    'Empire 8',
    'PAC (Presidents Athletic Conference)',
    'USA South Athletic Conference',
    'Midwest Conference',
    'Northern Athletics Collegiate Conference',
    'CCIW (College Conference of Illinois and Wisconsin)',
    'MIAC (Minnesota Intercollegiate Athletic Conference)',
    'SUNYAC (State University of New York Athletic Conference)',
    'ESC (Eastern College Athletic Conference) D3',
    'CUNYAC (City University of New York Athletic Conference)',
    'SAA (Southern Athletic Association) D3',
    'Allegheny Mountain Collegiate Conference',
    'Commonwealth Coast Conference',
    'Great South Athletic Conference',
    'North Coast Athletic Conference',
    'Northwest Conference',
    'Ohio Athletic Conference',
    'St. Louis Intercollegiate Athletic Conference',
    'Western New England Athletic Conference',
    'Heartland Collegiate Athletic Conference',
    'American Rivers Conference',
  ],
  NAIA: [
    'KCAC (Kansas Collegiate Athletic Conference)',
    'MSMC (Mid-South Conference)',
    'SOCON (Southern States Athletic Conference)',
    'HAAC (Heart of America Athletic Conference)',
    'CSFL (Frontier Conference)',
    'NAIA Cal Pac Conference',
    'NAIA Red River Athletic Conference',
    'NAIA Appalachian Athletic Conference',
    'NAIA Mid-South Conference',
    'NAIA Crossroads League',
    'NAIA Golden State Athletic Conference',
    'NAIA Association of Independent Institutions',
    'NAIA Chicagoland Collegiate Athletic Conference',
    'NAIA Indiana Collegiate Athletic Conference',
    'NAIA Sooner Athletic Conference',
    'NAIA Sun Conference',
    'NAIA TranSouth Athletic Conference',
    'NAIA Wolverine-Hoosier Athletic Conference',
  ],
  JUCO: [
    'NJCAA Division I Soccer',
    'NJCAA Division II Soccer',
    'NJCAA Division III Soccer',
    'California Community College Athletic Association Soccer',
    'Northwest Athletic Conference (NWAC) Soccer',
    'NJCAA Region 1 Soccer',
    'NJCAA Region 2 Soccer',
    'NJCAA Region 3 Soccer',
    'NJCAA Region 4 Soccer',
    'NJCAA Region 9 Soccer',
    'NJCAA Region 14 Soccer',
    'NJCAA Region 16 Soccer',
    'NJCAA Region 19 Soccer',
    'NJCAA Region 23 Soccer',
    'NJCAA Region 24 Soccer',
  ],
}

// ── Types ────────────────────────────────────────────────────────────────────

interface SchoolJSON {
  id: string; name: string; division: string; conference: string
  location: string; region: string; enrollment: number; size: string
  gpaMin: number; gpaAvg: number; goalsForwardAvg: number; goalsMidAvg: number
  programStrength: number; scholarships: boolean; notes: string
  mensCoach?: string; mensCoachEmail?: string
  womensCoach?: string; womensCoachEmail?: string
}

interface FoundSchool {
  name: string
  location: string
  hasMens: boolean
  hasWomens: boolean
}

// ── Anthropic client ─────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

async function withRetry<T>(fn: () => Promise<T>, max = 5): Promise<T> {
  let delay = 20000
  for (let i = 0; i <= max; i++) {
    try { return await fn() } catch (e: any) {
      const is429 = e?.status === 429 || String(e?.message).includes('429') ||
        String(e?.message).toLowerCase().includes('rate_limit')
      if (is429 && i < max) {
        const wait = delay * (1 + 0.2 * Math.random())
        console.log(`  ⏳ rate limit, waiting ${Math.round(wait/1000)}s`)
        await new Promise(r => setTimeout(r, wait))
        delay = Math.min(delay * 2, 120000)
        continue
      }
      throw e
    }
  }
  throw new Error('unreachable')
}

function robustParseArray(text: string): FoundSchool[] | null {
  // Try to find a JSON array in the text
  const start = text.indexOf('[')
  if (start === -1) return null
  let end = text.lastIndexOf(']')
  if (end === -1) return null
  let chunk = text.slice(start, end + 1)
  // First attempt
  try { return JSON.parse(chunk) } catch {}
  // Strip trailing incomplete object and try again
  const lastComma = chunk.lastIndexOf(',')
  if (lastComma > 0) {
    const trimmed = chunk.slice(0, lastComma) + ']'
    try { return JSON.parse(trimmed) } catch {}
  }
  // Try removing last partial entry
  const lastBrace = chunk.lastIndexOf('{')
  if (lastBrace > 0) {
    const trimmed = chunk.slice(0, lastBrace).trimEnd().replace(/,\s*$/, '') + ']'
    try { return JSON.parse(trimmed) } catch {}
  }
  return null
}

async function queryConference(division: string, conference: string): Promise<FoundSchool[]> {
  const prompt = `List ALL member schools in the ${conference} that have a varsity soccer program (men's or women's or both).
Search the official conference website and/or NCAA/NAIA membership directories.
For each school include: name (official full name), city+state location, whether they have men's soccer, whether they have women's soccer.
Return ONLY a JSON array, no other text:
[{"name":"Full School Name","location":"City, ST","hasMens":true,"hasWomens":true}, ...]
If the conference has no soccer or doesn't exist, return [].`

  try {
    const resp = await withRetry(() => client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305' as any, name: 'web_search', max_uses: 4 }],
      messages: [{ role: 'user', content: prompt }],
    }))
    let txt = ''
    for (const b of resp.content) if (b.type === 'text') txt = b.text
    if (!txt) return []
    const parsed = robustParseArray(txt)
    return parsed ?? []
  } catch (e) {
    throw new Error(`query failed for ${conference}: ${(e as Error).message?.slice(0, 120)}`)
  }
}

// ── Concurrency runner ───────────────────────────────────────────────────────

async function runWithLimit<T,U>(items: T[], limit: number, fn: (item: T, i: number) => Promise<U>): Promise<U[]> {
  const results: (U|undefined)[] = new Array(items.length)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i], i)
    }
  }))
  return results as U[]
}

// ── Name normalization for dedup ─────────────────────────────────────────────

function normName(s: string): string {
  return s.toLowerCase()
    .replace(/\b(university|college|institute|school|of|the|at|and|&)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const schoolsRaw: SchoolJSON[] = JSON.parse(fs.readFileSync(SCHOOLS_PATH, 'utf8'))
  const coachesRaw: Record<string, any> = JSON.parse(fs.readFileSync(COACHES_PATH, 'utf8'))

  // Determine which divisions to process
  const divsToDo = ARG_DIV
    ? [ARG_DIV]
    : ['D1','D2','D3','NAIA','JUCO']

  // Build existing name lookup
  const existingNorm = new Set(schoolsRaw.map(s => normName(s.name)))
  const existingIds  = new Set(schoolsRaw.map(s => s.id))

  console.log(`══ EXPAND SCHOOL DB ══`)
  console.log(`Divisions:        ${divsToDo.join(', ')}`)
  console.log(`Existing schools: ${schoolsRaw.length}`)
  console.log(`Concurrency:      ${ARG_CONC}`)
  if (DRY_RUN) console.log(`Mode:             DRY RUN`)
  console.log()

  const newSchools: SchoolJSON[] = []
  let totalAdded = 0

  for (const div of divsToDo) {
    const conferences = CONFERENCES[div]
    if (!conferences) { console.log(`Unknown division: ${div}`); continue }
    console.log(`\n── ${div} (${conferences.length} conferences) ──`)

    let confIdx = 0
    await runWithLimit(conferences, ARG_CONC, async (conf, i) => {
      const num = ++confIdx
      process.stdout.write(`[${num}/${conferences.length}] querying ${div} ${conf}...\n`)
      let found: FoundSchool[] = []
      try {
        found = await queryConference(div, conf)
      } catch (e) {
        console.log(`  ❌ ${(e as Error).message}`)
        return
      }

      let addedThisConf = 0
      for (const school of found) {
        const nn = normName(school.name)
        if (existingNorm.has(nn)) continue

        // Generate a unique id
        let id = makeSlug(school.name)
        let attempt = 0
        while (existingIds.has(id)) id = makeSlug(school.name) + (++attempt)

        const defaults = DIV_DEFAULTS[div] ?? DIV_DEFAULTS.D3
        const region = inferRegion(school.location)

        const entry: SchoolJSON = {
          id,
          name:           school.name,
          division:       div,
          conference:     conf.replace(/\s*\(.*\)/, '').trim(),
          location:       school.location,
          region,
          enrollment:     defaults.enrollment ?? 5000,
          size:           defaults.size ?? 'medium',
          gpaMin:         defaults.gpaMin ?? 2.8,
          gpaAvg:         defaults.gpaAvg ?? 3.1,
          goalsForwardAvg:defaults.goalsForwardAvg ?? 10,
          goalsMidAvg:    defaults.goalsMidAvg ?? 4,
          programStrength:defaults.programStrength ?? 3,
          scholarships:   defaults.scholarships ?? false,
          notes:          '',
        }

        schoolsRaw.push(entry)
        existingNorm.add(nn)
        existingIds.add(id)
        newSchools.push(entry)
        addedThisConf++
        totalAdded++

        // Add blank coachesScraped entries
        if (!DRY_RUN) {
          const genders: Array<'mens'|'womens'> = []
          if (school.hasMens !== false)   genders.push('mens')
          if (school.hasWomens !== false) genders.push('womens')
          for (const g of genders) {
            const key = `${id}:${g}`
            if (!coachesRaw[key]) {
              coachesRaw[key] = {
                schoolId: id, schoolName: school.name, gender: g,
                coachName: '', coachTitle: 'Head Coach', coachEmail: '',
                sourceUrl: '', scrapedAt: new Date().toISOString(),
                status: 'failed', reason: 'newly added — not yet scraped',
              }
            }
          }
        }
      }
      console.log(`  ✓ ${div} ${conf.split(' (')[0]} — found ${found.length}, added ${addedThisConf} new`)
    })
  }

  console.log(`\n══ RESULTS ══`)
  console.log(`New schools found: ${totalAdded}`)
  console.log(`Total after:       ${schoolsRaw.length}`)

  if (DRY_RUN) {
    console.log('\nDry run — no writes.')
    if (newSchools.length) {
      console.log('\nSample new schools:')
      newSchools.slice(0,10).forEach(s => console.log(`  ${s.id.padEnd(24)} ${s.division.padEnd(5)} ${s.name}`))
    }
    return
  }

  if (totalAdded > 0) {
    fs.writeFileSync(SCHOOLS_PATH, JSON.stringify(schoolsRaw, null, 2))
    fs.writeFileSync(COACHES_PATH, JSON.stringify(coachesRaw, null, 2))
    console.log(`\n✅ Wrote ${schoolsRaw.length} schools to schools.json`)
    console.log(`✅ Wrote coach stubs to coachesScraped.json`)
    console.log(`\nNext: npx tsx server/scripts/webResearchCoaches.ts --resume`)
  } else {
    console.log('\nNo new schools to add.')
  }
}

main().catch(e => { console.error('CRASHED:', e); process.exit(1) })
