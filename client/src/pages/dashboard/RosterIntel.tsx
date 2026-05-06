import { Fragment, useState, useMemo } from 'react'
import { getRosterIntel } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { PageHeader } from '../../components/ui/PageHeader'
import { REGIONS, regionFromLocation } from '../../lib/region'
import { readLegacyProfile } from '../../lib/profileAdapter'
import type { Division, Region, RosterProgram, PositionNeed, AthleteProfile } from '../../types'

function getProfile(): AthleteProfile | null {
  return readLegacyProfile()
}

const demandColor: Record<'High' | 'Medium' | 'Low', string> = {
  High: 'text-[#4ade80] bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)]',
  Medium: 'text-[#fbbf24] bg-[rgba(251,191,36,0.1)] border-[rgba(251,191,36,0.2)]',
  Low: 'text-[#9a9385] bg-[rgba(100,116,139,0.1)] border-[rgba(100,116,139,0.2)]',
}

const SOCCER_POSITIONS = [
  'Goalkeeper', 'Center Back', 'Outside Back', 'Defensive Midfielder',
  'Central Midfielder', 'Attacking Midfielder', 'Winger', 'Forward', 'Striker',
]

export function RosterIntel() {
  const profile = getProfile()
  const [gender, setGender] = useState<'mens' | 'womens'>('womens')
  const [division, setDivision] = useState<Division | 'all'>('all')
  const [regionFilter, setRegionFilter] = useState<Region>('any')
  const [positionSearch, setPositionSearch] = useState('')
  const [programs, setPrograms] = useState<RosterProgram[]>([])
  const [positionSummary, setPositionSummary] = useState<PositionNeed[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Snapshot of fields used for the last successful search. Drives the
  // "Save changes" CTA — only shows when the current selection differs.
  const [appliedFilters, setAppliedFilters] = useState<{
    gender: 'mens' | 'womens'
    division: Division | 'all'
    region: Region
  } | null>(null)

  const filtersDirty = appliedFilters !== null && (
    appliedFilters.gender !== gender ||
    appliedFilters.division !== division ||
    appliedFilters.region !== regionFilter
  )

  async function handleSearch() {
    setError(''); setLoading(true); setPrograms([]); setPositionSummary([])
    try {
      const athletePosition = profile?.position ?? 'Forward'
      const { programs: found, positionSummary: summary } = await getRosterIntel(gender, division, athletePosition)
      setPrograms(found)
      setPositionSummary(summary)
      setAppliedFilters({ gender, division, region: regionFilter })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roster data')
    } finally { setLoading(false) }
  }

  const filteredPrograms = useMemo(() => {
    return programs.filter((prog) => {
      const matchesRegion = regionFilter === 'any' || regionFromLocation(prog.location) === regionFilter
      if (!matchesRegion) return false
      if (!positionSearch.trim()) return true
      const q = positionSearch.toLowerCase()
      return prog.typicalRecruitingNeeds.some((n) => n.position.toLowerCase().includes(q))
    })
  }, [programs, positionSearch, regionFilter])

  const divisions: (Division | 'all')[] = ['all', 'D1', 'D2', 'D3', 'NAIA', 'JUCO']

  return (
    <div className="kr-page max-w-5xl">
      <PageHeader
        eyebrow="Roster Intelligence"
        title={<>Stop guessing. Start <span className="kr-accent">targeting</span>.</>}
        lede="Programs actively recruiting your position, based on each one's typical class composition."
      />

      <div className="mb-7 p-4 rounded-xl border border-[rgba(240,182,90,0.25)] bg-[rgba(240,182,90,0.05)] flex items-start gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_var(--gold)] mt-2 shrink-0" />
        <p className="text-[13px] text-ink-1 leading-[1.6]">
          <span className="text-gold font-medium">Verified program data.</span> Coach names and program info are sourced from athletic department records (Spring 2026). Recruiting needs reflect each program's typical class composition — confirm details directly with coaches.
        </p>
      </div>

      <Card className="p-6 mb-8">
        <div className="flex flex-wrap gap-6 mb-5">
          <div>
            <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-wider mb-2">Gender</div>
            <div className="flex gap-2">
              {[{ id: 'womens', label: "Women's" }, { id: 'mens', label: "Men's" }].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGender(g.id as 'mens' | 'womens')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                    gender === g.id
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
            <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-wider mb-2">Division</div>
            <div className="flex flex-wrap gap-2">
              {divisions.map((d) => (
                <button
                  key={d}
                  onClick={() => setDivision(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                    division === d
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
            <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-wider mb-2">Region</div>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRegionFilter(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
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
        </div>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? 'Loading...' : appliedFilters ? '📊 Refresh Programs' : '📊 Find Recruiting Programs'}
          </Button>
          {filtersDirty && !loading && (
            <>
              <Button onClick={handleSearch} variant="outline">
                Save changes
              </Button>
              <span className="text-[11px] text-[#9a9385] italic">Filters changed — save to apply.</span>
            </>
          )}
        </div>
      </Card>

      {positionSummary.length > 0 && (
        <div className="mb-8">
          <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-wider mb-3">Position Demand Summary</div>
          <div className="flex flex-wrap gap-3">
            {positionSummary.map((p) => (
              <button
                key={p.position}
                onClick={() => setPositionSearch(positionSearch === p.position ? '' : p.position)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${demandColor[p.demand]} ${positionSearch === p.position ? 'ring-2 ring-[#f0b65a]' : ''}`}
              >
                <span className="font-semibold text-sm">{p.position}</span>
                <span className="text-xs opacity-70">{p.demand} · {p.schoolCount} programs</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {programs.length > 0 && (
        <Card>
          <div className="p-4 border-b border-[rgba(245,241,232,0.08)] flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#f5f1e8]">
                {filteredPrograms.length} of {programs.length} Programs
              </div>
              <div className="text-xs text-[#9a9385] mt-0.5">Click a row to see full recruiting breakdown</div>
            </div>
            <div className="relative">
              <input
                type="text"
                value={positionSearch}
                onChange={(e) => setPositionSearch(e.target.value)}
                placeholder="Filter by position..."
                list="positions"
                className="bg-[rgba(245,241,232,0.05)] border border-[rgba(245,241,232,0.10)] rounded-lg px-3 py-2 text-sm text-[#f5f1e8] placeholder-[#9a9385] focus:outline-none focus:border-[#f0b65a] w-52"
              />
              <datalist id="positions">
                {SOCCER_POSITIONS.map((p) => <option key={p} value={p} />)}
              </datalist>
              {positionSearch && (
                <button onClick={() => setPositionSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9a9385] hover:text-[#f5f1e8] text-xs">✕</button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(245,241,232,0.08)]">
                  {['School', 'Conference', 'Div', 'Formation', 'Actively Recruiting', 'Coach'].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-[#9a9385] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPrograms.map((prog) => (
                  <Fragment key={prog.id}>
                    <tr
                      onClick={() => setExpandedRow(expandedRow === prog.id ? null : prog.id)}
                      className="border-b border-[rgba(245,241,232,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4 font-medium text-[#f5f1e8] whitespace-nowrap">{prog.school}</td>
                      <td className="px-5 py-4 text-[#9a9385] text-xs whitespace-nowrap">{prog.conference}</td>
                      <td className="px-5 py-4"><Badge variant="muted">{prog.division}</Badge></td>
                      <td className="px-5 py-4 text-[#9a9385] text-xs">{prog.formationStyle}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {prog.typicalRecruitingNeeds.filter((n) => n.level === 'High').map((n) => (
                            <span key={n.position} className={`px-2 py-0.5 rounded text-xs border ${demandColor.High}`}>
                              {n.position}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs whitespace-nowrap">
                        <div className="text-[#f5f1e8]">{prog.coachName}</div>
                        {prog.coachEmail && <div className="text-[#9a9385]">{prog.coachEmail}</div>}
                      </td>
                    </tr>
                    {expandedRow === prog.id && (
                      <tr className="border-b border-[rgba(245,241,232,0.04)] bg-[rgba(234,179,8,0.02)]">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-wider mb-2">Full Recruiting Needs</div>
                              <div className="flex flex-wrap gap-2">
                                {prog.typicalRecruitingNeeds.map((n) => (
                                  <span key={n.position} className={`px-3 py-1 rounded-lg border text-xs font-medium ${demandColor[n.level]}`}>
                                    {n.position}: {n.level}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-wider mb-2">Program Notes</div>
                              <p className="text-xs text-[#9a9385] leading-relaxed">{prog.notes}</p>
                              {prog.coachEmail && (
                                <div className="mt-3">
                                  <span className="text-xs text-[#9a9385]">Coach email: </span>
                                  <span className="text-xs text-[#60a5fa]">{prog.coachEmail}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {filteredPrograms.length === 0 && positionSearch && (
            <div className="p-10 text-center text-sm text-[#9a9385]">
              No programs found recruiting a <span className="text-[#f0b65a]">{positionSearch}</span>. Try a different position.
            </div>
          )}
        </Card>
      )}

      {!loading && programs.length === 0 && (
        <Card className="p-16 text-center">
          <div className="text-4xl mb-4">📊</div>
          <div className="font-serif text-xl font-bold text-[#f5f1e8] mb-2">Roster Intelligence</div>
          <p className="text-sm text-[#9a9385] max-w-sm mx-auto">
            Select a gender and division, then click Find Recruiting Programs to see verified programs actively recruiting your position.
          </p>
        </Card>
      )}
    </div>
  )
}
