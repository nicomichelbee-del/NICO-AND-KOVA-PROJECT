/**
 * Audit the failure pile in coachesScraped.json.
 *
 * Goal: figure out where the 739 ❌ entries are concentrated so the next
 * round of scraper improvements can target them. Buckets failures by:
 *   - division (D1/D2/D3/NAIA/JUCO)
 *   - whether ATHLETICS_DOMAINS[schoolId] is mapped
 *   - failure reason (the `reason` string we save)
 *   - conference (top conferences within each division)
 *
 * The current cache does not record per-URL HTTP status for failed
 * attempts (that data only lives in DEBUG_SCRAPE logs), so this audit
 * works at the entry level. A follow-up scraper change should persist
 * `urlAttempts` into the cache to make the next audit deeper.
 *
 * Usage:
 *   npx tsx server/scripts/auditFailures.ts
 *   npx tsx server/scripts/auditFailures.ts --out=server/data/failure-audit.md
 */

import * as fs from 'fs'
import * as path from 'path'
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
  status: string
  reason?: string
}

const CACHE_PATH = path.join(__dirname, '..', 'data', 'coachesScraped.json')

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }),
)
const OUT_PATH = args.out as string | undefined

const cache: Record<string, ScrapedCoach> = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
const schools = schoolsData as SchoolRecord[]
const schoolById: Record<string, SchoolRecord> = Object.fromEntries(schools.map((s) => [s.id, s]))

// Bucket helpers
const inc = <K extends string>(o: Record<K, number>, k: K) => { o[k] = (o[k] ?? 0) + 1 }
const pct = (n: number, d: number) => (d === 0 ? '—' : ((n / d) * 100).toFixed(1) + '%')

// ── Aggregate ────────────────────────────────────────────────────────────

const entries = Object.values(cache)
const failed = entries.filter((e) => e.status === 'failed')

const totalsByStatus: Record<string, number> = {}
entries.forEach((e) => inc(totalsByStatus, e.status))

const byDivision: Record<string, { total: number; failed: number; success: number; partial: number; emailInferred: number }> = {}
for (const e of entries) {
  const sch = schoolById[e.schoolId]
  const div = sch?.division ?? 'UNKNOWN'
  if (!byDivision[div]) byDivision[div] = { total: 0, failed: 0, success: 0, partial: 0, emailInferred: 0 }
  byDivision[div].total++
  if (e.status === 'failed') byDivision[div].failed++
  else if (e.status === 'success') byDivision[div].success++
  else if (e.status === 'partial') byDivision[div].partial++
  else if (e.status === 'email-inferred') byDivision[div].emailInferred++
}

// Domain-known vs unknown × division
const domainCoverage: Record<string, { failed: number; failedNoDomain: number; failedWithDomain: number }> = {}
for (const e of failed) {
  const sch = schoolById[e.schoolId]
  const div = sch?.division ?? 'UNKNOWN'
  if (!domainCoverage[div]) domainCoverage[div] = { failed: 0, failedNoDomain: 0, failedWithDomain: 0 }
  domainCoverage[div].failed++
  if (ATHLETICS_DOMAINS[e.schoolId]) domainCoverage[div].failedWithDomain++
  else domainCoverage[div].failedNoDomain++
}

// Failure reason bucket
const reasonCounts: Record<string, number> = {}
for (const e of failed) {
  const r = (e.reason ?? '(no reason)').slice(0, 100)
  inc(reasonCounts, r)
}

// Conference breakdown of failures (top 15)
const failuresByConference: Record<string, { div: string; count: number }> = {}
for (const e of failed) {
  const sch = schoolById[e.schoolId]
  const conf = sch?.conference ?? 'UNKNOWN'
  const div = sch?.division ?? 'UNKNOWN'
  const key = `${div} • ${conf}`
  if (!failuresByConference[key]) failuresByConference[key] = { div, count: 0 }
  failuresByConference[key].count++
}
const topConfs = Object.entries(failuresByConference).sort((a, b) => b[1].count - a[1].count).slice(0, 20)

