import fs from 'fs'
import path from 'path'
import schoolsData from '../data/schools.json'
import type { AthleteProfile, MatchBreakdown, School, SchoolDirectoryEntry, VideoRating } from '../../client/src/types/index'
import type { ProgramRecord, RecruitingClass } from '../../client/src/types/athletic'

const round1 = (n: number): number => Math.round(n * 10) / 10

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

// ── Academic tier (1 = most selective … 5 = open admission) ───────────────
// Composite of admission rate, SAT 75th percentile, and graduation rate. We
// don't have a US News dataset, so we approximate "ranking-like" tier from
// the Scorecard signals we do have. Tiers are stable: a 1540 / 4.0 athlete
// who insists on "top 50" can hard-filter SUNY Cortland (T5) without cutting
// out flagship state schools (T2/T3).
//
// Roughly:
//   T1 — Most selective:  Ivies, Stanford, MIT, Duke, top liberal arts
//   T2 — Highly selective: T50 flagship publics, well-known privates
//   T3 — Selective:        decent state schools, mid-tier privates
//   T4 — Moderately selective
//   T5 — Open admission / unknown
export type AcademicTier = 1 | 2 | 3 | 4 | 5

export function academicTier(schoolId: string): AcademicTier {
  const acad = getAcademic(schoolId)
  if (!acad) return 5

  // Weighted composite — admission rate is the strongest single signal so
  // it gets the largest weight. We only count dimensions that are populated
  // (Scorecard gaps are real for some smaller schools).
  let score = 0
  let weights = 0

  if (acad.admissionRate != null) {
    // 5% → 100, 25% → 75, 50% → 50, 75% → 25
    const s = Math.max(0, 100 - acad.admissionRate * 200)
    score += s * 0.55
    weights += 0.55
  }
  const sat = acad.sat75 ?? acad.satMid
  if (sat != null) {
    // 1550+ → 100, 1300 → 50, 1050 → 0
    const s = Math.max(0, Math.min(100, (sat - 1050) / 5))
    score += s * 0.30
    weights += 0.30
  }
  if (acad.graduationRate != null) {
    // 95% → 100, 70% → 50, 45% → 0
    const s = Math.max(0, Math.min(100, (acad.graduationRate * 100 - 45) * 2))
    score += s * 0.15
    weights += 0.15
  }

  if (weights === 0) return 5
  const norm = score / weights

  if (norm >= 80) return 1
  if (norm >= 65) return 2
  if (norm >= 50) return 3
  if (norm >= 30) return 4
  return 5
}

// ── Coach data (used here only for "does this school field a program of
// the requested gender?" — full coach lookup happens in the routes layer).
// We treat status === 'no-program' as the canonical "this school doesn't
// have a men's/women's team" signal. Missing entries are treated as
// "unknown" and pass through (the scraper just hasn't reached the school).

interface ScrapedCoachLite { status: string }

let coachStatusCache: Record<string, ScrapedCoachLite> | null = null
function getCoachStatus(schoolId: string, gender: 'mens' | 'womens'): string | null {
  if (coachStatusCache === null) {
    try {
      const p = path.join(__dirname, '..', 'data', 'coachesScraped.json')
      const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, ScrapedCoachLite>
      coachStatusCache = {}
      for (const [k, v] of Object.entries(raw)) {
        if (k.startsWith('_')) continue
        coachStatusCache[k] = { status: v.status }
      }
    } catch {
      coachStatusCache = {}
    }
  }
  const entry = coachStatusCache[`${schoolId}:${gender}`]
  return entry?.status ?? null
}

function hasProgramOfGender(schoolId: string, gender: 'mens' | 'womens'): boolean {
  return getCoachStatus(schoolId, gender) !== 'no-program'
}

// ── Roster data (open spots) ──────────────────────────────────────────────
// Sources from server/data/rostersScraped.json (built by scrapeRosters.ts).
// Used to estimate how many spots open up at the athlete's position
// over the next 1–2 graduating classes.

interface RosterPlayer {
  name: string
  position: 'GK' | 'D' | 'M' | 'F' | 'U'
  classYear: string  // 'Fr' | 'So' | 'Jr' | 'Sr' | 'Gr' | '2027' | ''
}

interface RosterRecord {
  players: RosterPlayer[]
  status: 'success' | 'failed' | 'no-program'
}

let rosterCache: Record<string, RosterRecord> | null = null
function getRoster(schoolId: string, gender: 'mens' | 'womens'): RosterRecord | undefined {
  if (rosterCache === null) {
    try {
      const p = path.join(__dirname, '..', 'data', 'rostersScraped.json')
      rosterCache = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, RosterRecord>
    } catch {
      rosterCache = {}
    }
  }
  return rosterCache[`${schoolId}:${gender}`]
}

// ── Program record (W-L-T history) ────────────────────────────────────────
let programRecordCache: Record<string, ProgramRecord> | null = null
function getProgramRecord(schoolId: string, gender: 'mens' | 'womens'): ProgramRecord | undefined {
  if (programRecordCache === null) {
    try {
      const p = path.join(__dirname, '..', 'data', 'programRecords.json')
      programRecordCache = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, ProgramRecord>
    } catch {
      programRecordCache = {}
    }
  }
  return programRecordCache[`${schoolId}:${gender}`]
}

