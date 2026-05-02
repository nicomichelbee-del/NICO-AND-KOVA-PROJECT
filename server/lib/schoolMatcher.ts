import fs from 'fs'
import path from 'path'
import schoolsData from '../data/schools.json'
import type { AthleteProfile, MatchBreakdown, School, SchoolDirectoryEntry } from '../../client/src/types/index'

// ── College Scorecard academic data (optional) ────────────────────────────
// When server/data/schoolsAcademic.json exists, the matcher merges admissions,
// SAT range, cost, and aid figures into each match. Missing file = matcher
// still works exactly as before, just without the extra fields.

interface AcademicRecord {
  satMid:             number | null
  sat25:              number | null
  sat75:              number | null
  actMid:             number | null
  admissionRate:      number | null
  tuitionInState:     number | null
  tuitionOutOfState:  number | null
  costOfAttendance:   number | null
  pctReceivingAid:    number | null
  pellGrantRate:      number | null
  graduationRate:     number | null
}

let academicCache: Record<string, AcademicRecord> | null = null
function getAcademic(schoolId: string): AcademicRecord | undefined {
  if (academicCache === null) {
    try {
      const p = path.join(__dirname, '..', 'data', 'schoolsAcademic.json')
      academicCache = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, AcademicRecord>
    } catch {
      academicCache = {}
    }
  }
  return academicCache[schoolId]
}

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

// ── v2 algorithm: two first-class fit axes ───────────────────────────────
//
// `academicFit` — how well does the athlete match the school's typical admit?
// `athleticFit` — how well does the athlete match the program's typical recruit?
// Each is 0–100. Higher = better match (athlete more likely to fit/play).
// Bucketing is *absolute* (thresholds), not relative — so a 3.6 GPA / D1
// midfielder targeting a top program will see actual reach schools (Stanford,
// UCLA) instead of having them suppressed by a stretch penalty.

