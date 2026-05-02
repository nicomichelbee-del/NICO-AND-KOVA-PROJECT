import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MILESTONES, CATEGORY_META, GRADE_LABEL,
  getMilestoneDate, getMilestoneStatus, loadDone, getAthleteProfile, DONE_KEY,
  getCurrentGrade, getCurrentSemester, isMilestonePast,
} from '../../data/milestones'

export function Timeline() {
  const profile = getAthleteProfile()
  const gradYear = profile?.gradYear ?? (new Date().getFullYear() + 2)
  const division = profile?.targetDivision
  const navigate = useNavigate()
  const nowRef = useRef<HTMLDivElement>(null)

  const currentGrade = getCurrentGrade(gradYear)
  const currentSemester = getCurrentSemester()

  const [done, setDone] = useState<Set<string>>(loadDone)
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')

  // Scroll to "You are here" on first load
  useEffect(() => {
    setTimeout(() => nowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200)
  }, [])

  function toggleDone(id: string, e: React.MouseEvent) {
    e.stopPropagation()
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
    return { ...m, date, status: getMilestoneStatus(date, isDone) as 'done' | 'overdue' | 'soon' | 'future' }
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
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-[rgba(255,255,255,0.07)]" />

        <div className="flex flex-col gap-0">
          {visible.map((m, i) => {
            const isPast = !done.has(m.id) && isMilestonePast(m.grade, m.semester, currentGrade, currentSemester)
            // First milestone that is NOT past — this is where "You are here" goes
            const isHereStart = !isPast && (i === 0 || isMilestonePast(visible[i - 1].grade, visible[i - 1].semester, currentGrade, currentSemester) || done.has(visible[i - 1].id))
            const prevIsPast = i > 0 && isMilestonePast(visible[i - 1].grade, visible[i - 1].semester, currentGrade, currentSemester) && !done.has(visible[i - 1].id)

            const statusDot = {
              done: 'bg-[#4ade80] border-[#4ade80]',
              overdue: 'bg-[#eab308] border-[#eab308]',
              soon: 'bg-[#eab308] border-[#eab308] opacity-60',
              future: 'bg-transparent border-[rgba(255,255,255,0.2)]',
            }[m.status]

            const cardBorder = isPast
              ? 'border-[rgba(255,255,255,0.04)]'
              : {
                  done: 'border-[rgba(74,222,128,0.1)]',
                  overdue: 'border-[rgba(234,179,8,0.25)]',
                  soon: 'border-[rgba(234,179,8,0.12)]',
                  future: 'border-[rgba(255,255,255,0.06)]',
                }[m.status]

            const destination = m.status !== 'done' && !isPast && m.actionTo ? m.actionTo : null

            return (
              <div key={m.id} className="relative pl-10 pb-6">
                {(i === 0 || visible[i - 1]?.grade !== m.grade) && (
                  <div className={`text-xs font-bold tracking-[2px] uppercase mb-3 -ml-10 pl-10 ${isPast ? 'text-[#2d3748]' : 'text-[#475569]'}`}>
                    {GRADE_LABEL[m.grade]} Year
                  </div>
                )}

                {/* "You are here" divider — inserted before first non-past milestone */}
                {prevIsPast && (
                  <div ref={nowRef} className="flex items-center gap-3 mb-4 -ml-10 pl-10">
                    <div className="flex-1 h-px bg-[rgba(234,179,8,0.3)]" />
                    <span className="text-[10px] font-bold tracking-[2px] uppercase text-[#eab308] px-2 py-1 rounded bg-[rgba(234,179,8,0.08)] border border-[rgba(234,179,8,0.2)] whitespace-nowrap">
                      You are here
                    </span>
                    <div className="flex-1 h-px bg-[rgba(234,179,8,0.3)]" />
                  </div>
                )}

                <div className={`absolute left-[11px] top-[3px] w-[9px] h-[9px] rounded-full border-2 ${statusDot} z-10 ${isPast ? 'opacity-30' : ''}`} />

                <div
                  className={`border ${cardBorder} rounded-xl p-5 transition-colors group ${
                    isPast
                      ? 'bg-transparent opacity-35 cursor-default'
                      : 'bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div
                        className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          m.status === 'done'
                            ? 'bg-[#4ade80] border-[#4ade80]'
                            : isPast
                              ? 'border-[rgba(255,255,255,0.1)]'
                              : 'border-[rgba(255,255,255,0.2)] group-hover:border-[rgba(234,179,8,0.4)]'
                        }`}
                        onClick={(e) => !isPast && toggleDone(m.id, e)}
                      >
                        {m.status === 'done' && <span className="text-[10px] text-black font-bold">✓</span>}
                      </div>
                      <div className={`text-sm font-bold ${m.status === 'done' ? 'text-[#475569] line-through' : isPast ? 'text-[#334155]' : 'text-[#f1f5f9]'}`}>
                        {m.title}
                      </div>
                    </div>
                    {!isPast && (
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
                    )}
                    {isPast && (
                      <span className="text-[10px] text-[#2d3748] shrink-0">missed window</span>
                    )}
                  </div>

                  <p className={`text-xs leading-relaxed ml-7 ${m.status === 'done' || isPast ? 'text-[#334155]' : 'text-[#64748b]'}`}>
                    {m.desc}
                  </p>

                  <div className="flex items-center gap-3 mt-4 ml-7">
                    <span className="text-[10px] text-[#334155]">
                      {GRADE_LABEL[m.grade]} · {m.semester.charAt(0).toUpperCase() + m.semester.slice(1)}
                      {' · '}
                      {m.date.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    {m.divisions && (
                      <span className="text-[10px] text-[#2d3748]">
                        {m.divisions.join(' / ')} only
                      </span>
                    )}
                    {destination && !isPast && (
                      <button
                        onClick={() => navigate(destination)}
                        className="text-[10px] font-semibold text-[#eab308] ml-auto px-3 py-1.5 rounded-lg bg-[rgba(234,179,8,0.1)] hover:bg-[rgba(234,179,8,0.2)] transition-colors border border-[rgba(234,179,8,0.3)] hover:border-[rgba(234,179,8,0.5)]"
                      >
                        {m.actionLabel} →
                      </button>
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
