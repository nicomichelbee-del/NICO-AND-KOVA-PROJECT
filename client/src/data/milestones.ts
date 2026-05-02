import type { Division } from '../types'

export type Grade = 'freshman' | 'sophomore' | 'junior' | 'senior'
export type Semester = 'fall' | 'spring' | 'summer'
export type Category = 'profile' | 'academic' | 'outreach' | 'camps' | 'visits' | 'commitment'

export interface Milestone {
  id: string
  title: string
  desc: string
  divisions?: Division[]
  grade: Grade
  semester: Semester
  category: Category
  actionLabel?: string
  actionTo?: string
}

export const MILESTONES: Milestone[] = [
  {
    id: 'profile',
    title: 'Complete Your Athlete Profile',
    desc: 'Lock in your position, GPA, stats, club, and highlight video. Everything else — school matching, email generation — depends on this.',
    grade: 'freshman',
    semester: 'fall',
    category: 'profile',
    actionLabel: 'Build Profile',
    actionTo: '/dashboard/profile',
  },
  {
    id: 'highlight-v1',
    title: 'Create Your Highlight Video (v1)',
    desc: 'Aim for 3–5 minutes. First 30 seconds must be your absolute best clip. Include name, grad year, position, and club as an overlay. Post to YouTube or Hudl.',
    grade: 'freshman',
    semester: 'spring',
    category: 'profile',
    actionLabel: 'Rate Your Video',
    actionTo: '/dashboard/video',
  },
  {
    id: 'ncaa-eligibility',
    title: 'Register with NCAA Eligibility Center',
    desc: 'Required for D1 and D2. Start at eligibilitycenter.org. Track your core courses from this point forward — you need 16 core courses to be eligible.',
    divisions: ['D1', 'D2'],
    grade: 'sophomore',
    semester: 'fall',
    category: 'academic',
  },
  {
    id: 'first-emails',
    title: 'Start Cold Outreach to Coaches',
    desc: 'D1 coaches recruit early — sophomore year is not too soon. Send 10–15 personalized emails using Beeko. Target reach, match, and safety schools.',
    grade: 'sophomore',
    semester: 'fall',
    category: 'outreach',
    actionLabel: 'Generate Emails',
    actionTo: '/dashboard/emails',
  },
  {
    id: 'id-camps',
    title: 'Attend ID Camps at Target Schools',
    desc: 'Get in front of coaches in person. Prioritize camps at your top 5 target schools. This is how coaches put a face to a name.',
    grade: 'sophomore',
    semester: 'summer',
    category: 'camps',
    actionLabel: 'Find ID Camps',
    actionTo: '/dashboard/camps',
  },
  {
    id: 'showcases',
    title: 'ECNL / MLS NEXT National Showcases',
    desc: 'Top-level club showcases draw hundreds of college coaches. Get on the roster and play your best in front of scouts. Film every game.',
    grade: 'junior',
    semester: 'summer',
    category: 'camps',
    actionLabel: 'View Showcase Events',
    actionTo: '/dashboard/camps',
  },
  {
    id: 'highlight-v2',
    title: 'Update Your Highlight Video',
    desc: "Replace sophomore clips with junior-year footage. Use Beeko's Video Rater to get a fresh score and improvement list before sending to new coaches.",
    grade: 'junior',
    semester: 'fall',
    category: 'profile',
    actionLabel: 'Rate Updated Video',
    actionTo: '/dashboard/video',
  },
  {
    id: 'narrow-list',
    title: 'Narrow to 10–15 Target Schools',
    desc: 'Use School Matcher to finalize your reach/target/safety list. Follow up with coaches you emailed earlier. Start tracking every interaction.',
    grade: 'junior',
    semester: 'fall',
    category: 'outreach',
    actionLabel: 'Match Schools',
    actionTo: '/dashboard/schools',
  },
  {
    id: 'unofficial-visits',
    title: 'Unofficial Campus Visits',
    desc: "Visit 4–6 schools on your own dime. Attend a game. Walk into the coach's office. Tour the facilities. Feel the campus culture.",
    grade: 'junior',
    semester: 'fall',
    category: 'visits',
  },
  {
    id: 'fafsa',
    title: 'FAFSA Opens — File Immediately',
    desc: "Opens October 1. File the same day using previous year's taxes. Athletic scholarship stacks on top of need-based aid — maximize both.",
    grade: 'senior',
    semester: 'fall',
    category: 'academic',
  },
  {
    id: 'official-visits',
    title: 'Official Campus Visits (School Pays)',
    desc: "D1/D2 programs can fly you in and cover costs. You get 5 total across all schools. Use them only for your serious contenders.",
    divisions: ['D1', 'D2'],
    grade: 'senior',
    semester: 'fall',
    category: 'visits',
  },
  {
    id: 'early-decision',
    title: 'Early Decision / Early Action Deadline',
    desc: 'Most ED deadlines are November 1–15. If a school is unambiguously your first choice, ED increases your admit odds and signals commitment to the coach.',
    grade: 'senior',
    semester: 'fall',
    category: 'commitment',
  },
  {
    id: 'nli-signing',
    title: 'National Letter of Intent — Early Period',
    desc: "Women's soccer: mid-November. Men's soccer: April. NLI is binding — the school holds your spot; you commit to attend. Don't sign until you're certain.",
    grade: 'senior',
    semester: 'fall',
    category: 'commitment',
  },
  {
    id: 'regular-apps',
    title: 'Regular Decision Applications Due',
    desc: "Most RD deadlines are January 1–15. Get all applications submitted before winter break so you're not scrambling.",
    grade: 'senior',
    semester: 'spring',
    category: 'commitment',
  },
  {
    id: 'commit',
    title: '🎉 Commit to Your School',
    desc: "This is what you've been working toward. Once you've got a scholarship offer or acceptance that feels right, say yes. You earned it.",
    grade: 'senior',
    semester: 'spring',
    category: 'commitment',
  },
]

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  profile: { label: 'Profile', color: 'text-[#60a5fa]' },
  academic: { label: 'Academic', color: 'text-[#a78bfa]' },
  outreach: { label: 'Outreach', color: 'text-[#eab308]' },
  camps: { label: 'Camps', color: 'text-[#f97316]' },
  visits: { label: 'Visits', color: 'text-[#34d399]' },
  commitment: { label: 'Commitment', color: 'text-[#fb7185]' },
}

