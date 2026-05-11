/* eslint-disable no-console */
// Smoke test: verify that the same athlete profile produces *different* match
// scores for men's vs women's at schools where the two programs diverge.
// Run with: npx tsx server/scripts/smokeTestGenderMatching.ts

import { scoreSingleSchool } from '../lib/schoolMatcher'
import type { AthleteProfile } from '../../client/src/types/index'

function makeProfile(gender: 'mens' | 'womens'): AthleteProfile {
  return {
    fullName: 'Smoke Test',
    gradYear: 2027,
    gender,
    position: 'Forward',
    club: 'Test FC',
    state: 'CA',
    gpa: 3.5,
    satAct: '1300',
    goals: 12,
    assists: 8,
    targetDivision: 'D1',
    targetDivisions: ['D1'],
    excludedDivisions: [],
    locationPreference: 'any',
    sizePreference: 'any',
    academicMinimum: 5,
  } as unknown as AthleteProfile
}

interface ScoredRow {
  school: string
  gender: 'mens' | 'womens'
  matchScore: number
  athleticFit: number | undefined
  programStrength: number | undefined
  goalsForwardAvg: number | undefined
  coachName: string | undefined
  coachEmail: string | undefined
}

const targets = [
  { id: 'unc',           label: 'UNC',           expect: 'women > men (22-title women vs 2-title men)' },
  { id: 'stanford',      label: 'Stanford',      expect: 'women > men (3 vs 2 titles, recent men weak)' },
  { id: 'ucla',          label: 'UCLA',          expect: 'women > men (recent decade)' },
  { id: 'indiana',       label: 'Indiana',       expect: 'men > women (8 NCAA titles vs mid B1G)' },
  { id: 'maryland',      label: 'Maryland',      expect: 'men > women (4 titles vs mid)' },
  { id: 'wakeforest',    label: 'Wake Forest',   expect: 'men > women (1 title, top-5 vs solid)' },
  { id: 'virginia',      label: 'Virginia',      expect: 'men > women (7 vs 1 title)' },
  { id: 'georgetown',    label: 'Georgetown',    expect: 'men > women (2019 champ vs solid)' },
  { id: 'tulsa',         label: 'Tulsa',         expect: 'men > women (2024 champ vs mid)' },
  { id: 'slu',           label: 'Saint Louis',   expect: 'men > women (10 titles legacy)' },
  { id: 'akron',         label: 'Akron',         expect: 'men only (no women varsity)' },
  { id: 'florida',       label: 'Florida',       expect: 'women only (no men varsity)' },
  { id: 'fsu',           label: 'Florida State', expect: 'women only (no men varsity)' },
  { id: 'usc',           label: 'USC',           expect: 'women only (men cut 2020)' },
]

const rows: ScoredRow[] = []
for (const { id, label, expect } of targets) {
  for (const gender of ['mens', 'womens'] as const) {
    const result = scoreSingleSchool(makeProfile(gender), id)
    if (!result) {
      rows.push({
        school: label,
        gender,
        matchScore: -1,
        athleticFit: -1,
        programStrength: undefined,
        goalsForwardAvg: undefined,
        coachName: '(no program)',
        coachEmail: '',
      })
      continue
    }
    rows.push({
      school: label,
      gender,
      matchScore: result.matchScore,
      athleticFit: result.athleticFit,
      programStrength: result.programStrength,
      goalsForwardAvg: result.goalsForwardAvg,
      coachName: result.coachName,
      coachEmail: result.coachEmail,
    })
  }
}

console.log('\n=== Same profile (3.5 GPA, 12 goals, Forward, D1 target), men\'s vs women\'s ===\n')
console.log('School         Gender   Score  Athletic  ProgStr  fAvg  Coach (real name+email is the new behavior)')
console.log('───────────────────────────────────────────────────────────────────────────────')
for (let i = 0; i < rows.length; i += 2) {
  const m = rows[i]
  const w = rows[i + 1]
  const expect = targets[i / 2].expect
  for (const r of [m, w]) {
    const coachStr = r.matchScore === -1
      ? r.coachName
      : `${r.coachName || '(no name)'} <${r.coachEmail || 'no email'}>`
    console.log(
      `${r.school.padEnd(14)} ${r.gender.padEnd(8)} ${String(r.matchScore).padStart(5)}  ${String(r.athleticFit).padStart(7)}  ${String(r.programStrength ?? '-').padStart(7)}  ${String(r.goalsForwardAvg ?? '-').padStart(4)}  ${coachStr}`,
    )
  }
  console.log(`               expect: ${expect}`)
  console.log()
}

