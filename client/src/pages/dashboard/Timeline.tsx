import { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { useProfile } from '../../context/ProfileContext'
import type { Division } from '../../types'
import {
  MILESTONES, CATEGORY_META, GRADE_LABEL,
  getMilestoneDate, getMilestoneStatus, loadDone, DONE_KEY,
  getCurrentGrade, getCurrentSemester, isMilestonePast,
  type Grade,
} from '../../data/milestones'

const GRADES: Grade[] = ['freshman', 'sophomore', 'junior', 'senior']

export function Timeline() {
  const { profile } = useProfile()
  const hasProfile = !!profile?.graduation_year
  const gradYear = profile?.graduation_year ?? (new Date().getFullYear() + 2)
  const division = (profile?.desired_division_levels?.[0] as Division | undefined) ?? undefined
  const athleteName = profile?.full_name ?? null
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

  const headerSubtitle = hasProfile
    ? `${athleteName ? `${athleteName} · ` : ''}Class of ${gradYear} · ${division ?? 'Set division'} · Currently ${GRADE_LABEL[currentGrade]} year`
    : `Class of ${gradYear} · Set your profile to personalize this`

  // Year quick-jump: count milestones per grade for the active filter so the
  // pill row reflects what's actually in view.
  const countsByGrade = useMemo(() => {
    const counts: Record<Grade, { total: number; done: number }> = {
      freshman: { total: 0, done: 0 },
      sophomore: { total: 0, done: 0 },
      junior: { total: 0, done: 0 },
      senior: { total: 0, done: 0 },
    }
    for (const m of all) {
      counts[m.grade].total += 1
      if (m.status === 'done') counts[m.grade].done += 1
    }
    return counts
  }, [all])

  function jumpToGrade(grade: Grade) {
    // The earlier-years section is collapsed by default; if the user jumps to a
    // past year we expand it so the target is visible.
    const order: Record<Grade, number> = { freshman: 0, sophomore: 1, junior: 2, senior: 3 }
    if (order[grade] < order[currentGrade] && !showPast) setShowPast(true)
    requestAnimationFrame(() => {
      const el = document.getElementById(`grade-${grade}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  // School year span text (e.g., "2025 – 2026" for freshman of class 2029).
  const schoolYearSpan = (grade: Grade) => {
    const start = { freshman: gradYear - 4, sophomore: gradYear - 3, junior: gradYear - 2, senior: gradYear - 1 }[grade]
    return `${start} – ${start + 1}`
  }

  // Up-next: first non-done upcoming milestone (used for the highlight banner).
  const upNext = upcoming.find((m) => m.status !== 'done')

  return (
    <div className="kr-page max-w-3xl">
      <PageHeader
        eyebrow="Your journey"
        title={<>Recruiting <span className="kr-accent">timeline</span>.</>}
        lede={headerSubtitle}
      />

      {/* Stat ribbon — single panel, three columns, vertical dividers. */}
      <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[linear-gradient(180deg,rgba(31,27,40,0.82)_0%,rgba(24,20,32,0.82)_100%)] mb-6 overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-[rgba(245,241,232,0.06)]">
          {[
            { label: 'Done so far', value: completedCount, tint: 'text-[#4ade80]' },
            { label: 'Still ahead', value: upcomingCount - upcomingDone, tint: 'text-[#f5f1e8]' },
            { label: 'Action needed', value: urgentCount, tint: urgentCount > 0 ? 'text-[#f0b65a]' : 'text-[#475569]' },
          ].map(({ label, value, tint }) => (
            <div key={label} className="px-5 py-4 flex flex-col items-start">
              <span className="font-mono text-[9.5px] tracking-[0.20em] uppercase text-ink-3 mb-1.5">{label}</span>
              <span
                className={`font-serif text-[34px] leading-none tabular-nums ${tint}`}
                style={{ fontVariationSettings: '"opsz" 144' }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
        {/* Inline progress strip lives at the bottom of the ribbon. */}
        <div className="px-5 py-3.5 border-t border-[rgba(245,241,232,0.06)] bg-[rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-3">Progress on what's ahead</span>
            <span className="font-mono text-[10.5px] tracking-[0.10em] text-ink-0">{progressPct}%</span>
          </div>
          <div className="h-[3px] bg-[rgba(245,241,232,0.06)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[linear-gradient(90deg,var(--gold-3),var(--gold))] rounded-full transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Year quick-jump pills */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        {GRADES.map((g) => {
          const c = countsByGrade[g]
          const isCurrent = g === currentGrade
          const allDone = c.total > 0 && c.done === c.total
          return (
            <button
              key={g}
              onClick={() => jumpToGrade(g)}
              className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-[11px] font-mono tracking-[0.10em] uppercase transition-colors ${
                isCurrent
                  ? 'bg-[rgba(240,182,90,0.10)] border-[rgba(240,182,90,0.55)] text-[#f5f1e8] shadow-[0_0_0_3px_rgba(240,182,90,0.10)]'
                  : 'bg-[rgba(245,241,232,0.02)] border-[rgba(245,241,232,0.10)] text-ink-2 hover:border-[rgba(240,182,90,0.40)] hover:text-ink-0'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-[#f0b65a]' : allDone ? 'bg-[#4ade80]' : 'bg-[rgba(245,241,232,0.20)]'}`} />
              <span className="font-medium">{GRADE_LABEL[g]}</span>
              <span className="text-[10px] tracking-normal text-ink-3">{c.done}/{c.total}</span>
            </button>
          )
        })}
      </div>

      {/* Up-next highlight — only shown when there's an active milestone */}
      {upNext && !showPast && (
        <div className="mb-5 rounded-2xl border border-[rgba(240,182,90,0.28)] bg-[radial-gradient(600px_180px_at_0%_0%,rgba(240,182,90,0.10),transparent_60%),linear-gradient(180deg,rgba(31,27,40,0.85)_0%,rgba(24,20,32,0.85)_100%)] p-5">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#f0b65a]">Up next · {GRADE_LABEL[upNext.grade]} · {upNext.semester.charAt(0).toUpperCase() + upNext.semester.slice(1)}</span>
            <span className={`text-[10px] font-semibold ${CATEGORY_META[upNext.category].color}`}>
              {CATEGORY_META[upNext.category].label.toUpperCase()}
            </span>
          </div>
          <div className="text-[15px] font-bold text-[#f5f1e8] mb-1">{upNext.title}</div>
          <p className="text-xs text-[#94a3b8] leading-relaxed mb-3">{upNext.desc}</p>
          <div className="flex flex-wrap gap-2">
            {upNext.actionTo && upNext.actionLabel && (
              <button
                onClick={() => navigate(upNext.actionTo!)}
                className="text-xs font-bold px-3.5 py-2 rounded-lg bg-[#f0b65a] text-black hover:bg-[#ffd28a] transition-colors"
              >
                {upNext.actionLabel} →
              </button>
            )}
            <button
              onClick={() => setExpanded(upNext.id)}
              className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-[rgba(245,241,232,0.04)] text-[#f5f1e8] hover:bg-[rgba(245,241,232,0.08)] transition-colors border border-[rgba(245,241,232,0.08)]"
            >
              See steps
            </button>
          </div>
        </div>
      )}

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
        {/* Rail with subtle gradient */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-[linear-gradient(180deg,rgba(245,241,232,0.04)_0%,rgba(245,241,232,0.12)_50%,rgba(245,241,232,0.04)_100%)]" />

        <div className="flex flex-col gap-0">
          {visible.map((m, i) => {
            const prev = visible[i - 1]
            const showGradeHeading = !prev || prev.grade !== m.grade
            const isUpNextAnchor = !showPast && i === 0
            const isExpanded = expanded === m.id
            const isAtCurrent = m.grade === currentGrade && m.semester === currentSemester && m.status !== 'done'

            const statusDot = {
              done: 'bg-[#4ade80] border-[#4ade80]',
              overdue: 'bg-[#f0b65a] border-[#f0b65a]',
              soon: 'bg-[#f0b65a] border-[#f0b65a] opacity-60',
              future: 'bg-[rgba(20,16,28,1)] border-[rgba(245,241,232,0.20)]',
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
                  <div id={`grade-${m.grade}`} className="-ml-10 pl-10 mb-4 mt-2 first:mt-0">
                    <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-[rgba(245,241,232,0.08)]">
                      <div className="flex items-baseline gap-3">
                        <span className="font-serif text-[22px] leading-none text-[#f5f1e8]" style={{ fontVariationSettings: '"opsz" 144' }}>
                          {GRADE_LABEL[m.grade]}
                        </span>
                        <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-3">year</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] tracking-[0.10em] text-ink-3">{schoolYearSpan(m.grade)}</span>
                        {m.grade === currentGrade && (
                          <span className="text-[9px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 rounded bg-[rgba(240,182,90,0.15)] text-[#f0b65a] border border-[rgba(240,182,90,0.35)]">
                            You're here
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className={`absolute left-[11px] top-[3px] w-[9px] h-[9px] rounded-full border-2 ${statusDot} z-10 ${
                    isAtCurrent ? 'shadow-[0_0_0_4px_rgba(240,182,90,0.18)]' : ''
                  }`}
                />

                <button
                  onClick={() => setExpanded((cur) => (cur === m.id ? null : m.id))}
                  className={`w-full text-left border ${cardBorder} ${ringFocus} rounded-2xl p-5 ${
                    isAtCurrent
                      ? 'bg-[rgba(240,182,90,0.04)]'
                      : 'bg-[rgba(255,255,255,0.02)]'
                  } hover:bg-[rgba(245,241,232,0.05)] transition-colors group`}
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

      {!hasProfile && (
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
