import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import {
  MILESTONES, CATEGORY_META, getMilestoneDate, getMilestoneStatus, loadDone, getAthleteProfile,
  getCurrentGrade, isMilestonePast, getCurrentSemester,
} from '../../data/milestones'

const quickActions = [
  { to: '/dashboard/profile', icon: '👤', title: 'Complete your profile', desc: 'Add your stats, GPA, and club info', badge: 'Start here' },
  { to: '/dashboard/schools', icon: '🎯', title: 'Find your schools', desc: 'Get AI-matched reach, target & safety schools', badge: '5 free' },
  { to: '/dashboard/emails', icon: '✉️', title: 'Email a coach', desc: 'Generate your first personalized outreach', badge: '3 free' },
]

const recentActivity = [
  { icon: '✉️', text: 'Coach email generated for Wake Forest University', time: '2h ago', badgeVariant: 'muted' as const, badgeLabel: 'Draft' },
  { icon: '🎯', text: '12 school matches found based on your profile', time: '1d ago', badgeVariant: 'gold' as const, badgeLabel: 'New' },
  { icon: '👤', text: 'Athlete profile updated', time: '2d ago', badgeVariant: 'green' as const, badgeLabel: 'Done' },
]

const STATUS_PRIORITY = { overdue: 0, soon: 1, future: 2, done: 3 }

function useUpcomingMilestones(limit = 4) {
  const profile = getAthleteProfile()
  const gradYear = profile?.gradYear ?? (new Date().getFullYear() + 2)
  const division = profile?.targetDivision
  const done = loadDone()
  const currentGrade = getCurrentGrade(gradYear)
  const currentSemester = getCurrentSemester()

  return MILESTONES
    .filter((m) => !(division && m.divisions && !m.divisions.includes(division)))
    // Only show milestones from the athlete's current point forward (skip old past grades)
    .filter((m) => !isMilestonePast(m.grade, m.semester, currentGrade, currentSemester))
    .map((m) => {
      const date = getMilestoneDate(gradYear, m.grade, m.semester)
      const isDone = done.has(m.id)
      return { ...m, date, status: getMilestoneStatus(date, isDone) as 'done' | 'overdue' | 'soon' | 'future' }
    })
    .filter((m) => m.status !== 'done')
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status])
    .slice(0, limit)
}

export function Overview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const name = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'Athlete'
  const upcomingMilestones = useUpcomingMilestones()

  return (
    <div className="px-10 py-10 max-w-5xl">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Dashboard</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">
          Good morning, {name}
        </h1>
        <p className="text-[#64748b] mt-2 text-sm">Your recruiting journey starts here.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {[
          { label: 'School Matches', value: '0', sub: 'of 5 free', color: 'text-[#eab308]' },
          { label: 'Emails Generated', value: '0', sub: 'of 3 free', color: 'text-[#eab308]' },
          { label: 'Coaches Contacted', value: '0', sub: null, color: 'text-[#4ade80]' },
          { label: 'Responses', value: '0', sub: null, color: 'text-[#60a5fa]' },
        ].map(({ label, value, sub, color }) => (
          <Card key={label} className="p-5">
            <div className={`font-serif text-3xl font-black ${color} tracking-[-1px]`}>{value}</div>
            <div className="text-xs text-[#64748b] mt-1">{label}</div>
            {sub && <div className="text-xs text-[rgba(255,255,255,0.2)] mt-0.5">{sub}</div>}
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mb-10">
        <h2 className="font-serif text-xl font-bold text-[#f1f5f9] mb-5">Get started</h2>
        <div className="grid grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to} className="no-underline">
              <Card hover className="p-6 h-full flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{action.icon}</span>
                  <Badge variant="gold">{action.badge}</Badge>
                </div>
                <div>
                  <div className="text-sm font-bold text-[#f1f5f9] mb-1">{action.title}</div>
                  <div className="text-xs text-[#64748b] leading-relaxed">{action.desc}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recruiting Timeline */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-xl font-bold text-[#f1f5f9]">Recruiting timeline</h2>
          <Link to="/dashboard/timeline" className="text-xs font-semibold text-[#eab308] hover:text-[#f0c010] no-underline">
            View full timeline →
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {upcomingMilestones.length === 0 ? (
            <Card className="p-5 text-center">
              <div className="text-sm text-[#64748b]">You're all caught up — no urgent milestones right now.</div>
            </Card>
          ) : (
            upcomingMilestones.map((m) => {
              const destination = m.actionTo ?? '/dashboard/timeline'
              const statusBg = {
                overdue: 'border-[rgba(234,179,8,0.25)] bg-[rgba(234,179,8,0.03)]',
                soon: 'border-[rgba(234,179,8,0.12)]',
                future: 'border-[rgba(255,255,255,0.06)]',
                done: 'border-[rgba(255,255,255,0.06)]',
              }[m.status]
              const dot = {
                overdue: 'bg-[#eab308]',
                soon: 'bg-[#eab308] opacity-60',
                future: 'bg-transparent border-2 border-[rgba(255,255,255,0.2)]',
                done: 'bg-[#4ade80]',
              }[m.status]

              return (
                <div
                  key={m.id}
                  onClick={() => navigate(destination)}
                  className={`flex items-center gap-4 px-5 py-4 rounded-xl border ${statusBg} cursor-pointer hover:bg-[rgba(234,179,8,0.06)] hover:border-[rgba(234,179,8,0.2)] transition-all group`}
                >
                  <div className={`shrink-0 w-2.5 h-2.5 rounded-full ${dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#f1f5f9] truncate">{m.title}</div>
                    <div className="text-xs text-[#64748b] mt-0.5">
                      {m.grade.charAt(0).toUpperCase() + m.grade.slice(1)} · {m.semester.charAt(0).toUpperCase() + m.semester.slice(1)}
                      {' · '}
                      {m.date.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
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
                    <span className="text-[#eab308] text-sm opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="mb-10">
        <h2 className="font-serif text-xl font-bold text-[#f1f5f9] mb-5">Recent activity</h2>
        <Card className="divide-y divide-[rgba(255,255,255,0.05)]">
          {recentActivity.map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <span className="text-lg">{item.icon}</span>
              <div className="flex-1 text-sm text-[#f1f5f9]">{item.text}</div>
              <span className="text-xs text-[#64748b]">{item.time}</span>
              <Badge variant={item.badgeVariant}>{item.badgeLabel}</Badge>
            </div>
          ))}
        </Card>
      </div>

      {/* Upgrade banner */}
      <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(234,179,8,0.08),rgba(15,23,41,0.9))] border border-[rgba(234,179,8,0.2)] p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-bold text-[#eab308] mb-1">Upgrade to Pro — $19/mo</div>
          <div className="text-xs text-[#64748b]">Unlimited emails, outreach tracker, video rater, and follow-up assistant</div>
        </div>
        <Button size="sm">Upgrade Now</Button>
      </div>
    </div>
  )
}
