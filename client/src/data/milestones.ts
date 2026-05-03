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
  /** Concrete, ordered steps the athlete can do right now to complete this milestone. */
  howTo: string[]
  /** Optional external link (e.g. NCAA Eligibility Center, FAFSA) shown alongside the in-app CTA. */
  externalLink?: { label: string; url: string }
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
    howTo: [
      'Open the Profile page from the sidebar.',
      'Fill in primary position, height/weight, preferred foot, and grad year.',
      'Add your current club, league, jersey number, and head coach contact.',
      'Enter your latest GPA, SAT/ACT (if taken), and intended major.',
      'Paste your YouTube or Hudl highlight video URL.',
      'Hit Save — School Matcher and Email Generator will unlock.',
    ],
  },
  {
    id: 'highlight-v1',
    title: 'Create Your First Highlight Video',
    desc: 'Aim for 3–5 minutes. First 30 seconds must be your absolute best clip. Include name, grad year, position, and club as an overlay. Post to YouTube or Hudl.',
    grade: 'freshman',
    semester: 'spring',
    category: 'profile',
    actionLabel: 'Rate Your Video',
    actionTo: '/dashboard/video',
    howTo: [
      'Pull game film from your last full club season — full-field angle is best.',
      'Cut 25–35 clips: goals, assists, 1v1 wins, defensive plays, set pieces.',
      'Lead with your best 2–3 clips in the first 30 seconds.',
      'Add a title card: name, grad year, position, club, jersey #, GPA.',
      'Keep total length 3–5 minutes — coaches stop watching after that.',
      'Upload to YouTube/Hudl, then run it through the Video Rater for an honest score.',
    ],
  },
  {
    id: 'ncaa-eligibility',
    title: 'Register with NCAA Eligibility Center',
    desc: 'Required for D1 and D2. Start at eligibilitycenter.org. Track your core courses from this point forward — you need 16 core courses to be eligible.',
    divisions: ['D1', 'D2'],
    grade: 'sophomore',
    semester: 'fall',
    category: 'academic',
    actionLabel: 'How to Register',
    actionTo: '/dashboard/timeline',
    externalLink: { label: 'NCAA Eligibility Center', url: 'https://web3.ncaa.org/ecwr3/' },
    howTo: [
      'Go to eligibilitycenter.org and create a Certification Account ($100 fee, $25 fee waiver available).',
      'Enter your high school(s), club team(s), and your sports.',
      'Ask your school counselor to upload your transcript through the NCAA portal.',
      'Confirm all 16 core courses are listed — English, math, science, social science.',
      'Send official SAT/ACT scores using NCAA code 9999 when you take them.',
      'Re-check your account every semester so missing transcripts don\'t stall recruiting.',
    ],
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
    howTo: [
      'Open School Matcher and pick 5 reach, 5 target, 5 safety programs.',
      'For each school, click "Generate Email" — Beeko personalizes it from your profile.',
      'Edit the "Why this school" line to mention something specific (recent win, major, alum).',
      'Attach your highlight link and a one-line stat snapshot.',
      'Send Tuesday–Thursday morning. Avoid weekends.',
      'Log every send in the Outreach Tracker so you know who to follow up with in 2 weeks.',
    ],
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
    howTo: [
      'List your top 5–8 schools — only attend camps where the coach has shown interest or you genuinely want to attend.',
      'Email the coach 2–3 weeks before camp: "Looking forward to camp on X — here\'s my video and stat line."',
      'Bring printed profile cards (5x7) with photo, contact, club, GPA, video link.',
      'On camp day: arrive 30 min early, introduce yourself by name + position to every coach.',
      'Play your natural game — don\'t try to be flashy. Coaches want decision-makers.',
      'Within 24 hours after, send a thank-you email and ask one specific question about the program.',
    ],
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
    howTo: [
      'Confirm with your club DOC which showcases the team is rostered for.',
      '4 weeks out: email every coach on your target list — "I\'ll be at [showcase], field X, jersey #Y, [date/time]."',
      'Pack two pairs of cleats, extra socks, your printed profile cards, and a phone tripod for filming.',
      'Film every game from a high angle — even one clip can become highlight material.',
      'Between games: rest, hydrate, scout the sideline for coaches you emailed.',
      'After the event: email each coach a 60-second clip of your best moments from that weekend.',
    ],
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
    howTo: [
      'Pull your strongest 25–30 clips from junior-year club + showcase film.',
      'Replace any clip that\'s older than 12 months — coaches want recent.',
      'Lead with a clip showing your decision-making, not just a goal.',
      'Add updated stats overlay: junior-year goals/assists, GPA, latest test score.',
      'Run the new cut through the Video Rater — it scores opening, variety, length, polish.',
      'Address every red flag the rater flags before re-sending to coaches.',
    ],
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
    howTo: [
      'Open School Matcher. Apply your division target, region, school size, and major filters.',
      'Save 4 reach, 6 target, and 4 safety schools to your tracker.',
      'For each, check the Roster Intel page — confirm there\'s an open spot at your position by your grad year.',
      'Drop schools where the coach hasn\'t replied after 2 emails + 1 follow-up.',
      'Add at least 2 D3 / NAIA safeties even if your target is D1 — leverage matters.',
    ],
  },
  {
    id: 'unofficial-visits',
    title: 'Unofficial Campus Visits',
    desc: "Visit 4–6 schools on your own dime. Attend a game. Walk into the coach's office. Tour the facilities. Feel the campus culture.",
    grade: 'junior',
    semester: 'fall',
    category: 'visits',
    actionLabel: 'Plan Visits',
    actionTo: '/dashboard/schools',
    howTo: [
      'Pick 4–6 schools from your narrowed list — ideally a mix of reach/target/safety.',
      'Email the coach 2 weeks ahead: "Visiting campus on [date], hoping to meet and tour facilities."',
      'Time the visit around a home soccer game if possible — see the program in action.',
      'Tour: locker room, training facilities, dorms, dining hall, the part of campus where your major lives.',
      'Sit in on a class in your intended major if the admissions office allows.',
      'Within 24 hours after, send a thank-you email — note one specific thing you loved.',
    ],
  },
  {
    id: 'fafsa',
    title: 'FAFSA Opens — File Immediately',
    desc: "Opens October 1. File the same day using previous year's taxes. Athletic scholarship stacks on top of need-based aid — maximize both.",
    grade: 'senior',
    semester: 'fall',
    category: 'academic',
    actionLabel: 'How to File',
    actionTo: '/dashboard/timeline',
    externalLink: { label: 'studentaid.gov', url: 'https://studentaid.gov/h/apply-for-aid/fafsa' },
    howTo: [
      'Both you and a parent: create FSA IDs at studentaid.gov before October 1.',
      'Gather: previous year\'s tax returns, W-2s, bank statements, investment records.',
      'File on October 1 the day it opens — early filers get more aid in many states.',
      'List every school you\'re applying to (up to 20) so each gets your FAFSA.',
      'For non-FAFSA aid, also complete the CSS Profile if any of your schools require it.',
      'Re-check FAFSA in January when your senior tax info finalizes.',
    ],
  },
  {
    id: 'official-visits',
    title: 'Official Campus Visits (School Pays)',
    desc: "D1/D2 programs can fly you in and cover costs. You get 5 total across all schools. Use them only for your serious contenders.",
    divisions: ['D1', 'D2'],
    grade: 'senior',
    semester: 'fall',
    category: 'visits',
    actionLabel: 'Track Visits',
    actionTo: '/dashboard/tracker',
    howTo: [
      'You only get 5 official visits total — burn them only on serious contenders.',
      'Wait for the coach to invite you. Don\'t ask for one before the offer is on the table.',
      'Visit during a competition weekend if possible — see the team play and meet the squad.',
      'Stay with a current player on the team — ask them honest questions about the coach.',
      'Meet with academic advising for your intended major during the visit.',
      'After: log every detail in the tracker — dorm, food, vibe, coach\'s tone — you\'ll forget by visit #3.',
    ],
  },
  {
    id: 'early-decision',
    title: 'Early Decision / Early Action Deadline',
    desc: 'Most ED deadlines are November 1–15. If a school is unambiguously your first choice, ED increases your admit odds and signals commitment to the coach.',
    grade: 'senior',
    semester: 'fall',
    category: 'commitment',
    actionLabel: 'Track Applications',
    actionTo: '/dashboard/tracker',
    howTo: [
      'Decide by mid-October: is this school unambiguously #1? ED is binding.',
      'Tell your coach you\'re applying ED — it\'s a strong commitment signal that often unlocks support from admissions.',
      'Submit Common App + supplements + recommendations + transcript by Nov 1 (or Nov 15).',
      'Confirm your counselor sent your school report and mid-year transcript.',
      'Decisions usually arrive mid-December. If admitted ED, withdraw all other applications.',
    ],
  },
  {
    id: 'nli-signing',
    title: 'National Letter of Intent — Early Period',
    desc: "Women's soccer: mid-November. Men's soccer: April. NLI is binding — the school holds your spot; you commit to attend. Don't sign until you're certain.",
    grade: 'senior',
    semester: 'fall',
    category: 'commitment',
    actionLabel: 'Track Offers',
    actionTo: '/dashboard/tracker',
    howTo: [
      'Get the official scholarship offer in writing — dollar amount and duration.',
      'Have a parent + your club coach review the NLI before signing.',
      'Confirm housing, meal plan, and book stipend are part of the package, not separate costs.',
      'Sign and email/fax back within 7 days of receiving the NLI to lock the spot.',
      'Once signed: stop replying to other coaches. Your recruiting is done.',
    ],
  },
  {
    id: 'regular-apps',
    title: 'Regular Decision Applications Due',
    desc: "Most RD deadlines are January 1–15. Get all applications submitted before winter break so you're not scrambling.",
    grade: 'senior',
    semester: 'spring',
    category: 'commitment',
    actionLabel: 'Track Applications',
    actionTo: '/dashboard/tracker',
    howTo: [
      'Build a master spreadsheet: school, deadline, app fee, supplements required.',
      'Aim to submit 1 application every 2–3 days through December — don\'t pull all-nighters in January.',
      'Reuse essays where possible — most "why us" prompts are 80% the same answer.',
      'Confirm with your counselor that transcripts + recommendations sent for every school.',
      'Pay attention to fee waivers — many schools waive if you\'ve visited or have FAFSA on file.',
    ],
  },
  {
    id: 'commit',
    title: '🎉 Commit to Your School',
    desc: "This is what you've been working toward. Once you've got a scholarship offer or acceptance that feels right, say yes. You earned it.",
    grade: 'senior',
    semester: 'spring',
    category: 'commitment',
    actionLabel: 'Update Profile',
    actionTo: '/dashboard/profile',
    howTo: [
      'Sleep on the offer — never commit on the call.',
      'Talk it through with your parents AND your club coach.',
      'Compare academic + athletic + financial fit against your top 2 alternatives one last time.',
      'Call the coach to verbally commit, then submit your enrollment deposit.',
      'Notify other coaches who recruited you — short, gracious email. They\'ll remember.',
      'Update your athlete profile to "Committed" and post it. Celebrate. You earned this.',
    ],
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
