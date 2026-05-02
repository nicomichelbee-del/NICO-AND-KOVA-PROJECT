import { useEffect, useState } from 'react'
import { matchSchools, getProgramIntel, findCoach, type FindCoachResult } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import type { AthleteProfile, School, ProgramIntel } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
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

type SortKey = 'match' | 'size' | 'program' | 'gpa' | 'division' | 'name'

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
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    if (!profile.gender) { setError('Please set your gender (Men\'s/Women\'s) in your athlete profile.'); return }
    setError(''); setLoading(true)
    try {
      const { schools } = await matchSchools(profile)
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
      case 'match': return dir * (a.matchScore - b.matchScore)
      case 'size':  return dir * (SIZE_RANK[a.size] - SIZE_RANK[b.size]) || (a.enrollment - b.enrollment)
      case 'program': return dir * ((a.programStrength ?? 0) - (b.programStrength ?? 0))
      case 'gpa':   return dir * ((a.gpaAvg ?? 0) - (b.gpaAvg ?? 0))
      case 'division': return dir * (DIV_RANK[a.division] - DIV_RANK[b.division]) || a.name.localeCompare(b.name)
      case 'name':  return dir * a.name.localeCompare(b.name)
    }
  })

  function setSortKey(k: SortKey) {
    if (sort === k) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSort(k)
      // Sensible default direction per axis (e.g. match score: high→low; name: A→Z).
      setSortDir(k === 'name' || k === 'division' ? 'asc' : 'desc')
    }
  }

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'match', label: 'Match score' },
    { key: 'program', label: 'Program strength' },
    { key: 'gpa', label: 'Typical GPA' },
    { key: 'size', label: 'School size' },
    { key: 'division', label: 'Division' },
    { key: 'name', label: 'Name' },
  ]

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">School Matcher</span>
          </div>
          <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Your School Matches</h1>
          <p className="text-[#64748b] mt-2 text-sm">Click any school for a full match breakdown and program details.</p>
        </div>
        <Button onClick={handleMatch} disabled={loading}>
          {loading ? 'Matching...' : schools.length ? 'Rematch' : 'Find My Schools'}
        </Button>
      </div>

      {error && <div className="mb-6 p-4 bg-red-900/20 border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>}

      {schools.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {(['reach', 'target', 'safety'] as const).map((cat) => (
              <Card key={cat} className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant={catColor[cat]}>{cat.toUpperCase()}</Badge>
                  <span className="font-serif text-2xl font-black text-[#f1f5f9]">
                    {schools.filter((s) => s.category === cat).length}
                  </span>
                  <span className="text-xs text-[#64748b]">schools</span>
                </div>
                <p className="text-xs text-[#64748b] leading-relaxed">{catDesc[cat]}</p>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            {(['all', 'reach', 'target', 'safety'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${
                  filter === f
                    ? 'bg-[#eab308] text-black border-[#eab308]'
                    : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-[10px] font-bold text-[#64748b] tracking-[2px] uppercase mr-1">Sort by</span>
            {SORT_OPTIONS.map((opt) => {
              const active = sort === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => setSortKey(opt.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 ${
                    active
                      ? 'bg-[#eab308] text-black border-[#eab308]'
                      : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                  }`}
                  title={active ? `Click to flip direction (currently ${sortDir === 'desc' ? 'high → low' : 'low → high'})` : undefined}
                >
                  {opt.label}
                  {active && <span className="text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-3">
            {sorted.map((school) => (
              <button
                key={school.id}
                onClick={() => setSelected(school)}
                className="text-left bg-[rgba(255,255,255,0.03)] border border-[rgba(234,179,8,0.15)] rounded-2xl p-5 flex items-center gap-5 transition-all hover:border-[rgba(234,179,8,0.4)] hover:bg-[rgba(234,179,8,0.05)] cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-bold text-[#f1f5f9] text-sm">{school.name}</span>
                    <Badge variant={catColor[school.category]}>{school.category}</Badge>
                    <Badge variant="muted">{school.division}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#64748b] flex-wrap">
                    <span>📍 {school.location}</span>
                    <span>👥 {school.enrollment.toLocaleString()} students</span>
                    {school.conference && <span>🏆 {school.conference}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-serif text-2xl font-black text-[#eab308]">{school.matchScore}</div>
                  <div className="text-xs text-[#64748b]">match score</div>
                </div>
                <div className="text-[#64748b] text-lg flex-shrink-0">›</div>
              </button>
            ))}
          </div>
        </>
      )}

      {!loading && schools.length === 0 && !error && (
        <Card className="p-16 text-center">
          <div className="text-4xl mb-4">🎯</div>
          <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Find your schools</div>
          <p className="text-sm text-[#64748b] mb-6 max-w-xs mx-auto">
            Complete your athlete profile, then click "Find My Schools" to get matched to 25 real programs based on your GPA, stats, and division goal.
          </p>
          <Button onClick={handleMatch} disabled={loading}>Find My Schools</Button>
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
        className="bg-[#0f172a] border border-[rgba(234,179,8,0.25)] rounded-2xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto scrollbar-hide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#0f172a] border-b border-[rgba(255,255,255,0.07)] px-7 py-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge variant={catColor[school.category]}>{school.category.toUpperCase()}</Badge>
              <Badge variant="muted">{school.division}</Badge>
              {school.conference && <Badge variant="muted">{school.conference}</Badge>}
            </div>
            <h2 className="font-serif text-2xl font-black text-[#f1f5f9] tracking-[-0.5px]">{school.name}</h2>
            <p className="text-xs text-[#64748b] mt-1">📍 {school.location}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-serif text-3xl font-black text-[#eab308] leading-none">{school.matchScore}</div>
            <div className="text-[10px] uppercase tracking-widest text-[#64748b] mt-1">match</div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-[#64748b] hover:text-[#f1f5f9] flex items-center justify-center text-lg"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-7 py-6 flex flex-col gap-6">
          {/* General info */}
          <section>
            <h3 className="text-[11px] font-bold text-[#64748b] tracking-[2px] uppercase mb-3">Program Info</h3>
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
              <p className="text-sm text-[#cbd5e1] mt-4 leading-relaxed italic border-l-2 border-[#eab308] pl-4">
                {school.notes}
              </p>
            )}
          </section>

          {/* Match breakdown */}
          {school.breakdown && (
            <section>
              <h3 className="text-[11px] font-bold text-[#64748b] tracking-[2px] uppercase mb-3">Match Breakdown</h3>
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
              <h3 className="text-[11px] font-bold text-[#64748b] tracking-[2px] uppercase">Program Intel</h3>
              {intel && (
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="text-[10px] uppercase tracking-widest text-[#64748b] hover:text-[#eab308] disabled:opacity-50"
                >
                  {refreshing ? 'Refreshing…' : '↻ Re-research'}
                </button>
              )}
            </div>

            {intelLoading && !intel && (
              <p className="text-xs text-[#64748b] py-3">Researching {gender === 'womens' ? "women's" : "men's"} program tactics…</p>
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
      <h3 className="text-[11px] font-bold text-[#64748b] tracking-[2px] uppercase mb-3">Head Coach</h3>
      {!lookup ? (
        <div className="bg-[rgba(255,255,255,0.04)] rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
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
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[rgba(234,179,8,0.12)] border border-[rgba(234,179,8,0.4)] text-[#eab308] hover:bg-[rgba(234,179,8,0.18)] disabled:opacity-50 flex-shrink-0"
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
            <div className="font-semibold text-[#f1f5f9]">{lookup.coachName || 'Head Coach'}</div>
            {lookup.source && SOURCE_BADGE[lookup.source] && (
              <span className={`text-[10px] uppercase tracking-widest ${SOURCE_BADGE[lookup.source].color}`}>
                {SOURCE_BADGE[lookup.source].label}
              </span>
            )}
          </div>
          {lookup.coachEmail ? (
            <a href={`mailto:${lookup.coachEmail}`} className="text-xs text-[#eab308] hover:underline">
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
            className="text-[10px] uppercase tracking-widest text-[#64748b] hover:text-[#eab308] mt-2 disabled:opacity-50"
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
    conf === 'medium' ? 'bg-[rgba(234,179,8,0.12)] border-[rgba(234,179,8,0.3)] text-[#eab308]' :
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
          <div className="text-[10px] uppercase tracking-widest text-[#64748b] mb-1">Playstyle</div>
          <p className="text-sm text-[#cbd5e1] leading-relaxed">{intel.playstyle}</p>
        </div>
      )}

      {intel.tacticalNotes.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#64748b] mb-1.5">Tactical tendencies</div>
          <ul className="flex flex-col gap-1.5">
            {intel.tacticalNotes.map((note, i) => (
              <li key={i} className="text-sm text-[#cbd5e1] leading-relaxed flex gap-2">
                <span className="text-[#eab308] flex-shrink-0">›</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {intel.recentForm && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#64748b] mb-1">Recent form</div>
          <p className="text-sm text-[#cbd5e1]">{intel.recentForm}</p>
        </div>
      )}

      {intel.staffStability && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#64748b] mb-1">Coaching staff</div>
          <p className="text-sm text-[#cbd5e1]">{intel.staffStability}</p>
        </div>
      )}

      {intel.recruitingProfile && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#64748b] mb-1">Recruiting profile</div>
          <p className="text-sm text-[#cbd5e1]">{intel.recruitingProfile}</p>
        </div>
      )}

      {/* Film & verification links: real searches, never fabricated URLs. */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-[#64748b] mb-1.5">Watch film & verify</div>
        <div className="flex flex-wrap gap-2">
          {intel.searchQueries.map((q) => (
            <a
              key={q.url}
              href={q.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-lg bg-[rgba(234,179,8,0.08)] border border-[rgba(234,179,8,0.25)] text-[#eab308] hover:bg-[rgba(234,179,8,0.15)]"
            >
              {q.label} ↗
            </a>
          ))}
        </div>
        <p className="text-[11px] text-[#64748b] mt-2 italic">
          We don't fabricate video URLs — these open real, current search results so you see actual film, not dead links.
        </p>
      </div>

      {intel.caveats.length > 0 && (
        <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
          <div className="text-[10px] uppercase tracking-widest text-[#64748b] mb-1.5">⚠️ Caveats</div>
          <ul className="flex flex-col gap-1">
            {intel.caveats.map((c, i) => (
              <li key={i} className="text-xs text-[#94a3b8] leading-relaxed">• {c}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-[#64748b] italic">
        AI-generated tactical analysis based on publicly available information through {new Date(intel.cachedAt).toLocaleDateString()}. Always confirm with the coach.
      </p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-[#64748b]">{label}</span>
      <span className="text-sm text-[#f1f5f9] capitalize">{value}</span>
    </div>
  )
}

function BreakdownRow({ label, score, detail, verdict }: { label: string; score: number; detail: string; verdict: string }) {
  const color = score >= 75 ? 'bg-[#4ade80]' : score >= 50 ? 'bg-[#eab308]' : 'bg-[#f87171]'
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5 gap-2">
        <span className="text-sm font-semibold text-[#f1f5f9]">{label}</span>
        <span className="text-xs text-[#64748b]">{detail}</span>
        <span className="font-serif font-black text-[#eab308] text-sm tabular-nums">{score}</span>
      </div>
      <div className="h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden mb-1.5">
        <div className={`h-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <p className="text-xs text-[#94a3b8] leading-relaxed">{verdict}</p>
    </div>
  )
}
