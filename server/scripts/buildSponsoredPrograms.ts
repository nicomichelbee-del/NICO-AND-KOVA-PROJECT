/**
 * buildSponsoredPrograms.ts
 *
 * Reads server/data/wikipediaPrograms.json (canonical D1 + D2 men's/women's
 * soccer program lists) and server/data/schools.json (the matcher's school
 * dataset), fuzzy-matches Wikipedia names → schoolIds, and writes
 * server/data/sponsoredPrograms.json:
 *
 *     { "<schoolId>:<gender>": true | false, ... }
 *
 * The matcher's hasProgramOfGender() reads this file as its source of truth
 * for "does this school field a varsity program of this gender at this
 * division?" Only D1 and D2 schools are populated — Wikipedia per-sport
 * lists for D3 / NAIA / NJCAA don't exist, so those divisions still rely
 * on coachesScraped.json status + manual overrides.
 *
 * Run:
 *   npx tsx server/scripts/buildSponsoredPrograms.ts
 *
 * The script also prints an audit report listing schools.json entries that
 * couldn't be matched to a Wikipedia entry — useful for spotting name
 * normalization gaps that need a manual override.
 */

import fs from 'fs'
import path from 'path'

interface SchoolRecord {
  id: string
  name: string
  division: 'D1' | 'D2' | 'D3' | 'NAIA' | 'JUCO'
}

interface WikiData {
  'd1-mens':   string[]
  'd1-womens': string[]
  'd2-mens':   string[]
  'd2-womens': string[]
}

const DATA_DIR = path.join(__dirname, '..', 'data')
const SCHOOLS_PATH   = path.join(DATA_DIR, 'schools.json')
const WIKIPEDIA_PATH = path.join(DATA_DIR, 'wikipediaPrograms.json')
const OUTPUT_PATH    = path.join(DATA_DIR, 'sponsoredPrograms.json')