// Schools that failed BOTH genders (high-impact targets — fixing one URL pattern wins twice)
const schoolFailureCounts: Record<string, { name: string; div: string; failedGenders: string[] }> = {}
for (const e of failed) {
  const sch = schoolById[e.schoolId]
  if (!sch) continue
  if (!schoolFailureCounts[e.schoolId]) {
    schoolFailureCounts[e.schoolId] = { name: sch.name, div: sch.division, failedGenders: [] }
  }
  schoolFailureCounts[e.schoolId].failedGenders.push(e.gender)
}
const bothGendersFailed = Object.entries(schoolFailureCounts)
  .filter(([, v]) => v.failedGenders.length === 2)
  .map(([id, v]) => ({ id, ...v }))

// One-gender failures (school exists in DB but only one gender failed — usually means
// the program for one gender doesn't exist OR the URL pattern picked up only one)
const singleGenderFailed = Object.entries(schoolFailureCounts)
  .filter(([, v]) => v.failedGenders.length === 1)
  .map(([id, v]) => ({ id, ...v, gender: v.failedGenders[0] }))

// Within domain-mapped failures, bucket by athletics domain TLD/pattern.
// e.g. *.edu vs *.com vs *.net — useful proxy for which CMS family the school uses.
const domainPatternCounts: Record<string, number> = {}
for (const e of failed) {
  const dom = ATHLETICS_DOMAINS[e.schoolId]
  if (!dom) continue
  const tld = dom.split('.').slice(-1)[0]
  inc(domainPatternCounts, tld)
}

// ── Render markdown ──────────────────────────────────────────────────────

const lines: string[] = []
const W = (s: string) => lines.push(s)

W('# Coach Scraper Failure Audit')
W('')
W(`_Generated ${new Date().toISOString()}_`)
W('')
W(`Total cache entries: ${entries.length}`)
W(`Schools in DB:       ${schools.length} (× 2 genders = ${schools.length * 2} expected entries)`)
W('')
W('## Status totals')
W('')
W('| Status | Count |')
W('|---|---|')
Object.entries(totalsByStatus).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => W(`| ${k} | ${v} |`))
W('')

W('## By division')
W('')
W('| Division | Total | ✅ Success | 🟡 Partial | 📧 Inferred | ❌ Failed | Fail % |')
W('|---|---:|---:|---:|---:|---:|---:|')
for (const div of ['D1', 'D2', 'D3', 'NAIA', 'JUCO']) {
  const b = byDivision[div]
  if (!b) continue
  W(`| ${div} | ${b.total} | ${b.success} | ${b.partial} | ${b.emailInferred} | ${b.failed} | ${pct(b.failed, b.total)} |`)
}
W('')

W('## Domain mapping coverage of failures')
W('')
W('Whether `ATHLETICS_DOMAINS[schoolId]` is populated for each failed entry. Failures with no domain mapping rely entirely on DuckDuckGo discovery, which is the weakest part of the pipeline. These are the easiest wins for Phase 2 (add domain mappings).')
W('')
W('| Division | Failed | With domain | No domain | No-domain % of failures |')
W('|---|---:|---:|---:|---:|')
for (const div of ['D1', 'D2', 'D3', 'NAIA', 'JUCO']) {
  const d = domainCoverage[div]
  if (!d) continue
  W(`| ${div} | ${d.failed} | ${d.failedWithDomain} | ${d.failedNoDomain} | ${pct(d.failedNoDomain, d.failed)} |`)
}
W('')

W('## Failure reasons')
W('')
W(`The \`reason\` string written by the scraper. \"no URL pattern returned a parseable head-coach card\" means a domain was known but every candidate URL either 404'd, redirected to the opposite gender, or returned a page the parser couldn't extract from. \"no domain mapping and search discovery failed\" means we didn't even know which site to hit and DDG returned nothing usable.`)
W('')
W('| Reason | Count |')
W('|---|---:|')
Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => W(`| ${k} | ${v} |`))
W('')

