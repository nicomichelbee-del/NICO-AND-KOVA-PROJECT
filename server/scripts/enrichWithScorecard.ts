/**
 * College Scorecard enrichment.
 *
 * For each school in server/data/schools.json, queries the U.S. Department of
 * Education's College Scorecard API for real admissions, cost, and aid data:
 *   • SAT/ACT 25th/75th percentile + median
 *   • Acceptance rate
 *   • In-state and out-of-state tuition
 *   • Cost of attendance
 *   • % of students receiving any aid + Pell grant rate
 *   • Graduation rate, enrollment
 *
 * The matcher consumes this via server/data/schoolsAcademic.json (keyed by
 * school id). Existing fields in schools.json (gpaAvg, programStrength, etc.)
 * stay where they are; this is purely additive.
 *
 * Usage:
 *   npx tsx server/scripts/enrichWithScorecard.ts                # all schools
 *   npx tsx server/scripts/enrichWithScorecard.ts --dry-run      # just print
 *   npx tsx server/scripts/enrichWithScorecard.ts --limit=10
 *   npx tsx server/scripts/enrichWithScorecard.ts --resume       # skip cached
 *
 * Requires COLLEGE_SCORECARD_API_KEY in .env (free at api.data.gov/signup/).
 *
 * Free tier: 1000 requests/hour. We make 1 request per school = 755 total per
 * full run, well under the limit.
 */

import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import schoolsData from '../data/schools.json'

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const API_KEY = process.env.COLLEGE_SCORECARD_API_KEY
const API_BASE = 'https://api.data.gov/ed/collegescorecard/v1/schools'
const CACHE_PATH = path.join(__dirname, '..', 'data', 'schoolsAcademic.json')
const UNMATCHED_PATH = path.join(__dirname, '..', 'data', 'scorecardUnmatched.json')

// ── CLI args ──────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }),
)

const DRY_RUN     = args['dry-run'] === 'true'
const ARG_LIMIT   = args.limit ? parseInt(args.limit, 10) : Infinity
const ARG_RESUME  = args.resume === 'true'
const ARG_SCHOOL  = args.school as string | undefined

// ── Types ─────────────────────────────────────────────────────────────────

interface SchoolInput {
  id:       string
  name:     string
  location: string  // "City, ST"
}

interface AcademicRecord {
  schoolId:           string
  scorecardId:        number
  scorecardName:      string
  satMid:             number | null
  sat25:              number | null
  sat75:              number | null
  actMid:             number | null
  admissionRate:      number | null  // 0–1
  tuitionInState:     number | null
  tuitionOutOfState:  number | null
  costOfAttendance:   number | null  // total cost incl. room/board
  pctReceivingAid:    number | null  // % with any federal aid
  pellGrantRate:      number | null  // 0–1
  graduationRate:     number | null  // 0–1
  enrollment:         number | null
  fetchedAt:          string
}

type Cache = Record<string, AcademicRecord>

// ── Cache I/O ─────────────────────────────────────────────────────────────

function loadCache(): Cache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as Cache
  } catch {
    return {}
  }
}

function saveCache(cache: Cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
}

// ── Name normalization for fuzzy matching ─────────────────────────────────

// Common state-abbrev expansions. Schools.json uses "NC State", "VA Tech",
// etc.; Scorecard uses "North Carolina State", "Virginia Tech." These pairs
// fall apart on token-overlap matching unless we expand.
const STATE_ABBR_EXPANSIONS: Array<[RegExp, string]> = [
  [/\bnc\b/gi, 'north carolina'],
  [/\bva\b/gi, 'virginia'],
  [/\bsc\b/gi, 'south carolina'],
  [/\bnj\b/gi, 'new jersey'],
  [/\bny\b/gi, 'new york'],
  [/\bla\b/gi, 'louisiana'],
  [/\bma\b/gi, 'massachusetts'],
  [/\bct\b/gi, 'connecticut'],
  [/\bnm\b/gi, 'new mexico'],
  [/\bnh\b/gi, 'new hampshire'],
]

const STOP_WORDS = new Set(['the', 'of', 'at', 'in', 'on', 'and', 'for', 'to'])