// ── Recruiting class composition ──────────────────────────────────────────
let recruitingClassCache: Record<string, RecruitingClass> | null = null
function getRecruitingClass(schoolId: string, gender: 'mens' | 'womens'): RecruitingClass | undefined {
  if (recruitingClassCache === null) {
    try {
      const p = path.join(__dirname, '..', 'data', 'recruitingClasses.json')
      recruitingClassCache = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, RecruitingClass>
    } catch {
      recruitingClassCache = {}
    }
  }
  return recruitingClassCache[`${schoolId}:${gender}`]
}

// Map athlete profile.position string → roster position bucket.
function profilePositionBucket(position: string): 'GK' | 'D' | 'M' | 'F' | null {
  const p = position.toLowerCase()
  if (p.includes('goal') || p === 'gk' || p === 'keeper') return 'GK'
  if (p.includes('back') || p === 'cb' || p === 'lb' || p === 'rb' || p === 'fb') return 'D'
  if (p.includes('mid') || p === 'cm' || p === 'cdm' || p === 'cam' || p === 'dm' || p === 'am') return 'M'
  if (p.includes('forward') || p.includes('striker') || p.includes('wing')
      || p === 'cf' || p === 'lw' || p === 'rw' || p === 'st') return 'F'
  return null
}

// Roster signal for the athlete at this school: how many at her position
// graduate by her grad year, and how many compete with her.
interface RosterSignal {
  totalAtPosition:    number    // current roster count at athlete's position
  graduatingByYear:   number    // seniors + grads currently — gone before athlete arrives
  juniorsAtPosition:  number    // juniors currently — gone the year after athlete arrives
  openSpots:          number    // estimated openings = graduating + juniors (next 2 yrs)
  totalRoster:        number    // total players for context
}

function computeRosterSignal(profile: AthleteProfile, schoolId: string): RosterSignal | null {
  const r = getRoster(schoolId, profile.gender ?? 'womens')
  if (!r || r.status !== 'success' || !r.players?.length) return null
  const bucket = profilePositionBucket(profile.position)
  if (!bucket) return null

  const atPos = r.players.filter((p) => p.position === bucket)
  const isSenior = (yr: string) => yr === 'Sr' || yr === 'Gr'
  const isJunior = (yr: string) => yr === 'Jr'

  const graduating = atPos.filter((p) => isSenior(p.classYear)).length
  const juniors = atPos.filter((p) => isJunior(p.classYear)).length

  return {
    totalAtPosition:   atPos.length,
    graduatingByYear:  graduating,
    juniorsAtPosition: juniors,
    openSpots:         graduating + juniors,  // simple proxy for next 2 yrs
    totalRoster:       r.players.length,
  }
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

// ── Multi-target helpers ──────────────────────────────────────────────────
// An athlete can target multiple divisions (e.g. "D1 or D3, nothing else").
// The matcher must treat every targeted division as on-target — no penalty
// for being "below" or "above" within the target set. These helpers replace
// scattered `divIdx(profile.targetDivision)` calls so single-target and
// multi-target athletes flow through the same code path.

function getTargets(profile: AthleteProfile): Division[] {
  const list = profile.targetDivisions?.length ? profile.targetDivisions : [profile.targetDivision]
  // Defensive: ensure targetDivision is always represented even if
  // targetDivisions was set without it (UI bug guard).
  if (!list.includes(profile.targetDivision)) list.push(profile.targetDivision)
  return list
}

// Signed distance from school's division to the *nearest* target. 0 means
// the school is in the target set. Negative = above (harder); positive =
// below (easier). Used everywhere the matcher previously did
// `divIdx(school) − divIdx(profile.targetDivision)`.
function effectiveDivGap(schoolDiv: Division, profile: AthleteProfile): number {
  const targets = getTargets(profile)
  if (targets.includes(schoolDiv)) return 0
  const sIdx = divIdx(schoolDiv)
  return targets
    .map((t) => sIdx - divIdx(t))
    .reduce((best, gap) => (Math.abs(gap) < Math.abs(best) ? gap : best))
}

// Highest target = smallest divIdx (D1 < D2 < D3 < NAIA < JUCO).
function topTargetIdx(profile: AthleteProfile): number {
  return Math.min(...getTargets(profile).map(divIdx))
}

// Lowest target = largest divIdx. Used to gate "deep below" safeties so
// a multi-target {D1, D3} athlete's deep-safety threshold is anchored to
// D3 (idx 2), not D1 (idx 0).
function bottomTargetIdx(profile: AthleteProfile): number {
  return Math.max(...getTargets(profile).map(divIdx))
}

// Human-readable target label for reasons / verdicts. Single target reads
// the same as before ("D3"); multi-target reads "D1/D3" so the athlete
// understands the matcher knows about her full target set.
function targetLabel(profile: AthleteProfile): string {
  const targets = getTargets(profile)
  if (targets.length === 1) return targets[0]
  // Order by division strength so output is consistent: "D1/D3", not "D3/D1".
  return [...targets].sort((a, b) => divIdx(a) - divIdx(b)).join('/')
}

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

  // Athlete GPA delta from typical admit. Asymmetric scaling: above-typical
  // saturates (diminishing returns), below-typical drops linearly. Without
  // saturation, a 3.7 GPA pegs at 100 against every 3.0-avg school in the
  // dataset — useless differentiation when schools.json gpaAvg is coarse.
  //
  //  Above typical (delta >= 0): score = 70 + 25 * (1 − exp(−3·delta))
  //    delta 0     → 70  (matches typical recruit)
  //    delta +0.2  → 81
  //    delta +0.4  → 87
  //    delta +0.6  → 91
  //    delta +1.0  → 94  (asymptote ≈ 95)
  //
  //  Below typical (delta < 0): linear − a real admissions risk grows fast.
  //    delta −0.2  → 55
  //    delta −0.4  → 40
  //    delta −0.7  → 18  (reach)
  const delta = profile.gpa - gpaAvg
  let score = delta >= 0
    ? 70 + 25 * (1 - Math.exp(-3 * delta))
    : 70 + delta * 75

  // Hard floor penalty: if athlete is below the school's published min, this
  // is a real admissions risk on top of being below average.
  if (gpaMin > 0 && profile.gpa < gpaMin) {
    score -= 15
  }

  // Scorecard selectivity refinement. When real admission data is available,
  // adjust for schools whose schools.json gpaAvg understates difficulty:
  //   • Stanford has gpaAvg 3.9 BUT acceptance ~4% → reach even at gpa 3.9
  //   • Wingate has gpaAvg 3.0 AND acceptance ~91% → strong fit at gpa 3.0
  // This pulls truly selective schools downward and modestly boosts open-
  // admission schools — but the boost is small (max +4) so an over-qualified
  // applicant doesn't peg at 100 just because the school is easy to get into.
  const academic = getAcademic(school.id)
  if (academic?.admissionRate != null) {
    const admPct = academic.admissionRate * 100
    if (admPct < 10) score -= 12       // ivy / equivalent
    else if (admPct < 20) score -= 8   // very selective
    else if (admPct < 35) score -= 4   // selective
    else if (admPct >= 80) score += 4  // open admission
    else if (admPct >= 65) score += 2
  }

  return Math.max(0, Math.min(100, round1(score)))
}

