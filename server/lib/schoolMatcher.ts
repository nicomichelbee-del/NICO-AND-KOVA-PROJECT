import schoolsData from '../data/schools.json'
import type { AthleteProfile, MatchBreakdown, School, SchoolDirectoryEntry } from '../../client/src/types/index'

interface SchoolRecord {
  id: string
  name: string
  division: 'D1' | 'D2' | 'D3' | 'NAIA' | 'JUCO'
  conference: string
  location: string
  region: string
  enrollment: number
  size: 'small' | 'medium' | 'large'
  mensCoach: string
  mensCoachEmail: string
  womensCoach: string
  womensCoachEmail: string
  gpaMin: number
  gpaAvg: number
  goalsForwardAvg: number
  goalsMidAvg: number
  programStrength: number
  scholarships?: boolean
  notes?: string
}

type Division = 'D1' | 'D2' | 'D3' | 'NAIA' | 'JUCO'
type Bucket = 'reach' | 'target' | 'safety'

const DIVISION_ORDER: Division[] = ['D1', 'D2', 'D3', 'NAIA', 'JUCO']
const divIdx = (d: Division) => DIVISION_ORDER.indexOf(d)

function isGoalkeeper(position: string): boolean {
  const p = position.toLowerCase()
  return p.includes('goal') || p === 'gk' || p === 'keeper'
}

function isForward(position: string): boolean {
  const p = position.toLowerCase()
  return p.includes('forward') || p.includes('striker') || p.includes('wing') || p === 'cf' || p === 'lw' || p === 'rw'
}

// Athlete strength relative to the school's typical recruit.
//   ~0  → matches typical recruit (target)
//   >0  → athlete is stronger than typical recruit (safety)
//   <0  → athlete is below typical recruit (reach)
// Combines academics, on-field stats, division gap, and program prestige.
function competitiveness(profile: AthleteProfile, school: SchoolRecord): number {
  const gk = isGoalkeeper(profile.position)
  const fwd = isForward(profile.position)

  // Academic delta in "GPA points" — every 0.3 GPA = 1 unit of separation.
  const gpaDelta = school.gpaAvg > 0 ? (profile.gpa - school.gpaAvg) / 0.3 : 0

  // Stats delta. GKs don't have goals, so weight academics fully for them.
  let statsDelta = 0
  if (!gk) {
    const expected = fwd ? school.goalsForwardAvg : school.goalsMidAvg
    if (expected > 0) {
      // Half of the typical scoring rate = 1 unit of separation in either direction.
      statsDelta = (profile.goals - expected) / Math.max(expected * 0.5, 3)
    }
  }

  // Division gap: targeting up vs. school's actual level.
  // If athlete targets D3 and school is D1 (idx delta = -2), school is much harder → negative.
  const divGap = divIdx(school.division) - divIdx(profile.targetDivision)
  // Negative if school is a higher division than target.
  const divDelta = -divGap * 0.6

  // Program prestige (1–10): a 10-rated program is harder to crack than a 6.
  const programDelta = -((school.programStrength - 6) * 0.2)

  // Weighted combination. Stats matter less for GKs.
  const gpaW = gk ? 0.55 : 0.40
  const statsW = gk ? 0.0 : 0.30
  return gpaDelta * gpaW + statsDelta * statsW + divDelta + programDelta
}

// Preference fit: how well does the school match the athlete's stated wants?
// 0–100, higher = better aligned.
function fit(profile: AthleteProfile, school: SchoolRecord): number {
  let score = 50

  // Division alignment is the strongest fit signal.
  const divDist = Math.abs(divIdx(school.division) - divIdx(profile.targetDivision))
  if (divDist === 0) score += 30
  else if (divDist === 1) score += 15
  else if (divDist === 2) score -= 5
  else score -= 20

  // Region preference (now an enum: any | West | Southwest | Midwest | Southeast | Northeast).
  if (profile.locationPreference && profile.locationPreference !== 'any') {
    if (school.region === profile.locationPreference) score += 15
    else score -= 5
  }

  // School size preference.
  if (profile.sizePreference && profile.sizePreference !== 'any') {
    if (school.size === profile.sizePreference) score += 10
    else score -= 3
  }

  return Math.max(0, Math.min(100, score))
}

