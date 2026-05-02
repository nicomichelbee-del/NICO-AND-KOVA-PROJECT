/**
 * Phase 0 diagnostic: prove (or disprove) the "every match score is 90" bug.
 *
 * Runs matchSchools() on a realistic athlete profile, then prints:
 *   1. A histogram of matchScore across ALL 755 schools (not just top 25).
 *   2. The top 25 schools the matcher returns, with score breakdown.
 *   3. Distinct-value counts for the underlying schools.json fields.
 *
 * Usage: npx tsx server/scripts/diagnoseMatcher.ts
 */

import { matchSchools } from '../lib/schoolMatcher'
import schoolsData from '../data/schools.json'
import type { AthleteProfile } from '../../client/src/types/index'

const SAMPLE_PROFILE: AthleteProfile = {
  name: 'Test Athlete',
  gradYear: 2027,
  position: 'Central Mid',
  gender: 'womens',
  clubTeam: 'FC Dallas Academy',
  clubLeague: 'ECNL',
  gpa: 3.6,
  goals: 8,
  assists: 6,
  targetDivision: 'D1',
  locationPreference: 'Southeast',
  sizePreference: 'large',
}

function histogram(values: number[], bucketSize = 5): void {
  const buckets: Record<number, number> = {}
  for (const v of values) {
    const b = Math.floor(v / bucketSize) * bucketSize
    buckets[b] = (buckets[b] ?? 0) + 1
  }
  const max = Math.max(...Object.values(buckets))
  const sortedKeys = Object.keys(buckets).map(Number).sort((a, b) => a - b)
  console.log(`\nDistribution of matchScore across all ${values.length} schools (bucket size ${bucketSize}):`)
  for (const k of sortedKeys) {
    const count = buckets[k]
    const bar = '█'.repeat(Math.round((count / max) * 40))
    console.log(`  ${String(k).padStart(3)}–${String(k + bucketSize - 1).padStart(3)}  ${String(count).padStart(4)}  ${bar}`)
  }
}

function main() {
  console.log('═══ Matcher Diagnostic ═══')
  console.log('Sample profile:')
  console.log(`  position:    ${SAMPLE_PROFILE.position} (${SAMPLE_PROFILE.gender})`)
  console.log(`  GPA:         ${SAMPLE_PROFILE.gpa}`)
  console.log(`  goals:       ${SAMPLE_PROFILE.goals}`)
  console.log(`  target div:  ${SAMPLE_PROFILE.targetDivision}`)
  console.log(`  region:      ${SAMPLE_PROFILE.locationPreference}`)
  console.log(`  size:        ${SAMPLE_PROFILE.sizePreference}`)

  // Pull every school back so we can see the full score distribution.
  const all = matchSchools(SAMPLE_PROFILE, schoolsData.length)
  const scores = all.map((s) => s.matchScore)

  histogram(scores)

  console.log('\nSummary stats:')
  console.log(`  unique scores:    ${new Set(scores).size}`)
  console.log(`  min:              ${Math.min(...scores)}`)
  console.log(`  max:              ${Math.max(...scores)}`)
  console.log(`  mean:             ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)}`)
  const top25 = all.slice(0, 25)
  const top25Scores = top25.map((s) => s.matchScore)
  console.log(`  top-25 score range: ${Math.min(...top25Scores)} – ${Math.max(...top25Scores)}`)
  console.log(`  top-25 unique:    ${new Set(top25Scores).size}`)

  console.log('\n══ DEFAULT USER VIEW (matchSchools(profile), topN=25) ══')
  const userView = matchSchools(SAMPLE_PROFILE)
  const counts = {
    reach: userView.filter((s) => s.category === 'reach').length,
    target: userView.filter((s) => s.category === 'target').length,
    safety: userView.filter((s) => s.category === 'safety').length,
  }
  console.log(`Total: ${userView.length}  |  reach: ${counts.reach}  target: ${counts.target}  safety: ${counts.safety}\n`)
  console.log('  rank  bucket   div   score  athl  acad  name')
  console.log('  ────  ───────  ────  ─────  ────  ────  ────────────────────────────────')
  userView.forEach((s, i) => {
    const rank = String(i + 1).padStart(2)
    const bucket = s.category.padEnd(7)
    const div = s.division.padEnd(4)
    const score = String(s.matchScore).padStart(3)
    const ath = String(s.athleticFit ?? '-').padStart(3)
    const acad = String(s.academicFit ?? '-').padStart(3)
    const name = s.name.slice(0, 38)
    console.log(`  ${rank}    ${bucket}  ${div}  ${score}    ${ath}   ${acad}   ${name}`)
  })

  console.log('\nUnderlying data resolution (across all 755 schools):')
  type SchoolField = {
    gpaAvg: number; goalsForwardAvg: number; goalsMidAvg: number; programStrength: number
  }
  const data = schoolsData as unknown as SchoolField[]
  const distinct = (k: keyof SchoolField) => new Set(data.map((s) => s[k])).size
  console.log(`  gpaAvg:           ${distinct('gpaAvg')} distinct values`)
  console.log(`  goalsForwardAvg:  ${distinct('goalsForwardAvg')} distinct values`)
  console.log(`  goalsMidAvg:      ${distinct('goalsMidAvg')} distinct values`)
  console.log(`  programStrength:  ${distinct('programStrength')} distinct values`)
}

main()
