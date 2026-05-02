import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import type { AthleteProfile, Division } from '../../types'

type Grade = 'freshman' | 'sophomore' | 'junior' | 'senior'
type Semester = 'fall' | 'spring' | 'summer'
type Category = 'profile' | 'academic' | 'outreach' | 'camps' | 'visits' | 'commitment'

interface Milestone {
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

const MILESTONES: Milestone[] = [
  {
    id: 'profile',
    title: 'Complete Your Athlete Profile',
    desc: 'Lock in your position, GPA, stats, club, and highlight video. Everything else — school matching, email generation — depends on this.',
    grade: 'freshman',
    semester: 'fall',
    category: 'profile',
    actionLabel: 'Build Profile →',
    actionTo: '/dashboard/profile',
  },
  {
    id: 'highlight-v1',
    title: 'Create Your Highlight Video (v1)',
    desc: 'Aim for 3–5 minutes. First 30 seconds must be your absolute best clip. Include name, grad year, position, and club as an overlay. Post to YouTube or Hudl.',
    grade: 'freshman',
    semester: 'spring',
    category: 'profile',
    actionLabel: 'Rate Your Video →',
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
    actionLabel: 'Generate Emails →',
    actionTo: '/dashboard/emails',
  },
  {
    id: 'id-camps',
    title: 'Attend ID Camps at Target Schools',
    desc: 'Get in front of coaches in person. Prioritize camps at your top 5 target schools. This is how coaches put a face to a name.',
    grade: 'sophomore',
    semester: 'summer',
    category: 'camps',
    actionLabel: 'Find ID Camps →',
    actionTo: '/dashboard/camps',
  },
  {
    id: 'showcases',
    title: 'ECNL / MLS NEXT National Showcases',
    desc: 'Top-level club showcases draw hundreds of college coaches. Get on the roster and play your best in front of scouts. Film every game.',
    grade: 'junior',
    semester: 'summer',
    category: 'camps',
    actionLabel: 'View Showcase Events →',
    actionTo: '/dashboard/camps',
  },
  {
    id: 'highlight-v2',
    title: 'Update Your Highlight Video',
    desc: 'Replace sophomore clips with junior-year footage. Use Beeko\'s Video Rater to get a fresh score and improvement list before sending to new coaches.',
    grade: 'junior',
    semester: 'fall',
    category: 'profile',
    actionLabel: 'Rate Updated Video →',
    actionTo: '/dashboard/video',
  },
  {
    id: 'narrow-list',
    title: 'Narrow to 10–15 Target Schools',
    desc: 'Use School Matcher to finalize your reach/target/safety list. Follow up with coaches you emailed earlier. Start tracking every interaction.',
    grade: 'junior',
    semester: 'fall',
    category: 'outreach',
    actionLabel: 'Match Schools →',
    actionTo: '/dashboard/schools',
  },
  {
    id: 'unofficial-visits',
    title: 'Unofficial Campus Visits',
    desc: 'Visit 4–6 schools on your own dime. Attend a game. Walk into the coach\'s office. Tour the facilities. Feel the campus culture.',
    grade: 'junior',
    semester: 'fall',
    category: 'visits',
  },
  {
    id: 'fafsa',
    title: 'FAFSA Opens — File Immediately',
    desc: 'Opens October 1. File the same day using previous year\'s taxes. Athletic scholarship stacks on top of need-based aid — maximize both.',
    grade: 'senior',
    semester: 'fall',
    category: 'academic',
  },
  {
    id: 'official-visits',
    title: 'Official Campus Visits (School Pays)',
    desc: 'D1/D2 programs can fly you in and cover costs. You get 5 total across all schools. Use them only for your serious contenders.',
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
    desc: 'Most RD deadlines are January 1–15. Get all applications submitted before winter break so you\'re not scrambling.',
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

const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  profile: { label: 'Profile', color: 'text-[#60a5fa]' },
  academic: { label: 'Academic', color: 'text-[#a78bfa]' },
  outreach: { label: 'Outreach', color: 'text-[#eab308]' },
  camps: { label: 'Camps', color: 'text-[#f97316]' },
  visits: { label: 'Visits', color: 'text-[#34d399]' },
  commitment: { label: 'Commitment', color: 'text-[#fb7185]' },
}

const GRADE_LABEL: Record<Grade, string> = {
  freshman: 'Freshman',
  sophomore: 'Sophomore',
  junior: 'Junior',
  senior: 'Senior',
}

const SEM_MONTH: Record<Semester, number> = { fall: 9, spring: 1, summer: 6 }

function getMilestoneDate(gradYear: number, grade: Grade, semester: Semester): Date {
  const gradeYear = { freshman: gradYear - 4, sophomore: gradYear - 3, junior: gradYear - 2, senior: gradYear - 1 }
  const base = gradeYear[grade]
  const year = semester === 'spring' ? base + 1 : base
  return new Date(year, SEM_MONTH[semester] - 1, 1)
}

function getStatus(date: Date, isDone: boolean): 'done' | 'overdue' | 'soon' | 'future' {
  if (isDone) return 'done'
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'overdue'
  if (diffDays < 90) return 'soon'
  return 'future'
}

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

const DONE_KEY = 'timeline_done'

function loadDone(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]')) } catch { return new Set() }
}

export function Timeline() {
  const profile = getProfile()
  const gradYear = profile?.gradYear ?? (new Date().getFullYear() + 2)
  const division = profile?.targetDivision

  const [done, setDone] = useState<Set<string>>(loadDone)
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')

  function toggleDone(id: string) {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(DONE_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const milestones = MILESTONES.filter((m) => {
    if (division && m.divisions && !m.divisions.includes(division)) return false
    return true
  })

  const withMeta = milestones.map((m) => {
    const date = getMilestoneDate(gradYear, m.grade, m.semester)
    const isDone = done.has(m.id)
    return { ...m, date, status: getStatus(date, isDone) as 'done' | 'overdue' | 'soon' | 'future' }
  })

  const visible = withMeta.filter((m) => {
    if (filter === 'done') return m.status === 'done'
    if (filter === 'pending') return m.status !== 'done'
    return true
  })

  const completedCount = withMeta.filter((m) => m.status === 'done').length
  const urgentCount = withMeta.filter((m) => m.status === 'overdue' || m.status === 'soon').length

  return (
    <div className="px-10 py-10 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Your Journey</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px] mb-2">
          Recruiting Timeline
        </h1>
        <p className="text-[#64748b] text-sm">
          {profile
            ? `Tailored for ${profile.name} · Class of ${gradYear} · ${division}`
            : `Class of ${gradYear} · Set your profile to personalize this`}
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Completed', value: completedCount, color: 'text-[#4ade80]' },
          { label: 'Remaining', value: withMeta.length - completedCount, color: 'text-[#f1f5f9]' },
          { label: 'Action Needed', value: urgentCount, color: 'text-[#eab308]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-xl p-4">
            <div className={`font-serif text-3xl font-black ${color} tracking-[-1px]`}>{value}</div>
            <div className="text-xs text-[#64748b] mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#64748b]">Overall progress</span>
          <span className="text-xs font-semibold text-[#f1f5f9]">{Math.round((completedCount / withMeta.length) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-[rgba(255,255,255,0.07)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#eab308] rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / withMeta.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-8 bg-[rgba(255,255,255,0.04)] rounded-lg p-1 w-fit">
        {(['all', 'pending', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors ${
              filter === f ? 'bg-[#eab308] text-black' : 'text-[#64748b] hover:text-[#f1f5f9]'
            }`}
          >
            {f === 'all' ? 'All Milestones' : f === 'pending' ? 'Pending' : 'Completed'}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-[rgba(255,255,255,0.07)]" />

        <div className="flex flex-col gap-0">
          {visible.map((m, i) => {
            const statusDot = {
              done: 'bg-[#4ade80] border-[#4ade80]',
              overdue: 'bg-[#eab308] border-[#eab308]',
              soon: 'bg-[#eab308] border-[#eab308] opacity-60',
              future: 'bg-transparent border-[rgba(255,255,255,0.2)]',
            }[m.status]

            const cardBorder = {
              done: 'border-[rgba(74,222,128,0.1)]',
              overdue: 'border-[rgba(234,179,8,0.25)]',
              soon: 'border-[rgba(234,179,8,0.12)]',
              future: 'border-[rgba(255,255,255,0.06)]',
            }[m.status]

            const isLastInGrade = i === visible.length - 1 || visible[i + 1]?.grade !== m.grade

            return (
              <div key={m.id} className="relative pl-10 pb-6">
                {/* Grade label */}
                {(i === 0 || visible[i - 1]?.grade !== m.grade) && (
                  <div className="text-xs font-bold tracking-[2px] uppercase text-[#475569] mb-3 -ml-10 pl-10">
                    {GRADE_LABEL[m.grade]} Year
                  </div>
                )}

                {/* Timeline dot */}
                <div className={`absolute left-[11px] top-[3px] w-[9px] h-[9px] rounded-full border-2 ${statusDot} z-10`} />

                {/* Card */}
                <div
                  className={`bg-[rgba(255,255,255,0.02)] border ${cardBorder} rounded-xl p-5 hover:bg-[rgba(255,255,255,0.04)] transition-colors cursor-pointer group`}
                  onClick={() => toggleDone(m.id)}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        m.status === 'done'
                          ? 'bg-[#4ade80] border-[#4ade80]'
                          : 'border-[rgba(255,255,255,0.2)] group-hover:border-[rgba(234,179,8,0.4)]'
                      }`}>
                        {m.status === 'done' && <span className="text-[10px] text-black font-bold">✓</span>}
                      </div>
                      <div className={`text-sm font-bold ${m.status === 'done' ? 'text-[#475569] line-through' : 'text-[#f1f5f9]'}`}>
                        {m.title}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {m.status === 'overdue' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(234,179,8,0.15)] text-[#eab308]">
                          ACTION NEEDED
                        </span>
                      )}
                      {m.status === 'soon' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(234,179,8,0.08)] text-[#eab308]">
                          COMING UP
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold ${CATEGORY_META[m.category].color}`}>
                        {CATEGORY_META[m.category].label.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <p className={`text-xs leading-relaxed ml-7 ${m.status === 'done' ? 'text-[#334155]' : 'text-[#64748b]'}`}>
                    {m.desc}
                  </p>

                  <div className="flex items-center gap-3 mt-3 ml-7">
                    <span className="text-[10px] text-[#334155]">
                      {GRADE_LABEL[m.grade]} · {m.semester.charAt(0).toUpperCase() + m.semester.slice(1)}
                      {' · '}
                      {m.date.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    {m.divisions && (
                      <span className="text-[10px] text-[#475569]">
                        {m.divisions.join(' / ')} only
                      </span>
                    )}
                    {m.actionLabel && m.actionTo && m.status !== 'done' && (
                      <Link
                        to={m.actionTo}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] font-semibold text-[#eab308] hover:text-[#f0c010] no-underline ml-auto"
                      >
                        {m.actionLabel}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {!profile && (
        <div className="mt-6 rounded-xl bg-[rgba(234,179,8,0.05)] border border-[rgba(234,179,8,0.15)] p-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-[#eab308] mb-0.5">Personalize this timeline</div>
            <div className="text-xs text-[#64748b]">Add your grad year and target division to filter and date milestones accurately.</div>
          </div>
          <Link to="/dashboard/profile" className="no-underline">
            <button className="text-xs font-bold px-4 py-2 rounded-lg bg-[#eab308] text-black hover:bg-[#f0c010] transition-colors whitespace-nowrap">
              Build Profile →
            </button>
          </Link>
        </div>
      )}
    </div>
  )
}
