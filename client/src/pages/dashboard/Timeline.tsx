import { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
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
  const upNextRef = useRef<HTMLDivElement>(null)

  const currentGrade = getCurrentGrade(gradYear)
  const currentSemester = getCurrentSemester()

  const [done, setDone] = useState<Set<string>>(loadDone)
  const [showPast, setShowPast] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

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

  // Tailor by division and current grade.
  const all = useMemo(() => {
    return MILESTONES
      .filter((m) => !division || !m.divisions || m.divisions.includes(division))
      .map((m) => {
        const date = getMilestoneDate(gradYear, m.grade, m.semester)
        const isDone = done.has(m.id)
        const past = isMilestonePast(m.grade, m.semester, currentGrade, currentSemester)
        return {
          ...m,
          date,
          past,
          status: getMilestoneStatus(date, isDone) as 'done' | 'overdue' | 'soon' | 'future',
        }
      })
  }, [division, gradYear, done, currentGrade, currentSemester])

  // Past milestones still incomplete = "missed but recoverable"
  const pastIncomplete = all.filter((m) => m.past && m.status !== 'done')
  const pastDone = all.filter((m) => m.past && m.status === 'done')
  const upcoming = all.filter((m) => !m.past)

  // What renders depends on the toggle.
  const visible = showPast ? all : upcoming

  // Auto-scroll to "Up next" on first paint, but only when we're hiding past.
  useEffect(() => {
    if (!showPast) {
      setTimeout(() => upNextRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200)
    }
  }, [showPast])

  const completedCount = all.filter((m) => m.status === 'done').length
  const upcomingCount = upcoming.length
  const upcomingDone = upcoming.filter((m) => m.status === 'done').length
  const urgentCount = upcoming.filter((m) => m.status === 'overdue' || m.status === 'soon').length
  const progressPct = upcomingCount === 0 ? 100 : Math.round((upcomingDone / upcomingCount) * 100)

  const headerSubtitle = profile
    ? `${profile.name} · Class of ${gradYear} · ${division ?? 'Set division'} · Currently ${GRADE_LABEL[currentGrade]} year`
    : `Class of ${gradYear} · Set your profile to personalize this`

  return (
    <div className="kr-page max-w-3xl">
      <PageHeader
        eyebrow="Your journey"
        title={<>Recruiting <span className="kr-accent">timeline</span>.</>}
        lede={headerSubtitle}
      />

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Done so far', value: completedCount, color: 'var(--pitch-2)' },
          { label: 'Still ahead', value: upcomingCount - upcomingDone, color: 'var(--fg-0)' },
          { label: 'Action needed', value: urgentCount, color: 'var(--gold)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="kr-stat-card">
            <div className="kr-stat-num" style={{ color }}>{value}</div>
            <div className="kr-stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Progress (across remaining milestones, not whole life) */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-3">Progress on what's still ahead</span>
          <span className="font-mono text-[11px] tracking-[0.14em] text-ink-0">{progressPct}%</span>
        </div>
        <div className="h-[3px] bg-[rgba(245,241,232,0.06)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[linear-gradient(90deg,var(--gold-3),var(--gold))] rounded-full transition-[width] duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Past summary (collapsed) */}
      {(pastIncomplete.length > 0 || pastDone.length > 0) && (
        <button
          onClick={() => setShowPast((v) => !v)}
          className="w-full mb-6 flex items-center justify-between bg-[rgba(245,241,232,0.03)] border border-[rgba(245,241,232,0.08)] rounded-xl px-5 py-4 hover:bg-[rgba(245,241,232,0.05)] transition-colors text-left"
        >
          <div>
            <div className="text-sm font-bold text-[#f5f1e8] mb-0.5">
              {showPast ? 'Hide earlier years' : 'Earlier years'}
            </div>
            <div className="text-xs text-[#9a9385]">
              {pastDone.length} done
              {pastIncomplete.length > 0 && (
                <>
                  {' · '}
                  <span className="text-[#f0b65a] font-semibold">{pastIncomplete.length} you missed — still worth doing</span>
                </>
              )}
            </div>
          </div>
          <span className="text-[#f0b65a] text-xs font-semibold">{showPast ? '▲' : '▼'}</span>
        </button>
      )}

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-[rgba(245,241,232,0.08)]" />

        <div className="flex flex-col gap-0">
          {visible.map((m, i) => {
            const prev = visible[i - 1]
            const showGradeHeading = !prev || prev.grade !== m.grade
            const isUpNextAnchor = !showPast && i === 0
            const isExpanded = expanded === m.id

            const statusDot = {
              done: 'bg-[#4ade80] border-[#4ade80]',
              overdue: 'bg-[#f0b65a] border-[#f0b65a]',
              soon: 'bg-[#f0b65a] border-[#f0b65a] opacity-60',
              future: 'bg-transparent border-[rgba(245,241,232,0.20)]',
            }[m.status]

            const cardBorder = m.past
              ? 'border-[rgba(240,182,90,0.18)]'
              : {
                  done: 'border-[rgba(74,222,128,0.15)]',
                  overdue: 'border-[rgba(240,182,90,0.35)]',
                  soon: 'border-[rgba(240,182,90,0.18)]',
                  future: 'border-[rgba(245,241,232,0.08)]',
                }[m.status]

            const ringFocus = isExpanded ? 'ring-1 ring-[rgba(240,182,90,0.45)]' : ''

            return (
              <div key={m.id} className="relative pl-10 pb-4" ref={isUpNextAnchor ? upNextRef : null}>
                {showGradeHeading && (
                  <div className="text-xs font-bold tracking-[2px] uppercase mb-3 -ml-10 pl-10 text-[#475569]">
                    {GRADE_LABEL[m.grade]} Year
                  </div>
                )}

                <div className={`absolute left-[11px] top-[3px] w-[9px] h-[9px] rounded-full border-2 ${statusDot} z-10`} />

                <button
                  onClick={() => setExpanded((cur) => (cur === m.id ? null : m.id))}
                  className={`w-full text-left border ${cardBorder} ${ringFocus} rounded-xl p-5 bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(245,241,232,0.04)] transition-colors group`}
                >
                  {/* Top row: checkbox + title + chips */}
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span
                        role="checkbox"
                        aria-checked={m.status === 'done'}
                        tabIndex={0}
                        className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${
                          m.status === 'done'
                            ? 'bg-[#4ade80] border-[#4ade80]'
                            : 'border-[rgba(245,241,232,0.20)] group-hover:border-[rgba(240,182,90,0.45)]'
                        }`}
                        onClick={(e) => toggleDone(m.id, e)}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault()
                            toggleDone(m.id, e as unknown as React.MouseEvent)
                          }
                        }}
                      >
                        {m.status === 'done' && <span className="text-[10px] text-black font-bold">✓</span>}
                      </span>
                      <div className={`text-sm font-bold ${m.status === 'done' ? 'text-[#475569] line-through' : 'text-[#f5f1e8]'}`}>
                        {m.title}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {m.past && m.status !== 'done' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(240,182,90,0.18)] text-[#f0b65a]">
                          MISSED — DO NOW
                        </span>
                      )}
                      {!m.past && m.status === 'overdue' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(240,182,90,0.18)] text-[#f0b65a]">
                          ACTION NEEDED
                        </span>
                      )}
                      {!m.past && m.status === 'soon' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(240,182,90,0.08)] text-[#f0b65a]">
                          COMING UP
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold ${CATEGORY_META[m.category].color}`}>
                        {CATEGORY_META[m.category].label.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className={`text-xs leading-relaxed ml-7 ${m.status === 'done' ? 'text-[#475569]' : 'text-[#94a3b8]'}`}>
                    {m.desc}
                  </p>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 mt-3 ml-7">
                    <span className="text-[10px] text-[#475569]">
                      {GRADE_LABEL[m.grade]} · {m.semester.charAt(0).toUpperCase() + m.semester.slice(1)}
                      {' · '}
                      {m.date.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    {m.divisions && (
                      <span className="text-[10px] text-[#475569]">
                        {m.divisions.join(' / ')} only
                      </span>
                    )}
                    <span className="ml-auto text-[10px] font-semibold text-[#f0b65a]">
                      {isExpanded ? 'Hide steps ▲' : 'How to do this ▼'}
                    </span>
                  </div>

                  {/* Expansion: how-to + CTA */}
                  {isExpanded && (
                    <div className="mt-5 ml-7 border-t border-[rgba(245,241,232,0.06)] pt-5">
                      <div className="text-[11px] font-bold tracking-[2px] uppercase text-[#f0b65a] mb-3">
                        How to complete this
                      </div>
                      <ol className="space-y-2 mb-5">
                        {m.howTo.map((step, idx) => (
                          <li key={idx} className="flex gap-3 text-xs leading-relaxed text-[#cbd5e1]">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-[rgba(240,182,90,0.10)] border border-[rgba(240,182,90,0.35)] flex items-center justify-center text-[10px] font-bold text-[#f0b65a]">
                              {idx + 1}
                            </span>
                            <span className="pt-0.5">{step}</span>
                          </li>
                        ))}
                      </ol>

                      <div className="flex flex-wrap items-center gap-2">
                        {m.actionTo && m.actionLabel && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(m.actionTo!)
                            }}
                            className="text-xs font-bold px-4 py-2 rounded-lg bg-[#f0b65a] text-black hover:bg-[#ffd28a] transition-colors"
                          >
                            {m.actionLabel} →
                          </button>
                        )}
                        {m.externalLink && (
                          <a
                            href={m.externalLink.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-semibold px-4 py-2 rounded-lg bg-[rgba(245,241,232,0.04)] text-[#f5f1e8] hover:bg-[rgba(245,241,232,0.08)] transition-colors border border-[rgba(245,241,232,0.08)]"
                          >
                            {m.externalLink.label} ↗
                          </a>
                        )}
                        {m.status !== 'done' && (
                          <button
                            onClick={(e) => toggleDone(m.id, e)}
                            className="text-xs font-semibold px-4 py-2 rounded-lg bg-transparent text-[#94a3b8] hover:text-[#4ade80] transition-colors border border-[rgba(245,241,232,0.08)] hover:border-[rgba(74,222,128,0.4)]"
                          >
                            Mark done ✓
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {!profile && (
        <div className="mt-6 rounded-xl bg-[rgba(240,182,90,0.06)] border border-[rgba(240,182,90,0.18)] p-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-[#f0b65a] mb-0.5">Personalize this timeline</div>
            <div className="text-xs text-[#9a9385]">Add your grad year and target division to filter and date milestones accurately.</div>
          </div>
          <Link to="/dashboard/profile" className="no-underline">
            <button className="text-xs font-bold px-4 py-2 rounded-lg bg-[#f0b65a] text-black hover:bg-[#ffd28a] transition-colors whitespace-nowrap">
              Build Profile →
            </button>
          </Link>
        </div>
      )}
    </div>
  )
}
