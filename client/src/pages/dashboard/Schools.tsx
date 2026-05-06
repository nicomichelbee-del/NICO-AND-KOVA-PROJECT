import { useEffect, useMemo, useRef, useState } from 'react'
import { matchSchools, getProgramIntel, findCoach, type FindCoachResult } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import type { AthleteProfile, Division, Region, School, ProgramIntel, VideoRating } from '../../types'
import type { AthleteProfileRecord } from '../../types/profile'

// Builds the matcher's AthleteProfile from the live profile editor. The new
// editor (Profile.tsx + OnboardingProfile.tsx) writes everything into
// `athleteProfileRecord`. The legacy `athleteProfile` localStorage key is
// only used as a fallback for fields the new schema doesn't yet track —
// goals, assists, gender, sizePreference, intendedMajor — so existing users
// don't lose those values when they edit their record.
//
// This is what makes "I changed my target division" actually flow through
// to the matcher: we map record.desired_division_levels → targetDivision /
// targetDivisions on every read.
function readJSON<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null }
  catch { return null }
}
function getProfile(): AthleteProfile | null {
  const record = readJSON<AthleteProfileRecord>('athleteProfileRecord')
  const legacy = readJSON<AthleteProfile>('athleteProfile')
  if (!record && !legacy) return null

  const levels = (record?.desired_division_levels ?? []) as Division[]
  const regions = (record?.regions_of_interest ?? []) as Region[]
  const targetDivision: Division = levels[0] ?? legacy?.targetDivision ?? 'D2'
  const targetDivisions = levels.length >= 2 ? levels : undefined

  return {
    name:               record?.full_name              ?? legacy?.name              ?? '',
    gradYear:           record?.graduation_year        ?? legacy?.gradYear          ?? new Date().getFullYear() + 2,
    position:           record?.primary_position       ?? legacy?.position          ?? '',
    // Prefer the gender the athlete picked in onboarding; fall back to
    // legacy (older accounts) only if the new record is missing it.
    gender:             record?.gender                 ?? legacy?.gender ?? 'womens',
    clubTeam:           record?.current_club           ?? legacy?.clubTeam          ?? '',
    clubLeague:         record?.current_league_or_division ?? legacy?.clubLeague    ?? '',
    gpa:                record?.gpa                    ?? legacy?.gpa               ?? 0,
    satAct:             record?.sat_score ?? record?.act_score ?? legacy?.satAct,
    goals:              legacy?.goals                  ?? 0,
    assists:            legacy?.assists                ?? 0,
    intendedMajor:      legacy?.intendedMajor,
    highlightUrl:       record?.highlight_video_url    ?? legacy?.highlightUrl ?? undefined,
    targetDivision,
    targetDivisions,
    locationPreference: regions[0] ?? legacy?.locationPreference ?? 'any',
    sizePreference:     legacy?.sizePreference         ?? 'any',
    excludedDivisions:  legacy?.excludedDivisions,
  }
}

function getLatestVideoRating(): VideoRating | null {
  try {
    const raw = localStorage.getItem('latestVideoRating')
    return raw ? JSON.parse(raw) as VideoRating : null
  } catch { return null }
}

// ── Saved schools (localStorage-backed favorites for the compare table) ──
const SAVED_KEY = 'savedSchoolIds'
function loadSavedIds(): string[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') as string[] } catch { return [] }
}
function persistSavedIds(ids: string[]): void {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(ids)) } catch { /* quota — silently ignore */ }
}