function normalizeName(s: string): string {
  let out = s.toLowerCase()
  for (const [re, replacement] of STATE_ABBR_EXPANSIONS) out = out.replace(re, replacement)
  return out
    .replace(/\buniversity of\b/g, '')
    .replace(/\bu of\b/g, '')
    .replace(/\bcollege\b/g, '')
    .replace(/\buniversity\b/g, '')
    .replace(/\bsaint\b/g, 'st')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(s: string): Set<string> {
  return new Set(
    normalizeName(s)
      .split(' ')
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
  )
}

function nameDistance(a: string, b: string): number {
  // Cheap "shared-token" distance — counts how many normalized tokens overlap.
  // 0 = perfect, higher = worse.
  const tokensA = tokenize(a)
  const tokensB = tokenize(b)
  if (tokensA.size === 0 || tokensB.size === 0) return 999
  let shared = 0
  for (const t of tokensA) if (tokensB.has(t)) shared++
  // Distance = (unique tokens not shared) on either side
  return tokensA.size + tokensB.size - 2 * shared
}

function extractState(location: string | undefined | null): string | null {
  // "Chapel Hill, NC" → "NC"
  if (!location) return null
  const parts = location.split(',').map((p) => p.trim())
  const last = parts[parts.length - 1]
  if (last && /^[A-Z]{2}$/.test(last)) return last
  return null
}

function extractCity(location: string | undefined | null): string | null {
  // "Chapel Hill, NC" → "Chapel Hill". Without city, "University of North
  // Carolina" name-matches Wilmington before Chapel Hill (Wilmington has fewer
  // extra tokens). City narrows it.
  if (!location) return null
  const parts = location.split(',').map((p) => p.trim())
  if (parts.length < 2) return null
  return parts[0] || null
}

// ── Scorecard fetch ───────────────────────────────────────────────────────

// Scorecard SAT fields are split by section (CR/math/writing). For a usable
// combined score we use `average.overall` (cumulative average reported by the
// school) and derive cumulative 25th/75th by summing the two main sections.
// Writing is often missing post-2016 and isn't needed for SAT mid estimates.
interface ScorecardResult {
  id:         number
  'school.name':   string
  'school.state':  string
  'latest.admissions.sat_scores.average.overall':               number | null
  'latest.admissions.sat_scores.25th_percentile.critical_reading': number | null
  'latest.admissions.sat_scores.25th_percentile.math':           number | null
  'latest.admissions.sat_scores.75th_percentile.critical_reading': number | null
  'latest.admissions.sat_scores.75th_percentile.math':           number | null
  'latest.admissions.act_scores.midpoint.cumulative':           number | null
  'latest.admissions.admission_rate.overall':                   number | null
  'latest.cost.tuition.in_state':                                number | null
  'latest.cost.tuition.out_of_state':                            number | null
  'latest.cost.attendance.academic_year':                        number | null
  'latest.aid.federal_loan_rate':                                number | null
  'latest.aid.pell_grant_rate':                                  number | null
  'latest.completion.rate_suppressed.overall':                   number | null
  'latest.student.size':                                         number | null
}

const FIELDS = [
  'id',
  'school.name',
  'school.state',
  'latest.admissions.sat_scores.average.overall',
  'latest.admissions.sat_scores.25th_percentile.critical_reading',
  'latest.admissions.sat_scores.25th_percentile.math',
  'latest.admissions.sat_scores.75th_percentile.critical_reading',
  'latest.admissions.sat_scores.75th_percentile.math',
  'latest.admissions.act_scores.midpoint.cumulative',
  'latest.admissions.admission_rate.overall',
  'latest.cost.tuition.in_state',
  'latest.cost.tuition.out_of_state',
  'latest.cost.attendance.academic_year',
  'latest.aid.federal_loan_rate',
  'latest.aid.pell_grant_rate',
  'latest.completion.rate_suppressed.overall',
  'latest.student.size',
].join(',')

// Build a clean search term: drop punctuation, "the", "of college university"
// scaffolding, and trim. "West Texas A&M University" → "west texas am", which
// Scorecard's full-text matcher handles cleanly. The raw form returns junk
// because `&` gets URL-encoded weirdly inside school.search.
function searchTerm(name: string): string {
  // Scorecard's school.search is finicky:
  //   • "west texas a and m university" → 0 hits
  //   • "west texas am" → 4 hits (correct school is #1)
  //   • "college of william mary" → only Richard Bland College (W&M missing!)
  //   • "william mary" → William & Mary (correct) + Richard Bland
  // So we drop `&`, apostrophes, and the institutional scaffolding words
  // ("college", "university", "the", "of"). The proper-noun core is what
  // Scorecard's full-text matcher works on.
  return name
    .toLowerCase()
    .replace(/['"`’]/g, '')
    .replace(/\b(the|of|college|university|institute)\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function searchScorecard(name: string, state: string | null, city: string | null): Promise<ScorecardResult[]> {
  const cleanName = searchTerm(name)
  // Try name + state + city first; fall back to name + state only if no hits.
  // The strict query is best for disambiguating multi-campus systems.
  async function fetchOnce(narrow: boolean): Promise<ScorecardResult[]> {
    const params = new URLSearchParams({
      'api_key': API_KEY!,
      'school.search':  cleanName,
      'school.operating': '1',
      'fields': FIELDS,
      'per_page': '20',
    })
    if (state) params.set('school.state', state)
    if (narrow && city) params.set('school.city', city)
    const url = `${API_BASE}?${params.toString()}`
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Scorecard ${res.status}: ${body.slice(0, 200)}`)
    }
    const json = await res.json() as { results: ScorecardResult[] }
    return json.results ?? []
  }

  const narrow = await fetchOnce(true)
  if (narrow.length > 0) return narrow
  return city ? fetchOnce(false) : narrow
}

// ── Match scorecard result to our school ───────────────────────────────────

function pickBest(name: string, results: ScorecardResult[], narrowedByCity: boolean): ScorecardResult | null {
  if (results.length === 0) return null
  // Rank by name token distance — lowest wins.
  const ranked = results
    .map((r) => ({ r, d: nameDistance(name, r['school.name']) }))
    .sort((a, b) => a.d - b.d)
  const best = ranked[0]

  // Sanity check: at least 1 shared token. Without this, the city+state
  // narrow-trust rule misfires — e.g., "College of William & Mary" in
  // Williamsburg VA returned only "Richard Bland College" (its 2-year
  // affiliate in nearby Petersburg). Zero shared tokens = different school.
  const tokensA = tokenize(name)
  const tokensB = tokenize(best.r['school.name'])
  let shared = 0
  for (const t of tokensA) if (tokensB.has(t)) shared++

  // Narrow-by-city + at least 1 shared token = trust it. Catches things like
  // "NC State University" → "North Carolina State University at Raleigh".
  if (narrowedByCity && results.length === 1 && shared >= 1) return best.r

  // Substring check: catches "Virginia Tech" → "Virginia Polytechnic
  // Institute and State University" (no shared token after stop-word filter,
  // but full normalized name embeds).
  const nA = normalizeName(name)
  const nB = normalizeName(best.r['school.name'])
  if (nA.length >= 4 && nB.includes(nA)) return best.r
  if (nB.length >= 4 && nA.includes(nB)) return best.r

  // Hard reject: zero shared tokens after stop-word filtering = different
  // schools, even if state+city happen to match (e.g. William & Mary vs.
  // Richard Bland — both around Williamsburg VA, no name overlap).
  if (shared === 0) return null

  // Otherwise apply the distance threshold.
  if (best.d > 6) return null
  return best.r
}

function toRecord(schoolId: string, r: ScorecardResult): AcademicRecord {
  const cr25  = r['latest.admissions.sat_scores.25th_percentile.critical_reading']
  const m25   = r['latest.admissions.sat_scores.25th_percentile.math']
  const cr75  = r['latest.admissions.sat_scores.75th_percentile.critical_reading']
  const m75   = r['latest.admissions.sat_scores.75th_percentile.math']
  // Combined SAT only when both halves are present (otherwise it'd be misleading).
  const sat25 = (cr25 != null && m25 != null) ? cr25 + m25 : null
  const sat75 = (cr75 != null && m75 != null) ? cr75 + m75 : null

  return {
    schoolId,
    scorecardId:        r.id,
    scorecardName:      r['school.name'],
    satMid:             r['latest.admissions.sat_scores.average.overall'],
    sat25,
    sat75,
    actMid:             r['latest.admissions.act_scores.midpoint.cumulative'],
    admissionRate:      r['latest.admissions.admission_rate.overall'],
    tuitionInState:     r['latest.cost.tuition.in_state'],
    tuitionOutOfState:  r['latest.cost.tuition.out_of_state'],
    costOfAttendance:   r['latest.cost.attendance.academic_year'],
    pctReceivingAid:    r['latest.aid.federal_loan_rate'],
    pellGrantRate:      r['latest.aid.pell_grant_rate'],
    graduationRate:     r['latest.completion.rate_suppressed.overall'],
    enrollment:         r['latest.student.size'],
    fetchedAt:          new Date().toISOString(),
  }
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) {
    console.error('Missing COLLEGE_SCORECARD_API_KEY in .env')
    console.error('Get a free key at https://api.data.gov/signup/ and add it as:')
    console.error('  COLLEGE_SCORECARD_API_KEY=your_key_here')
    process.exit(1)
  }

  const cache = loadCache()
  const unmatched: Array<{ schoolId: string; name: string; state: string | null; reason: string }> = []

  const queue: SchoolInput[] = (schoolsData as SchoolInput[]).filter((s) => {
    if (ARG_SCHOOL && s.id !== ARG_SCHOOL) return false
    if (ARG_RESUME && cache[s.id]) return false
    return true
  })

  const limited = queue.slice(0, ARG_LIMIT)

  console.log('══ College Scorecard Enrichment ══')
  console.log(`Schools to fetch: ${limited.length}  |  cached: ${Object.keys(cache).length}  |  total: ${schoolsData.length}`)
  if (DRY_RUN) {
    console.log('Dry run — no writes. Sample queue:')
    limited.slice(0, 5).forEach((s) => console.log(`  ${s.id} | ${s.name} | ${s.location}`))
    return
  }
  console.log()

  let matched = 0
  let missed = 0
  let counter = 0

  for (const school of limited) {
    counter++
    const state = extractState(school.location)
    const city = extractCity(school.location)
    try {
      // Try narrow first; if narrow returned results, those are city-filtered
      // and we should trust 1-of-1 hits even on name mismatch.
      let results = await searchScorecard(school.name, state, city)
      const narrowed = results.length > 0 && city != null
      if (results.length === 0 && city) {
        // Fallback: drop the city filter entirely.
        results = await searchScorecard(school.name, state, null)
      }
      const best = pickBest(school.name, results, narrowed)
      if (!best) {
        unmatched.push({ schoolId: school.id, name: school.name, state, reason: results.length === 0 ? 'no results' : 'no good name match' })
        missed++
        console.log(`  [${counter}/${limited.length}] ❌ ${school.id.padEnd(28)} ${school.name}`)
        continue
      }
      const record = toRecord(school.id, best)
      cache[school.id] = record
      matched++
      const cost = record.costOfAttendance ? `$${(record.costOfAttendance/1000).toFixed(0)}k` : '?'
      const adm = record.admissionRate ? `${(record.admissionRate*100).toFixed(0)}%` : '?'
      console.log(`  [${counter}/${limited.length}] ✅ ${school.id.padEnd(28)} ${best['school.name'].slice(0, 40).padEnd(40)} adm=${adm.padStart(4)}  COA=${cost}`)
    } catch (e) {
      unmatched.push({ schoolId: school.id, name: school.name, state, reason: (e as Error).message.slice(0, 100) })
      missed++
      console.log(`  [${counter}/${limited.length}] ⚠️  ${school.id} — ${(e as Error).message.slice(0, 60)}`)
    }

    // Persist every 25 entries so a crash doesn't lose work.
    if (counter % 25 === 0) saveCache(cache)
    // Light pacing — Scorecard's 1000/hour limit is generous, but be polite.
    await new Promise((r) => setTimeout(r, 50))
  }

  saveCache(cache)
  fs.writeFileSync(UNMATCHED_PATH, JSON.stringify(unmatched, null, 2))

  console.log()
  console.log('══ DONE ══')
  console.log(`Matched:    ${matched}`)
  console.log(`Unmatched:  ${missed}  (see ${UNMATCHED_PATH})`)
  console.log(`Cache:      ${CACHE_PATH}`)
}

main().catch((e) => {
  console.error('ENRICHMENT CRASHED:', e)
  process.exit(1)
})
