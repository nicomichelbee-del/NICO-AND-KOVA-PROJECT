import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { rateResponse } from '../../lib/api'
import type { CoachEmail, CoachResponse } from '../../types'

const DEMO: CoachEmail[] = [
  { id: '1', school: 'Wake Forest University', division: 'D1', coachName: 'Coach Hamilton', coachEmail: 'hamilton@wfu.edu', subject: 'Class of 2026 Striker — ECNL', body: '', status: 'responded', sentAt: '2025-04-10', respondedAt: '2025-04-14', createdAt: '2025-04-09' },
  { id: '2', school: 'Elon University', division: 'D1', coachName: 'Coach Rivera', coachEmail: '', subject: 'Class of 2026 Forward Interest', body: '', status: 'sent', sentAt: '2025-04-15', createdAt: '2025-04-14' },
  { id: '3', school: 'High Point University', division: 'D1', coachName: 'Coach Chen', coachEmail: '', subject: 'Prospective Student-Athlete Inquiry', body: '', status: 'draft', createdAt: '2025-04-18' },
  { id: '4', school: 'Appalachian State', division: 'D1', coachName: 'Coach Williams', coachEmail: '', subject: 'Class of 2026 Midfielder', body: '', status: 'sent', sentAt: '2025-04-20', createdAt: '2025-04-19' },
]

const statusColor: Record<CoachEmail['status'], 'green' | 'gold' | 'muted' | 'blue'> = {
  responded: 'green', sent: 'blue', draft: 'muted', not_interested: 'muted',
}

const ratingConfig = {
  hot: { label: '🔥 Hot', color: 'text-[#4ade80]', bg: 'bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)]' },
  warm: { label: '☀️ Warm', color: 'text-[#fbbf24]', bg: 'bg-[rgba(251,191,36,0.1)] border-[rgba(251,191,36,0.2)]' },
  cold: { label: '❄️ Cold', color: 'text-[#60a5fa]', bg: 'bg-[rgba(96,165,250,0.1)] border-[rgba(96,165,250,0.2)]' },
  not_interested: { label: '⛔ Not Interested', color: 'text-[#64748b]', bg: 'bg-[rgba(100,116,139,0.1)] border-[rgba(100,116,139,0.2)]' },
}

function loadResponses(): CoachResponse[] {
  try { return JSON.parse(localStorage.getItem('coachResponses') ?? '[]') } catch { return [] }
}
function saveResponses(r: CoachResponse[]) {
  localStorage.setItem('coachResponses', JSON.stringify(r))
}

