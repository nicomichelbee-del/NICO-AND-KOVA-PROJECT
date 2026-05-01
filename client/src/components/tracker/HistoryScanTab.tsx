import { useState, useMemo } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { gmailHistoryScan, createContact } from '../../lib/api'
import type { HistoryEmail, Division } from '../../types'

interface Props {
  userId: string
  gmailConnected: boolean
  onContactAdded: () => void
}

const CATEGORY_CFG = {
  id_camp: { label: 'ID Camp', style: 'bg-[rgba(139,92,246,0.15)] border-[rgba(139,92,246,0.3)] text-[#a78bfa]' },
  coach:   { label: 'Coach Email', style: 'bg-[rgba(96,165,250,0.1)] border-[rgba(96,165,250,0.2)] text-[#60a5fa]' },
}

const RATING_CFG = {
  hot:           { label: '🔥 Hot',          border: 'border-l-[#4ade80]', badge: 'bg-[rgba(74,222,128,0.12)] border-[rgba(74,222,128,0.3)] text-[#4ade80]',  scoreColor: 'text-[#4ade80]' },
  warm:          { label: '☀️ Warm',         border: 'border-l-[#fbbf24]', badge: 'bg-[rgba(251,191,36,0.12)] border-[rgba(251,191,36,0.3)] text-[#fbbf24]',  scoreColor: 'text-[#fbbf24]' },
  cold:          { label: '❄️ Cold',         border: 'border-l-[#60a5fa]', badge: 'bg-[rgba(96,165,250,0.1)] border-[rgba(96,165,250,0.2)] text-[#60a5fa]',   scoreColor: 'text-[#60a5fa]' },
  not_interested:{ label: '⛔ Pass',         border: 'border-l-[#475569]', badge: 'bg-[rgba(71,85,105,0.15)] border-[rgba(71,85,105,0.3)] text-[#64748b]',    scoreColor: 'text-[#64748b]' },
}

type SortKey = 'score' | 'date' | 'genuineness'
type CategoryFilter = 'all' | 'coach' | 'id_camp'
type TrackFilter = 'all' | 'untracked'
type RatingFilter = 'all' | 'hot' | 'warm' | 'cold'

function ScoreBar({ value, color }: { value: number; color: string }) {
  const pct = Math.round((value / 10) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.07)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold w-6 text-right" style={{ color: 'inherit' }}>{value}</span>
    </div>
  )
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return '' }
}

