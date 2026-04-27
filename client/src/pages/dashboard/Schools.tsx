import { useState } from 'react'
import { matchSchools } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import type { AthleteProfile, School } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

const catColor: Record<School['category'], 'blue' | 'gold' | 'green'> = {
  reach: 'blue', target: 'gold', safety: 'green',
}

export function Schools() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | School['category']>('all')

  async function handleMatch() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
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

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">School Matcher</span>
          </div>
          <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Your School Matches</h1>
          <p className="text-[#64748b] mt-2 text-sm">AI-matched reach, target, and safety schools based on your profile.</p>
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
              <Card key={cat} className="p-5 flex items-center gap-4">
                <Badge variant={catColor[cat]}>{cat.toUpperCase()}</Badge>
                <span className="font-serif text-2xl font-black text-[#f1f5f9]">
                  {schools.filter((s) => s.category === cat).length}
                </span>
                <span className="text-xs text-[#64748b]">schools</span>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 mb-6">
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

          <div className="flex flex-col gap-3">
            {filtered.map((school) => (
              <Card key={school.id} hover className="p-5 flex items-center gap-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-bold text-[#f1f5f9] text-sm">{school.name}</span>
                    <Badge variant={catColor[school.category]}>{school.category}</Badge>
                    <Badge variant="muted">{school.division}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#64748b] flex-wrap">
                    <span>📍 {school.location}</span>
                    <span>👥 {school.enrollment.toLocaleString()} students</span>
                    {school.conferece && <span>🏆 {school.conferece}</span>}
                    {school.coachName && <span>👤 {school.coachName}</span>}
                  </div>
                  {school.notes && <p className="text-xs text-[#64748b] mt-2 italic">{school.notes}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-serif text-2xl font-black text-[#eab308]">{school.matchScore}</div>
                  <div className="text-xs text-[#64748b]">match score</div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {!loading && schools.length === 0 && !error && (
        <Card className="p-16 text-center">
          <div className="text-4xl mb-4">🎯</div>
          <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Find your schools</div>
          <p className="text-sm text-[#64748b] mb-6 max-w-xs mx-auto">
            Complete your athlete profile, then click "Find My Schools" to get AI-matched programs.
          </p>
          <Button onClick={handleMatch} disabled={loading}>Find My Schools</Button>
        </Card>
      )}
    </div>
  )
}
