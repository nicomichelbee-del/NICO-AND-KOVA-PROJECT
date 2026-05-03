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
  // the −2 cap so a true reach is appropriately discouraged.
  const rawDivGap = divIdx(school.division) - divIdx(profile.targetDivision)
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

    const divDelta = divIdx(school.division) - divIdx(profile.targetDivision)
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
  const divGap = divIdx(school.division) - divIdx(profile.targetDivision)
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
      gaps.push(`they play ${school.division} (you target ${profile.targetDivision}) — one level above`)
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
    if (school.division === profile.targetDivision && video.divisionFitScore <= 5.5) {
      reasons.push(`Video AI rates your ${profile.targetDivision} fit at ${video.divisionFitScore.toFixed(1)}/10 — consider also targeting one level down.`)
    } else if (school.division === profile.targetDivision && video.divisionFitScore >= 8.5) {
      reasons.push(`Video AI rates your ${profile.targetDivision} fit at ${video.divisionFitScore.toFixed(1)}/10 — clearly playing at this level.`)
    }
  }

  // ── Geography preference ────────────────────────────────────────────
  if (profile.locationPreference && profile.locationPreference !== 'any'
      && school.region === profile.locationPreference) {
    reasons.push(`In your preferred ${profile.locationPreference} region.`)
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
}

// Per-bucket caps when the user requests the default 25-school result. Sum
// must be <= topN; remaining budget is distributed proportionally if any
// bucket is short.
const DEFAULT_BUCKET_CAPS = { safety: 8, target: 10, reach: 8 } as const

export function matchSchools(profile: AthleteProfile, topN = 25, video?: VideoRating | null): School[] {
  const gender = profile.gender ?? 'womens'
  // Hard exclusions — divisions the athlete has explicitly opted out of.
  // The targetDivision is never excludable (defensive guard against bad
  // client state). Applied before scoring so excluded schools never enter
  // the candidate pool, the bucket caps, or the deep-safety logic.
  const excluded = new Set(
    (profile.excludedDivisions ?? []).filter((d) => d !== profile.targetDivision),
  )

  const scored: Candidate[] = (schoolsData as SchoolRecord[])
    .filter((s) => !excluded.has(s.division))
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
      const rawDivGapForScore = divIdx(s.division) - divIdx(profile.targetDivision)
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
  const targetIdx = divIdx(profile.targetDivision)
  function divCloseness(c: Candidate): number {
    // Lower = closer to target. We weight "below target" more leniently
    // than "above target" — a D2 prospect should rank D3 (gap=+1) above
    // D1 (gap=-1) since one is attainable and the other is genuine reach.
    const gap = divIdx(c.school.division) - targetIdx
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
  const isDeepBelow = (c: Candidate) =>
    divIdx(c.school.division) - targetIdx >= 3
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
  const finalReach    = reach.slice(0, reachCap)

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
      reasons: buildReasons(profile, c.school, c.athletic, c.academic, c.bucket, academic, rosterSignal, video),
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
