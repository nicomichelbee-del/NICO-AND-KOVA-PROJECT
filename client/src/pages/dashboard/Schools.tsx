import { useEffect, useState } from 'react'
import { matchSchools, getProgramIntel, findCoach, type FindCoachResult } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import type { AthleteProfile, School, ProgramIntel, VideoRating } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

function getLatestVideoRating(): VideoRating | null {
  try {
    const raw = localStorage.getItem('latestVideoRating')
    return raw ? JSON.parse(raw) as VideoRating : null
  } catch { return null }
}

const catColor: Record<School['category'], 'blue' | 'gold' | 'green'> = {
  reach: 'blue', target: 'gold', safety: 'green',
}

const catDesc: Record<School['category'], string> = {
  reach: 'Your stats are below this program\'s typical recruit — worth reaching for',
  target: 'Your stats align well with this program\'s recruiting profile',
  safety: 'You would be a top recruit here — strong fit',
}

function formatMoney(n: number): string {
  if (n >= 10000) return `$${Math.round(n / 1000)}k`
  return `$${n.toLocaleString()}`
}

function formatAdmissionRate(rate: number): string {
  const pct = Math.round(rate * 100)
  const label = pct < 10 ? 'extremely selective'
              : pct < 25 ? 'very selective'
              : pct < 50 ? 'selective'
              : pct < 75 ? 'less selective'
              : 'open'
  return `${pct}% — ${label}`
}

type SortKey = 'match' | 'athletic' | 'academic' | 'cost' | 'size' | 'program' | 'gpa' | 'division' | 'name'

const SIZE_RANK: Record<NonNullable<School['size']>, number> = { small: 0, medium: 1, large: 2 }
const DIV_RANK: Record<School['division'], number> = { D1: 0, D2: 1, D3: 2, NAIA: 3, JUCO: 4 }