// Pass criteria — at least these gendered divergences must produce different
// matchScores (silently-shared values would make them identical).
const pairs: Array<{ id: string; min_delta: number }> = [
  { id: 'unc', min_delta: 1 },
  { id: 'stanford', min_delta: 1 },
  { id: 'indiana', min_delta: 4 },
  { id: 'maryland', min_delta: 4 },
  { id: 'wakeforest', min_delta: 3 },
  { id: 'virginia', min_delta: 1 },
  { id: 'georgetown', min_delta: 2 },
  { id: 'tulsa', min_delta: 3 },
  { id: 'slu', min_delta: 2 },
]
// ── Additional coverage tests ─────────────────────────────────────────────

// Multi-target athlete: {D1, D3}. Both targeted divisions should read as
// "exact division match" with zero gap penalty.
function makeMultiTarget(gender: 'mens' | 'womens'): AthleteProfile {
  return {
    ...makeProfile(gender),
    targetDivision: 'D1',
    targetDivisions: ['D1', 'D3'],
  } as unknown as AthleteProfile
}

// Defender profile: athletic fit should not be driven by goal averages,
// regardless of gender. We expect roughly similar scores men's vs women's
// for the same defender at a non-overridden school.
function makeDefender(gender: 'mens' | 'womens'): AthleteProfile {
  return {
    ...makeProfile(gender),
    position: 'Center Back',
    goals: 0,
    assists: 2,
  } as unknown as AthleteProfile
}

console.log('=== Bonus: multi-target {D1, D3} athlete at UNC vs a D3 program ===')
for (const id of ['unc', 'williams']) {
  const r = scoreSingleSchool(makeMultiTarget('womens'), id)
  if (r) console.log(`${r.name.padEnd(34)} category=${r.category.padEnd(7)} matchScore=${r.matchScore} (gap-penalty should be 0 for both divisions)`)
}
console.log()

console.log('=== Bonus: men\'s calibration fallback (no override) — should still differentiate ===')
for (const id of ['american', 'lehigh', 'navy']) {
  const m = scoreSingleSchool(makeProfile('mens'), id)
  const w = scoreSingleSchool(makeProfile('womens'), id)
  if (!m || !w) continue
  console.log(`${m.name.padEnd(34)} men: fAvg=${m.goalsForwardAvg} score=${m.matchScore} | women: fAvg=${w.goalsForwardAvg} score=${w.matchScore}`)
}
console.log()

console.log('=== Bonus: defender (goal stats should be ignored) ===')
for (const id of ['unc', 'indiana']) {
  const m = scoreSingleSchool(makeDefender('mens'), id)
  const w = scoreSingleSchool(makeDefender('womens'), id)
  console.log(`${id.padEnd(10)} men: score=${m?.matchScore ?? '-'} | women: score=${w?.matchScore ?? '-'} (defender — driven by programStrength, not goals)`)
}
console.log()

let failures = 0
for (const p of pairs) {
  const m = scoreSingleSchool(makeProfile('mens'), p.id)
  const w = scoreSingleSchool(makeProfile('womens'), p.id)
  const delta = Math.abs((m?.matchScore ?? 0) - (w?.matchScore ?? 0))
  const pass = delta >= p.min_delta
  if (!pass) {
    console.log(`FAIL ${p.id}: men=${m?.matchScore} women=${w?.matchScore} delta=${delta} < ${p.min_delta}`)
    failures++
  }
}
if (failures === 0) {
  console.log(`\nPASS — all ${pairs.length} gendered divergences produce meaningfully different scores.`)
  process.exit(0)
} else {
  console.log(`\nFAIL — ${failures}/${pairs.length} divergences below expected delta.`)
  process.exit(1)
}