export function Tracker() {
  const [tab, setTab] = useState<'contacts' | 'responses'>('contacts')
  const [contacts, setContacts] = useState<CoachEmail[]>(DEMO)
  const [filter, setFilter] = useState<CoachEmail['status'] | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newSchool, setNewSchool] = useState('')
  const [newCoach, setNewCoach] = useState('')

  const [responses, setResponses] = useState<CoachResponse[]>(loadResponses)
  const [inputMode, setInputMode] = useState<'paste' | 'quick'>('paste')
  const [resSchool, setResSchool] = useState('')
  const [resCoach, setResCoach] = useState('')
  const [resText, setResText] = useState('')
  const [quickVisit, setQuickVisit] = useState(false)
  const [quickQuestions, setQuickQuestions] = useState(false)
  const [quickScholarship, setQuickScholarship] = useState(false)
  const [ratingLoading, setRatingLoading] = useState(false)
  const [ratingError, setRatingError] = useState('')

  function addContact() {
    if (!newSchool) return
    setContacts((prev) => [{
      id: crypto.randomUUID(), school: newSchool, division: 'D1',
      coachName: newCoach, coachEmail: '', subject: '', body: '',
      status: 'draft', createdAt: new Date().toISOString(),
    }, ...prev])
    setNewSchool(''); setNewCoach(''); setShowAdd(false)
  }

  function updateStatus(id: string, status: CoachEmail['status']) {
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c))
  }

  async function handleRateResponse() {
    if (!resSchool || !resCoach) { setRatingError('Please enter school and coach name.'); return }
    const text = inputMode === 'paste' ? resText
      : `Coach responded. ${quickVisit ? 'Invited to visit campus.' : ''} ${quickQuestions ? 'Asked follow-up questions.' : ''} ${quickScholarship ? 'Mentioned scholarship possibility.' : ''}`
    if (!text.trim()) { setRatingError('Please provide some context about the response.'); return }
    setRatingError(''); setRatingLoading(true)
    try {
      const result = await rateResponse(resSchool, resCoach, text)
      const entry: CoachResponse = { ...result, rawText: inputMode === 'paste' ? resText : undefined }
      const updated = [entry, ...responses]
      setResponses(updated)
      saveResponses(updated)
      setResSchool(''); setResCoach(''); setResText('')
      setQuickVisit(false); setQuickQuestions(false); setQuickScholarship(false)
    } catch (e) {
      setRatingError(e instanceof Error ? e.message : 'Failed to rate response')
    } finally { setRatingLoading(false) }
  }

  const filtered = filter === 'all' ? contacts : contacts.filter((c) => c.status === filter)
  const counts = {
    all: contacts.length,
    draft: contacts.filter((c) => c.status === 'draft').length,
    sent: contacts.filter((c) => c.status === 'sent').length,
    responded: contacts.filter((c) => c.status === 'responded').length,
  }

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Outreach</span>
          </div>
          <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Outreach Tracker</h1>
          <p className="text-[#64748b] mt-2 text-sm">Track every contact, response, and follow-up in one place.</p>
        </div>
        {tab === 'contacts' && <Button onClick={() => setShowAdd(!showAdd)}>+ Add Contact</Button>}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[rgba(255,255,255,0.07)] mb-8">
        {[{ id: 'contacts', label: 'Contacts' }, { id: 'responses', label: 'Coach Responses' }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'contacts' | 'responses')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? 'border-[#eab308] text-[#eab308]'
                : 'border-transparent text-[#64748b] hover:text-[#f1f5f9]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'contacts' && (
        <>
          {showAdd && (
            <Card className="p-5 mb-6 flex items-end gap-4 flex-wrap">
              <div className="flex-1 min-w-40">
                <Input label="School" value={newSchool} onChange={(e) => setNewSchool(e.target.value)} placeholder="University name" />
              </div>
              <div className="flex-1 min-w-40">
                <Input label="Coach name" value={newCoach} onChange={(e) => setNewCoach(e.target.value)} placeholder="Coach name" />
              </div>
              <Button onClick={addContact}>Add</Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            </Card>
          )}

          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total', value: counts.all, color: 'text-[#f1f5f9]' },
              { label: 'Drafted', value: counts.draft, color: 'text-[#64748b]' },
              { label: 'Sent', value: counts.sent, color: 'text-[#60a5fa]' },
              { label: 'Responded', value: counts.responded, color: 'text-[#4ade80]' },
            ].map(({ label, value, color }) => (
              <Card key={label} className="p-4 text-center">
                <div className={`font-serif text-3xl font-black ${color}`}>{value}</div>
                <div className="text-xs text-[#64748b] mt-0.5">{label}</div>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 mb-5">
            {(['all', 'draft', 'sent', 'responded'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${
                  filter === f
                    ? 'bg-[#eab308] text-black border-[#eab308]'
                    : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                }`}
              >
                {f} {f !== 'all' ? `(${counts[f as keyof typeof counts]})` : ''}
              </button>
            ))}
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.07)]">
                    {['School', 'Coach', 'Div', 'Status', 'Sent', 'Response', 'Update'].map((h) => (
                      <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="px-5 py-4 font-medium text-[#f1f5f9] whitespace-nowrap">{c.school}</td>
                      <td className="px-5 py-4 text-[#64748b] whitespace-nowrap">{c.coachName}</td>
                      <td className="px-5 py-4"><Badge variant="muted">{c.division}</Badge></td>
                      <td className="px-5 py-4"><Badge variant={statusColor[c.status]}>{c.status}</Badge></td>
                      <td className="px-5 py-4 text-[#64748b] text-xs whitespace-nowrap">{c.sentAt ? new Date(c.sentAt).toLocaleDateString() : '—'}</td>
                      <td className="px-5 py-4 text-[#64748b] text-xs whitespace-nowrap">{c.respondedAt ? new Date(c.respondedAt).toLocaleDateString() : '—'}</td>
                      <td className="px-5 py-4">
                        <select
                          value={c.status}
                          onChange={(e) => updateStatus(c.id, e.target.value as CoachEmail['status'])}
                          className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded text-xs text-[#64748b] px-2 py-1.5 focus:outline-none focus:border-[#eab308]"
                        >
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="responded">Responded</option>
                          <option value="not_interested">Not Interested</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === 'responses' && (
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <div className="text-sm font-bold text-[#f1f5f9] mb-4">Log a Coach Response</div>
            <div className="flex gap-3 mb-5">
              {[{ id: 'paste', label: 'Paste Full Reply' }, { id: 'quick', label: 'Quick Form' }].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setInputMode(m.id as 'paste' | 'quick')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    inputMode === m.id
                      ? 'bg-[#eab308] text-black border-[#eab308]'
                      : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="School" value={resSchool} onChange={(e) => setResSchool(e.target.value)} placeholder="University name" />
              <Input label="Coach name" value={resCoach} onChange={(e) => setResCoach(e.target.value)} placeholder="Coach name" />
            </div>
            {inputMode === 'paste' ? (
              <Textarea
                label="Coach's reply (paste the full email text)"
                value={resText}
                onChange={(e) => setResText(e.target.value)}
                placeholder="Paste the coach's email reply here..."
                rows={5}
              />
            ) : (
              <div className="flex flex-col gap-3 p-4 bg-[rgba(255,255,255,0.02)] rounded-xl border border-[rgba(255,255,255,0.07)]">
                <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">What happened in their reply?</div>
                {[
                  { id: 'visit', label: 'Invited me for a campus visit', checked: quickVisit, set: setQuickVisit },
                  { id: 'questions', label: 'Asked follow-up questions about me', checked: quickQuestions, set: setQuickQuestions },
                  { id: 'scholarship', label: 'Mentioned scholarship possibilities', checked: quickScholarship, set: setQuickScholarship },
                ].map((item) => (
                  <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.set(e.target.checked)}
                      className="w-4 h-4 accent-[#eab308]"
                    />
                    <span className="text-sm text-[#f1f5f9]">{item.label}</span>
                  </label>
                ))}
              </div>
            )}
            {ratingError && <p className="text-xs text-red-400 mt-3">{ratingError}</p>}
            <Button onClick={handleRateResponse} disabled={ratingLoading} className="mt-4">
              {ratingLoading ? 'Analyzing...' : 'Rate Interest Level'}
            </Button>
          </Card>

          {responses.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-3xl mb-3">📬</div>
              <div className="font-serif text-base font-bold text-[#f1f5f9] mb-1">No responses logged yet</div>
              <p className="text-xs text-[#64748b]">When coaches reply, log them here and the AI will rate their interest level.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {responses.map((r) => {
                const cfg = ratingConfig[r.rating]
                return (
                  <Card key={r.id} className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="font-medium text-[#f1f5f9]">{r.school}</div>
                        <div className="text-xs text-[#64748b]">{r.coachName} · {new Date(r.date).toLocaleDateString()}</div>
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg border text-sm font-bold whitespace-nowrap ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                        <span className="ml-2 text-xs font-normal opacity-70">{r.confidence}% confident</span>
                      </div>
                    </div>
                    {r.signals.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {r.signals.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded text-xs text-[#64748b]">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="p-3 bg-[rgba(234,179,8,0.04)] border border-[rgba(234,179,8,0.15)] rounded-lg">
                      <span className="text-xs font-semibold text-[#eab308]">Next Step: </span>
                      <span className="text-xs text-[#f1f5f9]">{r.nextAction}</span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
