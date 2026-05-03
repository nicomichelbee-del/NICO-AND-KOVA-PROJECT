import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProfile } from '../../context/ProfileContext'
import { Badge } from '../../components/ui/Badge'
import {
  MILESTONES, CATEGORY_META, getMilestoneDate, getMilestoneStatus, loadDone, getAthleteProfile,
  getCurrentGrade, isMilestonePast, getCurrentSemester,
} from '../../data/milestones'

/* ============================================================
   Cinematic Overview — kinetic stats, hero task, heatmap,
   coach activity feed, timeline panel.
   ============================================================ */

const STATUS_PRIORITY = { overdue: 0, soon: 1, future: 2, done: 3 }

function timeOfDayGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Burning the midnight oil'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function timeOfDayBadge(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Late · Quiet hours'
  if (h < 12) return 'Morning · Peak focus'
  if (h < 17) return 'Afternoon · Coaches active'
  return 'Evening · Wrap-up'
}

function useUpcomingMilestones(limit = 4) {
  const profile = getAthleteProfile()
  const gradYear = profile?.gradYear ?? (new Date().getFullYear() + 2)
  const division = profile?.targetDivision
  const done = loadDone()
  const currentGrade = getCurrentGrade(gradYear)
  const currentSemester = getCurrentSemester()

  return useMemo(() => MILESTONES
    .filter((m) => !(division && m.divisions && !m.divisions.includes(division)))
    .filter((m) => !isMilestonePast(m.grade, m.semester, currentGrade, currentSemester))
    .map((m) => {
      const date = getMilestoneDate(gradYear, m.grade, m.semester)
      const isDone = done.has(m.id)
      return { ...m, date, status: getMilestoneStatus(date, isDone) as 'done' | 'overdue' | 'soon' | 'future' }
    })
    .filter((m) => m.status !== 'done')
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status])
    .slice(0, limit), [division, gradYear, done, currentGrade, currentSemester, limit])
}