// Manual name fixes for cases where Wikipedia and schools.json use very
// different spellings that the fuzzy matcher misses. Add entries here as
// audit failures surface. Format: { schoolId: [wikiName1, wikiName2, ...] }
const MANUAL_NAME_ALIASES: Record<string, string[]> = {
  'ucla':            ['University of California, Los Angeles'],
  'cal':             ['University of California, Berkeley'],
  'usc':             ['University of Southern California'],
  'unc':             ['University of North Carolina at Chapel Hill'],
  'maryland':        ['University of Maryland, College Park'],
  'michigan':        ['University of Michigan'],
  'ohio-state':      ['Ohio State University'],
  'pennstate':       ['Pennsylvania State University'],
  'indiana':         ['Indiana University Bloomington'],
  'rutgers':         ['Rutgers University-New Brunswick', 'Rutgers University–New Brunswick'],
  'wisconsin':       ['University of Wisconsin-Madison', 'University of Wisconsin–Madison'],
  'georgia-tech':    ['Georgia Institute of Technology'],
  'jhu':             ['Johns Hopkins University'],
  'uchicago':        ['University of Chicago'],
  'mit':             ['Massachusetts Institute of Technology'],
  'army':            ['United States Military Academy'],
  'navy':            ['United States Naval Academy'],
  'air-force':       ['United States Air Force Academy'],
  'iowastate':       ['Iowa State University'],
  'kstate':          ['Kansas State University'],
  'wvu':             ['West Virginia University'],
  'tcu':             ['Texas Christian University'],
  'smu':             ['Southern Methodist University'],
  'byu':             ['Brigham Young University'],
  'ucf':             ['University of Central Florida'],
  'lsu':             ['Louisiana State University'],
  'fiu':             ['Florida International University'],
  'uab':             ['University of Alabama at Birmingham'],
  'uconn':           ['University of Connecticut'],
  'umass':           ['University of Massachusetts Amherst'],
  'umass-lowell':    ['University of Massachusetts Lowell'],
  'umbc':            ['University of Maryland, Baltimore County'],
  'unlv':            ['University of Nevada, Las Vegas'],
  'olddominion':     ['Old Dominion University'],
  'oldominion':      ['Old Dominion University'],
  'virginiatech':    ['Virginia Polytechnic Institute and State University', 'Virginia Tech'],
  'southcarolina':   ['University of South Carolina'],
  'mississippi':     ['University of Mississippi'],
  'ole-miss':        ['University of Mississippi'],
  'tennessee':       ['University of Tennessee'],
  'kentucky':        ['University of Kentucky'],
  'georgia':         ['University of Georgia'],
  'florida':         ['University of Florida'],
  'alabama':         ['University of Alabama'],
  'texas':           ['University of Texas at Austin'],
  'texas-am':        ['Texas A&M University'],
  'auburn':          ['Auburn University'],
  'arkansas':        ['University of Arkansas'],
  'missouri':        ['University of Missouri'],
  'mizzou':          ['University of Missouri'],
  'oklahoma':        ['University of Oklahoma'],
  'oklahoma-state':  ['Oklahoma State University'],
  'mississippi-state': ['Mississippi State University'],
  'baylor':          ['Baylor University'],
  'kansas':          ['University of Kansas'],
  'kansas-state':    ['Kansas State University'],
  'iowa-state':      ['Iowa State University'],
  'minnesota':       ['University of Minnesota'],
  'iowa':            ['University of Iowa'],
  'illinois':        ['University of Illinois Urbana-Champaign'],
  'purdue':          ['Purdue University'],
  'nebraska':        ['University of Nebraska-Lincoln', 'University of Nebraska–Lincoln'],
  'utah':            ['University of Utah'],
  'colorado':        ['University of Colorado Boulder'],
  'arizona':         ['University of Arizona'],
  'arizona-state':   ['Arizona State University'],
  'washington':      ['University of Washington'],
  'oregon':          ['University of Oregon'],
  'duke':            ['Duke University'],
  'pittsburgh':      ['University of Pittsburgh'],
  'syracuse':        ['Syracuse University'],
  'notre-dame':      ['University of Notre Dame'],
  'boston-college':  ['Boston College'],
  'clemson':         ['Clemson University'],
  'wake-forest':     ['Wake Forest University'],
  'louisville':      ['University of Louisville'],
  'miami':           ['University of Miami'],
  'georgetown':      ['Georgetown University'],
  'stanford':        ['Stanford University'],
  // Additional aliases caught in audit pass
  'albany':          ['University at Albany, SUNY', 'University at Albany'],
  'ncstate':         ['North Carolina State University'],
  'sacstate':        ['California State University, Sacramento'],
  'uci':             ['University of California, Irvine'],
  'ucsb':            ['University of California, Santa Barbara'],
  'liu':             ['Long Island University'],
  'utrgv':           ['University of Texas Rio Grande Valley'],
  'calpolyPomona':   ['California State Polytechnic University, Pomona'],
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')   // strip diacritics
    .replace(/–|—/g, '-')                                       // unicode dashes
    .replace(/\bsaint\b/g, 'st')                                // saint ↔ st
    .replace(/\bst\.?\b/g, 'st')                                // "st." → "st"
    .replace(/&/g, ' and ')                                     // "A&M" → "a and m"
    .replace(/[^\w\s-]/g, ' ')                                  // strip punctuation
    .replace(/\b(university|college|the|of|and|at|institute|polytechnic|technological)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Build the normalized-name → school map. Key collisions resolve toward the
// shortest schoolId (heuristic: "alabama" before "alabama-am") so a generic
// Wikipedia name like "University of Alabama" can't accidentally land on the
// more-specific `alabama-am` if both somehow normalize to the same string.
function buildSchoolNameIndex(schools: SchoolRecord[]): Map<string, SchoolRecord> {
  const idx = new Map<string, SchoolRecord>()
  for (const s of schools) {
    const k = normalize(s.name)
    const existing = idx.get(k)
    if (!existing || s.id.length < existing.id.length) idx.set(k, s)
  }
  return idx
}

function findSchool(
  wikiName: string,
  byNormName: Map<string, SchoolRecord>,
): SchoolRecord | null {
  const norm = normalize(wikiName)
  const direct = byNormName.get(norm)
  if (direct) return direct
  // No substring fallback — too many false positives ("Utah Valley
  // University" was matching schools.json `utah` (University of Utah)).
  // Names that don't normalize identically need a MANUAL_NAME_ALIASES
  // entry to be matched. The audit output below tells you which.
  return null
}

function main() {
  const schools = JSON.parse(fs.readFileSync(SCHOOLS_PATH, 'utf8')) as SchoolRecord[]
  const wiki    = JSON.parse(fs.readFileSync(WIKIPEDIA_PATH, 'utf8')) as WikiData

  // Reverse manual aliases: wikiName (lowercased) → schoolId. Guard against
  // (a) duplicate alias keys mapping the same Wikipedia name to multiple
  // schoolIds (the later one would overwrite the correct one) and (b) alias
  // values pointing to schoolIds that don't exist in schools.json (would
  // produce orphan matchedIds that never appear in the output map).
  const aliasIdx = new Map<string, string>()
  const knownIds = new Set(schools.map((s) => s.id))
  for (const [id, names] of Object.entries(MANUAL_NAME_ALIASES)) {
    if (!knownIds.has(id)) {
      console.warn(`[alias] schoolId "${id}" is not in schools.json — skipping its aliases`)
      continue
    }
    for (const n of names) {
      const k = normalize(n)
      const existing = aliasIdx.get(k)
      if (existing && existing !== id) {
        console.warn(`[alias] duplicate name "${n}" maps to both "${existing}" and "${id}" — keeping "${existing}"`)
        continue
      }
      aliasIdx.set(k, id)
    }
  }

  const nameIdx = buildSchoolNameIndex(schools)

  // For each Wikipedia list, build a Set of matched schoolIds.
  function resolveList(list: string[]): { matchedIds: Set<string>; unmatched: string[] } {
    const matchedIds = new Set<string>()
    const unmatched: string[] = []
    for (const wikiName of list) {
      const aliasId = aliasIdx.get(normalize(wikiName))
      if (aliasId) { matchedIds.add(aliasId); continue }
      const school = findSchool(wikiName, nameIdx)
      if (school) matchedIds.add(school.id)
      else unmatched.push(wikiName)
    }
    return { matchedIds, unmatched }
  }

  const d1Mens   = resolveList(wiki['d1-mens'])
  const d1Womens = resolveList(wiki['d1-womens'])
  const d2Mens   = resolveList(wiki['d2-mens'])
  const d2Womens = resolveList(wiki['d2-womens'])

  // Build the canonical sponsorship map. Iterate over schools.json so the
  // output is keyed by our canonical schoolIds, with deterministic enums.
  // The matcher's getSponsored() filters out string-keyed metadata starting
  // with '_', so the _meta key here is informational only.
  const out: Record<string, unknown> = {
    _meta: {
      generatedAt: new Date().toISOString(),
      source: 'wikipediaPrograms.json',
      coverage: 'D1 + D2 men\'s and women\'s — D3, NAIA, NJCAA still rely on coachesScraped + overrides',
      counts: {
        d1Mens:   d1Mens.matchedIds.size,
        d1Womens: d1Womens.matchedIds.size,
        d2Mens:   d2Mens.matchedIds.size,
        d2Womens: d2Womens.matchedIds.size,
      },
    },
  }

  let d1MensYes = 0, d1MensNo = 0, d2MensYes = 0, d2MensNo = 0
  let d1WomensYes = 0, d1WomensNo = 0, d2WomensYes = 0, d2WomensNo = 0

  for (const s of schools) {
    if (s.division === 'D1') {
      const mens = d1Mens.matchedIds.has(s.id)
      const womens = d1Womens.matchedIds.has(s.id)
      out[`${s.id}:mens`]   = mens;   if (mens) d1MensYes++; else d1MensNo++
      out[`${s.id}:womens`] = womens; if (womens) d1WomensYes++; else d1WomensNo++
    } else if (s.division === 'D2') {
      const mens = d2Mens.matchedIds.has(s.id)
      const womens = d2Womens.matchedIds.has(s.id)
      out[`${s.id}:mens`]   = mens;   if (mens) d2MensYes++; else d2MensNo++
      out[`${s.id}:womens`] = womens; if (womens) d2WomensYes++; else d2WomensNo++
    }
    // D3 / NAIA / JUCO not populated — matcher falls through to existing
    // coachesScraped + override logic for those divisions.
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2) + '\n')
  console.log(`Wrote ${OUTPUT_PATH}`)
  console.log(`  D1 mens:   ${d1MensYes} sponsor / ${d1MensNo} don't  (Wikipedia list size: ${wiki['d1-mens'].length})`)
  console.log(`  D1 womens: ${d1WomensYes} sponsor / ${d1WomensNo} don't  (Wikipedia list size: ${wiki['d1-womens'].length})`)
  console.log(`  D2 mens:   ${d2MensYes} sponsor / ${d2MensNo} don't  (Wikipedia list size: ${wiki['d2-mens'].length})`)
  console.log(`  D2 womens: ${d2WomensYes} sponsor / ${d2WomensNo} don't  (Wikipedia list size: ${wiki['d2-womens'].length})`)

  // Audit: Wikipedia entries we couldn't map to a schoolId. Most of these
  // are schools not present in schools.json (we don't track every D2 in
  // the country) — that's expected and benign. But some may be naming
  // mismatches that need a MANUAL_NAME_ALIASES entry.
  console.log('\n=== UNMATCHED Wikipedia entries (consider adding to MANUAL_NAME_ALIASES) ===')
  console.log(`D1 mens unmatched (${d1Mens.unmatched.length}):`)
  d1Mens.unmatched.forEach((n) => console.log(`  - ${n}`))
  console.log(`D1 womens unmatched (${d1Womens.unmatched.length}):`)
  d1Womens.unmatched.forEach((n) => console.log(`  - ${n}`))
  console.log(`D2 mens unmatched (${d2Mens.unmatched.length}):`)
  d2Mens.unmatched.slice(0, 25).forEach((n) => console.log(`  - ${n}`))
  if (d2Mens.unmatched.length > 25) console.log(`  ...and ${d2Mens.unmatched.length - 25} more`)
  console.log(`D2 womens unmatched (${d2Womens.unmatched.length}):`)
  d2Womens.unmatched.slice(0, 25).forEach((n) => console.log(`  - ${n}`))
  if (d2Womens.unmatched.length > 25) console.log(`  ...and ${d2Womens.unmatched.length - 25} more`)
}

main()