function academicFit(profile: AthleteProfile, school: SchoolRecord): number {
  const gpaAvg = school.gpaAvg ?? 0
  const gpaMin = school.gpaMin ?? 0
  if (gpaAvg === 0) return 50  // unknown academic profile → neutral

  // Athlete GPA delta from typical admit.
  //  delta = 0   → athlete matches typical recruit → 70
  //  delta +0.4 → above typical → 100
  //  delta -0.4 → below typical → 40
  //  delta -0.7 → well below → 18 (reach)
  const delta = profile.gpa - gpaAvg
  let score = 70 + delta * 75

  // Hard floor penalty: if athlete is below the school's published min, this
  // is a real admissions risk on top of being below average.
  if (gpaMin > 0 && profile.gpa < gpaMin) {
    score -= 15
  }

  // Scorecard selectivity refinement. When real admission data is available,
  // adjust for schools whose schools.json gpaAvg understates difficulty:
  //   • Stanford has gpaAvg 3.9 BUT acceptance ~4% → reach even at gpa 3.9
  //   • Wingate has gpaAvg 3.0 AND acceptance ~91% → safety even at gpa 3.0
  // This pulls truly selective schools downward and boosts open-admission
  // schools, even when the underlying gpaAvg buckets are coarse.
  const academic = getAcademic(school.id)
  if (academic?.admissionRate != null) {
    const admPct = academic.admissionRate * 100
    if (admPct < 10) score -= 12       // ivy / equivalent
    else if (admPct < 20) score -= 8   // very selective
    else if (admPct < 35) score -= 4   // selective
    else if (admPct >= 80) score += 6  // open admission
    else if (admPct >= 65) score += 3
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

function athleticFit(profile: AthleteProfile, school: SchoolRecord): number {
  const gk = isGoalkeeper(profile.position)
  const fwd = isForward(profile.position)

  // Stats delta — only meaningful when both athlete and school have data.
  // For keepers we have no good signal yet (no save/clean-sheet data on the
  // profile); treat as neutral so academic + division dominate.
  let statsDelta = 0
  if (!gk && profile.goals > 0) {
    const expected = (fwd ? school.goalsForwardAvg : school.goalsMidAvg) ?? 0
    if (expected > 0) {
      // Half the typical scoring rate = 1 unit of separation in either direction.
      statsDelta = (profile.goals - expected) / Math.max(expected * 0.5, 3)
    }
  }

  // Division gap. Cap at ±2 so a D1 prospect doesn't see JUCO as "too easy
  // to be useful" — JUCOs would dominate as max-safety otherwise.
  const rawDivGap = divIdx(school.division) - divIdx(profile.targetDivision)
  const divGap = Math.max(-2, Math.min(2, rawDivGap))

  // Program prestige delta. School at strength 10 vs neutral 5 = +5 →
  // pulls athleticFit down (this is a tougher program).
  const programGap = (school.programStrength ?? 5) - 5

  // Composition. Tuned so:
  //   exact-fit, neutral program (statsDelta=0, divGap=0, programGap=0) → 60
  //   over-qualified safety (statsDelta=+1, divGap=+1, programGap=-2)   → 60+15+15+10 = 100
  //   classic reach (statsDelta=-1, divGap=-1, programGap=+4)           → 60-15-15-20 = 10
  const score = 60 + statsDelta * 15 + divGap * 15 - programGap * 5
  return Math.max(0, Math.min(100, Math.round(score)))
}

// Soft preference modifier: small bump for region/size match. Doesn't affect
// bucket assignment — just reorders within a bucket.
function preferenceBoost(profile: AthleteProfile, school: SchoolRecord): number {
  let boost = 0
  if (profile.locationPreference && profile.locationPreference !== 'any') {
    boost += school.region === profile.locationPreference ? 5 : -2
  }
  if (profile.sizePreference && profile.sizePreference !== 'any') {
    boost += school.size === profile.sizePreference ? 3 : -1
  }
  return boost
}

// ── reason generation ─────────────────────────────────────────────────────
// Produces 2–4 short, specific bullet points explaining *why* the school
// landed in its bucket. Rule-based — no AI cost. The athlete's card uses
// the top 2; the modal can show all of them.

function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? singular : (plural ?? `${singular}s`)
}

function buildReasons(
  profile: AthleteProfile,
  school: SchoolRecord,
  athletic: number,
  academic: number,
  bucket: Bucket,
  acad: AcademicRecord | undefined,
): string[] {
  const reasons: string[] = []
  const gk  = isGoalkeeper(profile.position)
  const fwd = isForward(profile.position)
  const positionLabel = gk ? 'keepers' : fwd ? 'forwards' : 'midfielders'

  // ── Top-line fit summary (always first) ──────────────────────────────
  if (bucket === 'safety') {
    reasons.push(athletic >= 90 && academic >= 90
      ? 'You\'re a top recruit on paper — comfortable fit on both axes.'
      : 'Both your athletic and academic profile clear this program\'s typical recruit.')
  } else if (bucket === 'target') {
    if (athletic >= 70 && academic <= 60) reasons.push('Athletically a strong fit; academics will be the stretch.')
    else if (academic >= 70 && athletic <= 60) reasons.push('Academic fit is strong; you\'ll need to compete athletically to play.')
    else reasons.push('You\'re in the conversation on both axes — a real target school.')
  } else {
    if (athletic <= 35 && academic <= 35) reasons.push('A genuine reach — aspirational on both sides.')
    else if (athletic <= 40) reasons.push('Their program plays a level above your current profile — athletic stretch.')
    else if (academic <= 40) reasons.push('Their typical recruit is above your current academic profile — push the GPA/SAT.')
    else reasons.push('Stretch fit — worth applying if it\'s a dream school.')
  }

  // ── Selectivity (Scorecard data, when available) ─────────────────────
  if (acad?.admissionRate != null) {
    const pct = Math.round(acad.admissionRate * 100)
    if (pct < 10) reasons.push(`Extremely selective — only ${pct}% of applicants are admitted.`)
    else if (pct < 25) reasons.push(`Very selective — ${pct}% acceptance rate.`)
    else if (pct >= 80) reasons.push(`Open admissions — ${pct}% acceptance rate.`)
  }

  // ── Athletic specifics ──────────────────────────────────────────────
  if (!gk && profile.goals > 0) {
    const expected = (fwd ? school.goalsForwardAvg : school.goalsMidAvg) ?? 0
    if (expected > 0) {
      if (profile.goals >= expected + 4) reasons.push(`Your ${profile.goals} goals exceed this program's typical ${positionLabel} (avg ${expected}).`)
      else if (profile.goals < Math.max(2, expected - 4)) reasons.push(`Your ${profile.goals} ${pluralize(profile.goals, 'goal')} is below typical ${positionLabel} here (avg ${expected}).`)
    }
  }

  // ── Academic specifics ──────────────────────────────────────────────
  const gpaAvg = school.gpaAvg ?? 0
  if (gpaAvg > 0 && profile.gpa > 0) {
    const delta = profile.gpa - gpaAvg
    if (delta >= 0.4) reasons.push(`Your ${profile.gpa.toFixed(2)} GPA is well above the typical recruit's ${gpaAvg.toFixed(1)}.`)
    else if (delta <= -0.4) reasons.push(`Your ${profile.gpa.toFixed(2)} GPA is below the typical ${gpaAvg.toFixed(1)} — bring up academics.`)
  }

  // ── Cost / scholarship signal (Scorecard) ────────────────────────────
  if (acad?.costOfAttendance != null) {
    const k = Math.round(acad.costOfAttendance / 1000)
    if (k <= 25) reasons.push(`Affordable — about $${k}k/yr cost of attendance.`)
    else if (k >= 70) reasons.push(`Expensive — about $${k}k/yr; check scholarships and financial aid.`)
  }
  if (school.scholarships && school.division !== 'D3') {
    // Athletic scholarships exist at this division — useful for the card.
    if (!reasons.some((r) => r.includes('scholarship') || r.includes('aid'))) {
      reasons.push(`Athletic scholarships available (${school.division}).`)
    }
  } else if (school.division === 'D3') {
    if (!reasons.some((r) => r.includes('aid') || r.includes('scholarship'))) {
      reasons.push('No athletic scholarships (D3); academic + need-based aid only.')
    }
  }

  // ── Geography preference ────────────────────────────────────────────
  if (profile.locationPreference && profile.locationPreference !== 'any'
      && school.region === profile.locationPreference) {
    reasons.push(`In your preferred ${profile.locationPreference} region.`)
  }

  // Cap at 4 reasons total. The first is always the top-line summary.
  return reasons.slice(0, 4)
}

// Absolute bucketing thresholds. A school is a safety only if the athlete is
// genuinely comfortable on both axes; a target if they're in the conversation
// on both; a reach if there's at least a credible path on either.
const SAFETY_FLOOR = 70   // both axes ≥ 70
const TARGET_FLOOR = 45   // both axes ≥ 45 (and not safety)
const REACH_FLOOR = 25    // at least one axis ≥ 25 (and not target)

function bucketFor(athletic: number, academic: number): Bucket | null {
  if (athletic >= SAFETY_FLOOR && academic >= SAFETY_FLOOR) return 'safety'
  if (athletic >= TARGET_FLOOR && academic >= TARGET_FLOOR) return 'target'
  if (athletic >= REACH_FLOOR || academic >= REACH_FLOOR) return 'reach'
  return null  // genuinely not a fit; drop from results
}

interface Candidate {
  school: SchoolRecord
  athletic: number
  academic: number
  matchScore: number
  bucket: Bucket
  coachName: string
  coachEmail: string
}

// Per-bucket caps when the user requests the default 25-school result. Sum
// must be <= topN; remaining budget is distributed proportionally if any
// bucket is short.
const DEFAULT_BUCKET_CAPS = { safety: 8, target: 10, reach: 8 } as const

export function matchSchools(profile: AthleteProfile, topN = 25): School[] {
  const gender = profile.gender ?? 'womens'

  const scored: Candidate[] = (schoolsData as SchoolRecord[])
    .map((s) => {
      const athletic = athleticFit(profile, s)
      const academic = academicFit(profile, s)
      const bucket = bucketFor(athletic, academic)
      if (!bucket) return null

      // Display matchScore = weighted blend (athletics-leaning since this is a
      // recruiting tool) + soft preference boost. Bucket assignment already
      // happened above; this is just for ranking + UI display.
      const blended = athletic * 0.55 + academic * 0.45
      const matchScore = Math.max(0, Math.min(100, Math.round(blended + preferenceBoost(profile, s))))
      return {
        school: s,
        athletic,
        academic,
        matchScore,
        bucket,
        coachName: gender === 'womens' ? s.womensCoach : s.mensCoach,
        coachEmail: gender === 'womens' ? s.womensCoachEmail : s.mensCoachEmail,
      } as Candidate
    })
    .filter((c): c is Candidate => c !== null)

  // Sort each bucket by matchScore desc, then break ties so ties don't
  // collapse the visual ordering. Many safeties cap at matchScore=100; we
  // surface the more competitive program first (higher programStrength),
  // then prefer schools matching the athlete's region/size preferences,
  // then the higher athletic fit.
  function bucketCompare(a: Candidate, b: Candidate): number {
    if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore
    const aProg = a.school.programStrength ?? 0
    const bProg = b.school.programStrength ?? 0
    if (aProg !== bProg) return bProg - aProg
    const aRegion = profile.locationPreference !== 'any' && a.school.region === profile.locationPreference ? 1 : 0
    const bRegion = profile.locationPreference !== 'any' && b.school.region === profile.locationPreference ? 1 : 0
    if (aRegion !== bRegion) return bRegion - aRegion
    return b.athletic - a.athletic
  }

  const byBucket = (b: Bucket) =>
    scored.filter((c) => c.bucket === b).sort(bucketCompare)

  const safety = byBucket('safety')
  const target = byBucket('target')
  const reach  = byBucket('reach')

  // Scale caps to the requested topN. For topN=25 this gives 8/10/7.
  const totalCap = topN
  const scale = totalCap / 26  // 8+10+8 in defaults
  const safetyCap = Math.round(DEFAULT_BUCKET_CAPS.safety * scale)
  const targetCap = Math.round(DEFAULT_BUCKET_CAPS.target * scale)
  const reachCap  = totalCap - safetyCap - targetCap

  const finalSafety = safety.slice(0, safetyCap)
  const finalTarget = target.slice(0, targetCap)
  const finalReach  = reach.slice(0, reachCap)

  // Output order: reach → target → safety. Reaches go first because they're
  // aspirational and the most useful to surface upfront. Targets are the
  // working list. Safeties are reassurance at the bottom.
  const ordered = [...finalReach, ...finalTarget, ...finalSafety]

  return ordered.map((c) => {
    const academic = getAcademic(c.school.id)
    return {
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
      athleticFit: c.athletic,
      academicFit: c.academic,
      reasons: buildReasons(profile, c.school, c.athletic, c.academic, c.bucket, academic),
      notes: c.school.notes ?? '',
      programStrength: c.school.programStrength,
      scholarships: c.school.scholarships,
      gpaAvg: c.school.gpaAvg,
      goalsForwardAvg: c.school.goalsForwardAvg,
      goalsMidAvg: c.school.goalsMidAvg,
      breakdown: buildBreakdown(profile, c.school, c.athletic, c.academic),
      // Scorecard fields when available (else undefined; UI guards on truthy).
      satMid:             academic?.satMid,
      sat25:              academic?.sat25,
      sat75:              academic?.sat75,
      admissionRate:      academic?.admissionRate,
      costOfAttendance:   academic?.costOfAttendance,
      tuitionInState:     academic?.tuitionInState,
      tuitionOutOfState:  academic?.tuitionOutOfState,
      pellGrantRate:      academic?.pellGrantRate,
      graduationRate:     academic?.graduationRate,
    }
  })
}

function buildBreakdown(
  profile: AthleteProfile,
  school: SchoolRecord,
  athletic: number,
  academic: number,
): MatchBreakdown {
  const gk = isGoalkeeper(profile.position)
  const fwd = isForward(profile.position)

  // Some schools.json entries are partial (e.g., bethel-university-tn). Treat
  // missing numerics as 0 here so the verdict logic doesn't crash on toFixed().
  const gpaAvg = school.gpaAvg ?? 0
  const gpaMin = school.gpaMin ?? 0

  // GPA axis.
  const gpaScore = gpaAvg > 0
    ? Math.max(0, Math.min(100, Math.round((profile.gpa / gpaAvg) * 100)))
    : 50
  const gpaVerdict = gpaAvg === 0
    ? 'No academic benchmark on file for this program.'
    : profile.gpa >= gpaAvg
      ? `You're above the typical recruit's ${gpaAvg.toFixed(1)} GPA.`
      : profile.gpa >= gpaMin
        ? `Your GPA clears the floor (${gpaMin.toFixed(1)}) but is below the typical ${gpaAvg.toFixed(1)}.`
        : `Below this program's typical academic profile (avg ${gpaAvg.toFixed(1)}, min ~${gpaMin.toFixed(1)}).`

  // Stats axis (skip for goalkeepers).
  let stats: MatchBreakdown['stats'] = null
  if (!gk) {
    const expected = (fwd ? school.goalsForwardAvg : school.goalsMidAvg) ?? 0
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
  const schoolRegion = school.region ?? 'unknown'
  const regionScore = pref === 'any' ? 75 : schoolRegion === pref ? 100 : 30
  const regionVerdict = pref === 'any'
    ? 'No region preference set.'
    : schoolRegion === pref
      ? `Located in your preferred ${pref} region.`
      : `Outside your preferred ${pref} region (this school is ${schoolRegion}).`

  // Size axis.
  const sizePref = profile.sizePreference || 'any'
  const schoolSize = school.size ?? 'medium'
  const sizeScore = sizePref === 'any' ? 75 : schoolSize === sizePref ? 100 : 40
  const sizeVerdict = sizePref === 'any'
    ? 'No size preference set.'
    : schoolSize === sizePref
      ? `Matches your ${sizePref}-school preference.`
      : `${schoolSize} school — you preferred ${sizePref}.`

  return {
    athleticFit: athletic,
    academicFit: academic,
    gpa: { score: gpaScore, yourValue: profile.gpa, typicalValue: gpaAvg, verdict: gpaVerdict },
    stats,
    division: { score: divScore, yourTarget: profile.targetDivision, schoolDivision: school.division, verdict: divVerdict },
    region: { score: regionScore, yourPref: pref, schoolRegion, verdict: regionVerdict },
    size: { score: sizeScore, yourPref: sizePref, schoolSize, verdict: sizeVerdict },
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
