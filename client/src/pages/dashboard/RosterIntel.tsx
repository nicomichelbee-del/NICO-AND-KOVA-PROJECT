import { useState, useMemo } from 'react'
import { getRosterIntel } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { Division, RosterProgram, PositionNeed, AthleteProfile } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

const demandColor: Record<'High' | 'Medium' | 'Low', string> = {
  High: 'text-[#4ade80] bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)]',
  Medium: 'text-[#fbbf24] bg-[rgba(251,191,36,0.1)] border-[rgba(251,191,36,0.2)]',
  Low: 'text-[#64748b] bg-[rgba(100,116,139,0.1)] border-[rgba(100,116,139,0.2)]',
}

const SOCCER_POSITIONS = [
  'Goalkeeper', 'Center Back', 'Right Back', 'Left Back', 'Defensive Mid',
  'Central Mid', 'Attacking Mid', 'Right Winger', 'Left Winger', 'Striker', 'Forward',
]

export function RosterIntel() {
  const profile = getProfile()
  const [gender, setGender] = useState<'mens' | 'womens'>('womens')
  const [division, setDivision] = useState<Division | 'all'>('all')
  const [positionSearch, setPositionSearch] = useState('')
  const [programs, setPrograms] = useState<RosterProgram[]>([])
  const [positionSummary, setPositionSummary] = useState<PositionNeed[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  async function handleSearch() {
    setError(''); setLoading(true); setPrograms([]); setPositionSummary([])
    try {
      const athletePosition = profile?.position ?? 'Forward'
      const { programs: found, positionSummary: summary } = await getRosterIntel(gender, division, athletePosition)
      setPrograms(found)
      setPositionSummary(summary)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roster data')
    } finally { setLoading(false) }
  }

  const filteredPrograms = useMemo(() => {
    if (!positionSearch.trim()) return programs
    const q = positionSearch.toLowerCase()
    return programs.filter((prog) =>
      prog.seniorsLeaving.some((s) => s.position.toLowerCase().includes(q)) ||
      prog.predictedNeed.some((n) => n.position.toLowerCase().includes(q))
    )
  }, [programs, positionSearch])

  const divisions: (Division | 'all')[] = ['all', 'D1', 'D2', 'D3', 'NAIA', 'JUCO']

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Roster Intel</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Roster Intelligence</h1>
        <p className="text-[#64748b] mt-2 text-sm">
          Find programs losing seniors and predict which positions they need to recruit this cycle.
        </p>
      </div>

      <Card className="p-6 mb-8">
        <div className="flex flex-wrap gap-6 mb-5">
          {/* Gender toggle */}
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Gender</div>
            <div className="flex gap-2">
              {[{ id: 'womens', label: "Women's" }, { id: 'mens', label: "Men's" }].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGender(g.id as 'mens' | 'womens')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                    gender === g.id
                      ? 'bg-[#eab308] text-black border-[#eab308]'
                      : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Division filter */}
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Division</div>
            <div className="flex flex-wrap gap-2">
              {divisions.map((d) => (
                <button
                  key={d}
                  onClick={() => setDivision(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                    division === d
                      ? 'bg-[#eab308] text-black border-[#eab308]'
                      : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? 'Analyzing rosters...' : '📊 Analyze Roster Needs'}
        </Button>
      </Card>

      {positionSummary.length > 0 && (
        <div className="mb-8">
          <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">Position Demand Summary</div>
          <div className="flex flex-wrap gap-3">
            {positionSummary.map((p) => (
              <button
                key={p.position}
                onClick={() => setPositionSearch(positionSearch === p.position ? '' : p.position)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${demandColor[p.demand]} ${positionSearch === p.position ? 'ring-2 ring-[#eab308]' : ''}`}
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
          <div className="p-4 border-b border-[rgba(255,255,255,0.07)] flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#f1f5f9]">
                {filteredPrograms.length} of {programs.length} Programs with Roster Openings
              </div>
              <div className="text-xs text-[#64748b] mt-0.5">Click a row to see all leaving seniors</div>
            </div>
            {/* Position search */}
            <div className="relative">
              <input
                type="text"
                value={positionSearch}
                onChange={(e) => setPositionSearch(e.target.value)}
                placeholder="Search by position..."
                list="positions"
                className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#eab308] w-52"
              />
              <datalist id="positions">
                {SOCCER_POSITIONS.map((p) => <option key={p} value={p} />)}
              </datalist>
              {positionSearch && (
                <button
                  onClick={() => setPositionSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#f1f5f9] text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.07)]">
                  {['School', 'Conference', 'Div', 'All Leaving Seniors', 'High Need Positions', 'Coach'].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPrograms.map((prog) => (
                  <>
                    <tr
                      key={prog.school}
                      onClick={() => setExpandedRow(expandedRow === prog.school ? null : prog.school)}
                      className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4 font-medium text-[#f1f5f9] whitespace-nowrap">{prog.school}</td>
                      <td className="px-5 py-4 text-[#64748b] text-xs whitespace-nowrap">{prog.conference}</td>
                      <td className="px-5 py-4"><Badge variant="muted">{prog.division}</Badge></td>
                      <td className="px-5 py-4 text-[#64748b] text-xs">
                        {prog.seniorsLeaving.map((s) => `${s.count} ${s.position}`).join(', ')}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {prog.predictedNeed.filter((n) => n.level === 'High').map((n) => (
                            <span key={n.position} className={`px-2 py-0.5 rounded text-xs border ${demandColor.High}`}>
                              {n.position}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[#64748b] text-xs whitespace-nowrap">{prog.coachName}</td>
                    </tr>
                    {expandedRow === prog.school && (
                      <tr className="border-b border-[rgba(255,255,255,0.04)] bg-[rgba(234,179,8,0.02)]">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">All Seniors Leaving</div>
                              <div className="flex flex-wrap gap-2">
                                {prog.seniorsLeaving.map((s) => (
                                  <span key={s.position} className="px-3 py-1 rounded-lg border border-[rgba(255,255,255,0.1)] text-xs text-[#f1f5f9]">
                                    {s.count}× {s.position}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">All Recruiting Needs</div>
                              <div className="flex flex-wrap gap-2">
                                {prog.predictedNeed.map((n) => (
                                  <span key={n.position} className={`px-3 py-1 rounded-lg border text-xs font-medium ${demandColor[n.level]}`}>
                                    {n.position}: {n.level}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          {filteredPrograms.length === 0 && positionSearch && (
            <div className="p-10 text-center text-sm text-[#64748b]">
              No programs found needing a <span className="text-[#eab308]">{positionSearch}</span>. Try a different position.
            </div>
          )}
        </Card>
      )}

      {!loading && programs.length === 0 && (
        <Card className="p-16 text-center">
          <div className="text-4xl mb-4">📊</div>
          <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Roster Intelligence</div>
          <p className="text-sm text-[#64748b] max-w-sm mx-auto">
            Select a gender and division, then click Analyze. We'll find programs with graduating seniors and predict their recruitment needs by position.
          </p>
        </Card>
      )}
    </div>
  )
}
