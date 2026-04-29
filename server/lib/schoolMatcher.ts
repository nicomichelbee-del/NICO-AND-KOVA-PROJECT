import schoolsData from '../data/schools.json'
import type { AthleteProfile, School } from '../../client/src/types/index'

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
}

type Division = 'D1' | 'D2' | 'D3' | 'NAIA' | 'JUCO'

const DIVISION_ORDER: Division[] = ['D1', 'D2', 'D3', 'NAIA', 'JUCO']

function divisionScore(target: Division, school: Division): number {
  const dist = Math.abs(DIVISION_ORDER.indexOf(target) - DIVISION_ORDER.indexOf(school))
  if (dist === 0) return 100
  if (dist === 1) return 65
  if (dist === 2) return 30
  return 10
}

function gpaScore(athleteGpa: number, schoolAvg: number): number {
  if (schoolAvg === 0) return 50
  return Math.min(100, Math.round((athleteGpa / schoolAvg) * 100))
}

function statsScore(goals: number, position: string, school: SchoolRecord): number {
  const pos = position.toLowerCase()
  const isGK = pos.includes('goal') || pos === 'gk' || pos === 'keeper'
  if (isGK) return 70
  const isFwd = pos.includes('forward') || pos.includes('striker') || pos.includes('winger') || pos === 'cf' || pos === 'lw' || pos === 'rw'
  const avg = isFwd ? school.goalsForwardAvg : school.goalsMidAvg
  if (avg === 0) return 50
  return Math.min(100, Math.round((goals / avg) * 100))
}

function prefScore(profile: AthleteProfile, school: SchoolRecord): number {
  let score = 50
  if (profile.sizePreference && profile.sizePreference !== 'any' && profile.sizePreference === school.size) score += 25
  const locPref = (profile.locationPreference ?? '').toLowerCase()
  if (locPref && (school.region.toLowerCase().includes(locPref) || school.location.toLowerCase().includes(locPref))) score += 25
  return Math.min(100, score)
}

function scoreSchool(profile: AthleteProfile, school: SchoolRecord): number {
  const isGK = profile.position.toLowerCase().includes('goal') || profile.position.toLowerCase() === 'gk'
  const gpaW = isGK ? 0.55 : 0.40
  const statsW = isGK ? 0.00 : 0.30
  const divW = isGK ? 0.30 : 0.20
  const prefW = isGK ? 0.15 : 0.10

  return Math.round(
    gpaScore(profile.gpa, school.gpaAvg) * gpaW +
    statsScore(profile.goals, profile.position, school) * statsW +
    divisionScore(profile.targetDivision, school.division) * divW +
    prefScore(profile, school) * prefW
  )
}

function category(score: number): 'reach' | 'target' | 'safety' {
  if (score < 55) return 'reach'
  if (score < 80) return 'target'
  return 'safety'
}

export function matchSchools(profile: AthleteProfile, topN = 25): Omit<School, 'notes'>[] {
  const gender = profile.gender ?? 'womens'
  const scored = (schoolsData as SchoolRecord[]).map((s) => ({
    school: s,
    score: scoreSchool(profile, s),
    coachName: gender === 'womens' ? s.womensCoach : s.mensCoach,
    coachEmail: gender === 'womens' ? s.womensCoachEmail : s.mensCoachEmail,
  })).sort((a, b) => b.score - a.score)

  const top = scored.slice(0, topN)

  let reach = top.filter((s) => category(s.score) === 'reach')
  let target = top.filter((s) => category(s.score) === 'target')
  let safety = top.filter((s) => category(s.score) === 'safety')

  while (reach.length < 4 && target.length > 0) reach.push(target.pop()!)
  while (safety.length < 8 && target.length > 0) safety.unshift(target.shift()!)

  const reachIds = new Set(reach.map((s) => s.school.id))
  const safetyIds = new Set(safety.map((s) => s.school.id))

  return [...safety, ...target, ...reach].slice(0, topN).map((s) => ({
    id: s.school.id,
    name: s.school.name,
    division: s.school.division,
    location: s.school.location,
    enrollment: s.school.enrollment,
    conference: s.school.conference,
    coachName: s.coachName,
    coachEmail: s.coachEmail,
    category: safetyIds.has(s.school.id) ? 'safety' : reachIds.has(s.school.id) ? 'reach' : 'target',
    matchScore: s.score,
  }))
}
