/**
 * Reads coachesScraped.json and prints a coverage report:
 *   - Per-division success rates
 *   - List of failed schools (so you know which programs need manual entry)
 *   - List of partial successes (name only, missing email)
 */

import fs from 'fs'
import path from 'path'
import schoolsData from '../data/schools.json'

const CACHE = path.join(__dirname, '..', 'data', 'coachesScraped.json')
const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'))

interface School { id: string; name: string; division: string }

const schools = schoolsData as School[]

interface Tally { success: number; partial: number; failed: number; total: number }
const byDiv: Record<string, Tally> = {}
const successList: string[] = []
const partialList: string[] = []
const failedList: string[] = []

for (const school of schools) {
  for (const gender of ['mens', 'womens'] as const) {
    const key = `${school.id}:${gender}`
    const entry = cache[key]
    if (!entry) continue

    const div = school.division
    byDiv[div] = byDiv[div] || { success: 0, partial: 0, failed: 0, total: 0 }
    byDiv[div].total++

    if (entry.status === 'success') {
      byDiv[div].success++
      successList.push(`${school.name} (${div}, ${gender}) — ${entry.coachName} <${entry.coachEmail}>`)
    } else if (entry.status === 'partial') {
      byDiv[div].partial++
      partialList.push(`${school.name} (${div}, ${gender}) — ${entry.coachName} (no email)`)
    } else {
      byDiv[div].failed++
      failedList.push(`${school.name} (${div}, ${gender}) — ${entry.reason ?? 'unknown'}`)
    }
  }
}

console.log('═════ COACH SCRAPE COVERAGE REPORT ═════\n')
console.log('Per-division coverage:')
const order = ['D1', 'D2', 'D3', 'NAIA', 'JUCO']
for (const div of order) {
  const t = byDiv[div]
  if (!t) continue
  const pct = ((t.success + t.partial) / t.total * 100).toFixed(0)
  console.log(`  ${div.padEnd(5)} ${t.success}✅ + ${t.partial}🟡 + ${t.failed}❌ of ${t.total}  →  ${pct}% useful`)
}
const total = Object.values(byDiv).reduce((a, b) => ({
  success: a.success + b.success,
  partial: a.partial + b.partial,
  failed: a.failed + b.failed,
  total: a.total + b.total,
}), { success: 0, partial: 0, failed: 0, total: 0 })
const totalPct = ((total.success + total.partial) / total.total * 100).toFixed(0)
console.log(`  ─────`)
console.log(`  ALL   ${total.success}✅ + ${total.partial}🟡 + ${total.failed}❌ of ${total.total}  →  ${totalPct}% useful`)

console.log(`\nFailed (need manual lookup or AI fallback): ${failedList.length}`)
if (process.argv.includes('--list-failed')) failedList.forEach((l) => console.log('  ', l))

console.log(`\nPartial (name only, no email): ${partialList.length}`)
if (process.argv.includes('--list-partial')) partialList.forEach((l) => console.log('  ', l))

console.log(`\nSuccessful entries: ${successList.length}`)
if (process.argv.includes('--list-success')) successList.slice(0, 30).forEach((l) => console.log('  ', l))
