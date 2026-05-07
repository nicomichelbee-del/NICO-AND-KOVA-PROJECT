/**
 * findProgramDisagreements.ts — read-only audit
 *
 * Identifies cases where Wikipedia (sponsoredPrograms.json) and the scraper
 * (coachesScraped.json) disagree about whether a school fields a varsity
 * program of a given gender. Output is grouped by disagreement type so we
 * can target Phase 2 AI verification at the highest-leverage cases first.
 *
 *   wiki=false / scraper=positive  → likely SCRAPER FALSE POSITIVE
 *                                    (e.g., Alabama men's, the user's main complaint)
 *   wiki=true  / scraper=no-program → SCRAPER FALSE NEGATIVE
 *                                    (Wikipedia knows about a program scraper missed)
 *   wiki=undef / scraper=positive   → D3/NAIA/JUCO — outside Phase 1 coverage
 *
 * Run:
 *   npx tsx server/scripts/findProgramDisagreements.ts
 */

import fs from 'fs'
import path from 'path'

interface SchoolRecord { id: string; name: string; division: string }
interface CoachEntry { schoolId: string; gender: 'mens' | 'womens'; status: string; coachName?: string }

const SCHOOLS_PATH = path.join(__dirname, '..', 'data', 'schools.json')
const COACHES_PATH = path.join(__dirname, '..', 'data', 'coachesScraped.json')
const SPONSORED_PATH = path.join(__dirname, '..', 'data', 'sponsoredPrograms.json')
const OVERRIDE_PATH = path.join(__dirname, '..', 'data', 'noProgramOverrides.json')

const POSITIVE_STATUSES = new Set([
  'success', 'partial', 'email-inferred',
  'web-verified', 'web-name-only',
  'haiku-verified', 'sonnet-verified',
  'ai-inferred',
])

const schools = JSON.parse(fs.readFileSync(SCHOOLS_PATH, 'utf8')) as SchoolRecord[]
const coaches = JSON.parse(fs.readFileSync(COACHES_PATH, 'utf8')) as Record<string, CoachEntry>
const sponsored = JSON.parse(fs.readFileSync(SPONSORED_PATH, 'utf8')) as Record<string, unknown>
const overrides = JSON.parse(fs.readFileSync(OVERRIDE_PATH, 'utf8')) as Record<string, unknown>

const schoolById = new Map(schools.map((s) => [s.id, s]))

interface Disagreement {
  key: string
  schoolName: string
  division: string
  gender: 'mens' | 'womens'
  scraperStatus: string
  scraperCoachName: string
  wikiSays: boolean | undefined
  reason: string
}

const falsePositives: Disagreement[] = []  // wiki=false, scraper positive
const falseNegatives: Disagreement[] = []  // wiki=true, scraper no-program
const lowerDivPositives: Disagreement[] = [] // wiki=undef, scraper positive (D3+)
const lowerDivNoProgram: Disagreement[] = [] // wiki=undef, scraper no-program

for (const [key, entry] of Object.entries(coaches)) {
  if (key.startsWith('_')) continue
  if (typeof entry !== 'object' || !entry?.schoolId || !entry?.gender) continue
  const school = schoolById.get(entry.schoolId)
  if (!school) continue
  // Skip cases where override file already settled the question — those
  // are pre-decided and don't need AI verification.
  if (overrides[`${entry.schoolId}:${entry.gender}`] === true) continue
  if (overrides[`${entry.schoolId}:${entry.gender}`] === false) continue

  const wiki = sponsored[`${entry.schoolId}:${entry.gender}`]
  const wikiBool = typeof wiki === 'boolean' ? wiki : undefined
  const isPositive = POSITIVE_STATUSES.has(entry.status)
  const isNoProgram = entry.status === 'no-program'

  const d: Disagreement = {
    key: `${entry.schoolId}:${entry.gender}`,
    schoolName: school.name,
    division: school.division,
    gender: entry.gender,
    scraperStatus: entry.status,
    scraperCoachName: entry.coachName ?? '',
    wikiSays: wikiBool,
    reason: '',
  }

  if (wikiBool === false && isPositive) {
    d.reason = 'Wikipedia: not a member program | Scraper: claims coach found'
    falsePositives.push(d)
  } else if (wikiBool === true && isNoProgram) {
    d.reason = 'Wikipedia: program exists | Scraper: marked no-program'
    falseNegatives.push(d)
  } else if (wikiBool === undefined && isPositive && (school.division === 'D3' || school.division === 'NAIA' || school.division === 'JUCO')) {
    d.reason = `Wikipedia: not covered (${school.division}) | Scraper: claims coach found — should we verify?`
    lowerDivPositives.push(d)
  } else if (wikiBool === undefined && isNoProgram) {
    d.reason = `Wikipedia: not covered (${school.division}) | Scraper: no-program (already filtered, no action needed)`
    lowerDivNoProgram.push(d)
  }
}

function dump(label: string, list: Disagreement[], showSample = 30) {
  console.log(`\n=== ${label} (${list.length}) ===`)
  list.slice(0, showSample).forEach((d) => {
    console.log(`  ${d.key.padEnd(40)} ${d.division.padEnd(5)} ${d.scraperStatus.padEnd(18)} "${d.scraperCoachName}"`)
  })
  if (list.length > showSample) console.log(`  ...and ${list.length - showSample} more`)
}

console.log(`Total schools: ${schools.length}`)
console.log(`Coach entries: ${Object.keys(coaches).filter((k) => !k.startsWith('_')).length}`)
console.log(`Sponsored entries: ${Object.keys(sponsored).filter((k) => !k.startsWith('_')).length}`)

dump('A. SCRAPER FALSE POSITIVES (Wikipedia says NO, scraper claims coach)', falsePositives)
dump('B. SCRAPER FALSE NEGATIVES (Wikipedia says YES, scraper marked no-program)', falseNegatives)
dump('C. LOWER-DIV positives Wikipedia doesn\'t cover', lowerDivPositives, 10)
dump('D. LOWER-DIV no-program (already filtered, FYI)', lowerDivNoProgram, 5)

console.log(`\nVerification cost estimate (Haiku + web search at ~$0.005/check):`)
console.log(`  Type A only: ~$${(falsePositives.length * 0.005).toFixed(2)}`)
console.log(`  Type A+B:    ~$${((falsePositives.length + falseNegatives.length) * 0.005).toFixed(2)}`)
console.log(`  All four:    ~$${((falsePositives.length + falseNegatives.length + lowerDivPositives.length + lowerDivNoProgram.length) * 0.005).toFixed(2)}`)

// Also write the disagreement set to disk for the verifier script to read.
const out = {
  _meta: {
    generatedAt: new Date().toISOString(),
    counts: {
      falsePositives: falsePositives.length,
      falseNegatives: falseNegatives.length,
      lowerDivPositives: lowerDivPositives.length,
      lowerDivNoProgram: lowerDivNoProgram.length,
    },
  },
  falsePositives,
  falseNegatives,
  lowerDivPositives,
  lowerDivNoProgram,
}
const OUT_PATH = path.join(__dirname, '..', 'data', 'programDisagreements.json')
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n')
console.log(`\nWrote ${OUT_PATH}`)