W('## Top 20 conferences by failure count')
W('')
W('Conferences clustered together usually share a CMS — fixing one URL pattern often clears a whole conference at once.')
W('')
W('| Division • Conference | Failures |')
W('|---|---:|')
for (const [k, v] of topConfs) W(`| ${k} | ${v.count} |`)
W('')

W('## Schools where BOTH genders failed')
W('')
W(`${bothGendersFailed.length} schools failed both mens and womens. These are pure pipeline failures (not "school doesn't have this program") and are the highest-leverage targets — one fix wins two entries.`)
W('')
const bothByDiv: Record<string, typeof bothGendersFailed> = {}
for (const s of bothGendersFailed) {
  if (!bothByDiv[s.div]) bothByDiv[s.div] = []
  bothByDiv[s.div].push(s)
}
for (const div of ['D1', 'D2', 'D3', 'NAIA', 'JUCO']) {
  const list = bothByDiv[div]
  if (!list || list.length === 0) continue
  const hasDomainCount = list.filter((s) => ATHLETICS_DOMAINS[s.id]).length
  W(`### ${div} — ${list.length} schools (${hasDomainCount} with mapped domain, ${list.length - hasDomainCount} without)`)
  W('')
  list
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 30)
    .forEach((s) => {
      const dom = ATHLETICS_DOMAINS[s.id] ? `→ ${ATHLETICS_DOMAINS[s.id]}` : '(no domain)'
      W(`- **${s.name}** \`${s.id}\` ${dom}`)
    })
  if (list.length > 30) W(`- _… and ${list.length - 30} more_`)
  W('')
}

W('## Schools where ONE gender succeeded but the other failed')
W('')
W(`${singleGenderFailed.length} entries. These usually mean the school genuinely lacks one program (common at JUCO/NAIA) OR the parser's gender filter was too strict on a shared staff page. Worth a sample check before assuming "no program".`)
W('')

W('## Athletics-domain TLD distribution within failures')
W('')
W('Mapped-domain failures grouped by TLD. `.com` failures are mostly SIDEARM-or-similar commercial vendors; `.edu` failures are almost always WordPress/Site Improve installs that need new URL patterns. Phase 2 should target the `.edu` slice first.')
W('')
W('| TLD | Failures with this TLD |')
W('|---|---:|')
Object.entries(domainPatternCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => W(`| .${k} | ${v} |`))
W('')

W('## Recommended ordering for the next pass')
W('')
W(`Based on the buckets above:`)
W('')
W(`1. **Add domain mappings.** ${Object.values(domainCoverage).reduce((s, d) => s + d.failedNoDomain, 0)} failures have no \`ATHLETICS_DOMAINS\` entry, so they only get DDG discovery. Even rough domain mappings unlock the URL-pattern engine for them.`)
W(`2. **Add non-SIDEARM URL patterns.** \`.edu\` failures (mostly D3/NAIA WordPress) are the largest mapped-but-failing slice — Phase 2 of the brief.`)
W(`3. **Improve search fallback.** DDG-only / top-1-result is brittle for small schools (Phase 3).`)
W(`4. **Persist \`urlAttempts\` into the cache.** This audit can't currently see HTTP status per pattern — add it to scrapeCoaches.ts so the next audit can show "404 vs redirect vs 200-but-empty" splits.`)
W('')

const md = lines.join('\n')

if (OUT_PATH) {
  const abs = path.isAbsolute(OUT_PATH) ? OUT_PATH : path.join(process.cwd(), OUT_PATH)
  fs.writeFileSync(abs, md)
  console.log(`Wrote ${abs}`)
} else {
  process.stdout.write(md)
}