export function HistoryScanTab({ userId, gmailConnected, onContactAdded }: Props) {
  const [emails, setEmails] = useState<HistoryEmail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scanned, setScanned] = useState(false)

  const [sortBy, setSortBy] = useState<SortKey>('score')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('all')
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all')

  const [adding, setAdding] = useState<string | null>(null)
  const [addCoachName, setAddCoachName] = useState('')
  const [addSchoolName, setAddSchoolName] = useState('')
  const [addDivision, setAddDivision] = useState<Division>('D1')
  const [addLoading, setAddLoading] = useState(false)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  async function handleScan() {
    setLoading(true); setError('')
    try {
      const { emails: found } = await gmailHistoryScan(userId)
      setEmails(found)
      setScanned(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed — check Gmail connection')
    } finally { setLoading(false) }
  }

  async function handleAdd(email: HistoryEmail) {
    if (!addSchoolName) return
    setAddLoading(true)
    try {
      await createContact(userId, {
        coachName: addCoachName, schoolName: addSchoolName,
        coachEmail: email.senderEmail, division: addDivision,
        gmailThreadId: email.threadId,
      })
      onContactAdded()
      setAdding(null); setAddCoachName(''); setAddSchoolName('')
      setAddedIds((prev) => new Set([...prev, email.threadId]))
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
    finally { setAddLoading(false) }
  }

  const stats = useMemo(() => ({
    total: emails.length,
    hot:   emails.filter((e) => e.rating === 'hot').length,
    warm:  emails.filter((e) => e.rating === 'warm').length,
    cold:  emails.filter((e) => e.rating === 'cold' || e.rating === 'not_interested').length,
    untracked: emails.filter((e) => !e.isTracked && !addedIds.has(e.threadId)).length,
  }), [emails, addedIds])

  const visible = useMemo(() => {
    let list = [...emails]
    if (categoryFilter !== 'all') list = list.filter((e) => e.category === categoryFilter)
    if (trackFilter === 'untracked') list = list.filter((e) => !e.isTracked && !addedIds.has(e.threadId))
    if (ratingFilter !== 'all') list = list.filter((e) => {
      if (ratingFilter === 'cold') return e.rating === 'cold' || e.rating === 'not_interested'
      return e.rating === ratingFilter
    })
    list.sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score || new Date(b.date).getTime() - new Date(a.date).getTime()
      if (sortBy === 'genuineness') return b.genuineness - a.genuineness || b.score - a.score
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
    return list
  }, [emails, categoryFilter, trackFilter, ratingFilter, sortBy, addedIds])

  if (!gmailConnected) {
    return (
      <Card className="p-12 text-center">
        <div className="text-3xl mb-3">📧</div>
        <div className="font-serif text-base font-bold text-[#f1f5f9] mb-1">Connect Gmail First</div>
        <p className="text-xs text-[#64748b]">Connect Gmail to scan 2 years of your inbox for every coach who ever contacted you.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Scan header ── */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
          <div>
            <div className="font-bold text-[#f1f5f9] text-base mb-1">2-Year Email Intelligence Scan</div>
            <p className="text-xs text-[#64748b] max-w-lg">
              Searches every corner of your Gmail — .edu senders, recruiting subjects, sent threads — to surface
              every real coach or ID camp email from the past 2 years. Filters out spam and platforms automatically,
              then rates each email's interest level with AI.
            </p>
          </div>
          <Button onClick={handleScan} disabled={loading}>
            {loading ? 'Scanning…' : scanned ? '↻ Re-scan' : '🔍 Scan 2 Years'}
          </Button>
        </div>
        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

        {scanned && !loading && (
          <div className="flex gap-3 mt-5 flex-wrap">
            {[
              { label: 'Total Found',   value: stats.total,     color: 'text-[#f1f5f9]',  bg: 'bg-[rgba(255,255,255,0.04)]' },
              { label: '🔥 Hot',        value: stats.hot,       color: 'text-[#4ade80]',  bg: 'bg-[rgba(74,222,128,0.06)]' },
              { label: '☀️ Warm',       value: stats.warm,      color: 'text-[#fbbf24]',  bg: 'bg-[rgba(251,191,36,0.06)]' },
              { label: '❄️ Cold / Pass',value: stats.cold,      color: 'text-[#60a5fa]',  bg: 'bg-[rgba(96,165,250,0.06)]' },
              { label: 'Not Tracked',  value: stats.untracked, color: 'text-[#eab308]',  bg: 'bg-[rgba(234,179,8,0.06)]' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`flex flex-col items-center px-4 py-3 ${bg} border border-[rgba(255,255,255,0.07)] rounded-xl min-w-[80px]`}>
                <span className={`font-serif text-2xl font-black ${color}`}>{value}</span>
                <span className="text-[10px] text-[#64748b] uppercase tracking-wider mt-0.5 text-center">{label}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {scanned && (
        <>
          {/* ── Controls ── */}
          <div className="flex gap-2 flex-wrap items-center">
            {/* Sort */}
            <div className="flex items-center gap-1 mr-2">
              <span className="text-[10px] text-[#475569] uppercase tracking-wider">Sort</span>
              {([['score','Hottest'],['date','Newest'],['genuineness','Most Genuine']] as [SortKey,string][]).map(([key,label]) => (
                <button key={key} onClick={() => setSortBy(key)}
                  className={`px-3 py-1 rounded text-xs font-semibold border transition-all ${sortBy === key ? 'bg-[#eab308] text-black border-[#eab308]' : 'text-[#64748b] border-[rgba(255,255,255,0.1)] hover:text-[#eab308] hover:border-[#eab308]'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="w-px h-4 bg-[rgba(255,255,255,0.1)]" />

            {/* Rating filter */}
            {([['all','All'],['hot','🔥 Hot'],['warm','☀️ Warm'],['cold','❄️ Cold']] as [RatingFilter,string][]).map(([key,label]) => (
              <button key={key} onClick={() => setRatingFilter(key)}
                className={`px-3 py-1 rounded text-xs font-semibold border transition-all ${ratingFilter === key ? 'bg-[#eab308] text-black border-[#eab308]' : 'text-[#64748b] border-[rgba(255,255,255,0.1)] hover:text-[#eab308] hover:border-[#eab308]'}`}>
                {label}
              </button>
            ))}

            <div className="w-px h-4 bg-[rgba(255,255,255,0.1)]" />

            <button onClick={() => setTrackFilter(trackFilter === 'all' ? 'untracked' : 'all')}
              className={`px-3 py-1 rounded text-xs font-semibold border transition-all ${trackFilter === 'untracked' ? 'bg-[#eab308] text-black border-[#eab308]' : 'text-[#64748b] border-[rgba(255,255,255,0.1)] hover:text-[#eab308] hover:border-[#eab308]'}`}>
              Not Tracked
            </button>
          </div>

          {/* ── Results ── */}
          {visible.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="text-2xl mb-2">🎉</div>
              <div className="text-sm text-[#64748b]">
                {emails.length === 0 ? 'No coach emails found in the past 2 years.' : 'No emails match the current filters.'}
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {visible.map((email) => {
                const catCfg = CATEGORY_CFG[email.category]
                const rCfg = RATING_CFG[email.rating] ?? RATING_CFG.cold
                const isAdded = addedIds.has(email.threadId)
                const tracked = email.isTracked || isAdded
                const scoreBarColor = email.score >= 8 ? 'bg-[#4ade80]' : email.score >= 5 ? 'bg-[#fbbf24]' : 'bg-[#60a5fa]'
                const genBarColor  = email.genuineness >= 8 ? 'bg-[#4ade80]' : email.genuineness >= 5 ? 'bg-[#fbbf24]' : 'bg-[#60a5fa]'

                return (
                  <div key={email.threadId}
                    className={`rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] border-l-4 ${rCfg.border} overflow-hidden`}>
                    <div className="p-4">
                      {/* ── Top row ── */}
                      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-sm font-semibold text-[#f1f5f9]">{email.senderName || email.senderEmail}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${catCfg.style}`}>{catCfg.label}</span>
                            {tracked && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)] text-[#4ade80]">Tracked</span>
                            )}
                            {(email.messageCount ?? 0) > 1 && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium border bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.1)] text-[#64748b]">
                                {email.messageCount} msgs
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#64748b]">{email.senderEmail}</div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${rCfg.badge}`}>{rCfg.label}</span>
                          <span className="text-xs text-[#475569]">{formatDate(email.date)}</span>
                        </div>
                      </div>

                      {/* ── Subject + snippet ── */}
                      <div className="text-xs text-[#94a3b8] italic mb-1">"{email.subject}"</div>
                      {email.snippet && (
                        <div className="text-xs text-[#64748b] leading-relaxed line-clamp-3 mb-3">{email.snippet}</div>
                      )}

                      {/* ── Score bars ── */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-[10px] text-[#475569] uppercase tracking-wider">Interest</span>
                            <span className={`text-[10px] font-bold ${rCfg.scoreColor}`}>{email.interestLevel}</span>
                          </div>
                          <div className={rCfg.scoreColor}>
                            <ScoreBar value={email.score ?? 0} color={scoreBarColor} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-[10px] text-[#475569] uppercase tracking-wider">Genuineness</span>
                            <span className="text-[10px] font-bold text-[#94a3b8]">{email.genuineness}/10</span>
                          </div>
                          <div className="text-[#94a3b8]">
                            <ScoreBar value={email.genuineness ?? 0} color={genBarColor} />
                          </div>
                        </div>
                      </div>

                      {/* ── AI summary + next action ── */}
                      {email.ratingNote && (
                        <div className="text-xs text-[#64748b] mb-1.5">
                          <span className="text-[#475569]">Summary: </span>{email.ratingNote}
                        </div>
                      )}
                      {email.nextAction && (
                        <div className="flex items-start gap-1.5 text-xs">
                          <span className="text-[#eab308] font-bold flex-shrink-0">→</span>
                          <span className="text-[#f1f5f9]">{email.nextAction}</span>
                        </div>
                      )}

                      {/* ── Add to tracker ── */}
                      {!tracked && adding !== email.threadId && (
                        <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)] flex justify-end">
                          <Button size="sm" variant="outline"
                            onClick={() => { setAdding(email.threadId); setAddCoachName(''); setAddSchoolName('') }}>
                            + Add to Tracker
                          </Button>
                        </div>
                      )}
                    </div>

                    {adding === email.threadId && (
                      <div className="px-4 pb-4 flex items-end gap-3 flex-wrap border-t border-[rgba(255,255,255,0.07)] pt-4">
                        <div className="flex-1 min-w-36">
                          <Input label="School name" value={addSchoolName} onChange={(e) => setAddSchoolName(e.target.value)} placeholder="University name" />
                        </div>
                        <div className="flex-1 min-w-36">
                          <Input label="Coach name" value={addCoachName} onChange={(e) => setAddCoachName(e.target.value)} placeholder="Coach name" />
                        </div>
                        <div>
                          <label className="text-xs text-[#64748b] block mb-1.5">Division</label>
                          <select value={addDivision} onChange={(e) => setAddDivision(e.target.value as Division)}
                            className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded text-xs text-[#f1f5f9] px-3 py-2 focus:outline-none focus:border-[#eab308]">
                            {(['D1','D2','D3','NAIA','JUCO'] as Division[]).map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <Button size="sm" onClick={() => handleAdd(email)} disabled={addLoading || !addSchoolName}>
                          {addLoading ? 'Adding…' : 'Add'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