export const GRADE_LABEL: Record<Grade, string> = {
  freshman: 'Freshman',
  sophomore: 'Sophomore',
  junior: 'Junior',
  senior: 'Senior',
}

export const SEM_MONTH: Record<Semester, number> = { fall: 9, spring: 1, summer: 6 }

export function getMilestoneDate(gradYear: number, grade: Grade, semester: Semester): Date {
  const gradeYear = { freshman: gradYear - 4, sophomore: gradYear - 3, junior: gradYear - 2, senior: gradYear - 1 }
  const base = gradeYear[grade]
  const year = semester === 'spring' ? base + 1 : base
  return new Date(year, SEM_MONTH[semester] - 1, 1)
}

export function getMilestoneStatus(date: Date, isDone: boolean): 'done' | 'overdue' | 'soon' | 'future' {
  if (isDone) return 'done'
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'overdue'
  if (diffDays < 90) return 'soon'
  return 'future'
}

export const DONE_KEY = 'timeline_done'

export function loadDone(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]')) } catch { return new Set() }
}

export function getAthleteProfile() {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

const GRADE_ORDER: Record<Grade, number> = { freshman: 0, sophomore: 1, junior: 2, senior: 3 }
const SEM_ORDER: Record<Semester, number> = { fall: 0, spring: 1, summer: 2 }

/** Returns the athlete's current grade based on their graduation year. */
export function getCurrentGrade(gradYear: number): Grade {
  const now = new Date()
  // Academic year starts in September; before Sep we're still in the prior school year
  const academicYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  const yearsUntilGrad = gradYear - academicYear
  if (yearsUntilGrad <= 1) return 'senior'
  if (yearsUntilGrad === 2) return 'junior'
  if (yearsUntilGrad === 3) return 'sophomore'
  return 'freshman'
}

/** Returns current semester (fall/spring/summer) based on today's month. */
export function getCurrentSemester(): Semester {
  const m = new Date().getMonth()
  if (m >= 8) return 'fall'    // Sep–Dec
  if (m >= 5) return 'summer'  // Jun–Aug
  return 'spring'              // Jan–May
}

/**
 * Returns true if a milestone's grade/semester is before the athlete's current point.
 * Used to dim "missed window" milestones on the timeline.
 */
export function isMilestonePast(grade: Grade, semester: Semester, currentGrade: Grade, currentSemester: Semester): boolean {
  const gOrder = GRADE_ORDER[grade]
  const curGOrder = GRADE_ORDER[currentGrade]
  if (gOrder < curGOrder) return true
  if (gOrder === curGOrder) return SEM_ORDER[semester] < SEM_ORDER[currentSemester]
  return false
}
