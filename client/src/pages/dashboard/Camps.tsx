import { useEffect, useMemo, useState } from 'react'
import { findCamps, generateCampEmails, getShowcaseEvents, getIdCamps } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { PageHeader } from '../../components/ui/PageHeader'
import { CampDetailModal } from '../../components/camps/CampDetailModal'
import { REGIONS, regionFromLocation } from '../../lib/region'
import type { AthleteProfile, IdCamp, CampCoach, Division, IdEvent, IdCampEntry, Region, StaffTier } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

type GeneratedEmail = { coachName: string; subject: string; body: string }
type Tab = 'showcase' | 'idcamps' | 'find'
type SelectedItem =
  | { kind: 'event'; data: IdEvent }
  | { kind: 'camp'; data: IdCampEntry }

const ALL_DIVISIONS: Division[] = ['D1', 'D2', 'D3', 'NAIA', 'JUCO']

const divisionColor: Record<string, string> = {
  D1: 'text-[#f87171]', D2: 'text-[#fbbf24]', D3: 'text-[#4ade80]',
  NAIA: 'text-[#60a5fa]', JUCO: 'text-[#a78bfa]',
}

const formatLabel: Record<IdCampEntry['format'], string> = {
  'residential': 'Residential ID Camp',
  'day': 'Day ID Camp',
  'prospect-day': 'Prospect Day',
  'elite-id': 'Elite ID Camp (invitation)',
}

const tierBadge: Record<StaffTier, string> = {
  S: 'bg-[rgba(251,191,36,0.15)] text-[#fbbf24] border-[rgba(251,191,36,0.4)]',
  A: 'bg-[rgba(74,222,128,0.12)] text-[#4ade80] border-[rgba(74,222,128,0.35)]',
  B: 'bg-[rgba(96,165,250,0.12)] text-[#60a5fa] border-[rgba(96,165,250,0.35)]',
  C: 'bg-[rgba(167,139,250,0.12)] text-[#a78bfa] border-[rgba(167,139,250,0.35)]',
  D: 'bg-[rgba(148,163,184,0.12)] text-[#94a3b8] border-[rgba(148,163,184,0.35)]',
}

