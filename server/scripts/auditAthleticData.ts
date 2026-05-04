/**
 * Coverage audit for the athletic info scraper.
 *
 * Reports D1/D2/D3 coverage for the 5 in-scope fields:
 *   coach name, coach email, division, location, competitive record, recruiting class
 *
 * Usage: npx tsx server/scripts/auditAthleticData.ts
 */
import * as fs from 'fs'
import * as path from 'path'

interface School { id: string; name: string; division: string; location: string }
interface Coach { schoolId: string; gender: 'mens' | 'womens'; coachName: string; coachEmail: string; status: string }

const dataDir = path.join(__dirname, '..', 'data')
const schools = JSON.parse(fs.readFileSync(path.join(dataDir, 'schools.json'), 'utf8')) as School[]
const coaches = JSON.parse(fs.readFileSync(path.join(dataDir, 'coachesScraped.json'), 'utf8')) as Record<string, Coach>
const records = (() => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'programRecords.json'), 'utf8')) as Record<string, unknown> } catch { return {} } })()
const classes = (() => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'recruitingClasses.json'), 'utf8')) as Record<string, unknown> } catch { return {} } })()
const budget = (() => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, '.scraperBudget.json'), 'utf8')) as { spendUsd: number; entries: unknown[] } } catch { return { spendUsd: 0, entries: [] } } })()

const FREE_RE = /^(gmail|yahoo|hotmail|outlook|aol|icloud|msn|protonmail|ymail|live|me|mac)\.(com|net)$/i
function isInstitutional(email: string): boolean {
  const m = email.toLowerCase().match(/@([^@\s>]+)\s*$/)
  if (!m) return false
  const d = m[1]
  if (FREE_RE.test(d)) return false
  return /\.(edu|gov|mil)$/.test(d) || /\.ac\.[a-z]{2}$/.test(d)
}

const TARGET_DIVISIONS = ['D1', 'D2', 'D3'] as const
const targetSchools = schools.filter(s => (TARGET_DIVISIONS as readonly string[]).includes(s.division))
const programTargets = targetSchools.length * 2

console.log(`══ ATHLETIC DATA COVERAGE AUDIT ══`)
console.log(`Target: D1+D2+D3 programs (${targetSchools.length} schools × 2 genders = ${programTargets} program-targets)\n`)

for (const div of TARGET_DIVISIONS) {
  const ds = targetSchools.filter(s => s.division === div)
  const dt = ds.length * 2
  const dsIds = new Set(ds.map(s => s.id))

  let withName = 0, withInstEmail = 0, withRecord = 0, withClass = 0
  for (const s of ds) {
    for (const g of ['mens', 'womens'] as const) {
      const key = `${s.id}:${g}`
      const c = coaches[key]
      if (c?.coachName) withName++
      if (c?.coachEmail && isInstitutional(c.coachEmail)) withInstEmail++
      if (records[key]) withRecord++
      if (classes[key]) withClass++
    }
  }
  console.log(`── ${div} (${ds.length} schools, ${dt} program-targets) ──`)
  console.log(`  Coach name:        ${withName}/${dt} (${pct(withName, dt)}%)`)
  console.log(`  Coach .edu email:  ${withInstEmail}/${dt} (${pct(withInstEmail, dt)}%)`)
  console.log(`  Competitive record:${withRecord}/${dt} (${pct(withRecord, dt)}%)`)
  console.log(`  Recruiting class:  ${withClass}/${dt} (${pct(withClass, dt)}%)`)
  console.log()
}

// Overall
let allName = 0, allEmail = 0, allRecord = 0, allClass = 0
for (const s of targetSchools) for (const g of ['mens', 'womens'] as const) {
  const key = `${s.id}:${g}`; const c = coaches[key]
  if (c?.coachName) allName++
  if (c?.coachEmail && isInstitutional(c.coachEmail)) allEmail++
  if (records[key]) allRecord++
  if (classes[key]) allClass++
}
console.log(`── OVERALL (D1+D2+D3) ──`)
console.log(`  Coach name:        ${allName}/${programTargets} (${pct(allName, programTargets)}%)`)
console.log(`  Coach .edu email:  ${allEmail}/${programTargets} (${pct(allEmail, programTargets)}%)`)
console.log(`  Competitive record:${allRecord}/${programTargets} (${pct(allRecord, programTargets)}%)`)
console.log(`  Recruiting class:  ${allClass}/${programTargets} (${pct(allClass, programTargets)}%)`)

console.log(`\n── BUDGET ──`)
console.log(`  Total spend: $${budget.spendUsd.toFixed(4)}  (${budget.entries.length} API calls)`)

function pct(n: number, d: number) { return d === 0 ? '0' : ((n / d) * 100).toFixed(1) }