// ── Excluded divisions (athlete-specified hard nos: "no JUCO") ─────────
// Persisted independently of the profile localStorage so the matcher can
// pick this up regardless of which profile-shape the rest of the app is
// using during the in-progress refactor. Sent to /api/ai/schools as part
// of the profile payload at match time.
const EXCLUDED_KEY = 'excludedDivisions'
const ALL_DIVISIONS: Division[] = ['D1', 'D2', 'D3', 'NAIA', 'JUCO']
const DIVISION_LABELS: Record<Division, string> = {
  D1: 'Division I', D2: 'Division II', D3: 'Division III', NAIA: 'NAIA', JUCO: 'JUCO',
}
function loadExcludedDivisions(): Division[] {
  try {
    const raw = localStorage.getItem(EXCLUDED_KEY)
    return raw ? (JSON.parse(raw) as Division[]) : []
  } catch { return [] }
}
function persistExcludedDivisions(divs: Division[]): void {
  try { localStorage.setItem(EXCLUDED_KEY, JSON.stringify(divs)) } catch { /* */ }
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

type SortKey = 'match' | 'shot' | 'athletic' | 'academic' | 'cost' | 'size' | 'program' | 'gpa' | 'division' | 'name'

const SIZE_RANK: Record<NonNullable<School['size']>, number> = { small: 0, medium: 1, large: 2 }
const DIV_RANK: Record<School['division'], number> = { D1: 0, D2: 1, D3: 2, NAIA: 3, JUCO: 4 }

// ── Power filter shape ──
interface PowerFilters {
  states: string[]              // 2-letter codes, empty = all states
  conferenceQuery: string       // free-text contains-match
  maxCost: number | null        // dollars; null = no cap
  scholarshipsOnly: boolean
  minOpenSpots: number          // 0 = any
  minProgramStrength: number    // 0 = any
  minRecruitableShot: number    // 0 = any
}
const DEFAULT_FILTERS: PowerFilters = {
  states: [], conferenceQuery: '', maxCost: null, scholarshipsOnly: false,
  minOpenSpots: 0, minProgramStrength: 0, minRecruitableShot: 0,
}

// ── Recruiting timeline urgency, calibrated by grad year × division ──
//
// Today's date drives the calculation; we lean on the matcher's gender +
// division knowledge to tell the athlete *exactly* what to do this week.
// Returns null when no profile or grad year is on file.
interface UrgencyRead {
  level: 'now' | 'soon' | 'planning' | 'early'
  headline: string
  detail: string
  action: string
}
function computeUrgency(profile: AthleteProfile | null): UrgencyRead | null {
  if (!profile?.gradYear) return null
  const now = new Date()
  // School year flips in August. If we're July or earlier, "current grade"
  // is computed against (year-1) so the rising-senior summer is treated as
  // the start of senior year, not the tail of junior year.
  const academicYear = now.getMonth() < 7 ? now.getFullYear() : now.getFullYear() + 1
  const yearsToGrad = profile.gradYear - academicYear
  const isD1orD2 = profile.targetDivision === 'D1' || profile.targetDivision === 'D2'
  // yearsToGrad: 3=freshman, 2=sophomore, 1=junior, 0=senior, <0=post-grad

  // Already graduated — most likely a transfer-portal candidate or
  // post-grad year. Don't pretend it's still senior season.
  if (yearsToGrad < 0) {
    return {
      level: 'now',
      headline: 'You\'re past your high-school grad year.',
      detail: 'Recruiting at this point is about transfer portal, JUCO bridge, or post-grad year. Different cycle, but the windows are still open.',
      action: 'Look at JUCO + transfer-portal-active programs. Honest conversations with coaches about your year-by-year plan.',
    }
  }
  if (yearsToGrad === 0) {
    return {
      level: 'now',
      headline: 'You\'re in your senior year — every week matters.',
      detail: isD1orD2
        ? `${profile.targetDivision} rosters are largely set. Late-cycle ${profile.targetDivision} spots open from de-commits and roster gaps; D3 and NAIA are still active.`
        : 'D3, NAIA, and JUCO programs recruit late into senior year — most spots open up in spring.',
      action: 'Email every reach + target this week. Attach video, GPA, and a clear ask.',
    }
  }
  if (yearsToGrad === 1) {
    return {
      level: isD1orD2 ? 'now' : 'soon',
      headline: 'You\'re a junior — the recruiting window is open.',
      detail: isD1orD2
        ? `${profile.targetDivision} coaches make ~70% of their commitments by junior summer. You\'re in the heart of the cycle.`
        : 'D3 and NAIA coaches start serious recruitment late junior year. Build the relationship now.',
      action: isD1orD2
        ? 'Email your top 5 reaches + 3 targets this week. Ask for an unofficial visit or ID camp.'
        : 'Email 8–10 schools this month. Lead with academic fit and major.',
    }
  }
  if (yearsToGrad === 2) {
    return {
      level: 'planning',
      headline: 'You\'re a sophomore — building the foundation.',
      detail: 'Most coaches can\'t legally engage with you yet, but they CAN watch your video and read your profile. Start the list now.',
      action: 'Send intro emails to ~10 programs. They\'ll log your name even if they can\'t reply.',
    }
  }
  return {
    level: 'early',
    headline: 'You\'re a freshman — early but smart.',
    detail: 'Coaches won\'t respond yet but recruiting boards remember names that show up early. Now is for skill-building and tournament exposure.',
    action: 'Focus on your tape, your GPA, and tournament film. Email 5 dream schools to plant the seed.',
  }
}

// ── Shot bucket helper for Recruitable Shot % chip ──
function shotBucket(shot: number): { label: string; color: string; bg: string; ring: string } {
  if (shot >= 70) return { label: 'Strong shot', color: '#4ade80', bg: 'rgba(74,222,128,0.10)', ring: 'rgba(74,222,128,0.30)' }
  if (shot >= 45) return { label: 'Real shot',   color: '#f0b65a', bg: 'rgba(240,182,90,0.10)', ring: 'rgba(240,182,90,0.30)' }
  if (shot >= 25) return { label: 'Outside shot',color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', ring: 'rgba(251,191,36,0.28)' }
  return { label: 'Long shot', color: '#f87171', bg: 'rgba(248,113,113,0.08)', ring: 'rgba(248,113,113,0.28)' }
}

export function Schools() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | School['category']>('all')
  const [sort, setSort] = useState<SortKey>('match')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<School | null>(null)

  // Simulated profile (drives the What-If panel). null = use the real
  // profile from localStorage. When set, the Schools list is the projected
  // matches for the simulated stats — clearly labeled in the UI.
  const [simProfile, setSimProfile] = useState<AthleteProfile | null>(null)
  const [simulating, setSimulating] = useState(false)
  const [simOpen, setSimOpen] = useState(false)

  // Power filters (state, conference, cost cap, etc.)
  const [filters, setFilters] = useState<PowerFilters>(DEFAULT_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Saved schools — persisted in localStorage; drives the Compare modal.
  const [savedIds, setSavedIds] = useState<string[]>(() => loadSavedIds())
  const [compareOpen, setCompareOpen] = useState(false)

  function toggleSaved(id: string) {
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      persistSavedIds(next)
      return next
    })
  }

  // Excluded divisions — hard nos. Sent in the match request so the server
  // never returns those schools at all (different from filters, which apply
  // post-match). Toggling a chip auto-rematches after a short debounce so
  // the result list reflects the new constraint without a manual Save click.
  // The simulator's own useEffect handles excluded changes when sim is
  // active (see line ~287); we skip rematching here in that case to avoid
  // double roundtrips.
  const [excludedDivisions, setExcludedDivisions] = useState<Division[]>(() => loadExcludedDivisions())
  const excludedRematchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function toggleExcluded(div: Division) {
    setExcludedDivisions((prev) => {
      const next = prev.includes(div) ? prev.filter((x) => x !== div) : [...prev, div]
      persistExcludedDivisions(next)
      return next
    })
    // Schedule a rematch only when results are already on screen and we're
    // not in simulation mode — otherwise toggling chips before clicking Match
    // would error on missing GPA/position checks.
    if (simProfile) return
    if (schools.length === 0) return
    if (excludedRematchTimer.current) clearTimeout(excludedRematchTimer.current)
    excludedRematchTimer.current = setTimeout(() => { handleMatch() }, 250)
  }

  // Initial match against the real profile, fired from the CTA. Kept as a
  // distinct fn (vs. a useEffect) because we want the user to consciously
  // run a match, not auto-match on page load.
  async function handleMatch(profileOverride?: AthleteProfile) {
    const baseProfile = profileOverride ?? getProfile()
    // Required fields. Without GPA + position the matcher returns garbage
    // (academic axis defaults to 0, position-based stats can't compute).
    if (!baseProfile?.name) { setError('Please complete your athlete profile first.'); return }
    if (!baseProfile.gender) { setError('Please set your gender (Men\'s/Women\'s) in your athlete profile.'); return }
    if (!baseProfile.position) { setError('Please pick a position in your athlete profile — the matcher needs it for athletic fit.'); return }
    if (!baseProfile.gpa || baseProfile.gpa <= 0) { setError('Please enter your GPA in your athlete profile — it drives the academic fit calculation.'); return }
    if (!baseProfile.targetDivision) { setError('Please pick a target division (D1/D2/D3/NAIA/JUCO) in your athlete profile.'); return }
    // Layer in the excluded-divisions setting from the page UI. We strip
    // any division that's part of the athlete's target set — the UI locks
    // those chips, but be defensive in case localStorage state diverges.
    // (The server matcher does the same filtering as a final safety net.)
    const targetSet = new Set<Division>(baseProfile.targetDivisions ?? [baseProfile.targetDivision])
    const profile: AthleteProfile = {
      ...baseProfile,
      excludedDivisions: excludedDivisions.filter((d) => !targetSet.has(d)),
    }
    setError(''); setLoading(true)
    try {
      // Pull the latest highlight-video rating (if any) so per-school athletic
      // fit reflects what the AI actually saw on tape, not just GPA + goals.
      const video = getLatestVideoRating()
      const { schools } = await matchSchools(profile, video)
      setSchools(schools)
      // Only persist when matching against the *real* profile — we don't want
      // simulated runs to pollute the dashboard's other surfaces.
      if (!profileOverride) localStorage.setItem('matchedSchools', JSON.stringify(schools))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to match schools')
    } finally { setLoading(false) }
  }

  // Debounced re-match when the user drags What-If sliders. 350ms gives the
  // matcher (server-side, but pure logic — no AI calls) time to respond
  // without making sliding feel laggy. We also bake excludedDivisions into
  // every simulated payload so toggling "no JUCO" mid-simulation works.
  const simTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!simProfile) return
    if (simTimer.current) clearTimeout(simTimer.current)
    setSimulating(true)
    simTimer.current = setTimeout(async () => {
      try {
        const video = getLatestVideoRating()
        const payload: AthleteProfile = {
          ...simProfile,
          excludedDivisions: excludedDivisions.filter((d) => d !== simProfile.targetDivision),
        }
        const { schools } = await matchSchools(payload, video)
        setSchools(schools)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Simulation failed')
      } finally {
        setSimulating(false)
      }
    }, 350)
    return () => { if (simTimer.current) clearTimeout(simTimer.current) }
  }, [simProfile, excludedDivisions])

  function resetSimulation() {
    // Cancel any in-flight simulation timer so a stale slider event can't
    // resolve *after* the real-profile match completes and overwrite it.
    if (simTimer.current) { clearTimeout(simTimer.current); simTimer.current = null }
    setSimulating(false)
    setSimProfile(null)
    void handleMatch()  // re-fetch with real profile
  }

  // Apply power filters. Done client-side since filtering after matching
  // gives the user instant feedback without re-hitting the server.
  const filteredByPower = useMemo(() => {
    return schools.filter((s) => {
      if (filters.states.length && !(s.state && filters.states.includes(s.state))) return false
      if (filters.conferenceQuery.trim() && !s.conference?.toLowerCase().includes(filters.conferenceQuery.trim().toLowerCase())) return false
      if (filters.maxCost != null && (s.costOfAttendance ?? Infinity) > filters.maxCost) return false
      // Athletic scholarships filter — D3 is hard-excluded (NCAA forbids
      // athletic aid), and other divisions need the scholarships flag set.
      if (filters.scholarshipsOnly) {
        if (s.division === 'D3') return false
        if (!s.scholarships) return false
      }
      if (filters.minOpenSpots > 0 && (s.rosterSignal?.openSpots ?? 0) < filters.minOpenSpots) return false
      if (filters.minProgramStrength > 0 && (s.programStrength ?? 0) < filters.minProgramStrength) return false
      if (filters.minRecruitableShot > 0 && (s.recruitableShot ?? 0) < filters.minRecruitableShot) return false
      return true
    })
  }, [schools, filters])

  const filtered = filter === 'all' ? filteredByPower : filteredByPower.filter((s) => s.category === filter)

  // Sort once per (filtered, sort, sortDir) change rather than every render.
  // ~25 schools makes this immaterial today, but cheap insurance against
  // future result-list growth and keeps re-renders snappy on the simulator.
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === 'desc' ? -1 : 1
      switch (sort) {
        case 'match':    return dir * (a.matchScore - b.matchScore)
        case 'shot':     return dir * ((a.recruitableShot ?? 0) - (b.recruitableShot ?? 0))
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
  }, [filtered, sort, sortDir])

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
    { key: 'shot',     label: 'Recruitable shot' },
    { key: 'athletic', label: 'Athletic fit' },
    { key: 'academic', label: 'Academic fit' },
    { key: 'cost',     label: 'Cost' },
    { key: 'program',  label: 'Program strength' },
    { key: 'gpa',      label: 'Typical GPA' },
    { key: 'size',     label: 'School size' },
    { key: 'division', label: 'Division' },
    { key: 'name',     label: 'Name' },
  ]

  // Available state codes from the matched results (fed into the state filter
  // picker so we never offer a state with zero schools in the user's matches).
  const availableStates = useMemo(
    () => Array.from(new Set(schools.map((s) => s.state).filter((x): x is string => !!x))).sort(),
    [schools],
  )

  const profileForUrgency = simProfile ?? getProfile()
  const urgency = computeUrgency(profileForUrgency)
  const filterCount = countActive(filters)
  const savedSchools = useMemo(() => schools.filter((s) => savedIds.includes(s.id)), [schools, savedIds])

  return (
    <div className="kr-page">
      <PageHeader
        eyebrow="School matcher"
        title={<>Your school <span className="kr-accent">matches</span>.</>}
        lede="Click any school for a full match breakdown. Heart the ones you like — compare them side by side."
        aside={
          <Button onClick={() => handleMatch()} disabled={loading}>
            {loading ? 'Matching…' : schools.length ? 'Rematch' : 'Find my schools'}
          </Button>
        }
      />

      {error && (
        <div className="mb-6 p-4 rounded-xl border border-[rgba(227,90,90,0.28)] bg-[rgba(227,90,90,0.08)] text-sm text-crimson-light">
          {error}
        </div>
      )}

      {/* Recruiting urgency — calibrated by grad year × division. Always show
          when we have a profile, even before the first match — the action is
          relevant either way. */}
      {urgency && schools.length === 0 && <UrgencyBanner urgency={urgency} />}

      {schools.length > 0 && (
        <>
          {urgency && <UrgencyBanner urgency={urgency} />}

          {/* Hard nos — divisions the athlete refuses to consider. Sits up
              top so it's discoverable on every visit; auto-rematches on
              toggle. The athlete's targetDivision is locked-in (can't be
              skipped) — visually disabled. */}
          <ExcludedDivisionsBar
            excluded={excludedDivisions}
            target={(simProfile ?? getProfile())?.targetDivision}
            targetDivisions={(simProfile ?? getProfile())?.targetDivisions}
            onToggle={toggleExcluded}
            loading={loading}
          />

          <ProfileAssessment schools={schools} />

          {/* Simulator banner — clearly tells the user these results aren't
              "real" matches when the What-If sliders have been touched. */}
          {simProfile && (
            <SimulationBanner
              simProfile={simProfile}
              realProfile={getProfile()}
              onReset={resetSimulation}
              isLoading={simulating}
            />
          )}

          {/* Toolbar — kept lightweight so the page reads as "your matches"
              first, with optional power tools tucked behind small buttons.
              Compare surfaces only when 2+ schools are saved (no clutter
              for new users). */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <SubtleToolbarButton
              active={simOpen}
              onClick={() => setSimOpen((v) => !v)}
              icon="◇"
              label={simProfile ? 'Simulating' : 'What if?'}
              accent={simProfile ? 'blue' : undefined}
            />
            <SubtleToolbarButton
              active={filtersOpen}
              onClick={() => setFiltersOpen((v) => !v)}
              icon="≡"
              label={filterCount > 0 ? `Filters · ${filterCount}` : 'Filters'}
              accent={filterCount > 0 ? 'gold' : undefined}
            />
            {filterCount > 0 && (
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="text-[10.5px] uppercase tracking-widest font-mono text-ink-3 hover:text-gold ml-1"
                title="Clear all active filters"
              >
                clear
              </button>
            )}
            <div className="flex-1" />
            {savedSchools.length >= 2 && (
              <button
                onClick={() => setCompareOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-[rgba(74,222,128,0.10)] border border-[rgba(74,222,128,0.40)] text-[#4ade80] text-sm font-semibold hover:bg-[rgba(74,222,128,0.18)] flex items-center gap-2"
              >
                Compare · {savedSchools.length}
              </button>
            )}
          </div>

          {simOpen && (
            <WhatIfPanel
              baseProfile={simProfile ?? getProfile()}
              onChange={setSimProfile}
              onClose={() => setSimOpen(false)}
              onResetSim={resetSimulation}
              isSimulating={!!simProfile}
              loading={simulating}
            />
          )}

          {filtersOpen && (
            <PowerFiltersPanel
              applied={filters}
              onApply={(next) => { setFilters(next); setFiltersOpen(false) }}
              onClose={() => setFiltersOpen(false)}
              availableStates={availableStates}
            />
          )}

          <div className="grid grid-cols-3 gap-4 mb-8">
            {(['reach', 'target', 'safety'] as const).map((cat) => {
              const inBucket = filteredByPower.filter((s) => s.category === cat)
              return (
                <Card key={cat} className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant={catColor[cat]}>{cat.toUpperCase()}</Badge>
                    <span className="font-serif text-2xl font-black text-[#f5f1e8]">
                      {inBucket.length}
                    </span>
                    <span className="text-xs text-[#9a9385]">schools</span>
                  </div>
                  {/* Division mix — answers "what kind of safeties are these?"
                      at a glance. e.g. "3 D2 · 2 D3 · 1 NAIA". */}
                  <DivisionMix schools={inBucket} />
                  <p className="text-xs text-[#9a9385] leading-relaxed mt-2">{catDesc[cat]}</p>
                </Card>
              )
            })}
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
                  aria-pressed={active}
                  aria-label={active
                    ? `Sort by ${opt.label}, currently ${sortDir === 'desc' ? 'high to low' : 'low to high'} — click to flip`
                    : `Sort by ${opt.label}`}
                  className={`px-3 py-1.5 rounded-full font-mono text-[10.5px] tracking-[0.14em] uppercase border transition-[border-color,background,color] flex items-center gap-1 ${
                    active
                      ? 'bg-gold text-[#1a1304] border-gold'
                      : 'bg-transparent text-ink-2 border-[rgba(245,241,232,0.10)] hover:border-[rgba(240,182,90,0.45)] hover:text-ink-0'
                  }`}
                  title={active ? `Click to flip direction (currently ${sortDir === 'desc' ? 'high → low' : 'low → high'})` : undefined}
                >
                  {opt.label}
                  {active && <span aria-hidden className="text-[11px]">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                </button>
              )
            })}
          </div>

          {sorted.length === 0 && (
            <Card className="p-10 text-center">
              <p className="text-sm text-ink-2">No schools match these filters. Loosen them or clear filters.</p>
              {filterCount > 0 && (
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="mt-3 text-[10.5px] uppercase tracking-widest font-mono text-gold hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </Card>
          )}

          <div className="flex flex-col gap-3">
            {sorted.map((school) => (
              <SchoolCard
                key={school.id}
                school={school}
                onClick={() => setSelected(school)}
                isSaved={savedIds.includes(school.id)}
                onToggleSave={() => toggleSaved(school.id)}
              />
            ))}
          </div>
        </>
      )}

      {!loading && schools.length === 0 && !error && (
        <Card className="p-12 md:p-16 text-center">
          <span className="kr-eyebrow justify-center">Step 02 · Match</span>
          <h2 className="kr-h2 mt-4">Find your <span className="kr-accent">schools</span>.</h2>
          <p className="text-[15px] text-ink-1 mt-3 mb-7 max-w-md mx-auto leading-[1.6]">
            We rank 2,500+ programs against your stats, academics, and division goal — then surface the 25 strongest matches with a Recruitable Shot %, live roster openings, and a What-If simulator no one else has.
          </p>
          <Button onClick={() => handleMatch()} disabled={loading}>Find my schools</Button>
        </Card>
      )}

      {selected && <SchoolDetailModal school={selected} onClose={() => setSelected(null)} />}

      {compareOpen && savedSchools.length >= 2 && (
        <CompareModal
          schools={savedSchools}
          onClose={() => setCompareOpen(false)}
          onUnsave={(id) => toggleSaved(id)}
        />
      )}
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
          <div className="text-right flex-shrink-0 flex items-start gap-5">
            {school.recruitableShot != null && (() => {
              const b = shotBucket(school.recruitableShot)
              return (
                <div className="text-right">
                  <div className="font-serif text-[40px] leading-none tabular-nums" style={{ color: b.color, fontVariationSettings: '"opsz" 144' }}>
                    {Math.round(school.recruitableShot)}
                    <span className="text-[20px] ml-0.5">%</span>
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3 mt-2">shot</div>
                </div>
              )
            })()}
            <div>
              <div className="font-serif text-[40px] leading-none text-gold tabular-nums" style={{ fontVariationSettings: '"opsz" 144' }}>{school.matchScore.toFixed(1)}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3 mt-2">match</div>
            </div>
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
          {/* Recruitable shot — what are your real odds. Big and bold so the
              athlete can't miss it; the word that matters here is "realistic". */}
          {school.recruitableShot != null && (() => {
            const b = shotBucket(school.recruitableShot)
            return (
              <section
                className="rounded-xl border px-5 py-4"
                style={{ borderColor: b.ring, background: b.bg }}
              >
                <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: b.color }}>
                      Recruitable Shot · {b.label}
                    </div>
                    <p className="text-sm text-[#cbd5e1] mt-1.5 leading-relaxed">
                      Estimated probability you'd realistically be recruited here based on your fit, the program's level, and current roster needs at your position.
                    </p>
                  </div>
                  <div className="font-serif text-[44px] leading-none tabular-nums" style={{ color: b.color, fontVariationSettings: '"opsz" 144' }}>
                    {Math.round(school.recruitableShot)}<span className="text-[22px]">%</span>
                  </div>
                </div>
                {school.dataConfidence && school.dataConfidence !== 'high' && (
                  <p className="text-[10.5px] text-[#9a9385] italic mt-2">
                    {school.dataConfidence === 'medium'
                      ? 'Medium confidence — some data points missing on this program.'
                      : 'Low confidence — limited public data on this program. Treat the number as a rough guide.'}
                  </p>
                )}
              </section>
            )
          })()}

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
  // Average ONLY over schools that actually have a fit value — defaulting
  // missing data to 50 inflates "balanced" reads and hides bias when many
  // matches lack scoring inputs (e.g., D3 schools without Scorecard data).
  const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
  const aths  = schools.map((s) => s.athleticFit).filter((x): x is number => x != null)
  const acads = schools.map((s) => s.academicFit).filter((x): x is number => x != null)
  const ath  = Math.round(avg(aths) * 10) / 10
  const acad = Math.round(avg(acads) * 10) / 10
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

// ────────────────────────────────────────────────────────────────────────────
// Elite-tier additions: card, urgency banner, simulator, filters, compare.
// All client-only — zero new AI tokens. They're pure UI on top of the
// matcher's structured output.
// ────────────────────────────────────────────────────────────────────────────

interface SchoolCardProps {
  school: School
  onClick: () => void
  isSaved: boolean
  onToggleSave: () => void
}

function SchoolCard({ school, onClick, isSaved, onToggleSave }: SchoolCardProps) {
  const shot = school.recruitableShot
  const bucket = shot != null ? shotBucket(shot) : null

  // Card layout: main click target (school content + match score) on the left,
  // a vertical "rail" on the right with the save button above the chevron.
  // The save button is a sibling of the click target so taps are routed
  // unambiguously — no `absolute` positioning over the score column, which
  // caused visible overlap on narrow phones.
  return (
    <div className="bg-[linear-gradient(180deg,rgba(31,27,40,0.82)_0%,rgba(24,20,32,0.82)_100%)] border border-[rgba(245,241,232,0.08)] rounded-2xl transition-[border-color,box-shadow] duration-200 hover:border-[rgba(240,182,90,0.45)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.30)] group flex items-stretch">
      <button onClick={onClick} className="text-left flex-1 min-w-0 flex items-start gap-4 sm:gap-6 cursor-pointer p-5 sm:p-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
            <span className="font-medium text-ink-0 text-[16px] tracking-[-0.005em]">{school.name}</span>
            <Badge variant={catColor[school.category]}>{school.category}</Badge>
            <Badge variant="muted">{school.division}</Badge>
            {bucket && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-mono border"
                style={{ color: bucket.color, background: bucket.bg, borderColor: bucket.ring }}
                title={`Recruitable Shot: ${shot!.toFixed(0)}% — ${bucket.label.toLowerCase()}`}
              >
                {bucket.label} · {Math.round(shot!)}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 sm:gap-4 font-mono text-[10.5px] tracking-[0.14em] uppercase text-ink-3 flex-wrap mb-3">
            <span>{school.location}</span>
            <span className="text-ink-3/60">·</span>
            <span>{school.enrollment.toLocaleString()} students</span>
            {school.conference && <>
              <span className="text-ink-3/60">·</span>
              <span>{school.conference}</span>
            </>}
            {school.rosterSignal && school.rosterSignal.openSpots >= 2 && (
              <>
                <span className="text-ink-3/60">·</span>
                <span className="text-[#4ade80]">~{school.rosterSignal.openSpots} open spots</span>
              </>
            )}
          </div>

          {(school.athleticFit != null || school.academicFit != null) && (
            <div className="flex gap-4 mb-2.5 max-w-md">
              <FitBar label="Athletic" value={school.athleticFit ?? 50} />
              <FitBar label="Academic" value={school.academicFit ?? 50} />
            </div>
          )}

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
          <div
            className={`font-serif text-[34px] leading-none tabular-nums ${
              school.dataConfidence === 'low' ? 'text-[rgba(240,182,90,0.55)]' : 'text-gold'
            }`}
            style={{ fontVariationSettings: '"opsz" 144' }}
            title={school.dataConfidence === 'low' ? 'Score has lower confidence — fewer signals on this school' : undefined}
          >
            {school.matchScore.toFixed(1)}
          </div>
          <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-3 mt-1.5">match score</div>
          {school.dataConfidence === 'low' && (
            <div className="font-mono text-[9px] tracking-widest uppercase text-[#fbbf24] mt-1">
              ⚠ low confidence
            </div>
          )}
        </div>
      </button>
      {/* Right rail — save button on top, chevron below. Sibling of the main
          click target so taps don't ambiguously hit either. */}
      <div className="flex flex-col items-center justify-between py-5 sm:py-6 pr-3 sm:pr-4 pl-1 gap-2 flex-shrink-0">
        <button
          onClick={onToggleSave}
          className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors ${
            isSaved
              ? 'bg-[rgba(240,182,90,0.18)] text-gold border border-[rgba(240,182,90,0.45)]'
              : 'bg-[rgba(245,241,232,0.04)] text-[#9a9385] hover:text-gold hover:bg-[rgba(240,182,90,0.10)] border border-transparent'
          }`}
          title={isSaved ? 'Remove from compare' : 'Save to compare'}
          aria-label={isSaved ? 'Remove from compare' : 'Save to compare'}
          aria-pressed={isSaved}
        >
          {isSaved ? '♥' : '♡'}
        </button>
        <div
          aria-hidden
          className="text-ink-3 text-lg group-hover:text-gold group-hover:translate-x-0.5 transition-[color,transform]"
        >
          →
        </div>
      </div>
    </div>
  )
}

// ── Excluded divisions bar. Lets the athlete say "I don't want JUCO" or
// "no NAIA" and have the matcher respect it on every match. Every division
// in the athlete's target set (single or multi) is locked-in — can't be
// excluded. Toggling auto-rematches (debounced in the parent).
function ExcludedDivisionsBar({
  excluded, target, targetDivisions, onToggle, loading,
}: {
  excluded: Division[]
  target: Division | undefined
  targetDivisions?: Division[]
  onToggle: (d: Division) => void
  loading: boolean
}) {
  // Lock every division in the target set, not just the primary. For a
  // multi-target {D1, D3} athlete, both chips render as locked "target".
  const lockedTargets = new Set<Division>(targetDivisions ?? (target ? [target] : []))
  return (
    <div className="mb-6 rounded-xl border border-[rgba(245,241,232,0.08)] bg-[rgba(245,241,232,0.02)] px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#9a9385] font-bold">
            Divisions to skip
          </span>
          <span className="text-[11px] text-ink-3">
            {excluded.length === 0
              ? 'tap any division to exclude it from your matches'
              : `excluding ${excluded.length} of 5 — your matches won't include these`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-[10px] text-[#9a9385] font-mono">rematching…</span>}
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {ALL_DIVISIONS.map((div) => {
          const isExcluded = excluded.includes(div)
          const isTarget   = lockedTargets.has(div)
          // Locked: can't exclude the division you're actively targeting.
          if (isTarget) {
            return (
              <span
                key={div}
                className="px-3 py-1.5 rounded-md font-mono text-[10.5px] tracking-widest uppercase border border-[rgba(240,182,90,0.25)] bg-[rgba(240,182,90,0.06)] text-gold opacity-90 flex items-center gap-1.5 cursor-not-allowed"
                title="Your target division — can't be skipped"
              >
                <span className="text-[9px]">●</span>
                {div}
                <span className="text-[9px] text-[#9a9385] normal-case tracking-normal">target</span>
              </span>
            )
          }
          return (
            <button
              key={div}
              onClick={() => onToggle(div)}
              aria-pressed={isExcluded}
              className={`px-3 py-1.5 rounded-md font-mono text-[10.5px] tracking-widest uppercase border transition-colors flex items-center gap-1.5 ${
                isExcluded
                  ? 'bg-[rgba(248,113,113,0.10)] border-[rgba(248,113,113,0.40)] text-[#f87171] line-through decoration-from-font'
                  : 'bg-transparent border-[rgba(245,241,232,0.10)] text-ink-1 hover:border-[rgba(248,113,113,0.30)] hover:text-[#f87171]'
              }`}
              title={isExcluded ? `Include ${DIVISION_LABELS[div]} again` : `Skip ${DIVISION_LABELS[div]} — won't show in matches`}
            >
              {isExcluded && <span className="text-[10px]">✕</span>}
              {div}
              <span className="text-[9px] text-ink-3 normal-case tracking-normal">{DIVISION_LABELS[div]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Division mix — "what kind of safeties are these?" at a glance ─────
// Renders e.g. "3 D2 · 2 D3 · 1 NAIA" with a tiny color dot per division.
// Helps the athlete spot at-a-glance whether their safety bucket is mostly
// NCAA or skewing toward NAIA/JUCO bridge programs.
const DIVISION_DOT: Record<Division, string> = {
  D1:   '#f0b65a',
  D2:   '#fbbf24',
  D3:   '#facc15',
  NAIA: '#94a3b8',
  JUCO: '#64748b',
}
function DivisionMix({ schools }: { schools: School[] }) {
  if (schools.length === 0) {
    return <p className="text-[10.5px] text-[#9a9385] italic">No matches in this bucket yet.</p>
  }
  const counts = schools.reduce<Record<string, number>>((acc, s) => {
    acc[s.division] = (acc[s.division] ?? 0) + 1
    return acc
  }, {})
  const ordered = (['D1', 'D2', 'D3', 'NAIA', 'JUCO'] as Division[]).filter((d) => counts[d] > 0)
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {ordered.map((d, i) => (
        <span key={d} className="flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-widest">
          <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: DIVISION_DOT[d] }} />
          <span className="text-ink-1 font-semibold">{counts[d]}</span>
          <span className="text-ink-2">{d}</span>
          {i < ordered.length - 1 && <span aria-hidden className="text-ink-3/60 ml-1">·</span>}
        </span>
      ))}
    </div>
  )
}

// ── Urgency banner: grad-year × division aware. Drives a single concrete
// action so the athlete knows what to do this week. ────────────────────
function UrgencyBanner({ urgency }: { urgency: UrgencyRead }) {
  const palette: Record<UrgencyRead['level'], { ring: string; tint: string; eyebrow: string; eyebrowColor: string }> = {
    now:      { ring: 'rgba(248,113,113,0.40)', tint: 'rgba(248,113,113,0.06)', eyebrow: 'Move now',     eyebrowColor: '#f87171' },
    soon:     { ring: 'rgba(240,182,90,0.40)',  tint: 'rgba(240,182,90,0.06)',  eyebrow: 'Move soon',    eyebrowColor: '#f0b65a' },
    planning: { ring: 'rgba(96,165,250,0.40)',  tint: 'rgba(96,165,250,0.06)',  eyebrow: 'Plan ahead',   eyebrowColor: '#60a5fa' },
    early:    { ring: 'rgba(148,163,184,0.40)', tint: 'rgba(148,163,184,0.06)', eyebrow: 'Build early',  eyebrowColor: '#94a3b8' },
  }
  const p = palette[urgency.level]
  return (
    <div
      className="mb-6 rounded-2xl border px-5 py-4"
      style={{ borderColor: p.ring, background: `linear-gradient(180deg, ${p.tint} 0%, rgba(255,255,255,0.01) 100%)` }}
    >
      <div className="flex items-start gap-4 flex-wrap">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold mt-1" style={{ color: p.eyebrowColor }}>
          {p.eyebrow}
        </div>
        <div className="flex-1 min-w-[280px]">
          <p className="text-[15px] font-medium text-[#f5f1e8] leading-snug">{urgency.headline}</p>
          <p className="text-xs text-[#cbd5e1] mt-1.5 leading-relaxed">{urgency.detail}</p>
          <p className="text-xs text-[#f0b65a] mt-2 font-semibold leading-relaxed">→ {urgency.action}</p>
        </div>
      </div>
    </div>
  )
}

// ── Simulation banner: sticks above results when sim is active so the user
// is never confused about what they're looking at. ─────────────────────
function SimulationBanner({
  simProfile, realProfile, onReset, isLoading,
}: {
  simProfile: AthleteProfile
  realProfile: AthleteProfile | null
  onReset: () => void
  isLoading: boolean
}) {
  const diffs: string[] = []
  if (realProfile) {
    if (simProfile.gpa !== realProfile.gpa) diffs.push(`GPA ${simProfile.gpa.toFixed(2)}`)
    if (simProfile.goals !== realProfile.goals) diffs.push(`${simProfile.goals} goals`)
    if (simProfile.assists !== realProfile.assists) diffs.push(`${simProfile.assists} assists`)
    if (simProfile.targetDivision !== realProfile.targetDivision) diffs.push(`${simProfile.targetDivision} target`)
    if (simProfile.locationPreference !== realProfile.locationPreference) diffs.push(`${simProfile.locationPreference} region`)
    if (simProfile.sizePreference !== realProfile.sizePreference) diffs.push(`${simProfile.sizePreference} schools`)
  }
  return (
    <div className="mb-5 rounded-xl border border-[rgba(96,165,250,0.40)] bg-[rgba(96,165,250,0.06)] px-5 py-3 flex items-center gap-4 flex-wrap">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#60a5fa] font-bold">
        Simulating {isLoading && '…'}
      </span>
      <span className="text-xs text-[#cbd5e1] flex-1 min-w-[220px]">
        {diffs.length ? `Projected matches if you had: ${diffs.join(' · ')}` : 'Projected matches based on simulated profile.'}
      </span>
      <button
        onClick={onReset}
        className="text-[10px] uppercase tracking-widest font-mono text-[#f0b65a] hover:underline"
      >
        ↺ Reset to actual
      </button>
    </div>
  )
}

// Quiet toolbar button. Designed to read as "secondary action" — small,
// borderless until hover, no big colored background. The page is about
// the school list; these are tools you reach for occasionally.
function SubtleToolbarButton({
  active, onClick, icon, label, accent,
}: {
  active: boolean
  onClick: () => void
  icon: string
  label: string
  accent?: 'gold' | 'blue'
}) {
  const baseClass = 'px-3 py-1.5 rounded-lg border text-sm transition-colors flex items-center gap-1.5'
  let stateClass: string
  if (active) {
    stateClass = 'bg-[rgba(245,241,232,0.06)] border-[rgba(245,241,232,0.18)] text-ink-0'
  } else if (accent === 'gold') {
    stateClass = 'bg-transparent border-[rgba(240,182,90,0.45)] text-gold hover:bg-[rgba(240,182,90,0.06)]'
  } else if (accent === 'blue') {
    stateClass = 'bg-transparent border-[rgba(96,165,250,0.45)] text-[#60a5fa] hover:bg-[rgba(96,165,250,0.06)]'
  } else {
    stateClass = 'bg-transparent border-[rgba(245,241,232,0.08)] text-ink-2 hover:text-ink-0 hover:border-[rgba(245,241,232,0.18)]'
  }
  return (
    <button onClick={onClick} className={`${baseClass} ${stateClass}`}>
      <span className="text-[13px] opacity-70">{icon}</span>
      <span>{label}</span>
    </button>
  )
}

// ── What-If Simulator: drag GPA/goals/division — matches re-rank live ────
//
// Drives the parent's `simProfile` state directly. The parent debounces and
// re-fetches matches automatically. Calibration choices:
//   • GPA range 2.0–4.0 in 0.05 steps — the floor is realistic (under 2.0
//     and most schools won't admit; not worth modeling)
//   • Goals/assists 0–40 — covers nearly every high-school season top end
//   • Region/size are picklists — sliders don't fit a categorical axis
function WhatIfPanel({
  baseProfile, onChange, onClose, onResetSim, isSimulating, loading,
}: {
  baseProfile: AthleteProfile | null
  onChange: (p: AthleteProfile) => void
  onClose: () => void
  onResetSim: () => void
  isSimulating: boolean
  loading: boolean
}) {
  // Local working copy. Always start from baseProfile so the sliders show the
  // current values (real or simulated) when the panel opens. We clamp GPA
  // to the slider's min so a profile with GPA=0 doesn't show "0.00" while
  // the thumb is pinned to 2.0.
  const initial = baseProfile ? { ...baseProfile, gpa: Math.max(2.0, baseProfile.gpa) } : null
  const [draft, setDraft] = useState<AthleteProfile | null>(initial)
  // Re-sync from the base profile ONLY when sim is not active. While the user
  // is actively simulating, the parent's `simProfile` is being driven *from*
  // our slider drags — letting the effect fire on every parent state change
  // would clobber the drag mid-motion.
  useEffect(() => {
    if (isSimulating) return
    if (baseProfile) setDraft({ ...baseProfile, gpa: Math.max(2.0, baseProfile.gpa) })
  }, [isSimulating, baseProfile?.gpa, baseProfile?.goals, baseProfile?.assists, baseProfile?.targetDivision, baseProfile?.locationPreference, baseProfile?.sizePreference])

  if (!draft) {
    return (
      <Card className="mb-5 p-5">
        <p className="text-sm text-ink-2">Complete your athlete profile first to use What If.</p>
      </Card>
    )
  }

  function patch<K extends keyof AthleteProfile>(key: K, value: AthleteProfile[K]) {
    const next = { ...draft!, [key]: value }
    setDraft(next)
    onChange(next)
  }

  return (
    <Card className="mb-5 p-5 border-[rgba(96,165,250,0.30)] bg-gradient-to-br from-[rgba(96,165,250,0.04)] to-[rgba(255,255,255,0.01)]">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#60a5fa] font-bold">What If?</div>
          <p className="text-sm text-ink-1 mt-1">Drag the sliders — your matches re-rank live.</p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-xs text-[#9a9385] font-mono">recomputing…</span>}
          {isSimulating && (
            <button onClick={onResetSim} className="text-[10px] uppercase tracking-widest font-mono text-[#f0b65a] hover:underline">
              ↺ Reset to actual
            </button>
          )}
          <button onClick={onClose} className="text-[#9a9385] hover:text-ink-0 text-lg leading-none" aria-label="Close">×</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <SliderRow
          label="GPA"
          value={draft.gpa}
          min={2.0} max={4.0} step={0.05}
          formatValue={(v) => v.toFixed(2)}
          onChange={(v) => patch('gpa', v)}
        />
        <SliderRow
          label="Goals (season)"
          value={draft.goals}
          min={0} max={40} step={1}
          formatValue={(v) => String(v)}
          onChange={(v) => patch('goals', v)}
        />
        <SliderRow
          label="Assists (season)"
          value={draft.assists}
          min={0} max={40} step={1}
          formatValue={(v) => String(v)}
          onChange={(v) => patch('assists', v)}
        />
        <PickerRow<Division>
          label="Target division"
          value={draft.targetDivision}
          options={['D1', 'D2', 'D3', 'NAIA', 'JUCO']}
          onChange={(v) => patch('targetDivision', v)}
        />
        <PickerRow
          label="Region preference"
          value={draft.locationPreference}
          options={['any', 'West', 'Southwest', 'Midwest', 'Southeast', 'Northeast'] as AthleteProfile['locationPreference'][]}
          onChange={(v) => patch('locationPreference', v)}
        />
        <PickerRow
          label="School size"
          value={draft.sizePreference}
          options={['any', 'small', 'medium', 'large'] as AthleteProfile['sizePreference'][]}
          onChange={(v) => patch('sizePreference', v)}
        />
      </div>

      <p className="text-[10px] text-[#9a9385] italic mt-4">
        Simulated changes don't touch your saved profile — they just project what your matches would look like.
      </p>
    </Card>
  )
}

function SliderRow({
  label, value, min, max, step, onChange, formatValue,
}: {
  label: string
  value: number
  min: number; max: number; step: number
  onChange: (v: number) => void
  formatValue: (v: number) => string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10.5px] uppercase tracking-widest text-[#9a9385] font-mono">{label}</span>
        <span className="text-sm font-semibold text-gold tabular-nums">{formatValue(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#f0b65a]"
      />
    </div>
  )
}

function PickerRow<T extends string>({
  label, value, options, onChange,
}: {
  label: string
  value: T
  options: T[]
  onChange: (v: T) => void
}) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-widest text-[#9a9385] font-mono mb-2">{label}</div>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 rounded-md font-mono text-[10.5px] tracking-widest uppercase border transition-colors ${
              value === opt
                ? 'bg-gold text-[#1a1304] border-gold'
                : 'bg-transparent text-ink-2 border-[rgba(245,241,232,0.10)] hover:border-[rgba(240,182,90,0.45)]'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Power filters: state, conference, cost cap, scholarships, open spots ──
function PowerFiltersPanel({
  applied, onApply, onClose, availableStates,
}: {
  applied: PowerFilters                     // currently-applied filters
  onApply: (f: PowerFilters) => void        // commit + close
  onClose: () => void
  availableStates: string[]
}) {
  // Draft state — changes don't affect the school list until "Apply" is
  // clicked. Lets the user line up several filter changes (state + cost +
  // open spots) and commit them at once instead of fighting a re-render
  // after every checkbox.
  const [draft, setDraft] = useState<PowerFilters>(applied)
  // Re-sync the draft whenever the panel re-opens with different applied
  // filters (e.g., user opened, cancelled, opened again).
  useEffect(() => { setDraft(applied) }, [applied])

  function patch<K extends keyof PowerFilters>(key: K, value: PowerFilters[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }
  function toggleState(code: string) {
    setDraft((d) => ({
      ...d,
      states: d.states.includes(code) ? d.states.filter((s) => s !== code) : [...d.states, code],
    }))
  }

  // Track whether the draft differs from what's applied — used to enable the
  // Apply button only when there's something to commit.
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied)
  const draftCount = countActive(draft)

  return (
    <Card className="mb-5 p-5">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold font-bold">Filters</div>
          <p className="text-sm text-ink-1 mt-1">Narrow your list. Apply when you're ready.</p>
        </div>
        <button onClick={onClose} className="text-[#9a9385] hover:text-ink-0 text-lg leading-none" aria-label="Close">×</button>
      </div>

      {/* Where ──────────────────────────────────────────── */}
      <FilterGroup label="Where">
        <div className="md:col-span-2">
          <FilterFieldLabel>States in your matches</FilterFieldLabel>
          {availableStates.length === 0 ? (
            <p className="text-xs text-[#9a9385]">Run a match first to see available states.</p>
          ) : (
            <div className="flex gap-1.5 flex-wrap">
              {availableStates.map((code) => (
                <button
                  key={code}
                  onClick={() => toggleState(code)}
                  className={`px-2.5 py-1 rounded-md font-mono text-[10.5px] tracking-widest uppercase border transition-colors ${
                    draft.states.includes(code)
                      ? 'bg-gold text-[#1a1304] border-gold'
                      : 'bg-transparent text-ink-2 border-[rgba(245,241,232,0.10)] hover:border-[rgba(240,182,90,0.45)]'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="md:col-span-2">
          <FilterFieldLabel>Conference</FilterFieldLabel>
          <input
            type="text"
            value={draft.conferenceQuery}
            onChange={(e) => patch('conferenceQuery', e.target.value)}
            placeholder="Big Ten, ACC, NESCAC, …"
            className="w-full px-3 py-2 rounded-md bg-[rgba(245,241,232,0.04)] border border-[rgba(245,241,232,0.10)] text-sm text-ink-0 placeholder:text-[#475569] focus:outline-none focus:border-[rgba(240,182,90,0.45)]"
          />
        </div>
      </FilterGroup>

      {/* Cost ───────────────────────────────────────────── */}
      <FilterGroup label="Cost">
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <FilterFieldLabel>Cost ceiling</FilterFieldLabel>
            <span className="text-sm font-semibold text-gold tabular-nums">
              {draft.maxCost == null ? 'no limit' : `up to ${formatMoney(draft.maxCost)}/yr`}
            </span>
          </div>
          <input
            type="range"
            min={15000} max={90000} step={1000}
            value={draft.maxCost ?? 90000}
            onChange={(e) => {
              const v = Number(e.target.value)
              patch('maxCost', v >= 90000 ? null : v)
            }}
            className="w-full accent-[#f0b65a]"
          />
        </div>
        <div>
          <ToggleRow
            label="Athletic scholarships available"
            value={draft.scholarshipsOnly}
            onChange={(v) => patch('scholarshipsOnly', v)}
            hint="D1 / D2 / NAIA only — D3 doesn't offer athletic aid"
          />
        </div>
      </FilterGroup>

      {/* Quality / fit ──────────────────────────────────── */}
      <FilterGroup label="Quality">
        <SliderRow
          label="Open spots at my position"
          value={draft.minOpenSpots}
          min={0} max={6} step={1}
          formatValue={(v) => v === 0 ? 'any' : `${v}+ open`}
          onChange={(v) => patch('minOpenSpots', v)}
        />
        <SliderRow
          label="Program tier (1–10)"
          value={draft.minProgramStrength}
          min={0} max={10} step={1}
          formatValue={(v) => v === 0 ? 'any tier' : `${v}+ / 10`}
          onChange={(v) => patch('minProgramStrength', v)}
        />
        <SliderRow
          label="Min recruitable shot"
          value={draft.minRecruitableShot}
          min={0} max={90} step={5}
          formatValue={(v) => v === 0 ? 'any chance' : `${v}% or better`}
          onChange={(v) => patch('minRecruitableShot', v)}
        />
      </FilterGroup>

      {/* Apply / Reset bar — sticks to the bottom of the panel for the
          deliberate "I'm done choosing, search now" moment the user asked
          for. Reset wipes the draft to defaults; Apply commits + closes. */}
      <div className="mt-5 pt-4 border-t border-[rgba(245,241,232,0.08)] flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => setDraft(DEFAULT_FILTERS)}
          className="text-[10.5px] uppercase tracking-widest font-mono text-ink-2 hover:text-ink-0"
        >
          Reset
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-ink-1 hover:text-ink-0"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(draft)}
            disabled={!dirty}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              dirty
                ? 'bg-gold text-[#1a1304] hover:bg-[#f5c578]'
                : 'bg-[rgba(245,241,232,0.06)] text-ink-3 cursor-not-allowed'
            }`}
          >
            {draftCount > 0 ? `Search · ${draftCount} filter${draftCount === 1 ? '' : 's'}` : 'Search'}
          </button>
        </div>
      </div>
    </Card>
  )
}

function countActive(f: PowerFilters): number {
  return (f.states.length ? 1 : 0)
       + (f.conferenceQuery.trim() ? 1 : 0)
       + (f.maxCost != null ? 1 : 0)
       + (f.scholarshipsOnly ? 1 : 0)
       + (f.minOpenSpots > 0 ? 1 : 0)
       + (f.minProgramStrength > 0 ? 1 : 0)
       + (f.minRecruitableShot > 0 ? 1 : 0)
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[#7a7468] mb-3">{label}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
        {children}
      </div>
    </div>
  )
}

function FilterFieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-ink-1 font-medium mb-2">{children}</div>
}

function ToggleRow({
  label, value, onChange, hint,
}: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors flex items-center justify-between gap-3 ${
        value
          ? 'bg-[rgba(240,182,90,0.10)] border-[rgba(240,182,90,0.45)]'
          : 'bg-[rgba(245,241,232,0.02)] border-[rgba(245,241,232,0.10)] hover:border-[rgba(240,182,90,0.30)]'
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm text-ink-0">{label}</div>
        {hint && <div className="text-[10.5px] text-[#9a9385] mt-0.5">{hint}</div>}
      </div>
      <div
        className={`w-9 h-5 rounded-full relative transition-colors ${
          value ? 'bg-gold' : 'bg-[rgba(245,241,232,0.10)]'
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-[#1a1304] transition-[left] ${
            value ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </div>
    </button>
  )
}

// ── Compare modal: vertical side-by-side table of saved schools ─────────
//
// Designed for the most-asked questions: which is the best fit, the cheapest,
// the most realistic shot, where are open spots? Vertical layout is mobile
// friendlier than a wide table.
function CompareModal({
  schools, onClose, onUnsave,
}: {
  schools: School[]
  onClose: () => void
  onUnsave: (id: string) => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[linear-gradient(180deg,rgba(31,27,40,0.98)_0%,rgba(20,16,26,0.98)_100%)] border border-[rgba(240,182,90,0.30)] rounded-2xl w-full max-w-6xl my-8 shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-[rgba(20,16,26,0.92)] backdrop-blur-md border-b border-[rgba(245,241,232,0.08)] px-7 py-5 flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold font-bold mb-1">Compare</div>
            <h2 className="kr-h2">Side by side · {schools.length} schools</h2>
            <p className="text-xs text-[#9a9385] mt-2">Best in each row is highlighted.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[rgba(245,241,232,0.05)] hover:bg-[rgba(245,241,232,0.10)] text-[#9a9385] hover:text-[#f5f1e8] flex items-center justify-center text-lg flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="overflow-x-auto px-2 py-4">
          <CompareTable schools={schools} onUnsave={onUnsave} />
        </div>
      </div>
    </div>
  )
}

function CompareTable({ schools, onUnsave }: { schools: School[]; onUnsave: (id: string) => void }) {
  // Highlights the "winning" cell per row. A cell wins when it's strictly
  // best on this metric — ties surface neutrally so we don't lie.
  function pickBest(values: (number | null | undefined)[], higherIsBetter: boolean): number | null {
    const valid = values.map((v, i) => ({ v: v ?? null, i })).filter((x) => x.v != null) as { v: number; i: number }[]
    if (valid.length === 0) return null
    const sorted = [...valid].sort((a, b) => higherIsBetter ? b.v - a.v : a.v - b.v)
    if (sorted.length > 1 && sorted[0].v === sorted[1].v) return null  // tie → no winner
    return sorted[0].i
  }

  const rows: { label: string; render: (s: School) => string; bestIdx: number | null; key: string }[] = [
    { key: 'shot',     label: 'Recruitable Shot',  render: (s) => s.recruitableShot != null ? `${Math.round(s.recruitableShot)}%` : '—', bestIdx: pickBest(schools.map((s) => s.recruitableShot), true) },
    { key: 'match',    label: 'Match score',       render: (s) => s.matchScore.toFixed(1),                                                bestIdx: pickBest(schools.map((s) => s.matchScore), true) },
    { key: 'athletic', label: 'Athletic fit',      render: (s) => (s.athleticFit ?? 0).toFixed(0),                                       bestIdx: pickBest(schools.map((s) => s.athleticFit), true) },
    { key: 'academic', label: 'Academic fit',      render: (s) => (s.academicFit ?? 0).toFixed(0),                                       bestIdx: pickBest(schools.map((s) => s.academicFit), true) },
    { key: 'opens',    label: 'Open spots (pos.)', render: (s) => s.rosterSignal ? `~${s.rosterSignal.openSpots}` : '—',                  bestIdx: pickBest(schools.map((s) => s.rosterSignal?.openSpots), true) },
    { key: 'cost',     label: 'Cost / yr',         render: (s) => s.costOfAttendance != null ? formatMoney(s.costOfAttendance) : '—',     bestIdx: pickBest(schools.map((s) => s.costOfAttendance), false) },
    { key: 'admit',    label: 'Acceptance rate',   render: (s) => s.admissionRate != null ? `${Math.round(s.admissionRate * 100)}%` : '—', bestIdx: pickBest(schools.map((s) => s.admissionRate), true) },
    { key: 'gpa',      label: 'Typical GPA',       render: (s) => s.gpaAvg != null ? s.gpaAvg.toFixed(2) : '—',                            bestIdx: null },
    { key: 'sat',      label: 'SAT (avg)',         render: (s) => s.satMid != null && s.satMid > 0 ? String(s.satMid) : '—',              bestIdx: null },
    { key: 'prog',     label: 'Program strength',  render: (s) => s.programStrength != null ? `${s.programStrength}/10` : '—',           bestIdx: pickBest(schools.map((s) => s.programStrength), true) },
    { key: 'div',      label: 'Division',          render: (s) => s.division,                                                              bestIdx: null },
    { key: 'conf',     label: 'Conference',        render: (s) => s.conference || '—',                                                     bestIdx: null },
    { key: 'size',     label: 'Size',              render: (s) => `${s.size} (${s.enrollment.toLocaleString()})`,                          bestIdx: null },
    { key: 'loc',      label: 'Location',          render: (s) => s.location,                                                              bestIdx: null },
    { key: 'sch',      label: 'Athletic aid',      render: (s) => s.scholarships ? 'Yes' : s.division === 'D3' ? 'No (D3)' : '—',          bestIdx: null },
  ]

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="sticky left-0 z-10 bg-[rgba(20,16,26,0.95)] backdrop-blur-md text-left p-3 font-mono text-[10px] uppercase tracking-widest text-[#9a9385] border-b border-[rgba(245,241,232,0.08)] min-w-[160px]">
            Metric
          </th>
          {schools.map((s) => (
            <th
              key={s.id}
              className="text-left p-3 align-top border-b border-[rgba(245,241,232,0.08)] min-w-[200px]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink-0 leading-tight">{s.name}</div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <Badge variant={catColor[s.category]}>{s.category}</Badge>
                    <Badge variant="muted">{s.division}</Badge>
                  </div>
                </div>
                <button
                  onClick={() => onUnsave(s.id)}
                  className="w-6 h-6 rounded text-[#9a9385] hover:text-[#f87171] hover:bg-[rgba(248,113,113,0.10)] text-base leading-none flex-shrink-0 flex items-center justify-center"
                  title="Remove from compare"
                  aria-label={`Remove ${s.name} from compare`}
                >
                  ×
                </button>
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="hover:bg-[rgba(245,241,232,0.02)]">
            <td className="sticky left-0 bg-[rgba(20,16,26,0.95)] backdrop-blur-md p-3 text-[11px] uppercase tracking-widest text-[#9a9385] font-mono border-b border-[rgba(245,241,232,0.04)]">
              {row.label}
            </td>
            {schools.map((s, i) => {
              const isBest = row.bestIdx === i
              return (
                <td
                  key={s.id}
                  className={`p-3 text-sm border-b border-[rgba(245,241,232,0.04)] ${
                    isBest ? 'text-[#4ade80] font-semibold' : 'text-ink-1'
                  }`}
                >
                  {row.render(s)}
                  {isBest && <span className="ml-1 text-[#4ade80]">★</span>}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
