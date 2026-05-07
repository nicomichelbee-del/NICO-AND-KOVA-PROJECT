/**
 * buildEadaPrograms.ts — Phase 4 of the program-existence accuracy plan.
 *
 * Downloads the EADA (Equity in Athletics Disclosure Act) bulk file from the
 * U.S. Department of Education for the latest academic year, extracts the
 * schools.xlsx sheet (one row per (institution × sport)), filters soccer
 * rows, and emits server/data/eadaPrograms.json — the federal source of
 * truth for whether a school sponsors men's and/or women's varsity soccer.
 *
 * EADA covers EVERY Title-IV-eligible school across D1, D2, D3, NAIA, and
 * NJCAA, with annual self-reported participation counts. A row with
 * PARTIC_MEN > 0 means the school fielded a varsity men's program that year.
 * Same for PARTIC_WOMEN. This is dramatically more comprehensive than the
 * Wikipedia per-sport lists we used in Phase 1, which only covered D1+D2.
 *
 * Output:
 *   server/data/eadaPrograms.json:
 *     {
 *       _meta: { sourceYear, downloadedAt, unmatchedCount },
 *       "<schoolId>:mens":   true | false,
 *       "<schoolId>:womens": true | false,
 *       ...
 *     }
 *
 * Run:
 *   npx tsx server/scripts/buildEadaPrograms.ts
 *
 * Manual alias map at the bottom — when EADA institution names don't fuzzy-
 * match our schoolIds, add an entry. The audit prints unmatched names.
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import { unzipSync } from 'zlib'
import xlsx from 'xlsx'

const DATA_DIR = path.join(__dirname, '..', 'data')
const SCHOOLS_PATH = path.join(DATA_DIR, 'schools.json')
const OUTPUT_PATH  = path.join(DATA_DIR, 'eadaPrograms.json')

const EADA_API = 'https://ope.ed.gov/athletics/api/dataFiles/fileList'
const EADA_DOWNLOAD = (fileName: string) =>
  `https://ope.ed.gov/athletics/api/dataFiles/file?fileName=${encodeURIComponent(fileName)}`

interface SchoolRecord { id: string; name: string; division: string }
interface EadaFileEntry { FileName: string; Year: number; Format: string }
interface EadaRow {
  unitid: number
  institution_name: string
  Sports: string
  PARTIC_MEN?: number
  PARTIC_WOMEN?: number
  classification_name?: string
}

// ── HTTP helpers (zero deps; node:https only) ─────────────────────────────

function httpGet(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'kickriq-eada/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpGet(res.headers.location!).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`GET ${url} → HTTP ${res.statusCode}`))
      }
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

// ── Name normalization (mirrors buildSponsoredPrograms.ts) ────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/–|—/g, '-')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bst\.?\b/g, 'st')
    .replace(/&/g, ' and ')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\b(university|college|the|of|and|at|institute|polytechnic|technological)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Manual aliases — EADA institution_name → our schoolId. EADA uses formal
// institutional names ("University of California-Los Angeles") that don't
// always fuzzy-match our compact schoolIds (`ucla`). Audit output prints
// the unmatched names; add entries here as needed.
const MANUAL_NAME_ALIASES: Record<string, string[]> = {
  ucla:           ['University of California-Los Angeles'],
  cal:            ['University of California-Berkeley'],
  usc:            ['University of Southern California'],
  unc:            ['University of North Carolina at Chapel Hill'],
  ncstate:        ['North Carolina State University at Raleigh'],
  uci:            ['University of California-Irvine'],
  ucsb:           ['University of California-Santa Barbara'],
  ucsd:           ['University of California-San Diego'],
  ucr:            ['University of California-Riverside'],
  ucdavis:        ['University of California-Davis'],
  utrgv:          ['The University of Texas Rio Grande Valley'],
  liu:            ['Long Island University'],
  uconn:          ['University of Connecticut'],
  umass:          ['University of Massachusetts-Amherst'],
  georgetown:     ['Georgetown University'],
  uchicago:       ['University of Chicago'],
  jhu:            ['Johns Hopkins University'],
  mit:            ['Massachusetts Institute of Technology'],
  duke:           ['Duke University'],
  stanford:       ['Stanford University'],
  northwestern:   ['Northwestern University'],
  pennstate:      ['Pennsylvania State University-Main Campus'],
  ohiostate:      ['The Ohio State University-Main Campus'],
  michigan:       ['University of Michigan-Ann Arbor'],
  indiana:        ['Indiana University-Bloomington'],
  rutgers:        ['Rutgers University-New Brunswick'],
  maryland:       ['University of Maryland-College Park'],
  wisconsin:      ['University of Wisconsin-Madison'],
  illinois:       ['University of Illinois Urbana-Champaign'],
  georgia:        ['The University of Georgia'],
  alabama:        ['The University of Alabama'],
  tennessee:      ['The University of Tennessee, Knoxville'],
  florida:        ['University of Florida'],
  texas:          ['The University of Texas at Austin'],
  virginia:       ['University of Virginia-Main Campus'],
  pittsburgh:     ['University of Pittsburgh-Pittsburgh Campus'],
  notredame:      ['University of Notre Dame'],
  miami:          ['University of Miami'],
  georgiatech:    ['Georgia Institute of Technology-Main Campus'],
  'georgia-tech': ['Georgia Institute of Technology-Main Campus'],
  fsu:            ['Florida State University'],
  umich:          ['University of Michigan-Ann Arbor'],
}

async function main() {
  // 1. Find the latest EADA year + download URL
  const listJson = (await httpGet(EADA_API)).toString('utf8')
  const list = JSON.parse(listJson) as EadaFileEntry[]
  const latest = list
    .filter((f) => f.Format !== 'Excel' && f.FileName.startsWith('EADA_'))
    .sort((a, b) => b.Year - a.Year)[0]
  if (!latest) throw new Error('No EADA bulk file found')
  console.log(`Latest EADA bulk: ${latest.FileName} (year ${latest.Year})`)

  // 2. Download
  const zipBuf = await httpGet(EADA_DOWNLOAD(latest.FileName))
  console.log(`Downloaded ${(zipBuf.length / 1024 / 1024).toFixed(1)} MB`)

  // 3. Find schools.xlsx inside the zip — extract via xlsx package's auto-zip
  //    handling (it recognizes the OOXML zip wrapper). For the EADA wrapper
  //    we need to unzip first to find schools.xlsx.
  // Quick zip parser using `unzipSync` won't work here (that's for gzip).
  // Use the `xlsx` package's `read` directly on the buffer — but the buffer
  // is a multi-file zip, not a workbook. We need an actual unzip.
  // Easiest: shell out to unzip since this is a build script. Falls back
  // to looking for a tmp extraction dir if `unzip` isn't on PATH.
  const tmpDir = path.join('/tmp', `eada-${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })
  const zipPath = path.join(tmpDir, 'eada.zip')
  fs.writeFileSync(zipPath, zipBuf)
  const { execSync } = await import('child_process')
  execSync(`unzip -o ${zipPath} -d ${tmpDir} > /dev/null`)
  const xlsxPath = path.join(tmpDir, 'schools.xlsx')
  if (!fs.existsSync(xlsxPath)) throw new Error(`schools.xlsx not found in ${tmpDir}`)

  // 4. Parse schools.xlsx, filter soccer rows. Then ALSO parse instLevel.xlsx
  // (one row per institution) so we can detect schools that filed an EADA
  // report but listed zero soccer rows — that's authoritative "no soccer at
  // all", which the matcher should treat as both mens=false AND womens=false
  // (e.g., Georgia Tech fields baseball/basketball/football/etc. but no soccer).
  const wb = xlsx.readFile(xlsxPath)
  const rows = xlsx.utils.sheet_to_json<EadaRow>(wb.Sheets[wb.SheetNames[0]])
  const soccer = rows.filter((r) => r.Sports === 'Soccer')
  console.log(`Soccer rows: ${soccer.length} (out of ${rows.length} total)`)

  const instLevelPath = path.join(tmpDir, 'instLevel.xlsx')
  const instLevelWb = xlsx.readFile(instLevelPath)
  const instLevelRows = xlsx.utils.sheet_to_json<{ unitid: number; institution_name: string }>(
    instLevelWb.Sheets[instLevelWb.SheetNames[0]],
  )
  console.log(`Institutions reporting under EADA: ${instLevelRows.length}`)

  // 5. Build {unitid: {mens, womens}}. Schools with a soccer row get the
  // PARTIC_* > 0 result. Schools in instLevel but not in any soccer row
  // get explicit false for both — they reported athletics but no soccer.
  const byUnitid = new Map<number, { mens: boolean; womens: boolean; name: string }>()
  for (const inst of instLevelRows) {
    byUnitid.set(inst.unitid, { mens: false, womens: false, name: inst.institution_name })
  }
  for (const r of soccer) {
    const mens = (r.PARTIC_MEN ?? 0) > 0
    const womens = (r.PARTIC_WOMEN ?? 0) > 0
    const existing = byUnitid.get(r.unitid)
    if (existing) {
      byUnitid.set(r.unitid, {
        mens: existing.mens || mens,
        womens: existing.womens || womens,
        name: existing.name,
      })
    } else {
      byUnitid.set(r.unitid, { mens, womens, name: r.institution_name })
    }
  }

  // 6. Map UNITID → our schoolIds via name fuzzy-match + manual aliases
  const schools = JSON.parse(fs.readFileSync(SCHOOLS_PATH, 'utf8')) as SchoolRecord[]
  const knownIds = new Set(schools.map((s) => s.id))

  // Index schools.json by normalized name (shortest-id wins for collisions)
  const nameIdx = new Map<string, SchoolRecord>()
  for (const s of schools) {
    const k = normalize(s.name)
    const existing = nameIdx.get(k)
    if (!existing || s.id.length < existing.id.length) nameIdx.set(k, s)
  }
  // Manual alias index — EADA name normalized → our schoolId
  const aliasIdx = new Map<string, string>()
  for (const [id, names] of Object.entries(MANUAL_NAME_ALIASES)) {
    if (!knownIds.has(id)) continue
    for (const n of names) aliasIdx.set(normalize(n), id)
  }

  function findSchool(eadaName: string): SchoolRecord | null {
    const norm = normalize(eadaName)
    const aliasId = aliasIdx.get(norm)
    if (aliasId) return schools.find((s) => s.id === aliasId) ?? null
    return nameIdx.get(norm) ?? null
  }

  const out: Record<string, unknown> = {
    _meta: {
      generatedAt: new Date().toISOString(),
      sourceYear:  latest.Year,
      sourceFile:  latest.FileName,
      coverage:    'All Title IV institutions reporting under EADA — covers D1, D2, D3, NAIA, NJCAA.',
    },
  }
  let matched = 0
  let mensYes = 0, mensNo = 0, womensYes = 0, womensNo = 0
  const unmatched: { eadaName: string; classification?: string }[] = []

  for (const [, info] of byUnitid) {
    const school = findSchool(info.name)
    if (!school) {
      // Find a soccer row to grab classification for the audit log
      const sample = soccer.find((r) => r.institution_name === info.name)
      unmatched.push({ eadaName: info.name, classification: sample?.classification_name })
      continue
    }
    matched++
    out[`${school.id}:mens`]   = info.mens
    out[`${school.id}:womens`] = info.womens
    if (info.mens) mensYes++; else mensNo++
    if (info.womens) womensYes++; else womensNo++
  }

  // Add a count meta after matching
  ;(out._meta as Record<string, unknown>).matchedSchools = matched
  ;(out._meta as Record<string, unknown>).unmatchedCount = unmatched.length
  ;(out._meta as Record<string, unknown>).counts = { mensYes, mensNo, womensYes, womensNo }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2) + '\n')
  console.log(`\nWrote ${OUTPUT_PATH}`)
  console.log(`  Matched schools: ${matched}`)
  console.log(`  Unmatched (EADA names with no schools.json analog): ${unmatched.length}`)
  console.log(`  mens=true:   ${mensYes}    mens=false:   ${mensNo}`)
  console.log(`  womens=true: ${womensYes}    womens=false: ${womensNo}`)

  // Sample of unmatched — most are real schools not in our 771-school dataset
  // (small NJCAA programs, regional D3s). Print the first 20 grouped by
  // classification so the user can decide if any are worth adding.
  console.log(`\n=== Sample unmatched (first 20, by classification) ===`)
  const byClass: Record<string, string[]> = {}
  for (const u of unmatched.slice(0, 100)) {
    const c = u.classification ?? 'unknown'
    byClass[c] = byClass[c] ?? []
    byClass[c].push(u.eadaName)
  }
  for (const [c, names] of Object.entries(byClass)) {
    console.log(`  ${c}: ${names.length}`)
    names.slice(0, 5).forEach((n) => console.log(`    - ${n}`))
  }

  // Cleanup
  try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch { /* */ }
}

main().catch((e) => {
  console.error('buildEadaPrograms failed:', e)
  process.exit(1)
})
