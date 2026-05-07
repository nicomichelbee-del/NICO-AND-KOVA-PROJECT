import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KickrIQLogo } from '../components/ui/KickrIQLogo'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'
import {
  searchCoachPrograms,
  claimCoachProgram,
  getCoachMe,
  updateCoachNeeds,
  type CoachProgram,
} from '../lib/api'
import { InboundFeed } from '../components/coach/InboundFeed'
import { NotificationPrefs } from '../components/coach/NotificationPrefs'

const POSITIONS = [
  'Goalkeeper', 'Center Back', 'Outside Back', 'Defensive Midfielder',
  'Central Midfielder', 'Attacking Midfielder', 'Winger', 'Forward',
]
const LEVELS: ('High' | 'Medium' | 'Low')[] = ['High', 'Medium', 'Low']

export function CoachDashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [program, setProgram] = useState<CoachProgram | null>(null)
  const [error, setError] = useState('')

  // Claim state
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; school: string; conference: string; division: string; gender: 'mens' | 'womens'; location: string }[]>([])
  const [claiming, setClaiming] = useState<string | null>(null)

  useEffect(() => {
    if (!user) { navigate('/for-coaches', { replace: true }); return }
    setLoading(true)
    getCoachMe(user.id)
      .then(({ program }) => {
        if (program) setProgram(program)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [user, navigate])

  useEffect(() => {
    if (!searchQ.trim() || program) { setSearchResults([]); return }
    const timer = setTimeout(() => {
      searchCoachPrograms(searchQ).then(({ programs }) => setSearchResults(programs)).catch(() => {})
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQ, program])

  async function handleClaim(schoolId: string, gender: 'mens' | 'womens') {
    if (!user?.email) return
    setClaiming(schoolId); setError('')
    try {
      const { program: claimed } = await claimCoachProgram(user.id, user.email, schoolId, gender)
      setProgram(claimed)
      setSearchQ(''); setSearchResults([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not claim program')
    } finally { setClaiming(null) }
  }

  async function handleNeedChange(position: string, level: 'High' | 'Medium' | 'Low' | null) {
    if (!user || !program) return
    const next = program.needs.filter((n) => n.position !== position)
    if (level) next.push({ position, level })
    setProgram({ ...program, needs: next })
    try { await updateCoachNeeds(user.id, { needs: next }) } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function handleNotesBlur(notes: string) {
    if (!user || !program) return
    try { await updateCoachNeeds(user.id, { notes }) } catch { /* silent */ }
  }

  return (
    <div className="kickriq min-h-screen">
      <div className="page">
        <header className="knav knav-scrolled">
          <div className="wrap knav-inner">
            <Link to="/" className="brand"><KickrIQLogo height={28} /></Link>
            <div className="knav-cta">
              <span className="text-xs text-[#9a9385] hide-mobile mr-3">{user?.email}</span>
              <button
                onClick={async () => { await signOut(); navigate('/') }}
                className="text-xs font-mono uppercase tracking-wider text-[#9a9385] hover:text-[#f0b65a]"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <section className="section" style={{ paddingTop: 100 }}>
          <div className="wrap" style={{ maxWidth: 980 }}>
            {loading ? (
              <div className="text-center py-16 text-sm text-[#9a9385]">Loading…</div>
            ) : !program ? (
              <div>
                <div className="text-center mb-10">
                  <span className="section-marker" style={{ justifyContent: 'center' }}>Step 1 of 1</span>
                  <h1 className="h-section" style={{ marginTop: 12 }}>Find &amp; claim your program</h1>
                  <p className="lede" style={{ marginTop: 8 }}>
                    Type your school name. We'll match it against our database and verify your email.
                  </p>
                </div>
                <Card className="p-6 max-w-2xl mx-auto">
                  <Input
                    label="Search for your school"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="e.g. Stanford, Wake Forest, Lewis"
                  />
                  {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
                  {searchResults.length > 0 && (
                    <div className="mt-4 flex flex-col gap-2">
                      {searchResults.map((p) => (
                        <button
                          key={`${p.id}-${p.gender}`}
                          onClick={() => handleClaim(p.id, p.gender)}
                          disabled={claiming === p.id}
                          className="text-left px-4 py-3 rounded-lg border border-[rgba(245,241,232,0.08)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(240,182,90,0.45)] hover:bg-[rgba(234,179,8,0.04)] transition-all disabled:opacity-50"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-[#f5f1e8]">{p.school}</div>
                              <div className="text-xs text-[#9a9385]">{p.conference} · {p.division} · {p.gender === 'mens' ? "Men's" : "Women's"} · {p.location}</div>
                            </div>
                            <span className="text-xs font-mono uppercase tracking-wider text-[#f0b65a]">
                              {claiming === p.id ? 'Claiming…' : 'Claim →'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchQ && searchResults.length === 0 && (
                    <p className="text-xs text-[#9a9385] mt-3">No programs found. Try the school's full name.</p>
                  )}
                </Card>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* Program header */}
                <Card className="p-6">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <span className="text-[10.5px] font-mono uppercase tracking-[0.22em] text-[#4ade80]">
                        ✓ Verified · Claimed
                      </span>
                      <h1 className="font-serif text-2xl font-black text-[#f5f1e8] mt-2">{program.school}</h1>
                      <div className="text-sm text-[#9a9385]">{program.conference} · {program.division} · {program.gender === 'mens' ? "Men's" : "Women's"} · {program.location}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono uppercase tracking-wider text-[#9a9385]">Status</div>
                      <div className="font-serif text-sm font-bold text-[#4ade80]">Active</div>
                    </div>
                  </div>
                </Card>

                <NotificationPrefs coachUserId={user!.id} />

                {/* Roster needs editor */}
                <Card className="p-6">
                  <div className="text-xs font-mono uppercase tracking-[0.18em] text-[#f0b65a] mb-1">
                    Your roster needs
                  </div>
                  <p className="text-sm text-[#9a9385] mb-4">
                    Set the level for each position. Changes update the public Open Spots feed within a minute.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {POSITIONS.map((pos) => {
                      const current = program.needs.find((n) => n.position === pos)?.level ?? null
                      return (
                        <div key={pos} className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[rgba(245,241,232,0.06)] bg-[rgba(255,255,255,0.02)]">
                          <span className="text-sm text-[#f5f1e8]">{pos}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleNeedChange(pos, null)}
                              className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition-all ${
                                current === null
                                  ? 'bg-[#9a9385] text-black border-[#9a9385]'
                                  : 'border-[rgba(245,241,232,0.10)] text-[#9a9385] hover:border-[#9a9385]'
                              }`}
                            >
                              None
                            </button>
                            {LEVELS.map((lvl) => (
                              <button
                                key={lvl}
                                onClick={() => handleNeedChange(pos, lvl)}
                                className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider border transition-all ${
                                  current === lvl
                                    ? lvl === 'High'
                                      ? 'bg-[#4ade80] text-black border-[#4ade80]'
                                      : lvl === 'Medium'
                                      ? 'bg-[#fbbf24] text-black border-[#fbbf24]'
                                      : 'bg-[#9a9385] text-black border-[#9a9385]'
                                    : 'border-[rgba(245,241,232,0.10)] text-[#9a9385] hover:border-[#f0b65a]'
                                }`}
                              >
                                {lvl}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>

                {/* Notes */}
                <Card className="p-6">
                  <div className="text-xs font-mono uppercase tracking-[0.18em] text-[#f0b65a] mb-3">Program notes (public)</div>
                  <textarea
                    defaultValue={program.notes}
                    onBlur={(e) => handleNotesBlur(e.target.value)}
                    rows={3}
                    placeholder="One line about your program — system, philosophy, anything recruits should know."
                    className="w-full bg-[rgba(245,241,232,0.04)] border border-[rgba(245,241,232,0.10)] rounded text-sm text-[#f5f1e8] px-3 py-2 focus:outline-none focus:border-[#f0b65a]"
                  />
                </Card>

                {/* Inbound athletes */}
                <Card className="p-6">
                  <div className="text-xs font-mono uppercase tracking-[0.18em] text-[#f0b65a] mb-3">
                    Athletes who emailed you
                  </div>
                  <InboundFeed coachUserId={user!.id} />
                </Card>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