export function Schools() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | School['category']>('all')
  const [sort, setSort] = useState<SortKey>('match')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<School | null>(null)

  async function handleMatch() {
    const profile = getProfile()
    // Required fields. Without GPA + position the matcher returns garbage
    // (academic axis defaults to 0, position-based stats can't compute).
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    if (!profile.gender) { setError('Please set your gender (Men\'s/Women\'s) in your athlete profile.'); return }
    if (!profile.position) { setError('Please pick a position in your athlete profile — the matcher needs it for athletic fit.'); return }
    if (!profile.gpa || profile.gpa <= 0) { setError('Please enter your GPA in your athlete profile — it drives the academic fit calculation.'); return }
    if (!profile.targetDivision) { setError('Please pick a target division (D1/D2/D3/NAIA/JUCO) in your athlete profile.'); return }
    setError(''); setLoading(true)
    try {
      // Pull the latest highlight-video rating (if any) so per-school athletic
      // fit reflects what the AI actually saw on tape, not just GPA + goals.
      const video = getLatestVideoRating()
      const { schools } = await matchSchools(profile, video)
      setSchools(schools)
      localStorage.setItem('matchedSchools', JSON.stringify(schools))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to match schools')
    } finally { setLoading(false) }
  }

  const filtered = filter === 'all' ? schools : schools.filter((s) => s.category === filter)

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'desc' ? -1 : 1
    switch (sort) {
      case 'match':    return dir * (a.matchScore - b.matchScore)
      case 'athletic': return dir * ((a.athleticFit ?? 0) - (b.athleticFit ?? 0))
      case 'academic': return dir * ((a.academicFit ?? 0) - (b.academicFit ?? 0))
      // Cost: ascending direction = cheapest first. Schools without Scorecard
      // data sort to the end regardless of direction.
      case 'cost': {
        const aCost = a.costOfAttendance ?? Number.MAX_SAFE_INTEGER
        const bCost = b.costOfAttendance ?? Number.MAX_SAFE_INTEGER
        return dir * (aCost - bCost)
      }
      case 'size':     return dir * (SIZE_RANK[a.size] - SIZE_RANK[b.size]) || (a.enrollment - b.enrollment)
      case 'program':  return dir * ((a.programStrength ?? 0) - (b.programStrength ?? 0))
      case 'gpa':      return dir * ((a.gpaAvg ?? 0) - (b.gpaAvg ?? 0))
      case 'division': return dir * (DIV_RANK[a.division] - DIV_RANK[b.division]) || a.name.localeCompare(b.name)
      case 'name':     return dir * a.name.localeCompare(b.name)
    }
  })

  function setSortKey(k: SortKey) {
    if (sort === k) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSort(k)
      // Sensible default direction per axis: cost / name / division go
      // ascending (cheapest, A–Z); fits/scores/strength go descending.
      const ascByDefault = k === 'name' || k === 'division' || k === 'cost'
      setSortDir(ascByDefault ? 'asc' : 'desc')
    }
  }

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'match',    label: 'Match score' },
    { key: 'athletic', label: 'Athletic fit' },
    { key: 'academic', label: 'Academic fit' },
    { key: 'cost',     label: 'Cost' },
    { key: 'program',  label: 'Program strength' },
    { key: 'gpa',      label: 'Typical GPA' },
    { key: 'size',     label: 'School size' },
    { key: 'division', label: 'Division' },
    { key: 'name',     label: 'Name' },
  ]

  return (
    <div className="kr-page">
      <PageHeader
        eyebrow="School matcher"
        title={<>Your school <span className="kr-accent">matches</span>.</>}
        lede="Click any school for a full match breakdown and program details."
        aside={
          <Button onClick={handleMatch} disabled={loading}>
            {loading ? 'Matching…' : schools.length ? 'Rematch' : 'Find my schools'}
          </Button>
        }
      />

      {error && (
        <div className="mb-6 p-4 rounded-xl border border-[rgba(227,90,90,0.28)] bg-[rgba(227,90,90,0.08)] text-sm text-crimson-light">
          {error}
        </div>
      )}

      {schools.length > 0 && (
        <>
          <ProfileAssessment schools={schools} />

          <div className="grid grid-cols-3 gap-4 mb-8">
            {(['reach', 'target', 'safety'] as const).map((cat) => (
              <Card key={cat} className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant={catColor[cat]}>{cat.toUpperCase()}</Badge>
                  <span className="font-serif text-2xl font-black text-[#f5f1e8]">
                    {schools.filter((s) => s.category === cat).length}
                  </span>
                  <span className="text-xs text-[#9a9385]">schools</span>
                </div>
                <p className="text-xs text-[#9a9385] leading-relaxed">{catDesc[cat]}</p>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            {(['all', 'reach', 'target', 'safety'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full font-mono text-[10.5px] tracking-[0.16em] uppercase border transition-[border-color,background,color] ${
                  filter === f
                    ? 'bg-gold text-[#1a1304] border-gold'
                    : 'bg-transparent text-ink-2 border-[rgba(245,241,232,0.10)] hover:border-[rgba(240,182,90,0.45)] hover:text-ink-0'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="font-mono text-[10px] tracking-[0.20em] uppercase text-ink-3 mr-1">Sort by</span>
            {SORT_OPTIONS.map((opt) => {
              const active = sort === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => setSortKey(opt.key)}
                  className={`px-3 py-1.5 rounded-full font-mono text-[10.5px] tracking-[0.14em] uppercase border transition-[border-color,background,color] flex items-center gap-1 ${
                    active
                      ? 'bg-gold text-[#1a1304] border-gold'
                      : 'bg-transparent text-ink-2 border-[rgba(245,241,232,0.10)] hover:border-[rgba(240,182,90,0.45)] hover:text-ink-0'
                  }`}
                  title={active ? `Click to flip direction (currently ${sortDir === 'desc' ? 'high → low' : 'low → high'})` : undefined}
                >
                  {opt.label}
                  {active && <span className="text-[11px]">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-3">
            {sorted.map((school) => (
              <button
                key={school.id}
                onClick={() => setSelected(school)}
                className="text-left bg-[linear-gradient(180deg,rgba(31,27,40,0.82)_0%,rgba(24,20,32,0.82)_100%)] border border-[rgba(245,241,232,0.08)] rounded-2xl p-6 flex items-start gap-6 transition-[transform,border-color,box-shadow] duration-200 hover:border-[rgba(240,182,90,0.45)] hover:-translate-y-[2px] hover:shadow-[0_12px_30px_rgba(0,0,0,0.30)] cursor-pointer group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="font-medium text-ink-0 text-[16px] tracking-[-0.005em]">{school.name}</span>
                    <Badge variant={catColor[school.category]}>{school.category}</Badge>
                    <Badge variant="muted">{school.division}</Badge>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-[10.5px] tracking-[0.14em] uppercase text-ink-3 flex-wrap mb-3">
                    <span>{school.location}</span>
                    <span className="text-ink-3/60">·</span>
                    <span>{school.enrollment.toLocaleString()} students</span>
                    {school.conference && <>
                      <span className="text-ink-3/60">·</span>
                      <span>{school.conference}</span>
                    </>}
                  </div>

                  {/* Two-axis fit bars: lets the user see at a glance *why* this is reach/target/safety */}
                  {(school.athleticFit != null || school.academicFit != null) && (
                    <div className="flex gap-4 mb-2.5 max-w-md">
                      <FitBar label="Athletic" value={school.athleticFit ?? 50} />
                      <FitBar label="Academic" value={school.academicFit ?? 50} />
                    </div>
                  )}

                  {/* Top 2 reasons — the rest live in the modal */}
                  {school.reasons && school.reasons.length > 0 && (
                    <ul className="flex flex-col gap-0.5 mt-1">
                      {school.reasons.slice(0, 2).map((r, i) => (
                        <li key={i} className="text-xs text-[#94a3b8] leading-relaxed flex gap-1.5">
                          <span className="text-[#f0b65a] flex-shrink-0">›</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="text-right flex-shrink-0 pt-1">
                  <div className="font-serif text-[34px] leading-none text-gold tabular-nums" style={{ fontVariationSettings: '"opsz" 144' }}>{school.matchScore.toFixed(1)}</div>
                  <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-3 mt-1.5">match score</div>
                </div>
                <div className="text-ink-2 text-lg flex-shrink-0 pt-2 group-hover:text-gold group-hover:translate-x-0.5 transition-[color,transform]">→</div>
              </button>
            ))}
          </div>
        </>
      )}

      {!loading && schools.length === 0 && !error && (
        <Card className="p-12 md:p-16 text-center">
          <span className="kr-eyebrow justify-center">Step 02 · Match</span>
          <h2 className="kr-h2 mt-4">Find your <span className="kr-accent">schools</span>.</h2>
          <p className="text-[15px] text-ink-1 mt-3 mb-7 max-w-md mx-auto leading-[1.6]">
            We rank 2,500+ programs against your stats, academics, and division goal — then surface the 25 strongest matches.
          </p>
          <Button onClick={handleMatch} disabled={loading}>Find my schools</Button>
        </Card>
      )}

      {selected && <SchoolDetailModal school={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function SchoolDetailModal({ school, onClose }: { school: School; onClose: () => void }) {
  const profile = getProfile()
  const gender: 'mens' | 'womens' = profile?.gender ?? 'womens'
  const [intel, setIntel] = useState<ProgramIntel | null>(null)
  const [intelLoading, setIntelLoading] = useState(false)
  const [intelError, setIntelError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIntelLoading(true); setIntelError('')
    getProgramIntel(school.id, gender)
      .then((res) => { if (!cancelled) setIntel(res.intel) })
      .catch((e) => { if (!cancelled) setIntelError(e instanceof Error ? e.message : 'Failed to load program intel') })
      .finally(() => { if (!cancelled) setIntelLoading(false) })
    return () => { cancelled = true }
  }, [school.id, gender])

  async function handleRefresh() {
    setRefreshing(true); setIntelError('')
    try {
      const res = await getProgramIntel(school.id, gender, true)
      setIntel(res.intel)
    } catch (e) {
      setIntelError(e instanceof Error ? e.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[linear-gradient(180deg,rgba(31,27,40,0.98)_0%,rgba(20,16,26,0.98)_100%)] border border-[rgba(240,182,90,0.30)] rounded-2xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto scrollbar-hide shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-[rgba(20,16,26,0.92)] backdrop-blur-md border-b border-[rgba(245,241,232,0.08)] px-7 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0 pr-12">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant={catColor[school.category]}>{school.category}</Badge>
              <Badge variant="muted">{school.division}</Badge>
              {school.conference && <Badge variant="muted">{school.conference}</Badge>}
            </div>
            <h2 className="kr-h2">{school.name}</h2>
            <p className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-ink-3 mt-2">{school.location}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-serif text-[40px] leading-none text-gold tabular-nums" style={{ fontVariationSettings: '"opsz" 144' }}>{school.matchScore.toFixed(1)}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3 mt-2">match</div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[rgba(245,241,232,0.05)] hover:bg-[rgba(245,241,232,0.10)] text-[#9a9385] hover:text-[#f5f1e8] flex items-center justify-center text-lg"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-7 py-6 flex flex-col gap-6">
          {/* Why this is a {bucket} — full reasons list */}
          {school.reasons && school.reasons.length > 0 && (
            <section>
              <h3 className="text-[11px] font-bold text-[#9a9385] tracking-[2px] uppercase mb-3">
                Why this is a {school.category}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {school.reasons.map((r, i) => (
                  <li key={i} className="text-sm text-[#cbd5e1] leading-relaxed flex gap-2">
                    <span className="text-[#f0b65a] flex-shrink-0">›</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* General info */}
          <section>
            <h3 className="text-[11px] font-bold text-[#9a9385] tracking-[2px] uppercase mb-3">Program Info</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Region" value={school.region} />
              <InfoRow label="Size" value={`${school.size} (${school.enrollment.toLocaleString()} students)`} />
              <InfoRow label="Conference" value={school.conference || '—'} />
              <InfoRow label="Scholarships" value={school.scholarships ? 'Yes' : school.division === 'D3' ? 'No (D3)' : '—'} />
              {school.programStrength != null && (
                <InfoRow label="Program strength" value={`${school.programStrength}/10`} />
              )}
              {school.gpaAvg != null && school.gpaAvg > 0 && (
                <InfoRow label="Typical recruit GPA" value={school.gpaAvg.toFixed(1)} />
              )}
              {school.admissionRate != null && (
                <InfoRow label="Acceptance rate" value={formatAdmissionRate(school.admissionRate)} />
              )}
              {school.satMid != null && school.satMid > 0 && (
                <InfoRow
                  label="SAT (avg)"
                  value={
                    school.sat25 && school.sat75
                      ? `${school.satMid} (range ${school.sat25}–${school.sat75})`
                      : String(school.satMid)
                  }
                />
              )}
              {school.costOfAttendance != null && school.costOfAttendance > 0 && (
                <InfoRow label="Cost of attendance" value={formatMoney(school.costOfAttendance)} />
              )}
              {school.tuitionInState != null && school.tuitionOutOfState != null
                && school.tuitionInState !== school.tuitionOutOfState && (
                <InfoRow
                  label="Tuition"
                  value={`${formatMoney(school.tuitionInState)} in-state · ${formatMoney(school.tuitionOutOfState)} out`}
                />
              )}
              {school.pellGrantRate != null && (
                <InfoRow label="Pell grant rate" value={`${(school.pellGrantRate * 100).toFixed(0)}% of students`} />
              )}
            </div>
            {school.notes && (
              <p className="text-sm text-[#cbd5e1] mt-4 leading-relaxed italic border-l-2 border-[#f0b65a] pl-4">
                {school.notes}
              </p>
            )}
          </section>

          {/* Roster signal: live-scraped open spots at the athlete's position */}
          {school.rosterSignal && <RosterSection signal={school.rosterSignal} />}

          {/* Match breakdown */}
          {school.breakdown && (
            <section>
              <h3 className="text-[11px] font-bold text-[#9a9385] tracking-[2px] uppercase mb-3">Match Breakdown</h3>
              <div className="flex flex-col gap-3">
                <BreakdownRow
                  label="Academics (GPA)"
                  score={school.breakdown.gpa.score}
                  detail={`Yours: ${school.breakdown.gpa.yourValue.toFixed(2)} • Typical: ${school.breakdown.gpa.typicalValue.toFixed(1)}`}
                  verdict={school.breakdown.gpa.verdict}
                />
                {school.breakdown.stats && (
                  <BreakdownRow
                    label="On-field stats (goals)"
                    score={school.breakdown.stats.score}
                    detail={`Yours: ${school.breakdown.stats.yourValue} • Typical: ${school.breakdown.stats.typicalValue}`}
                    verdict={school.breakdown.stats.verdict}
                  />
                )}
                <BreakdownRow
                  label="Division alignment"
                  score={school.breakdown.division.score}
                  detail={`Your target: ${school.breakdown.division.yourTarget} • School: ${school.breakdown.division.schoolDivision}`}
                  verdict={school.breakdown.division.verdict}
                />
                <BreakdownRow
                  label="Region fit"
                  score={school.breakdown.region.score}
                  detail={`Your pref: ${school.breakdown.region.yourPref} • School: ${school.breakdown.region.schoolRegion}`}
                  verdict={school.breakdown.region.verdict}
                />
                <BreakdownRow
                  label="School size fit"
                  score={school.breakdown.size.score}
                  detail={`Your pref: ${school.breakdown.size.yourPref} • School: ${school.breakdown.size.schoolSize}`}
                  verdict={school.breakdown.size.verdict}
                />
              </div>
            </section>
          )}

          {/* Program intel: tactics, formation, search-driven film links */}
          <section>
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <h3 className="text-[11px] font-bold text-[#9a9385] tracking-[2px] uppercase">Program Intel</h3>
              {intel && (
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="text-[10px] uppercase tracking-widest text-[#9a9385] hover:text-[#f0b65a] disabled:opacity-50"
                >
                  {refreshing ? 'Refreshing…' : '↻ Re-research'}
                </button>
              )}
            </div>

            {intelLoading && !intel && (
              <p className="text-xs text-[#9a9385] py-3">Researching {gender === 'womens' ? "women's" : "men's"} program tactics…</p>
            )}
            {intelError && !intel && (
              <p className="text-xs text-red-400 py-3">{intelError}</p>
            )}
            {intel && <ProgramIntelView intel={intel} />}
          </section>

          <CoachSection school={school} gender={gender} />
        </div>
      </div>
    </div>
  )
}

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  scraped:         { label: '✓ Official site',          color: 'text-[#4ade80]' },
  'scraped-partial': { label: '⚠️ Verify email',        color: 'text-[#fbbf24]' },
  'email-inferred': { label: '⚠️ Inferred email — verify', color: 'text-[#fbbf24]' },
  'ai-recall':     { label: '⚠️ Verify before sending', color: 'text-[#fbbf24]' },
}

function getHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

function CoachSection({ school, gender }: { school: School; gender: 'mens' | 'womens' }) {
  // Coaches change frequently — fetch live on demand, scraped DB first then AI.
  const [lookup, setLookup] = useState<FindCoachResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLookup() {
    setLoading(true); setError('')
    try {
      const res = await findCoach(school.name, school.division, gender)
      setLookup(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h3 className="text-[11px] font-bold text-[#9a9385] tracking-[2px] uppercase mb-3">Head Coach</h3>
      {!lookup ? (
        <div className="bg-[rgba(245,241,232,0.04)] rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs text-[#94a3b8] leading-relaxed">
              We don't store coach contact info — coaches change jobs and stored data goes stale.
              Look up the current head coach for the {gender === 'womens' ? "women's" : "men's"} program below.
            </div>
            {error && <div className="text-xs text-red-400 mt-1">{error}</div>}
          </div>
          <button
            onClick={handleLookup}
            disabled={loading}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[rgba(240,182,90,0.12)] border border-[rgba(240,182,90,0.45)] text-[#f0b65a] hover:bg-[rgba(234,179,8,0.18)] disabled:opacity-50 flex-shrink-0"
          >
            {loading ? 'Looking up…' : '🔍 Look up coach'}
          </button>
        </div>
      ) : (
        <div className={`rounded-lg px-4 py-3 text-sm border ${
          lookup.source === 'scraped'
            ? 'bg-[rgba(74,222,128,0.05)] border-[rgba(74,222,128,0.25)]'
            : 'bg-[rgba(251,191,36,0.05)] border-[rgba(251,191,36,0.25)]'
        }`}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="font-semibold text-[#f5f1e8]">{lookup.coachName || 'Head Coach'}</div>
            {lookup.source && SOURCE_BADGE[lookup.source] && (
              <span className={`text-[10px] uppercase tracking-widest ${SOURCE_BADGE[lookup.source].color}`}>
                {SOURCE_BADGE[lookup.source].label}
              </span>
            )}
          </div>
          {lookup.coachEmail ? (
            <a href={`mailto:${lookup.coachEmail}`} className="text-xs text-[#f0b65a] hover:underline">
              {lookup.coachEmail}
            </a>
          ) : (
            <a
              href={lookup.sourceUrl ?? `https://www.google.com/search?q=${encodeURIComponent(`${school.name} ${gender === 'womens' ? "women's" : "men's"} soccer head coach email`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#60a5fa] hover:underline"
            >
              {lookup.sourceUrl ? 'Find email on official roster page ↗' : 'Email unknown — search the official roster page ↗'}
            </a>
          )}
          {lookup.sourceUrl && (
            <div className="mt-1">
              <a
                href={lookup.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[#475569] hover:text-[#94a3b8]"
              >
                Source: {getHostname(lookup.sourceUrl!)} ↗
              </a>
            </div>
          )}
          <button
            onClick={handleLookup}
            disabled={loading}
            className="text-[10px] uppercase tracking-widest text-[#9a9385] hover:text-[#f0b65a] mt-2 disabled:opacity-50"
          >
            {loading ? '…' : '↻ Re-check'}
          </button>
        </div>
      )}
    </section>
  )
}

function ProgramIntelView({ intel }: { intel: ProgramIntel }) {
  const conf = intel.confidence
  const confColor =
    conf === 'high' ? 'bg-[rgba(74,222,128,0.12)] border-[rgba(74,222,128,0.3)] text-[#4ade80]' :
    conf === 'medium' ? 'bg-[rgba(240,182,90,0.12)] border-[rgba(240,182,90,0.35)] text-[#f0b65a]' :
    'bg-[rgba(248,113,113,0.1)] border-[rgba(248,113,113,0.3)] text-[#f87171]'
  const confLabel =
    conf === 'high' ? 'High confidence — specific recent knowledge' :
    conf === 'medium' ? 'Medium confidence — general / conference-level knowledge' :
    'Low confidence — limited public info, verify everything below'

  return (
    <div className="flex flex-col gap-4">
      <div className={`rounded-lg border px-3 py-2 text-[11px] font-semibold ${confColor}`}>
        {confLabel}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InfoRow label="Primary formation" value={intel.formation || 'Unknown'} />
        {intel.formationVariants && intel.formationVariants.length > 0 && (
          <InfoRow label="Variants" value={intel.formationVariants.join(', ')} />
        )}
      </div>

      {intel.playstyle && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#9a9385] mb-1">Playstyle</div>
          <p className="text-sm text-[#cbd5e1] leading-relaxed">{intel.playstyle}</p>
        </div>
      )}

      {intel.tacticalNotes.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#9a9385] mb-1.5">Tactical tendencies</div>
          <ul className="flex flex-col gap-1.5">
            {intel.tacticalNotes.map((note, i) => (
              <li key={i} className="text-sm text-[#cbd5e1] leading-relaxed flex gap-2">
                <span className="text-[#f0b65a] flex-shrink-0">›</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {intel.recentForm && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#9a9385] mb-1">Recent form</div>
          <p className="text-sm text-[#cbd5e1]">{intel.recentForm}</p>
        </div>
      )}

      {intel.staffStability && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#9a9385] mb-1">Coaching staff</div>
          <p className="text-sm text-[#cbd5e1]">{intel.staffStability}</p>
        </div>
      )}

      {intel.recruitingProfile && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#9a9385] mb-1">Recruiting profile</div>
          <p className="text-sm text-[#cbd5e1]">{intel.recruitingProfile}</p>
        </div>
      )}

      {/* Film & verification links: real searches, never fabricated URLs. */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-[#9a9385] mb-1.5">Watch film & verify</div>
        <div className="flex flex-wrap gap-2">
          {intel.searchQueries.map((q) => (
            <a
              key={q.url}
              href={q.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-lg bg-[rgba(240,182,90,0.08)] border border-[rgba(240,182,90,0.30)] text-[#f0b65a] hover:bg-[rgba(240,182,90,0.18)]"
            >
              {q.label} ↗
            </a>
          ))}
        </div>
        <p className="text-[11px] text-[#9a9385] mt-2 italic">
          We don't fabricate video URLs — these open real, current search results so you see actual film, not dead links.
        </p>
      </div>

      {intel.caveats.length > 0 && (
        <div className="rounded-lg border border-[rgba(245,241,232,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
          <div className="text-[10px] uppercase tracking-widest text-[#9a9385] mb-1.5">⚠️ Caveats</div>
          <ul className="flex flex-col gap-1">
            {intel.caveats.map((c, i) => (
              <li key={i} className="text-xs text-[#94a3b8] leading-relaxed">• {c}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-[#9a9385] italic">
        AI-generated tactical analysis based on publicly available information through {new Date(intel.cachedAt).toLocaleDateString()}. Always confirm with the coach.
      </p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-[#9a9385]">{label}</span>
      <span className="text-sm text-[#f5f1e8] capitalize">{value}</span>
    </div>
  )
}

// Top-of-page summary that interprets the athlete's full match list.
// Tells them which axis is currently their strength vs. their stretch and
// where the average match lands financially. The numbers come from data
// the matcher already produced — no extra computation cost.
function ProfileAssessment({ schools }: { schools: School[] }) {
  if (schools.length === 0) return null
  const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
  const ath = Math.round(avg(schools.map((s) => s.athleticFit ?? 50)) * 10) / 10
  const acad = Math.round(avg(schools.map((s) => s.academicFit ?? 50)) * 10) / 10
  const costs = schools.map((s) => s.costOfAttendance).filter((c): c is number => c != null && c > 0)
  const medianCost = costs.length
    ? Math.round([...costs].sort((a, b) => a - b)[Math.floor(costs.length / 2)] / 1000)
    : null

  // Interpret the imbalance.
  const diff = ath - acad
  let headline: string
  if (Math.abs(diff) < 8) {
    headline = 'Your athletic and academic profile are well-balanced across these matches.'
  } else if (diff >= 8) {
    headline = 'Your athletic profile leads — these matches lean on play first; lift academics to widen the funnel.'
  } else {
    headline = 'Your academic profile leads — coaches will be reading your transcript before your highlights.'
  }

  return (
    <Card className="p-6 mb-6 bg-gradient-to-br from-[rgba(240,182,90,0.06)] to-[rgba(255,255,255,0.02)]">
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex-1 min-w-[280px]">
          <div className="text-[10px] uppercase tracking-widest text-[#f0b65a] font-bold mb-1.5">Your match read</div>
          <p className="text-sm text-[#cbd5e1] leading-relaxed">{headline}</p>
          {medianCost != null && (
            <p className="text-xs text-[#9a9385] mt-2">
              Median cost of attendance across your {schools.length} matches: <span className="text-[#cbd5e1] font-semibold">${medianCost}k/yr</span>
            </p>
          )}
        </div>
        <div className="flex gap-5 min-w-[260px]">
          <div className="flex-1">
            <FitBar label="Avg Athletic" value={ath} />
          </div>
          <div className="flex-1">
            <FitBar label="Avg Academic" value={acad} />
          </div>
        </div>
      </div>
    </Card>
  )
}

function RosterSection({ signal }: { signal: NonNullable<School['rosterSignal']> }) {
  // Color the open-spots count by signal strength so the user gets an
  // at-a-glance read on how recruitable the position is.
  const opens = signal.openSpots
  const color = opens >= 4 ? 'text-[#4ade80]' : opens >= 2 ? 'text-[#f0b65a]' : 'text-[#f87171]'
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-[11px] font-bold text-[#9a9385] tracking-[2px] uppercase">Roster &amp; Open Spots</h3>
        <span className="text-[10px] text-[#9a9385]">live-scraped from the team's roster page</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-[#9a9385]">At your position</span>
          <span className="text-xl font-serif font-black text-[#f5f1e8]">{signal.totalAtPosition}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-[#9a9385]">Graduating</span>
          <span className="text-xl font-serif font-black text-[#f5f1e8]">{signal.graduatingByYear}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-[#9a9385]">Juniors</span>
          <span className="text-xl font-serif font-black text-[#f5f1e8]">{signal.juniorsAtPosition}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-[#9a9385]">Est. open spots</span>
          <span className={`text-xl font-serif font-black ${color}`}>{signal.openSpots}</span>
        </div>
      </div>
      <p className="text-[11px] text-[#9a9385] italic mt-3 leading-relaxed">
        Estimated openings = current seniors + juniors at your position (will graduate within ~2 years).
        Total roster: {signal.totalRoster} players. Coaches actively recruit positions where players are aging out.
      </p>
    </section>
  )
}

function FitBar({ label, value }: { label: string; value: number }) {
  // Color thresholds match the buckets:
  //   ≥70 = green (safety zone)  ≥45 = yellow (target)  else red (reach)
  const color = value >= 70 ? 'bg-[#4ade80]' : value >= 45 ? 'bg-[#f0b65a]' : 'bg-[#f87171]'
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-widest text-[#9a9385]">{label}</span>
        <span className="text-[11px] font-semibold text-[#cbd5e1] tabular-nums">{value.toFixed(1)}</span>
      </div>
      <div className="h-1 bg-[rgba(245,241,232,0.06)] rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function BreakdownRow({ label, score, detail, verdict }: { label: string; score: number; detail: string; verdict: string }) {
  const color = score >= 75 ? 'bg-[#4ade80]' : score >= 50 ? 'bg-[#f0b65a]' : 'bg-[#f87171]'
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5 gap-2">
        <span className="text-sm font-semibold text-[#f5f1e8]">{label}</span>
        <span className="text-xs text-[#9a9385]">{detail}</span>
        <span className="font-serif font-black text-[#f0b65a] text-sm tabular-nums">{score}</span>
      </div>
      <div className="h-1.5 bg-[rgba(245,241,232,0.06)] rounded-full overflow-hidden mb-1.5">
        <div className={`h-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <p className="text-xs text-[#94a3b8] leading-relaxed">{verdict}</p>
    </div>
  )
}