function TierBadge({ tier }: { tier: StaffTier }) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-widest border rounded px-1.5 py-0.5 ${tierBadge[tier]}`}>
      {tier}-tier
    </span>
  )
}

export function Camps() {
  const [tab, setTab] = useState<Tab>('showcase')

  return (
    <div className="kr-page max-w-5xl">
      <PageHeader
        eyebrow="Camps & showcases"
        title={<>ID camps. <span className="kr-accent">Showcases</span>. Sidelines.</>}
        lede="Multi-school showcase events, individual school ID camps, and a finder for any school you target."
      />

      {/* Honest disclaimer banner — surfaces our data limits up front */}
      <div className="mb-7 p-4 rounded-xl border border-[rgba(240,182,90,0.25)] bg-[rgba(240,182,90,0.05)] flex items-start gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_var(--gold)] mt-2 shrink-0" />
        <div className="text-[13px] text-ink-1 leading-[1.6]">
          <span className="text-gold font-medium">Dates and registration links change every year.</span> We link directly to each program's official registration page where possible, and provide a Google search fallback if a link goes stale. Click any card for details, ratings, and what other athletes said.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[rgba(245,241,232,0.08)] mb-8 overflow-x-auto scrollbar-hide">
        {[
          { id: 'showcase' as const, label: 'Showcase events' },
          { id: 'idcamps' as const, label: 'Major ID camps' },
          { id: 'find' as const, label: 'Find camps at your schools' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 font-mono text-[11px] tracking-[0.18em] uppercase border-b-2 transition-[color,border-color] whitespace-nowrap -mb-px ${
              tab === t.id
                ? 'border-gold text-gold'
                : 'border-transparent text-ink-2 hover:text-ink-0'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'showcase' && <ShowcaseTab />}
      {tab === 'idcamps' && <IdCampsTab />}
      {tab === 'find' && <FindCampsTab />}
    </div>
  )
}

// ── Showcase Events tab: multi-school showcase events (ECNL, Disney, Jefferson Cup, etc.) ──

type ShowcaseFilters = {
  divFilter: Division | 'all'
  genderFilter: 'both' | 'mens' | 'womens'
  regionFilter: Region
  search: string
}
const SHOWCASE_FILTERS_KEY = 'campsShowcaseFilters'
const DEFAULT_SHOWCASE_FILTERS: ShowcaseFilters = {
  divFilter: 'all', genderFilter: 'both', regionFilter: 'any', search: '',
}
function loadShowcaseFilters(): ShowcaseFilters {
  try {
    const raw = localStorage.getItem(SHOWCASE_FILTERS_KEY)
    return raw ? { ...DEFAULT_SHOWCASE_FILTERS, ...(JSON.parse(raw) as ShowcaseFilters) } : DEFAULT_SHOWCASE_FILTERS
  } catch { return DEFAULT_SHOWCASE_FILTERS }
}

function ShowcaseTab() {
  const [events, setEvents] = useState<IdEvent[]>([])
  const [loading, setLoading] = useState(true)
  const initial = loadShowcaseFilters()
  const [divFilter, setDivFilter] = useState<Division | 'all'>(initial.divFilter)
  const [genderFilter, setGenderFilter] = useState<'both' | 'mens' | 'womens'>(initial.genderFilter)
  const [regionFilter, setRegionFilter] = useState<Region>(initial.regionFilter)
  const [search, setSearch] = useState(initial.search)
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [savedFilters, setSavedFilters] = useState<ShowcaseFilters>(initial)
  const [savedFlash, setSavedFlash] = useState(false)

  const filtersDirty = (
    savedFilters.divFilter !== divFilter ||
    savedFilters.genderFilter !== genderFilter ||
    savedFilters.regionFilter !== regionFilter ||
    savedFilters.search !== search
  )

  function saveFilters() {
    const next: ShowcaseFilters = { divFilter, genderFilter, regionFilter, search }
    try { localStorage.setItem(SHOWCASE_FILTERS_KEY, JSON.stringify(next)) } catch { /* */ }
    setSavedFilters(next)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  useEffect(() => {
    getShowcaseEvents()
      .then((res) => setEvents(res.events))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => events.filter((e) => {
    const d = divFilter === 'all' || e.divisions.includes(divFilter)
    const g = genderFilter === 'both' || e.gender === 'both' || e.gender === genderFilter
    const r = regionFilter === 'any' || regionFromLocation(e.location) === regionFilter
    const q = search.trim().toLowerCase()
    const s = !q || e.name.toLowerCase().includes(q) || e.organizer.toLowerCase().includes(q) || e.location.toLowerCase().includes(q)
    return d && g && r && s
  }), [events, divFilter, genderFilter, regionFilter, search])

  return (
    <>
      <Card className="p-5 mb-6">
        <div className="flex flex-wrap gap-6 items-start">
          <div>
            <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-wider mb-2">Division</div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'D1', 'D2', 'D3', 'NAIA', 'JUCO'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDivFilter(d)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all capitalize ${
                    divFilter === d
                      ? 'bg-[#f0b65a] text-black border-[#f0b65a]'
                      : 'bg-transparent text-[#9a9385] border-[rgba(245,241,232,0.10)] hover:border-[#f0b65a] hover:text-[#f0b65a]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-wider mb-2">Gender</div>
            <div className="flex gap-2">
              {[{ id: 'both', label: 'All' }, { id: 'womens', label: "Women's" }, { id: 'mens', label: "Men's" }].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGenderFilter(g.id as 'both' | 'mens' | 'womens')}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                    genderFilter === g.id
                      ? 'bg-[#f0b65a] text-black border-[#f0b65a]'
                      : 'bg-transparent text-[#9a9385] border-[rgba(245,241,232,0.10)] hover:border-[#f0b65a] hover:text-[#f0b65a]'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-wider mb-2">Region</div>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRegionFilter(r)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all capitalize ${
                    regionFilter === r
                      ? 'bg-[#f0b65a] text-black border-[#f0b65a]'
                      : 'bg-transparent text-[#9a9385] border-[rgba(245,241,232,0.10)] hover:border-[#f0b65a] hover:text-[#f0b65a]'
                  }`}
                >
                  {r === 'any' ? 'All' : r}
                </button>
              ))}
            </div>
          </div>

          <div className="ml-auto">
            <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-wider mb-2">Search</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Event, organizer, location…"
              className="bg-[rgba(245,241,232,0.04)] border border-[rgba(245,241,232,0.10)] rounded-lg px-3 py-1.5 text-xs text-[#f5f1e8] placeholder-[#9a9385] focus:outline-none focus:border-[#f0b65a] w-56"
            />
          </div>
        </div>
        {(filtersDirty || savedFlash) && (
          <div className="mt-4 pt-4 border-t border-[rgba(245,241,232,0.06)] flex items-center justify-end gap-3">
            {savedFlash ? (
              <span className="text-[11px] text-[#4ade80] font-mono">✓ Filters saved</span>
            ) : (
              <span className="text-[11px] text-[#f0b65a] italic">Filters changed — save to remember.</span>
            )}
            <Button onClick={saveFilters} disabled={!filtersDirty} size="sm" variant="outline">
              Save filters
            </Button>
          </div>
        )}
      </Card>

      <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-wider mb-4">
        {loading ? 'Loading…' : `${filtered.length} Showcase Event${filtered.length !== 1 ? 's' : ''}`}
      </div>

      <div className="flex flex-col gap-4">
        {filtered.map((event) => (
          <Card key={event.id} hover className="p-5">
            <button
              type="button"
              onClick={() => setSelected({ kind: 'event', data: event })}
              className="text-left w-full"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-bold text-[#f5f1e8] text-sm">{event.name}</span>
                    <TierBadge tier={event.staffTier} />
                  </div>
                  <div className="text-xs text-[#9a9385]">{event.organizer}</div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                  {event.divisions.map((d) => (
                    <span key={d} className={`text-xs font-bold ${divisionColor[d] ?? 'text-[#9a9385]'}`}>{d}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-3 text-xs text-[#9a9385]">
                <div>📅 {event.dateRange}</div>
                <div>📍 {event.location}</div>
                <div>👥 {event.coachAttendance}</div>
                <div>💰 {event.costRange}</div>
              </div>
              <p className="text-xs text-[#9a9385] italic mb-3 leading-relaxed">{event.notes}</p>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-xs text-[#f0b65a] font-semibold">Click for details, ratings & comments →</span>
                <span className="text-xs text-[#9a9385]">
                  {event.gender === 'both' ? "Men's & Women's" : event.gender === 'womens' ? "Women's only" : "Men's only"}
                </span>
              </div>
            </button>
          </Card>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <Card className="p-12 text-center">
          <div className="text-3xl mb-3">🌍</div>
          <p className="text-sm text-[#9a9385]">No events match the selected filters.</p>
        </Card>
      )}

      <CampDetailModal item={selected} onClose={() => setSelected(null)} />
    </>
  )
}

// ── Major ID Camps tab: curated single-school ID camps ──

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const
type Month = typeof MONTHS[number] | 'any'

const FORMAT_OPTIONS: Array<{ id: IdCampEntry['format'] | 'any'; label: string }> = [
  { id: 'any',           label: 'All formats' },
  { id: 'residential',   label: 'Residential' },
  { id: 'day',           label: 'Day' },
  { id: 'prospect-day',  label: 'Prospect day' },
  { id: 'elite-id',      label: 'Elite ID (invite)' },
]

const TIER_ORDER: Record<StaffTier, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 }

type SortKey = 'match' | 'school' | 'tier'

/**
 * Match score for a single ID camp against the athlete's profile.
 * Returns 0–100. Athlete profile is optional — when missing, returns null.
 *
 *  - Division match (athlete's targetDivision === camp.division): +35
 *  - Gender alignment: +20 (camp gender === athlete or camp is "both")
 *  - Region preference (athlete.locationPreference === camp.region): +20 (any → +5)
 *  - Tier quality: S +20, A +15, B +10, C +5, D 0
 *  - GPA proxy: D3/Ivy-leaning prospect days reward higher GPAs slightly
 */
function computeCampMatch(camp: IdCampEntry, profile: AthleteProfile | null): number | null {
  if (!profile) return null
  let score = 0

  if (profile.targetDivision === camp.division) score += 35
  else if (
    (profile.targetDivision === 'D1' && camp.division === 'D2') ||
    (profile.targetDivision === 'D2' && (camp.division === 'D1' || camp.division === 'D3')) ||
    (profile.targetDivision === 'D3' && (camp.division === 'D2' || camp.division === 'NAIA')) ||
    (profile.targetDivision === 'NAIA' && (camp.division === 'D3' || camp.division === 'JUCO')) ||
    (profile.targetDivision === 'JUCO' && camp.division === 'NAIA')
  ) {
    score += 18
  }

  if (camp.gender === 'both' || camp.gender === profile.gender) score += 20

  if (profile.locationPreference === 'any') score += 5
  else if (profile.locationPreference === camp.region) score += 20

  score += { S: 20, A: 15, B: 10, C: 5, D: 0 }[camp.staffTier]

  // GPA bonus: prospect-day camps lean academic — reward higher GPAs slightly
  if (camp.format === 'prospect-day' && profile.gpa >= 3.6) score += 5

  return Math.min(100, score)
}

function campContainsMonth(camp: IdCampEntry, month: Month): boolean {
  if (month === 'any') return true
  return camp.typicalMonths.toLowerCase().includes(month.toLowerCase())
}

type IdCampsFilters = {
  search: string
  divFilter: Division | 'any'
  regionFilter: Region
  genderFilter: 'any' | 'mens' | 'womens'
  tierFilter: StaffTier | 'any'
  formatFilter: IdCampEntry['format'] | 'any'
  monthFilter: Month
  sortKey: SortKey
}
const IDCAMPS_FILTERS_KEY = 'campsIdCampsFilters'
const DEFAULT_IDCAMPS_FILTERS: IdCampsFilters = {
  search: '', divFilter: 'any', regionFilter: 'any', genderFilter: 'any',
  tierFilter: 'any', formatFilter: 'any', monthFilter: 'any', sortKey: 'school',
}
function loadIdCampsFilters(fallbackSort: SortKey): IdCampsFilters {
  const base = { ...DEFAULT_IDCAMPS_FILTERS, sortKey: fallbackSort }
  try {
    const raw = localStorage.getItem(IDCAMPS_FILTERS_KEY)
    if (!raw) return base
    return { ...base, ...(JSON.parse(raw) as IdCampsFilters) }
  } catch { return base }
}

function IdCampsTab() {
  const [camps, setCamps] = useState<IdCampEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [profile] = useState<AthleteProfile | null>(() => getProfile())

  const initial = loadIdCampsFilters(profile ? 'match' : 'school')
  // Filter state
  const [search, setSearch] = useState(initial.search)
  const [divFilter, setDivFilter] = useState<Division | 'any'>(initial.divFilter)
  const [regionFilter, setRegionFilter] = useState<Region>(initial.regionFilter)
  const [genderFilter, setGenderFilter] = useState<'any' | 'mens' | 'womens'>(initial.genderFilter)
  const [tierFilter, setTierFilter] = useState<StaffTier | 'any'>(initial.tierFilter)
  const [formatFilter, setFormatFilter] = useState<IdCampEntry['format'] | 'any'>(initial.formatFilter)
  const [monthFilter, setMonthFilter] = useState<Month>(initial.monthFilter)
  const [sortKey, setSortKey] = useState<SortKey>(initial.sortKey)
  const [savedFilters, setSavedFilters] = useState<IdCampsFilters>(initial)
  const [savedFlash, setSavedFlash] = useState(false)

  const filtersDirty = (
    savedFilters.search !== search ||
    savedFilters.divFilter !== divFilter ||
    savedFilters.regionFilter !== regionFilter ||
    savedFilters.genderFilter !== genderFilter ||
    savedFilters.tierFilter !== tierFilter ||
    savedFilters.formatFilter !== formatFilter ||
    savedFilters.monthFilter !== monthFilter ||
    savedFilters.sortKey !== sortKey
  )

  function saveFilters() {
    const next: IdCampsFilters = { search, divFilter, regionFilter, genderFilter, tierFilter, formatFilter, monthFilter, sortKey }
    try { localStorage.setItem(IDCAMPS_FILTERS_KEY, JSON.stringify(next)) } catch { /* */ }
    setSavedFilters(next)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  useEffect(() => {
    getIdCamps()
      .then((res) => setCamps(res.camps))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = camps
      .filter((c) => {
        if (divFilter !== 'any' && c.division !== divFilter) return false
        if (regionFilter !== 'any' && c.region !== regionFilter) return false
        if (genderFilter !== 'any' && c.gender !== 'both' && c.gender !== genderFilter) return false
        if (tierFilter !== 'any' && c.staffTier !== tierFilter) return false
        if (formatFilter !== 'any' && c.format !== formatFilter) return false
        if (!campContainsMonth(c, monthFilter)) return false
        if (q && !c.schoolName.toLowerCase().includes(q) && !c.campName.toLowerCase().includes(q)) return false
        return true
      })
      .map((c) => ({ camp: c, match: computeCampMatch(c, profile) }))

    if (sortKey === 'match' && profile) {
      rows.sort((a, b) => (b.match ?? 0) - (a.match ?? 0) || a.camp.schoolName.localeCompare(b.camp.schoolName))
    } else if (sortKey === 'tier') {
      rows.sort((a, b) => TIER_ORDER[a.camp.staffTier] - TIER_ORDER[b.camp.staffTier] || a.camp.schoolName.localeCompare(b.camp.schoolName))
    } else {
      rows.sort((a, b) => a.camp.schoolName.localeCompare(b.camp.schoolName))
    }
    return rows
  }, [camps, search, divFilter, regionFilter, genderFilter, tierFilter, formatFilter, monthFilter, sortKey, profile])

  const activeFilterCount =
    (divFilter !== 'any' ? 1 : 0) +
    (regionFilter !== 'any' ? 1 : 0) +
    (genderFilter !== 'any' ? 1 : 0) +
    (tierFilter !== 'any' ? 1 : 0) +
    (formatFilter !== 'any' ? 1 : 0) +
    (monthFilter !== 'any' ? 1 : 0) +
    (search ? 1 : 0)

  function clearAll() {
    setSearch(''); setDivFilter('any'); setRegionFilter('any')
    setGenderFilter('any'); setTierFilter('any'); setFormatFilter('any'); setMonthFilter('any')
  }

  return (
    <>
      {/* Filter panel */}
      <div className="kr-panel mb-6 space-y-5">
        <FilterRow label="Division">
          <FilterChip active={divFilter === 'any'} onClick={() => setDivFilter('any')}>All</FilterChip>
          {ALL_DIVISIONS.map((d) => (
            <FilterChip key={d} active={divFilter === d} onClick={() => setDivFilter(d)}>{d}</FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Region">
          {REGIONS.map((r) => (
            <FilterChip key={r} active={regionFilter === r} onClick={() => setRegionFilter(r)}>
              {r === 'any' ? 'All' : r}
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Gender">
          <FilterChip active={genderFilter === 'any'} onClick={() => setGenderFilter('any')}>All</FilterChip>
          <FilterChip active={genderFilter === 'womens'} onClick={() => setGenderFilter('womens')}>Women's</FilterChip>
          <FilterChip active={genderFilter === 'mens'} onClick={() => setGenderFilter('mens')}>Men's</FilterChip>
        </FilterRow>

        <FilterRow label="Tier">
          <FilterChip active={tierFilter === 'any'} onClick={() => setTierFilter('any')}>All</FilterChip>
          {(['S', 'A', 'B', 'C', 'D'] as StaffTier[]).map((t) => (
            <FilterChip key={t} active={tierFilter === t} onClick={() => setTierFilter(t)}>{t}-tier</FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Format">
          {FORMAT_OPTIONS.map((f) => (
            <FilterChip key={f.id} active={formatFilter === f.id} onClick={() => setFormatFilter(f.id)}>{f.label}</FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Month">
          <FilterChip active={monthFilter === 'any'} onClick={() => setMonthFilter('any')}>Any month</FilterChip>
          {MONTHS.map((m) => (
            <FilterChip key={m} active={monthFilter === m} onClick={() => setMonthFilter(m)}>
              {m.slice(0, 3)}
            </FilterChip>
          ))}
        </FilterRow>

        <div className="flex items-center gap-3 flex-wrap pt-3 border-t border-[rgba(245,241,232,0.06)]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by school or camp name…"
            className="flex-1 min-w-64 bg-[rgba(245,241,232,0.03)] border border-[rgba(245,241,232,0.10)] rounded-full px-4 py-2.5 text-[14px] text-ink-0 placeholder-ink-3 caret-gold focus:outline-none focus:border-[rgba(240,182,90,0.55)] focus:ring-[3px] focus:ring-[rgba(240,182,90,0.18)] transition-[border-color,box-shadow]"
          />
          {activeFilterCount > 0 && (
            <button
              onClick={clearAll}
              className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-2 hover:text-ink-0 px-3 py-2"
            >
              Clear filters · {activeFilterCount}
            </button>
          )}
          {(filtersDirty || savedFlash) && (
            <div className="flex items-center gap-2 ml-auto">
              {savedFlash ? (
                <span className="text-[11px] text-[#4ade80] font-mono">✓ Saved</span>
              ) : (
                <span className="text-[11px] text-[#f0b65a] italic">Filters changed</span>
              )}
              <Button onClick={saveFilters} disabled={!filtersDirty} size="sm" variant="outline">
                Save filters
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Sort + count bar */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-2">
          {loading ? 'Loading…' : `${filtered.length} camp${filtered.length !== 1 ? 's' : ''}`}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] tracking-[0.20em] uppercase text-ink-3 mr-1">Sort</span>
          {profile && (
            <FilterChip active={sortKey === 'match'} onClick={() => setSortKey('match')}>Best match</FilterChip>
          )}
          <FilterChip active={sortKey === 'tier'} onClick={() => setSortKey('tier')}>Tier (S→D)</FilterChip>
          <FilterChip active={sortKey === 'school'} onClick={() => setSortKey('school')}>School A–Z</FilterChip>
        </div>
      </div>

      {/* No-profile nudge */}
      {!profile && !loading && (
        <div className="mb-5 p-4 rounded-xl border border-[rgba(240,182,90,0.25)] bg-[rgba(240,182,90,0.05)] flex items-start gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_var(--gold)] mt-2 shrink-0" />
          <div className="text-[13px] text-ink-1 leading-[1.6]">
            <span className="text-gold font-medium">Complete your athlete profile</span> to unlock match scores tuned to your division, region, gender, and academics.
          </div>
        </div>
      )}

      {/* Camp cards */}
      <div className="flex flex-col gap-3">
        {filtered.map(({ camp, match }) => (
          <button
            key={camp.id}
            type="button"
            onClick={() => setSelected({ kind: 'camp', data: camp })}
            className="text-left w-full bg-[linear-gradient(180deg,rgba(31,27,40,0.82)_0%,rgba(24,20,32,0.82)_100%)] border border-[rgba(245,241,232,0.08)] rounded-2xl p-6 transition-[transform,border-color,box-shadow] duration-200 hover:border-[rgba(240,182,90,0.40)] hover:-translate-y-[2px] hover:shadow-[0_12px_30px_rgba(0,0,0,0.30)] cursor-pointer group"
          >
            <div className="flex items-start justify-between gap-5 flex-wrap">
              <div className="min-w-0 flex-1">
                {/* School name as headline */}
                <div className="font-serif text-[22px] leading-[1.15] text-ink-0 tracking-[-0.015em] mb-1" style={{ fontVariationSettings: '"opsz" 96' }}>
                  {camp.schoolName}
                </div>
                <div className="text-[14px] text-ink-1 mb-3">{camp.campName}</div>

                {/* Chip row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={camp.staffTier === 'S' ? 'gold' : camp.staffTier === 'A' ? 'green' : camp.staffTier === 'B' ? 'blue' : 'muted'}>
                    {camp.staffTier}-tier
                  </Badge>
                  <Badge variant="muted">{camp.division}</Badge>
                  <Badge variant="muted">{camp.gender === 'both' ? 'Co-ed' : camp.gender === 'womens' ? "Women's" : "Men's"}</Badge>
                  <Badge variant="muted">{camp.region}</Badge>
                  <Badge variant="muted">{formatLabel[camp.format]}</Badge>
                </div>
              </div>

              {/* Match score badge */}
              {match != null && (
                <div className="text-right flex-shrink-0">
                  <div
                    className="font-serif text-[34px] leading-none tabular-nums"
                    style={{
                      fontVariationSettings: '"opsz" 144',
                      color: match >= 75 ? 'var(--gold)' : match >= 50 ? 'var(--fg-0)' : 'var(--fg-2)',
                    }}
                  >
                    {match}
                  </div>
                  <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-3 mt-1.5">
                    your match
                  </div>
                </div>
              )}
            </div>

            {/* Facts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 mt-5 pt-4 border-t border-[rgba(245,241,232,0.06)]">
              <Fact label="When" value={camp.typicalMonths} />
              <Fact label="Ages" value={camp.ageRange} />
              <Fact label="Cost" value={camp.estimatedCost} />
              <Fact label="Region" value={camp.region} />
            </div>

            {camp.notes && (
              <p className="text-[13px] text-ink-2 italic mt-4 leading-[1.6]">{camp.notes}</p>
            )}

            <div className="flex items-center gap-2 mt-4 font-mono text-[10.5px] tracking-[0.18em] uppercase text-gold group-hover:translate-x-0.5 transition-transform">
              Open details
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>
              </svg>
            </div>
          </button>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <Card className="p-12 text-center">
          <span className="kr-eyebrow justify-center">Nothing matches</span>
          <h2 className="kr-h2 mt-4">No camps fit those filters.</h2>
          <p className="text-[14px] text-ink-1 mt-3 mb-7 max-w-md mx-auto leading-[1.6]">
            Try loosening a filter or use the "Find camps at your schools" tab to look up any program.
          </p>
          {activeFilterCount > 0 && <Button onClick={clearAll}>Clear all filters</Button>}
        </Card>
      )}

      <CampDetailModal item={selected} onClose={() => setSelected(null)} />
    </>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 flex-wrap">
      <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-2 w-20 pt-1.5 shrink-0">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5 flex-1">{children}</div>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full font-mono text-[10.5px] tracking-[0.14em] uppercase border transition-[border-color,background,color] ${
        active
          ? 'bg-gold text-[#1a1304] border-gold'
          : 'bg-transparent text-ink-2 border-[rgba(245,241,232,0.10)] hover:border-[rgba(240,182,90,0.45)] hover:text-ink-0'
      }`}
    >
      {children}
    </button>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-3 mb-1">{label}</div>
      <div className="text-[13px] text-ink-1 truncate">{value}</div>
    </div>
  )
}

// ── Find Camps tab: user-driven lookup for arbitrary schools ──

const FIND_CAMPS_TARGETS_KEY = 'campsFindTargetSchools'
function loadFindCampsTargets(): { name: string; division: Division }[] {
  try {
    const raw = localStorage.getItem(FIND_CAMPS_TARGETS_KEY)
    return raw ? (JSON.parse(raw) as { name: string; division: Division }[]) : []
  } catch { return [] }
}

function FindCampsTab() {
  const initialTargets = loadFindCampsTargets()
  const [targetSchools, setTargetSchools] = useState<{ name: string; division: Division }[]>(initialTargets)
  const [savedTargets, setSavedTargets] = useState<{ name: string; division: Division }[]>(initialTargets)
  const [savedFlash, setSavedFlash] = useState(false)
  const [schoolInput, setSchoolInput] = useState('')
  const [schoolDivision, setSchoolDivision] = useState<Division>('D1')
  const [camps, setCamps] = useState<IdCamp[]>([])
  const [resultSearch, setResultSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedCamp, setSelectedCamp] = useState<IdCamp | null>(null)
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([])
  const [emailLoading, setEmailLoading] = useState(false)
  const [emails, setEmails] = useState<GeneratedEmail[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null)

  const targetsDirty = (
    targetSchools.length !== savedTargets.length ||
    targetSchools.some((t, i) => t.name !== savedTargets[i]?.name || t.division !== savedTargets[i]?.division)
  )

  function saveTargets() {
    try { localStorage.setItem(FIND_CAMPS_TARGETS_KEY, JSON.stringify(targetSchools)) } catch { /* */ }
    setSavedTargets(targetSchools)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  function addSchool() {
    if (!schoolInput.trim() || targetSchools.length >= 8) return
    if (targetSchools.some((s) => s.name.toLowerCase() === schoolInput.trim().toLowerCase())) return
    setTargetSchools((prev) => [...prev, { name: schoolInput.trim(), division: schoolDivision }])
    setSchoolInput('')
  }

  function removeSchool(name: string) {
    setTargetSchools((prev) => prev.filter((s) => s.name !== name))
  }

  async function handleFindCamps() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    if (targetSchools.length === 0) { setError('Add at least one school above.'); return }
    setError(''); setLoading(true); setCamps([]); setSelectedCamp(null); setEmails([]); setResultSearch('')
    try {
      const { camps: found } = await findCamps(profile, targetSchools)
      setCamps(found)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to find camps')
    } finally { setLoading(false) }
  }

  function toggleCoach(name: string) {
    setSelectedCoaches((prev) => prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name])
  }

  function selectCamp(camp: IdCamp) {
    setSelectedCamp(camp)
    setSelectedCoaches(camp.coaches.map((c) => c.name))
    setEmails([])
  }

  async function handleGenerateEmails() {
    const profile = getProfile()
    if (!profile || !selectedCamp) return
    const coachObjs: CampCoach[] = selectedCamp.coaches.filter((c) => selectedCoaches.includes(c.name))
    setEmailLoading(true)
    try {
      const { emails: generated } = await generateCampEmails(profile, selectedCamp, coachObjs)
      setEmails(generated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate emails')
    } finally { setEmailLoading(false) }
  }

  async function copyEmail(idx: number, text: string) {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <>
      <Card className="p-6 mb-8">
        <div className="text-sm font-semibold text-[#f5f1e8] mb-4">Add up to 8 schools — we'll point you to each program's current ID-camp registration page.</div>
        <div className="flex gap-3 mb-4 flex-wrap">
          <input
            type="text"
            value={schoolInput}
            onChange={(e) => setSchoolInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSchool()}
            placeholder="University name..."
            className="flex-1 min-w-48 bg-[rgba(245,241,232,0.05)] border border-[rgba(245,241,232,0.10)] rounded-lg px-3 py-2 text-sm text-[#f5f1e8] placeholder-[#9a9385] focus:outline-none focus:border-[#f0b65a]"
          />
          <div className="flex gap-1">
            {ALL_DIVISIONS.map((d) => (
              <button
                key={d}
                onClick={() => setSchoolDivision(d)}
                className={`px-2.5 py-2 rounded text-xs font-semibold border transition-all ${
                  schoolDivision === d
                    ? 'bg-[#f0b65a] text-black border-[#f0b65a]'
                    : 'bg-transparent text-[#9a9385] border-[rgba(245,241,232,0.10)] hover:border-[#f0b65a]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <Button onClick={addSchool} disabled={!schoolInput.trim() || targetSchools.length >= 8} size="sm">+ Add</Button>
        </div>

        {targetSchools.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {targetSchools.map((s) => (
              <div key={s.name} className="flex items-center gap-2 px-3 py-1.5 bg-[rgba(240,182,90,0.08)] border border-[rgba(240,182,90,0.25)] rounded-lg">
                <span className={`text-xs font-bold ${divisionColor[s.division]}`}>{s.division}</span>
                <span className="text-sm text-[#f5f1e8]">{s.name}</span>
                <button onClick={() => removeSchool(s.name)} className="text-[#9a9385] hover:text-[#f5f1e8] text-xs ml-1">✕</button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleFindCamps} disabled={loading || targetSchools.length === 0}>
            {loading ? 'Searching…' : `🔍 Find ID Camps at ${targetSchools.length} School${targetSchools.length !== 1 ? 's' : ''}`}
          </Button>
          {(targetsDirty || savedFlash) && (
            <>
              <Button onClick={saveTargets} disabled={!targetsDirty} size="sm" variant="outline">
                {savedFlash ? '✓ Saved' : 'Save schools'}
              </Button>
              {!savedFlash && (
                <span className="text-[11px] text-[#f0b65a] italic">List changed — save to remember.</span>
              )}
            </>
          )}
        </div>
      </Card>

      {camps.length > 0 && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-wider">
                {(() => {
                  const q = resultSearch.trim().toLowerCase()
                  const visible = q ? camps.filter((c) => c.campName.toLowerCase().includes(q) || c.school.toLowerCase().includes(q)) : camps
                  return `${visible.length} Result${visible.length !== 1 ? 's' : ''}${q ? ` of ${camps.length}` : ''}`
                })()}
              </div>
              <input
                value={resultSearch}
                onChange={(e) => setResultSearch(e.target.value)}
                placeholder="🔍 Filter results…"
                className="bg-[rgba(245,241,232,0.04)] border border-[rgba(245,241,232,0.10)] rounded-lg px-3 py-1.5 text-xs text-[#f5f1e8] placeholder-[#9a9385] focus:outline-none focus:border-[#f0b65a] w-48"
              />
            </div>
            <div className="flex flex-col gap-3">
              {camps.filter((c) => {
                const q = resultSearch.trim().toLowerCase()
                return !q || c.campName.toLowerCase().includes(q) || c.school.toLowerCase().includes(q)
              }).map((camp) => (
                <button
                  key={camp.id}
                  onClick={() => selectCamp(camp)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    selectedCamp?.id === camp.id
                      ? 'border-[#f0b65a] bg-[rgba(240,182,90,0.06)]'
                      : 'border-[rgba(245,241,232,0.08)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(240,182,90,0.35)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="font-medium text-[#f5f1e8] text-sm leading-snug">{camp.campName}</div>
                    <span className={`text-xs font-bold flex-shrink-0 ${divisionColor[camp.division] ?? 'text-[#9a9385]'}`}>{camp.division}</span>
                  </div>
                  <div className="text-xs text-[#f0b65a] font-medium mb-1">{camp.school}</div>
                  <div className="text-xs text-[#9a9385] italic">{camp.date}</div>
                  <a href={camp.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-[#60a5fa] hover:underline mt-1.5 inline-block">
                    🔗 Open registration search
                  </a>
                </button>
              ))}
            </div>
          </div>

          <div>
            {selectedCamp ? (
              <div className="flex flex-col gap-4">
                <Card className="p-5">
                  <div className="font-serif text-lg font-bold text-[#f5f1e8] mb-1">{selectedCamp.campName}</div>
                  <div className="text-xs text-[#f0b65a] mb-3">{selectedCamp.school}</div>
                  <div className="flex flex-col gap-1.5 mb-4 text-xs text-[#9a9385]">
                    <div className="italic">📅 {selectedCamp.date}</div>
                    {selectedCamp.url && (
                      <a href={selectedCamp.url} target="_blank" rel="noopener noreferrer" className="text-[#60a5fa] hover:underline">
                        🔗 Find current registration page
                      </a>
                    )}
                  </div>

                  <div className="text-xs font-semibold text-[#f5f1e8] uppercase tracking-wider mb-2">Coaches to email</div>
                  <p className="text-[11px] text-[#9a9385] italic mb-3">Coach name unknown — confirm on the school's roster page before sending. The email generator will use a generic salutation.</p>
                  <div className="flex flex-col gap-2 mb-4">
                    {selectedCamp.coaches.map((coach) => (
                      <label key={coach.name} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[rgba(245,241,232,0.03)] transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedCoaches.includes(coach.name)}
                          onChange={() => toggleCoach(coach.name)}
                          className="w-4 h-4 accent-[#f0b65a]"
                        />
                        <div>
                          <div className="text-sm text-[#f5f1e8]">{coach.name}</div>
                          <div className="text-xs text-[#9a9385]">{coach.title}</div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <Button onClick={handleGenerateEmails} disabled={emailLoading || selectedCoaches.length === 0} className="w-full">
                    {emailLoading ? 'Generating...' : `✉️ Generate ${selectedCoaches.length} Email${selectedCoaches.length !== 1 ? 's' : ''}`}
                  </Button>
                </Card>

                {emails.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-wider">{emails.length} Emails Ready</div>
                    {emails.map((email, idx) => (
                      <Card key={idx} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-sm font-medium text-[#f5f1e8]">{email.coachName}</div>
                            <div className="text-xs text-[#9a9385]">{email.subject}</div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setExpandedEmail(expandedEmail === idx ? null : idx)} className="text-xs text-[#9a9385] hover:text-[#f5f1e8] px-2 py-1 border border-[rgba(245,241,232,0.10)] rounded">
                              {expandedEmail === idx ? 'Hide' : 'View'}
                            </button>
                            <button onClick={() => copyEmail(idx, `Subject: ${email.subject}\n\n${email.body}`)} className="text-xs text-[#f0b65a] hover:text-[#c47a16] px-2 py-1 border border-[rgba(240,182,90,0.35)] rounded">
                              {copiedIdx === idx ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                        {expandedEmail === idx && (
                          <pre className="text-xs text-[#9a9385] whitespace-pre-wrap font-sans leading-relaxed mt-3 pt-3 border-t border-[rgba(245,241,232,0.08)]">
                            {email.body}
                          </pre>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Card className="p-12 h-full flex flex-col items-center justify-center text-center">
                <div className="text-3xl mb-3">⛺</div>
                <div className="font-serif text-base font-bold text-[#f5f1e8] mb-1">Select a camp</div>
                <p className="text-xs text-[#9a9385]">Click any result to draft outreach emails to the coaching staff.</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {!loading && camps.length === 0 && targetSchools.length === 0 && (
        <Card className="p-16 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <div className="font-serif text-xl font-bold text-[#f5f1e8] mb-2">Find ID camps at any school</div>
          <p className="text-sm text-[#9a9385] max-w-md mx-auto">Add up to 8 schools above. For each school we generate a Google search link that returns the current ID-camp registration page — no fabricated URLs.</p>
        </Card>
      )}
    </>
  )
}