interface Candidate {
  school: SchoolRecord
  comp: number
  fit: number
  matchScore: number
  bucket: Bucket
  coachName: string
  coachEmail: string
}

export function matchSchools(profile: AthleteProfile, topN = 25): School[] {
  const gender = profile.gender ?? 'womens'

  const scored = (schoolsData as SchoolRecord[]).map((s) => {
    const comp = competitiveness(profile, s)
    const f = fit(profile, s)
    // Schools wildly out of reach get a match-score penalty so they don't
    // dominate the ranking — but they're still allowed to surface as reaches.
    const stretch = Math.abs(comp)
    const stretchPenalty = stretch > 2 ? Math.min(40, (stretch - 2) * 20) : 0
    const matchScore = Math.max(0, Math.min(100, Math.round(f - stretchPenalty)))
    return {
      school: s,
      comp,
      fit: f,
      matchScore,
      coachName: gender === 'womens' ? s.womensCoach : s.mensCoach,
      coachEmail: gender === 'womens' ? s.womensCoachEmail : s.mensCoachEmail,
    }
  })

  // Pick the topN most-relevant schools by overall fit-weighted score, then
  // partition *those* by competitiveness. This makes reach/target/safety a
  // relative split within the chosen pool, so every athlete always gets a mix
  // of all three — even when stats are sparse.
  const pool = [...scored].sort((a, b) => b.matchScore - a.matchScore).slice(0, topN)

  // Slot allocation. Roughly 30% safety / 40% target / 30% reach, with a floor
  // so each bucket has meaningful representation.
  const minPerBucket = Math.max(4, Math.floor(topN * 0.2))
  const safetyN = Math.max(minPerBucket, Math.floor(topN * 0.3))
  const targetN = Math.max(minPerBucket, Math.floor(topN * 0.4))
  const reachN = Math.max(minPerBucket, pool.length - safetyN - targetN)

  // Sort the pool by competitiveness (descending = most likely safety first).
  const byComp = [...pool].sort((a, b) => b.comp - a.comp)

  const safetySlice = byComp.slice(0, safetyN)
  const targetSlice = byComp.slice(safetyN, safetyN + targetN)
  const reachSlice = byComp.slice(safetyN + targetN, safetyN + targetN + reachN)

  const candidates: Candidate[] = [
    ...safetySlice.map((c) => ({ ...c, bucket: 'safety' as Bucket })),
    ...targetSlice.map((c) => ({ ...c, bucket: 'target' as Bucket })),
    ...reachSlice.map((c) => ({ ...c, bucket: 'reach' as Bucket })),
  ]

  // Within each bucket, surface the strongest fit first.
  const ordered = [
    ...candidates.filter((c) => c.bucket === 'safety').sort((a, b) => b.matchScore - a.matchScore),
    ...candidates.filter((c) => c.bucket === 'target').sort((a, b) => b.matchScore - a.matchScore),
    ...candidates.filter((c) => c.bucket === 'reach').sort((a, b) => b.matchScore - a.matchScore),
  ]

  return ordered.map((c) => ({
    id: c.school.id,
    name: c.school.name,
    division: c.school.division,
    location: c.school.location,
    region: c.school.region,
    size: c.school.size,
    enrollment: c.school.enrollment,
    conference: c.school.conference,
    coachName: c.coachName,
    coachEmail: c.coachEmail,
    category: c.bucket,
    matchScore: c.matchScore,
    notes: c.school.notes ?? '',
    programStrength: c.school.programStrength,
    scholarships: c.school.scholarships,
    gpaAvg: c.school.gpaAvg,
    goalsForwardAvg: c.school.goalsForwardAvg,
    goalsMidAvg: c.school.goalsMidAvg,
    breakdown: buildBreakdown(profile, c.school),
  }))
}