// Tape-derived skill from the highlight video. Avg of the 4 quality dimensions
// — division fit is intentionally excluded here because we use it separately
// against the school's specific division.
function tapeSkill(v: VideoRating): number {
  return (v.technicalScore + v.tacticalScore + v.composureScore + v.positionPlayScore) / 4
}

function athleticFit(profile: AthleteProfile, school: SchoolRecord, video?: VideoRating | null): number {
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

  // Division gap. We cap the *positive* side at +1 so schools 2+ levels
  // below the athlete's target don't all get the same maxed-out bonus —
  // otherwise a D1-targeting athlete sees JUCOs flood her safety bucket
  // at matchScore=100. The negative side (school plays above target) keeps
  // the −2 cap so a true reach is appropriately discouraged. effectiveDivGap
  // returns 0 for any division in the athlete's target set, so multi-target
  // athletes ({D1, D3}) get unpenalized scoring at both levels.
  const rawDivGap = effectiveDivGap(school.division, profile)
  const divGap = Math.max(-2, Math.min(1, rawDivGap))

  // Program prestige delta. School at strength 10 vs neutral 5 = +5 →
  // pulls athleticFit down (this is a tougher program).
  const programGap = (school.programStrength ?? 5) - 5

  // Base composition. Tuned so:
  //   exact-fit, neutral program (statsDelta=0, divGap=0, programGap=0) → 60
  //   over-qualified safety (statsDelta=+1, divGap=+1, programGap=-2)   → 60+15+15+10 = 100
  //   classic reach (statsDelta=-1, divGap=-1, programGap=+4)           → 60-15-15-20 = 10
  let score = 60 + statsDelta * 15 + divGap * 15 - programGap * 5

  // ── Highlight video signal (optional) ────────────────────────────────
  // Replaces the "every 7.0 mid plays the same level" assumption with what
  // the tape actually shows. Two distinct adjustments:
  //
  //  1) tape-vs-program-expectation: a school with programStrength 10 expects
  //     a tape ~9.0 player; strength 5 expects ~7.0; strength 0 expects ~5.0.
  //     A 9.0 player at a 5-strength school is well above the bar (+);
  //     a 5.0 player at a 10-strength school is well below (−).
  //     Multiplier ≈ 6 gives meaningful differentiation without dominating.
  //
  //  2) division-fit-vs-school-division: the AI's `divisionFitScore` is the
  //     player's calibrated level vs. their *target* division. We project
  //     that read onto each school's actual division — same division uses
  //     the score directly; one division easier than target reads up by 1;
  //     one division harder reads down by 1. Multiplier ≈ 3.
  if (video) {
    const tape = tapeSkill(video)
    const programExpectation = 5 + (school.programStrength ?? 5) * 0.4  // 5..9
    const tapeVsProgram = tape - programExpectation                      // ~ −4..+4
    score += tapeVsProgram * 6

    const divDelta = effectiveDivGap(school.division, profile)
    // Easier division → effectively higher fit; harder → lower.
    const projectedDivFit = video.divisionFitScore + Math.max(-2, Math.min(2, divDelta))
    const projectedVsBaseline = projectedDivFit - 7                       // 7 = "fits target"
    score += projectedVsBaseline * 3
  }

  return Math.max(0, Math.min(100, round1(score)))
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
  roster: RosterSignal | undefined,
  video?: VideoRating | null,
  isStretchReach = false,
): string[] {
  const reasons: string[] = []
  const gk  = isGoalkeeper(profile.position)
  const fwd = isForward(profile.position)
  const positionLabel = gk ? 'keepers' : fwd ? 'forwards' : 'midfielders'

  // ── Top-line fit summary (always first) ──────────────────────────────
  // We build the headline from the actual gaps in the data, not generic
  // language. Athletes asked us repeatedly what "athletic stretch" means —
  // now the answer is specific: division gap, program prestige, GPA delta,
  // selectivity, or position-specific stat gaps.
  const divGap = effectiveDivGap(school.division, profile)
  const gpaAvg = school.gpaAvg ?? 0
  const gpaDelta = gpaAvg > 0 ? profile.gpa - gpaAvg : 0
  const programStrength = school.programStrength ?? 5
  const expectedGoals = (fwd ? school.goalsForwardAvg : school.goalsMidAvg) ?? 0
  const goalsDelta = !gk && profile.goals > 0 && expectedGoals > 0 ? profile.goals - expectedGoals : 0
  const admPct = acad?.admissionRate != null ? acad.admissionRate * 100 : null

  // Specific gap descriptors — used to assemble human-readable reasons.
  // Each describes ONE concrete reason this school is a stretch.
  function athleticGaps(): string[] {
    const gaps: string[] = []
    if (divGap < 0) {
      const levels = Math.abs(divGap)
      const levelWord = levels === 1 ? 'one level' : levels === 2 ? 'two levels' : `${levels} levels`
      gaps.push(`they play ${school.division} (you target ${targetLabel(profile)}) — ${levelWord} above`)
    }
    if (programStrength >= 8 && athletic <= 50) {
      gaps.push(`top-tier program (${programStrength}/10 strength)`)
    }
    if (goalsDelta <= -5 && expectedGoals > 0) {
      gaps.push(`typical ${positionLabel} score ${expectedGoals} (you have ${profile.goals})`)
    }
    if (video) {
      const tape = tapeSkill(video)
      const expectation = 5 + (school.programStrength ?? 5) * 0.4
      if (tape - expectation <= -1.5) {
        gaps.push(`tape grades ${tape.toFixed(1)}/10 vs typical ${expectation.toFixed(1)} for this level`)
      }
    }
    return gaps
  }
  function academicGaps(): string[] {
    const gaps: string[] = []
    if (gpaDelta <= -0.4 && gpaAvg > 0) {
      gaps.push(`your ${profile.gpa.toFixed(2)} GPA vs typical ${gpaAvg.toFixed(1)}`)
    }
    if (admPct != null && admPct < 15) {
      gaps.push(`only ${Math.round(admPct)}% of applicants admitted`)
    } else if (admPct != null && admPct < 30 && academic <= 60) {
      gaps.push(`selective admit (${Math.round(admPct)}% acceptance rate)`)
    }
    return gaps
  }

  if (bucket === 'safety') {
    reasons.push(athletic >= 90 && academic >= 90
      ? 'You\'re a top recruit on paper — comfortable fit on both axes.'
      : 'Both your athletic and academic profile clear this program\'s typical recruit.')
  } else if (bucket === 'target') {
    if (athletic >= 70 && academic <= 60) {
      const gaps = academicGaps().slice(0, 1)
      reasons.push(gaps.length
        ? `Athletically a strong fit — academics will be the stretch (${gaps[0]}).`
        : 'Athletically a strong fit; academics will be the stretch.')
    } else if (academic >= 70 && athletic <= 60) {
      const gaps = athleticGaps().slice(0, 1)
      reasons.push(gaps.length
        ? `Academic fit is strong — you'll need to compete athletically (${gaps[0]}).`
        : 'Academic fit is strong; you\'ll need to compete athletically to play.')
    } else {
      reasons.push('You\'re in the conversation on both axes — a real target school.')
    }
  } else {
    // Reach bucket. Pull up to two specific gaps so the user understands
    // *what exactly* makes this a stretch, not just that it is one.
    const aGaps = athletic <= 50 ? athleticGaps() : []
    const acGaps = academic <= 50 ? academicGaps() : []
    if (athletic <= 35 && academic <= 35) {
      const all = [...aGaps, ...acGaps].slice(0, 2)
      reasons.push(all.length
        ? `A genuine reach on both sides — ${all.join('; ')}.`
        : 'A genuine reach — aspirational on both sides.')
    } else if (athletic <= 40 && aGaps.length) {
      reasons.push(`Athletic stretch — ${aGaps.slice(0, 2).join('; ')}.`)
    } else if (academic <= 40 && acGaps.length) {
      reasons.push(`Academic stretch — ${acGaps.slice(0, 2).join('; ')}.`)
    } else if (athletic <= 40) {
      reasons.push('Their program plays a level above your current profile — athletic stretch.')
    } else if (academic <= 40) {
      reasons.push('Their typical recruit is above your current academic profile — push the GPA/SAT.')
    } else {
      const all = [...aGaps, ...acGaps].slice(0, 2)
      reasons.push(all.length
        ? `Stretch fit — ${all.join('; ')}.`
        : 'Stretch fit — worth applying if it\'s a dream school.')
    }
  }

  // ── Roster / open spots (live-scraped) ──────────────────────────────
  // Surface this RIGHT AFTER the top-line summary because "open spots at
  // my position" is the user's #1 stated factor and the most actionable
  // signal we have. Drops to bottom if no roster data on file.
  if (roster) {
    const positionLabel = isGoalkeeper(profile.position) ? 'keepers'
                       : isForward(profile.position) ? 'forwards'
                       : 'midfielders'
    const positionSing = positionLabel.replace(/s$/, '')
    if (roster.openSpots >= 3) {
      reasons.push(`${roster.graduatingByYear} graduating + ${roster.juniorsAtPosition} juniors at your position — ~${roster.openSpots} spots opening up.`)
    } else if (roster.totalAtPosition >= 7) {
      reasons.push(`Stocked at your position (${roster.totalAtPosition} ${positionLabel}) — competitive for playing time.`)
    } else if (roster.graduatingByYear >= 1) {
      reasons.push(`${roster.graduatingByYear} ${pluralize(roster.graduatingByYear, positionSing)} graduating from this program.`)
    } else if (roster.totalAtPosition >= 1) {
      reasons.push(`Currently ${roster.totalAtPosition} ${pluralize(roster.totalAtPosition, positionSing)} on roster.`)
    }
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

  // ── Highlight tape signal (when the athlete has rated their video) ──
  if (video) {
    const tape = tapeSkill(video)
    const expectation = 5 + (school.programStrength ?? 5) * 0.4
    const delta = tape - expectation
    if (delta >= 1.2) {
      reasons.push(`Tape grades ${tape.toFixed(1)}/10 — above this program's typical recruit profile.`)
    } else if (delta <= -1.2) {
      reasons.push(`Tape grades ${tape.toFixed(1)}/10 — below this program's typical recruit; close the gap with a stronger highlight.`)
    }
    if (getTargets(profile).includes(school.division) && video.divisionFitScore <= 5.5) {
      reasons.push(`Video AI rates your ${school.division} fit at ${video.divisionFitScore.toFixed(1)}/10 — consider also targeting one level down.`)
    } else if (getTargets(profile).includes(school.division) && video.divisionFitScore >= 8.5) {
      reasons.push(`Video AI rates your ${school.division} fit at ${video.divisionFitScore.toFixed(1)}/10 — clearly playing at this level.`)
    }
  }

  // ── Geography preference ────────────────────────────────────────────
  if (profile.locationPreference && profile.locationPreference !== 'any'
      && school.region === profile.locationPreference) {
    reasons.push(`In your preferred ${profile.locationPreference} region.`)
  }

  // Stretch reaches get a dedicated lead reason so the athlete understands
  // *why* a higher-division school is on her board even when she targets a
  // lower division. Replaces the generic top-line summary built above.
  if (isStretchReach) {
    const levels = Math.abs(effectiveDivGap(school.division, profile))
    const levelPhrase = levels === 1 ? 'one level above' : `${levels} levels above`
    reasons[0] = `Aspirational reach — ${school.division} program, ${levelPhrase} your ${targetLabel(profile)} target. Worth the swing if it's a dream school.`
  }

  // Cap at 5 reasons total. The first is always the top-line summary.
  return reasons.slice(0, 5)
}

// ── Recruitable Shot % — the headline differentiator ────────────────────
//
// matchScore answers "is this a good fit?" — it's a weighted blend of axes.
// recruitableShot answers "what are your odds of actually being recruited
// here?" Distinct, more honest, and the single number a teen + parent
// most want to know. Probabilistic (0–100) — calibrated so:
//   • A clean safety (both fits 90+, open spots, no division gap)         → 80–95
//   • A solid target (both fits 60–75, some opens, neutral program)       → 45–60
//   • A reach with no open spots and a tough program                      → 8–20
// Never returns 0 or 100 — always leaves room for the human factor.
function recruitableShot(
  athletic: number,
  academic: number,
  divisionGap: number,            // school.div - athlete.targetDiv (-2..+2)
  programGap: number,             // school.programStrength - 5 (-5..+5)
  roster: RosterSignal | null,
): number {
  // Base from the two fit axes — the dominant signal.
  let p = (athletic * 0.55 + academic * 0.45)

  // Roster need adjustment. Open spots at the athlete's position is the
  // single most actionable real-world signal, so weight it strongly.
  if (roster) {
    if (roster.openSpots >= 4) p += 8         // big opening — coaches actively recruiting position
    else if (roster.openSpots >= 2) p += 4
    else if (roster.openSpots === 1) p += 1
    else if (roster.totalAtPosition >= 8) p -= 6  // logjam at position
    else if (roster.totalAtPosition >= 6) p -= 3
  }

  // Division gap penalty — moving up a level is exponentially harder.
  if (divisionGap < 0) p -= Math.abs(divisionGap) * 6   // school plays above target
  else if (divisionGap > 0) p += Math.min(divisionGap * 2, 4)  // school below target = easier

  // Program prestige — strength 10 (Stanford-tier) penalizes harder than
  // strength 8 (mid-major). Strength <5 boosts.
  if (programGap > 0) p -= programGap * 2.5
  else if (programGap < 0) p += Math.abs(programGap) * 1.5

  // Clamp to 5–95 — never declare certain success or failure.
  return Math.max(5, Math.min(95, round1(p)))
}

// Confidence reflects how much underlying data we have. Drives whether the UI
// shows the recruitable-shot number with full confidence or hedges it.
function dataConfidence(
  school: SchoolRecord,
  acad: AcademicRecord | undefined,
  roster: RosterSignal | null,
): 'high' | 'medium' | 'low' {
  let signals = 0
  if ((school.gpaAvg ?? 0) > 0) signals++
  if ((school.goalsForwardAvg ?? 0) > 0 || (school.goalsMidAvg ?? 0) > 0) signals++
  if (acad?.admissionRate != null) signals++
  if (acad?.satMid != null && acad.satMid > 0) signals++
  if (acad?.costOfAttendance != null) signals++
  if (roster) signals++
  if (signals >= 5) return 'high'
  if (signals >= 3) return 'medium'
  return 'low'
}

// Extract two-letter state code from school.location ("Stanford, CA").
function extractState(location: string): string | undefined {
  const m = location.match(/,\s*([A-Z]{2})\s*$/)
  return m ? m[1] : undefined
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
  // True when this school was force-injected as an aspirational cross-division
  // reach (a school that plays at a higher division than the athlete's target).
  // The matcher always includes 1–2 of these for athletes who are succeeding
  // at their target level — so a strong D3 player still sees a D1/D2 dream
  // school instead of a wall of same-division reaches.
  isStretchReach?: boolean
}

// Per-bucket caps when the user requests the default 25-school result. Sum
// must be <= topN; remaining budget is distributed proportionally if any
// bucket is short.
const DEFAULT_BUCKET_CAPS = { safety: 8, target: 10, reach: 8 } as const

// Score a single school against the athlete's profile, ignoring bucket caps,
// stretch logic, the academic floor, and the excluded-divisions filter. Used
// by the search-a-school feature so users can ask "what's my score for X?"
// for any school in the dataset, even ones the matcher would normally hide.
// Returns null when the schoolId isn't in schools.json.
export function scoreSingleSchool(
  profile: AthleteProfile,
  schoolId: string,
  video?: VideoRating | null,
): School | null {
  const gender = profile.gender ?? 'womens'
  const school = (schoolsData as SchoolRecord[]).find((s) => s.id === schoolId)
  if (!school) return null

  const athletic = athleticFit(profile, school, video ?? null)
  const academic = academicFit(profile, school)
  // bucketFor returns null when the school is genuinely a non-fit. For
  // search we still want to return a result — fall back to 'reach' so the
  // UI can render the card. The matchScore makes the actual fit obvious.
  const bucket = bucketFor(athletic, academic) ?? 'reach'

  let blended = athletic * 0.55 + academic * 0.45
  const rawDivGapForScore = effectiveDivGap(school.division, profile)
  if (rawDivGapForScore === 2) blended -= 8
  else if (rawDivGapForScore === 3) blended -= 16
  else if (rawDivGapForScore >= 4) blended -= 22
  const matchScore = Math.max(0, Math.min(100, round1(blended + preferenceBoost(profile, school))))

  const academicData = getAcademic(school.id)
  const rosterSignal = computeRosterSignal(profile, school.id) ?? undefined
  const rawDivGap = divIdx(school.division) - divIdx(profile.targetDivision)
  const programGap = (school.programStrength ?? 5) - 5
  const shot = recruitableShot(athletic, academic, Math.max(-2, Math.min(2, rawDivGap)), programGap, rosterSignal ?? null)

  return {
    id: school.id,
    name: school.name,
    division: school.division,
    location: school.location,
    region: school.region,
    size: school.size,
    enrollment: school.enrollment,
    conference: school.conference,
    coachName: gender === 'womens' ? school.womensCoach : school.mensCoach,
    coachEmail: gender === 'womens' ? school.womensCoachEmail : school.mensCoachEmail,
    category: bucket,
    matchScore,
    athleticFit: athletic,
    academicFit: academic,
    reasons: buildReasons(profile, school, athletic, academic, bucket, academicData, rosterSignal, video, false),
    notes: school.notes ?? '',
    programStrength: school.programStrength,
    scholarships: school.scholarships,
    gpaAvg: school.gpaAvg,
    goalsForwardAvg: school.goalsForwardAvg,
    goalsMidAvg: school.goalsMidAvg,
    breakdown: buildBreakdown(profile, school, athletic, academic),
    satMid:             academicData?.satMid,
    sat25:              academicData?.sat25,
    sat75:              academicData?.sat75,
    admissionRate:      academicData?.admissionRate,
    costOfAttendance:   academicData?.costOfAttendance,
    tuitionInState:     academicData?.tuitionInState,
    tuitionOutOfState:  academicData?.tuitionOutOfState,
    pellGrantRate:      academicData?.pellGrantRate,
    graduationRate:     academicData?.graduationRate,
    academicTier:       academicTier(school.id),
    rosterSignal,
    recruitableShot:    shot,
    dataConfidence:     dataConfidence(school, academicData, rosterSignal ?? null),
    state:              extractState(school.location),
    record:             getProgramRecord(school.id, gender) ?? null,
    recruitingClass:    getRecruitingClass(school.id, gender) ?? null,
  }
}

export function matchSchools(profile: AthleteProfile, topN = 25, video?: VideoRating | null): School[] {
  const gender = profile.gender ?? 'womens'
  // Hard exclusions — divisions the athlete has explicitly opted out of.
  // Any division in the target set is never excludable (defensive guard
  // against bad client state). Applied before scoring so excluded schools
  // never enter the candidate pool, the bucket caps, or the deep-safety
  // logic. For multi-target athletes, every targeted division is protected.
  const targetSetForExclusion = new Set(getTargets(profile))
  const excluded = new Set(
    (profile.excludedDivisions ?? []).filter((d) => !targetSetForExclusion.has(d)),
  )

  // Academic minimum tier (1 = T25-ish, 5 = no preference). Hardish filter:
  // schools whose tier is *strictly worse* than the floor are dropped from
  // the candidate pool entirely so the athlete doesn't have to scroll past
  // open-admission schools when she's pre-committed to T50.
  const academicFloor: AcademicTier | null = profile.academicMinimum ?? null

  const scored: Candidate[] = (schoolsData as SchoolRecord[])
    .filter((s) => !excluded.has(s.division))
    .filter((s) => hasProgramOfGender(s.id, gender))
    .filter((s) => {
      if (!academicFloor || academicFloor >= 5) return true
      return academicTier(s.id) <= academicFloor
    })
    .map((s) => {
      const athletic = athleticFit(profile, s, video)
      const academic = academicFit(profile, s)
      const bucket = bucketFor(athletic, academic)
      if (!bucket) return null

      // Display matchScore = weighted blend (athletics-leaning since this is a
      // recruiting tool) + soft preference boost. Bucket assignment already
      // happened above; this is just for ranking + UI display. One decimal
      // place so the score actually varies across the list — without
      // decimals every athlete sees a wall of 90 / 91 / 92s.
      let blended = athletic * 0.55 + academic * 0.45
      // Honesty penalty for "deep below" target. A D1-target athlete should
      // never see a JUCO score 100 — even if she'd dominate athletically,
      // it isn't a "match" to her stated goals. Graded so:
      //   • +2 levels below (e.g., D1 → D3): -8
      //   • +3 levels below (e.g., D1 → NAIA, D2 → JUCO): -16
      //   • +4 levels below (D1 → JUCO): -22
      // effectiveDivGap returns 0 for divisions in the target set, so a
      // multi-target {D1, D3} athlete won't see the D3 schools penalized.
      const rawDivGapForScore = effectiveDivGap(s.division, profile)
      if (rawDivGapForScore === 2) blended -= 8
      else if (rawDivGapForScore === 3) blended -= 16
      else if (rawDivGapForScore >= 4) blended -= 22
      const matchScore = Math.max(0, Math.min(100, round1(blended + preferenceBoost(profile, s))))
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

  // Sort each bucket. Primary order is "closeness to target division" so a
  // D1-target athlete's safety bucket leads with D2 schools, not JUCOs.
  // Within the same closeness, sort by matchScore desc, then break further
  // ties on programStrength → region match → athletic fit.
  // For multi-target athletes ({D1, D3}), every targeted division reads as
  // distance 0 — both feel "on target" rather than one being "the" target.
  const topIdx = topTargetIdx(profile)
  const bottomIdx = bottomTargetIdx(profile)
  function divCloseness(c: Candidate): number {
    // Lower = closer to target. We weight "below target" more leniently
    // than "above target" — a D2 prospect should rank D3 (gap=+1) above
    // D1 (gap=-1) since one is attainable and the other is genuine reach.
    const gap = effectiveDivGap(c.school.division, profile)
    if (gap === 0) return 0
    if (gap > 0) return gap            // 1, 2, 3, 4 — below target, getting "easier"
    return -gap + 0.5                  // 1.5, 2.5 — above target, harder
  }
  function bucketCompare(a: Candidate, b: Candidate): number {
    const aClose = divCloseness(a)
    const bClose = divCloseness(b)
    if (aClose !== bClose) return aClose - bClose
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

  // Cap "deep below" safeties (3+ divisions below the athlete's target) at
  // a hard maximum of 2. These are mostly bridge-year fallbacks — useful
  // but not the focus. Without this cap, a D1-targeting athlete's safety
  // bucket can fill entirely with JUCOs because they all score perfectly
  // on the athletic axis. We deliberately under-fill the safety bucket
  // rather than backfilling with more JUCOs when close-divisions are
  // sparse — a 5-school safety bucket is more honest than a 7-school one
  // padded with bridge programs the athlete didn't ask for.
  const DEEP_SAFETY_CAP = 2
  // "Deep below" is anchored to the *lowest* target division — for a
  // multi-target {D1, D3} athlete that's D3, so anything 3+ below D3
  // (NAIA/JUCO would be 1 and 2 below; nothing here is "deep") qualifies.
  const isDeepBelow = (c: Candidate) =>
    divIdx(c.school.division) - bottomIdx >= 3
  const closeSafeties = safety.filter((c) => !isDeepBelow(c))
  // Within the deep-safety pool, sort NAIA before JUCO — NAIA programs are
  // 4-year schools and a more honest "fallback" than a JUCO bridge year.
  // Athletes asked for NCAA/4-year representation in safeties before any
  // 2-year bridge options.
  const deepSafeties = safety
    .filter(isDeepBelow)
    .sort((a, b) => {
      const aJuco = a.school.division === 'JUCO' ? 1 : 0
      const bJuco = b.school.division === 'JUCO' ? 1 : 0
      if (aJuco !== bJuco) return aJuco - bJuco       // NAIA first
      return bucketCompare(a, b)                       // existing tiebreaker
    })
  const closeSlots = Math.min(closeSafeties.length, safetyCap)
  const deepSlots  = Math.min(deepSafeties.length, DEEP_SAFETY_CAP, Math.max(0, safetyCap - closeSlots))
  const finalSafety = [...closeSafeties.slice(0, closeSlots), ...deepSafeties.slice(0, deepSlots)]
  const finalTarget   = target.slice(0, targetCap)

  // ── Cross-division stretch reaches ──────────────────────────────────────
  // Athletes who are succeeding at their target level should still see at
  // least one or two schools from a higher division as aspirational dream
  // picks — without this, a strong D3-targeting player can end up with zero
  // D1/D2 schools on her board. We gate on a real "good enough" signal so
  // stretches don't get shown to athletes who'd find them discouraging:
  //   • ≥1 same-division safety  (athlete clears typical recruit on both axes), OR
  //   • ≥4 same-division targets+safeties (deep same-level fit pool).
  // Picks are forced into the reach bucket and consume reach-cap slots so
  // the total result count stays constant.
  // "Same target" = any school whose division is in the athlete's target
  // set. For multi-target {D1, D3}, both D1 and D3 schools count toward
  // the eligibility gate.
  const targetSet = new Set(getTargets(profile))
  const sameTargetCands = scored.filter((c) => targetSet.has(c.school.division))
  const sameTargetSafeties = sameTargetCands.filter((c) => c.bucket === 'safety').length
  const sameTargetSolid    = sameTargetCands.filter((c) => c.bucket === 'safety' || c.bucket === 'target').length
  // Stretches only make sense above the athlete's *highest* current target —
  // a {D1, D3} athlete's highest target is already D1, so no stretches.
  const eligibleForStretch = topIdx > 0 && (sameTargetSafeties >= 1 || sameTargetSolid >= 4)

  // Build stretch pool independently of the regular bucketFor cutoff — these
  // are aspirational picks where athletic fit is *expected* to fail the
  // normal threshold. We still need them scored so matchScore + reasons work.
  const stretchPool: Candidate[] = eligibleForStretch
    ? (schoolsData as SchoolRecord[])
        .filter((s) => !excluded.has(s.division))
        .filter((s) => hasProgramOfGender(s.id, gender))
        // Intentionally NOT filtered by academicFloor — stretch reaches are
        // aspirational by design. Letting one slightly-below-floor dream
        // school through is the "flexible" half of the academic-minimum
        // contract: hard filter for the regular list, soft for stretches.
        .filter((s) => divIdx(s.division) < topIdx)  // strictly above the highest target
        .map((s) => {
          const athletic = athleticFit(profile, s, video)
          const academic = academicFit(profile, s)
          const blended = athletic * 0.55 + academic * 0.45
          const matchScore = Math.max(0, Math.min(100, round1(blended + preferenceBoost(profile, s))))
          return {
            school: s,
            athletic,
            academic,
            matchScore,
            bucket: 'reach' as Bucket,
            coachName: gender === 'womens' ? s.womensCoach : s.mensCoach,
            coachEmail: gender === 'womens' ? s.womensCoachEmail : s.mensCoachEmail,
            isStretchReach: true,
          } as Candidate
        })
    : []

  // Pick at most one school per "above-target" division, capping at 2 total.
  // Within a division, rank by program prestige (the dream-school signal),
  // then academic fit (where the athlete *can* compete), then preferred-region
  // match. We deliberately don't rank by athletic fit — for a stretch reach
  // it's by definition low and would just push interesting schools down.
  const STRETCH_CAP = 2
  const stretches: Candidate[] = []
  for (let i = 1; i <= topIdx && stretches.length < STRETCH_CAP; i++) {
    const div = DIVISION_ORDER[topIdx - i]
    const pool = stretchPool.filter((c) => c.school.division === div)
    if (!pool.length) continue
    pool.sort((a, b) => {
      const aProg = a.school.programStrength ?? 0
      const bProg = b.school.programStrength ?? 0
      if (aProg !== bProg) return bProg - aProg
      if (a.academic !== b.academic) return b.academic - a.academic
      const aRegion = profile.locationPreference && profile.locationPreference !== 'any'
        && a.school.region === profile.locationPreference ? 1 : 0
      const bRegion = profile.locationPreference && profile.locationPreference !== 'any'
        && b.school.region === profile.locationPreference ? 1 : 0
      if (aRegion !== bRegion) return bRegion - aRegion
      return b.matchScore - a.matchScore
    })
    stretches.push(pool[0])
  }

  // Stretches consume reach-cap slots; same-div reaches fill the rest.
  // Dedupe in case a higher-div school was already in the natural reach pool.
  const stretchIds = new Set(stretches.map((c) => c.school.id))
  const remainingReachCap = Math.max(0, reachCap - stretches.length)
  const finalReach = [
    ...stretches,
    ...reach.filter((c) => !stretchIds.has(c.school.id)).slice(0, remainingReachCap),
  ]

  // Output order: reach → target → safety. Reaches go first because they're
  // aspirational and the most useful to surface upfront. Targets are the
  // working list. Safeties are reassurance at the bottom.
  const ordered = [...finalReach, ...finalTarget, ...finalSafety]

  return ordered.map((c) => {
    const academic = getAcademic(c.school.id)
    const rosterSignal = computeRosterSignal(profile, c.school.id) ?? undefined
    const rawDivGap = divIdx(c.school.division) - divIdx(profile.targetDivision)
    const programGap = (c.school.programStrength ?? 5) - 5
    const shot = recruitableShot(c.athletic, c.academic, Math.max(-2, Math.min(2, rawDivGap)), programGap, rosterSignal ?? null)
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
      reasons: buildReasons(profile, c.school, c.athletic, c.academic, c.bucket, academic, rosterSignal, video, c.isStretchReach),
      notes: c.school.notes ?? '',
      isStretchReach: c.isStretchReach,
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
      academicTier:       academicTier(c.school.id),
      rosterSignal,
      recruitableShot:    shot,
      dataConfidence:     dataConfidence(c.school, academic, rosterSignal ?? null),
      state:              extractState(c.school.location),
      record:           getProgramRecord(c.school.id, gender) ?? null,
      recruitingClass:  getRecruitingClass(c.school.id, gender) ?? null,
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

  // Division axis. effectiveDivGap returns 0 for any division in the
  // athlete's target set, so a multi-target {D1, D3} athlete sees both
  // D1 and D3 schools as "exact division match".
  const signedDivGap = effectiveDivGap(school.division, profile)
  const divDist = Math.abs(signedDivGap)
  const divScore = divDist === 0 ? 100 : divDist === 1 ? 70 : divDist === 2 ? 35 : 15
  const tgtLabel = targetLabel(profile)
  const divVerdict = divDist === 0
    ? `Exact division match for your ${tgtLabel} target.`
    : signedDivGap < 0
      ? `Plays above your ${tgtLabel} target — more competitive.`
      : `Plays below your ${tgtLabel} target — more attainable.`

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