/* ----------------- Count-up hook ----------------- */
function useCountUp(target: number, duration = 1000, deps: unknown[] = []) {
  const [value, setValue] = useState(target > 0 ? 0 : target)
  const startedAt = useRef<number | null>(null)
  useEffect(() => {
    if (target <= 0) { setValue(target); return }
    let raf = 0
    function step(ts: number) {
      if (startedAt.current === null) startedAt.current = ts
      const elapsed = ts - startedAt.current
      const t = Math.min(1, elapsed / duration)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, ...deps])
  return value
}

/* ----------------- Sparkline ----------------- */
function Sparkline({ points, id }: { points: number[]; id: string }) {
  if (points.length < 2) return null
  const max = Math.max(...points, 1)
  const min = Math.min(...points)
  const range = Math.max(max - min, 1)
  const w = 100
  const h = 100
  const stepX = w / (points.length - 1)
  const path = points.map((p, i) => {
    const x = i * stepX
    const y = h - ((p - min) / range) * h
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  const fillPath = `${path} L ${w} ${h} L 0 ${h} Z`
  return (
    <div className="kr-stat-spark">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="fill" d={fillPath} fill={`url(#${id})`} />
        <path className="line" d={path} />
      </svg>
    </div>
  )
}

/* ----------------- Stat tile ----------------- */
type Tone = 'gold' | 'pitch' | 'crimson' | 'ivory'
interface StatTileProps {
  topLabel: string
  value: number
  ofTotal?: number
  label: string
  sub?: string
  tone: Tone
  spark: number[]
  delay?: number
}
function StatTile({ topLabel, value, ofTotal, label, sub, tone, spark, delay = 0 }: StatTileProps) {
  const v = useCountUp(value, 1000)
  const sparkId = `spark-${topLabel.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div
      className={`kr-stat-tile tone-${tone}`}
      style={{ animation: 'krReveal 600ms cubic-bezier(.2,.7,.2,1) backwards', animationDelay: `${delay}ms` }}
    >
      <div className="kr-stat-tile-top">
        <span className="kr-stat-tile-top-label" style={{ color: tone === 'gold' ? 'var(--gold)' : tone === 'pitch' ? 'var(--pitch-2)' : tone === 'crimson' ? 'var(--crimson-2)' : 'var(--fg-1)' }}>
          {topLabel}
        </span>
        <span style={{ fontSize: 9.5 }}>{value === 0 ? 'No data' : 'This month'}</span>
      </div>
      <div className="kr-stat-tile-num">
        <span className="kr-count">{v}</span>
        {typeof ofTotal === 'number' && <span className="kr-stat-tile-num-of">/ {ofTotal}</span>}
      </div>
      <div className="kr-stat-tile-label">{label}</div>
      {sub && <div className="kr-stat-tile-sub">{sub}</div>}
      <Sparkline points={spark} id={sparkId} />
    </div>
  )
}

/* ----------------- Heatmap ----------------- */
function Heatmap() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const rows = ['EMAIL', 'OPEN', 'REPLY', 'CAMP']
  // Synthetic but consistent activity grid
  const seed = (i: number, j: number) => {
    const v = ((i * 13 + j * 7) % 9) - 1
    return Math.max(0, Math.min(4, Math.round(v / 2)))
  }
  return (
    <div className="kr-heatmap">
      <div className="kr-heatmap-day">·</div>
      {days.map((d, i) => <div key={`d-${i}`} className="kr-heatmap-day text-center">{d}</div>)}
      {rows.map((label, ri) => (
        <RowGroup key={label} label={label} ri={ri} seed={seed} days={days} />
      ))}
    </div>
  )
}
function RowGroup({ label, ri, seed, days }: { label: string; ri: number; seed: (i: number, j: number) => number; days: string[] }) {
  return (
    <>
      <div className="kr-heatmap-day">{label}</div>
      {days.map((_, di) => {
        const lvl = seed(ri, di)
        return <div key={`${label}-${di}`} className={`kr-heatmap-cell ${lvl > 0 ? `l${lvl}` : ''}`} title={`${label} · ${days[di]}`} />
      })}
    </>
  )
}

/* ----------------- Coach feed ----------------- */
function CoachFeed() {
  const items = [
    'Coach Mendez (Stanford) opened your profile · 3m ago',
    'Coach Patel (UNC) viewed your highlight tape · 12m ago',
    'Wake Forest ID Camp · April 12 · spots filling',
    'New opening · D1 · GK · University of Portland',
    'Coach Murray (Williams) · replied · 22m ago',
    'Notre Dame staff viewed 14 profiles this week',
    'Roster portal · CB exit at SMU · 2 slots open',
  ]
  return (
    <div className="kr-coach-feed">
      <div className="kr-coach-feed-kicker">
        <span className="w-1.5 h-1.5 rounded-full bg-crimson-light" />
        Live · Coach activity
      </div>
      <div className="kr-coach-feed-row">
        <div className="kr-coach-feed-track">
          {[...items, ...items].map((t, i) => (
            <span key={i}>· {t.replace(/(\d+\s*m\s*ago|\d+\s*open|spots?\s*filling|opened|viewed|replied)/gi, (m) => `<b>${m}</b>`).split(/(<b>.*?<\/b>)/).map((part, k) => (
              part.startsWith('<b>') ? <b key={k}>{part.replace(/<\/?b>/g, '')}</b> : <span key={k}>{part}</span>
            ))}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Overview() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const navigate = useNavigate()
  const name = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'Athlete'
  const upcomingMilestones = useUpcomingMilestones()

  // Hero task — first incomplete onboarding step or first milestone
  const heroTask = profile?.profile_completed
    ? {
        eyebrow: 'On the clock · 12 min',
        title: 'Pick the first 12 schools to target.',
        body: 'AI ranks every program by athletic, academic, and cost fit. Approve a shortlist, then we draft the first batch of coach emails.',
        ctaLabel: 'Open School Matcher',
        ctaTo: '/dashboard/schools',
        meta: ['12 schools', '5 free', 'Athletic · Academic · Cost'],
      }
    : {
        eyebrow: 'On the clock · 6 min',
        title: 'Build your athlete profile.',
        body: 'Position, class year, club, GPA, highlight link. The base every coach sees first — and what powers your matches.',
        ctaLabel: 'Complete profile',
        ctaTo: '/onboarding/profile?edit=1',
        meta: ['6 minutes', '5 fields left', 'Required for matching'],
      }

  return (
    <div className="kr-page mx-auto">
      {/* Cinematic hero */}
      <section className="kr-cine-hero mb-8" data-reveal-on-load>
        <div className="kr-cine-hero-row">
          <div className="min-w-0">
            <div className="kr-cine-hero-time mb-4">
              <span className="live-dot" />
              {timeOfDayBadge()}
            </div>
            <h1 className="kr-h1">
              {timeOfDayGreeting()}, <span className="kr-accent">{name}</span>.
            </h1>
            <p className="text-[15.5px] text-ink-1 mt-3 max-w-[58ch] leading-[1.6]">
              One focused hour beats a busy week. Here's the move that matters today.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-ink-3">
              Recruiting setup
            </span>
            <div className="font-serif text-[34px] text-gold leading-none" style={{ letterSpacing: '-0.025em' }}>
              {profile?.profile_completed ? '43%' : '12%'}
            </div>
            <div className="w-44 h-1.5 rounded-full bg-[rgba(245,241,232,0.06)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--gold-3),var(--gold))]"
                style={{ width: profile?.profile_completed ? '43%' : '12%' }}
              />
            </div>
            <span className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-ink-3">
              {profile?.profile_completed ? '3 of 7 steps complete' : '1 of 7 steps complete'}
            </span>
          </div>
        </div>
      </section>

      {/* Coach feed ticker */}
      <div className="mb-8" data-reveal>
        <CoachFeed />
      </div>

      {/* Stat tiles — kinetic */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatTile
          topLabel="MATCHES"
          value={0} ofTotal={5}
          label="School matches"
          sub="Free tier · upgrade for unlimited"
          tone="gold"
          spark={[1, 2, 1, 3, 2, 4, 3, 5]}
          delay={0}
        />
        <StatTile
          topLabel="EMAILS"
          value={0} ofTotal={3}
          label="Emails generated"
          sub="3 free · personalized drafts"
          tone="ivory"
          spark={[0, 1, 0, 1, 2, 1, 2, 3]}
          delay={80}
        />
        <StatTile
          topLabel="CONTACTED"
          value={0}
          label="Coaches contacted"
          sub="Across all divisions"
          tone="pitch"
          spark={[0, 0, 1, 1, 2, 1, 2, 2]}
          delay={160}
        />
        <StatTile
          topLabel="REPLIES"
          value={0}
          label="Responses"
          sub="Opens · replies · visits"
          tone="crimson"
          spark={[0, 0, 0, 1, 0, 1, 1, 0]}
          delay={240}
        />
      </div>

      {/* Hero task — On the Clock */}
      <section className="mb-10">
        <div className="kr-hero-task" data-reveal>
          <div className="kr-hero-task-eyebrow">
            <span className="otc-line" />
            <span>{heroTask.eyebrow}</span>
            <span className="otc-line" />
          </div>
          <h2>
            {heroTask.title.split(' ').map((w, i) =>
              w.toLowerCase().includes('first') || w.toLowerCase().includes('athlete')
                ? <span key={i} className="kr-accent">{w} </span>
                : <span key={i}>{w} </span>,
            )}
          </h2>
          <p className="lede">{heroTask.body}</p>
          <div className="kr-hero-task-row">
            <button
              type="button"
              onClick={() => navigate(heroTask.ctaTo)}
              className="kbtn-like"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '14px 22px', borderRadius: 999,
                fontFamily: 'var(--kr-sans)', fontSize: 15, fontWeight: 600,
                background: 'linear-gradient(180deg, #f5c170 0%, #e0982e 100%)',
                color: '#1a1304', border: 'none', cursor: 'pointer',
                boxShadow: '0 1px 0 rgba(255,255,255,0.4) inset, 0 8px 22px rgba(240,182,90,0.25)',
                transition: 'transform 220ms ease, box-shadow 220ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)'; e.currentTarget.style.boxShadow = '0 0 0 8px rgba(240,182,90,0.16), 0 0 32px rgba(240,182,90,0.55)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 0 rgba(255,255,255,0.4) inset, 0 8px 22px rgba(240,182,90,0.25)'; }}
            >
              {heroTask.ctaLabel}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>
              </svg>
            </button>
            <Link
              to="/dashboard/timeline"
              className="font-mono text-[11px] tracking-[0.18em] uppercase text-ink-2 hover:text-gold transition-colors no-underline"
            >
              Skip · view full plan →
            </Link>
            <div className="kr-hero-task-meta">
              {heroTask.meta.map((m) => (
                <span key={m} className="kr-hero-task-meta-item">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                  </svg>
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Heatmap + Timeline split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-10">
        <section className="xl:col-span-1" data-reveal>
          <div className="kr-section-head">
            <div>
              <span className="kr-eyebrow">Activity heat</span>
              <h2 className="kr-h3 mt-2">Last <span className="kr-accent">7 days</span>.</h2>
            </div>
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-3">Email · open · reply · camp</span>
          </div>
          <Heatmap />
          <div className="mt-3 flex items-center justify-between font-mono text-[9.5px] tracking-[0.16em] uppercase text-ink-3">
            <span>Less</span>
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((l) => (
                <span key={l} className={`w-2.5 h-2.5 rounded-sm ${l === 0 ? 'bg-[rgba(245,241,232,0.04)] border border-[rgba(245,241,232,0.06)]' : `kr-heatmap-cell l${l}`}`} />
              ))}
            </div>
            <span>More</span>
          </div>
        </section>

        <section className="xl:col-span-2" data-reveal="right">
          <div className="kr-section-head">
            <div>
              <span className="kr-eyebrow">Timeline</span>
              <h2 className="kr-h3 mt-2">What's next on your <span className="kr-accent">calendar</span>.</h2>
            </div>
            <Link to="/dashboard/timeline" className="kr-link">Full plan →</Link>
          </div>

          <div className="kr-panel p-0 overflow-hidden">
            {upcomingMilestones.length === 0 ? (
              <div className="px-7 py-10 text-center text-[14px] text-ink-2">
                You're all caught up — no urgent milestones right now.
              </div>
            ) : (
              <div className="divide-y divide-[rgba(245,241,232,0.06)]">
                {upcomingMilestones.map((m) => {
                  const destination = m.actionTo ?? '/dashboard/timeline'
                  const dotClass = {
                    overdue: 'bg-crimson-light shadow-[0_0_10px_var(--crimson-2)]',
                    soon: 'bg-gold shadow-[0_0_10px_var(--gold)]',
                    future: 'bg-transparent border border-[rgba(245,241,232,0.30)]',
                    done: 'bg-pitch-light',
                  }[m.status]

                  return (
                    <button
                      key={m.id}
                      onClick={() => navigate(destination)}
                      className="w-full flex items-center gap-5 px-6 py-5 text-left hover:bg-[rgba(240,182,90,0.04)] transition-colors group"
                    >
                      <div className={`shrink-0 w-2.5 h-2.5 rounded-full ${dotClass}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-medium text-ink-0 truncate">{m.title}</div>
                        <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-ink-3 mt-1">
                          {m.grade} · {m.semester}
                          <span className="mx-2 text-ink-3">·</span>
                          {m.date.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {m.status === 'overdue' && <Badge variant="crimson">Action needed</Badge>}
                        {m.status === 'soon' && <Badge variant="gold">Coming up</Badge>}
                        <span className={`font-mono text-[10px] tracking-[0.18em] uppercase ${CATEGORY_META[m.category].color}`}>
                          {CATEGORY_META[m.category].label}
                        </span>
                        <span className="text-gold text-sm opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Upgrade banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[rgba(240,182,90,0.30)] p-7 flex items-center justify-between gap-6 flex-wrap"
        style={{
          background:
            'radial-gradient(700px 300px at 100% 0%, rgba(240,182,90,0.14), transparent 60%), ' +
            'linear-gradient(135deg, rgba(31,27,40,0.9), rgba(20,16,26,0.92))',
        }}
      >
        <div className="absolute -top-12 left-1/3 w-48 h-1 bg-[linear-gradient(90deg,transparent,rgba(240,182,90,0.4),transparent)] blur-md" />
        <div className="relative">
          <span className="kr-eyebrow">Pro tier · $19/mo</span>
          <h3 className="font-serif text-2xl text-ink-0 mt-3 leading-[1.1]" style={{ letterSpacing: '-0.02em' }}>
            Go <span className="kr-accent">unlimited</span>. Get the tracker, follow-ups, and Video Rater.
          </h3>
          <p className="text-[14px] text-ink-1 mt-2 max-w-[52ch]">
            Cheaper than one ID camp. Cancel anytime.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/signup')}
          className="relative px-6 py-3 rounded-full font-medium text-[14px] text-[#1a1304] bg-[linear-gradient(180deg,#f5c170_0%,#e0982e_100%)] hover:bg-[linear-gradient(180deg,#ffd28a_0%,#e8a23a_100%)] transition-[transform,box-shadow] shadow-[0_8px_22px_rgba(240,182,90,0.25)] hover:shadow-[0_0_0_8px_rgba(240,182,90,0.16),0_0_32px_rgba(240,182,90,0.55)] hover:-translate-y-[2px]"
        >
          Upgrade to Pro
        </button>
      </div>
    </div>
  )
}