function buildBreakdown(profile: AthleteProfile, school: SchoolRecord): MatchBreakdown {
  const gk = isGoalkeeper(profile.position)
  const fwd = isForward(profile.position)

  // GPA axis.
  const gpaScore = school.gpaAvg > 0
    ? Math.max(0, Math.min(100, Math.round((profile.gpa / school.gpaAvg) * 100)))
    : 50
  const gpaVerdict = profile.gpa >= school.gpaAvg
    ? `You're above the typical recruit's ${school.gpaAvg.toFixed(1)} GPA.`
    : profile.gpa >= school.gpaMin
      ? `Your GPA clears the floor (${school.gpaMin.toFixed(1)}) but is below the typical ${school.gpaAvg.toFixed(1)}.`
      : `Below this program's typical academic profile (avg ${school.gpaAvg.toFixed(1)}, min ~${school.gpaMin.toFixed(1)}).`

  // Stats axis (skip for goalkeepers).
  let stats: MatchBreakdown['stats'] = null
  if (!gk) {
    const expected = fwd ? school.goalsForwardAvg : school.goalsMidAvg
    const positionLabel = fwd ? 'forwards' : 'midfielders'
    const score = expected > 0
      ? Math.max(0, Math.min(100, Math.round((profile.goals / expected) * 100)))
      : 50
    const verdict = expected === 0
      ? 'No goal-scoring benchmark on file for this program.'
      : profile.goals >= expected
        ? `You out-scored this program's typical ${positionLabel} (${expected} goals).`
        : profile.goals >= expected * 0.7
          ? `You're within range of this program's typical ${positionLabel} (${expected} goals).`
          : `Below this program's typical ${positionLabel} (${expected} goals).`
    stats = { score, yourValue: profile.goals, typicalValue: expected, verdict }
  }

  // Division axis.
  const divDist = Math.abs(divIdx(school.division) - divIdx(profile.targetDivision))
  const divScore = divDist === 0 ? 100 : divDist === 1 ? 70 : divDist === 2 ? 35 : 15
  const divVerdict = divDist === 0
    ? `Exact division match for your ${profile.targetDivision} target.`
    : divIdx(school.division) < divIdx(profile.targetDivision)
      ? `Plays one level above your ${profile.targetDivision} target — more competitive.`
      : `Plays below your ${profile.targetDivision} target — more attainable.`

  // Region axis.
  const pref = profile.locationPreference || 'any'
  const regionScore = pref === 'any' ? 75 : school.region === pref ? 100 : 30
  const regionVerdict = pref === 'any'
    ? 'No region preference set.'
    : school.region === pref
      ? `Located in your preferred ${pref} region.`
      : `Outside your preferred ${pref} region (this school is ${school.region}).`

  // Size axis.
  const sizePref = profile.sizePreference || 'any'
  const sizeScore = sizePref === 'any' ? 75 : school.size === sizePref ? 100 : 40
  const sizeVerdict = sizePref === 'any'
    ? 'No size preference set.'
    : school.size === sizePref
      ? `Matches your ${sizePref}-school preference.`
      : `${school.size} school — you preferred ${sizePref}.`

  return {
    gpa: { score: gpaScore, yourValue: profile.gpa, typicalValue: school.gpaAvg, verdict: gpaVerdict },
    stats,
    division: { score: divScore, yourTarget: profile.targetDivision, schoolDivision: school.division, verdict: divVerdict },
    region: { score: regionScore, yourPref: pref, schoolRegion: school.region, verdict: regionVerdict },
    size: { score: sizeScore, yourPref: sizePref, schoolSize: school.size, verdict: sizeVerdict },
  }
}

// Public directory used by the email composer to browse all schools by region
// and conference. No athlete data — pure school metadata.
export function listSchools(): SchoolDirectoryEntry[] {
  return (schoolsData as SchoolRecord[]).map((s) => ({
    id: s.id,
    name: s.name,
    division: s.division,
    conference: s.conference,
    location: s.location,
    region: s.region,
    size: s.size,
    enrollment: s.enrollment,
    notes: s.notes,
  }))
}
