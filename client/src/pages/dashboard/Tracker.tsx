import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { ContactRow } from '../../components/tracker/ContactRow'
import { UntrackedSection } from '../../components/tracker/UntrackedSection'
import { HistoryScanTab } from '../../components/tracker/HistoryScanTab'
import { getContacts, createContact, updateContact, gmailGetThreads, getGmailStatus, rateResponse } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import type { OutreachContact, CoachResponse, UntrackedThread, Division } from '../../types'

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
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'contacts' | 'responses' | 'discovered'>('contacts')
  const [contacts, setContacts] = useState<OutreachContact[]>([])
  const [untrackedThreads, setUntrackedThreads] = useState<UntrackedThread[]>([])
  const [filter, setFilter] = useState<OutreachContact['status'] | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newSchool, setNewSchool] = useState('')
  const [newCoach, setNewCoach] = useState('')
  const [newCoachEmail, setNewCoachEmail] = useState('')
  const [newDivision, setNewDivision] = useState<Division>('D1')
  const [contactsLoading, setContactsLoading] = useState(false)

  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)
  const [gmailLoading, setGmailLoading] = useState(false)
  const [sendingId] = useState<string | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

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

  const loadContacts = useCallback(async () => {
    if (!user?.id) return
    setContactsLoading(true)
    try {
      const { contacts: data } = await getContacts(user.id)
      setContacts(data)
    } catch { /* show empty state */ }
    finally { setContactsLoading(false) }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    loadContacts()
    getGmailStatus(user.id).then((s) => {
      setGmailConnected(s.connected)
      setGmailEmail(s.email)
    }).catch(() => {})
  }, [user?.id, loadContacts])

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'gmail-connected') {
        setGmailConnected(true)
        setGmailEmail(e.data.email ?? null)
        setGmailLoading(false)
        if (user?.id) syncThreads(user.id)
      } else if (e.data?.type === 'gmail-error') {
        setGmailLoading(false)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [user?.id])

  async function connectGmail() {
    if (!user?.id) return
    setGmailLoading(true)
    try {
      const res = await fetch(`/api/gmail/auth?userId=${encodeURIComponent(user.id)}`)
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Failed to get auth URL')
      window.open(data.url, 'gmail-auth', 'width=500,height=600,left=200,top=100')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to start Gmail auth')
      setGmailLoading(false)
    }
  }

  async function syncThreads(uid: string) {
    setSyncLoading(true); setSyncMsg('')
    try {
      const { tracked, untracked } = await gmailGetThreads(uid)
      setContacts(tracked)
      setUntrackedThreads(untracked)
      const newReplies = tracked.filter((c) => c.status === 'replied' && c.lastReplyAt).length
      setSyncMsg(newReplies > 0 ? `${newReplies} coach repl${newReplies === 1 ? 'y' : 'ies'} found!` : 'Up to date.')
    } catch {
      setSyncMsg('Sync failed — check Gmail connection.')
    } finally { setSyncLoading(false) }
  }

  async function handleStatusChange(id: string, status: OutreachContact['status']) {
    if (!user?.id) return
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c))
    try { await updateContact(id, user.id, { status }) } catch { loadContacts() }
  }

  function handleSendEmail(contact: OutreachContact) {
    const params = new URLSearchParams({
      school: contact.schoolName,
      division: contact.division,
      coachName: contact.coachName,
      coachEmail: contact.coachEmail,
    })
    navigate(`/dashboard/emails?${params.toString()}`)
  }

  async function addContact() {
    if (!newSchool || !user?.id) return
    try {
      await createContact(user.id, {
        coachName: newCoach, schoolName: newSchool,
        coachEmail: newCoachEmail, division: newDivision,
      })
      await loadContacts()
      setNewSchool(''); setNewCoach(''); setNewCoachEmail(''); setShowAdd(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add contact')
    }
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
      setResponses(updated); saveResponses(updated)
      setResSchool(''); setResCoach(''); setResText('')
      setQuickVisit(false); setQuickQuestions(false); setQuickScholarship(false)
    } catch (e) {
      setRatingError(e instanceof Error ? e.message : 'Failed to rate response')
    } finally { setRatingLoading(false) }
  }

  const filtered = filter === 'all' ? contacts : contacts.filter((c) => c.status === filter)
  const counts = {
    all: contacts.length,
    contacted: contacts.filter((c) => c.status === 'contacted').length,
    replied: contacts.filter((c) => c.status === 'replied').length,
    scheduled_visit: contacts.filter((c) => c.status === 'scheduled_visit').length,
  }

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Outreach</span>
          </div>
          <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Outreach Tracker</h1>
          <p className="text-[#64748b] mt-2 text-sm">Track every contact, response, and follow-up in one place.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {gmailConnected ? (
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#4ade80] inline-block" />
                  <span className="text-xs text-[#4ade80] font-semibold">Gmail Connected</span>
                </div>
                {gmailEmail && <div className="text-xs text-[#64748b]">{gmailEmail}</div>}
              </div>
              <Button variant="outline" size="sm" onClick={() => user?.id && syncThreads(user.id)} disabled={syncLoading}>
                {syncLoading ? 'Syncing...' : '↻ Check for Replies'}
              </Button>
            </div>
          ) : (
            <Button onClick={connectGmail} disabled={gmailLoading || !user?.id} size="sm">
              {gmailLoading ? 'Connecting...' : '📧 Connect Gmail'}
            </Button>
          )}
          {syncMsg && <div className="text-xs text-[#eab308]">{syncMsg}</div>}
          {!user?.id && <div className="text-xs text-[#64748b]">Sign in to connect Gmail</div>}
        </div>
      </div>

      <div className="flex gap-0 border-b border-[rgba(255,255,255,0.07)] mb-8">
        {[
          { id: 'contacts', label: 'Contacts' },
          { id: 'responses', label: 'Coach Responses' },
          { id: 'discovered', label: '🔍 Discovered Emails' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'contacts' | 'responses' | 'discovered')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id ? 'border-[#eab308] text-[#eab308]' : 'border-transparent text-[#64748b] hover:text-[#f1f5f9]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'contacts' && (
        <>
          {!gmailConnected && (
            <Card className="p-4 mb-6 flex items-center justify-between gap-4">
              <div className="text-sm text-[#94a3b8]">
                📧 Connect Gmail to see coach replies, send emails, and get AI interest ratings.
              </div>
              <Button size="sm" onClick={connectGmail} disabled={gmailLoading || !user?.id}>
                {gmailLoading ? 'Connecting...' : 'Connect Gmail'}
              </Button>
            </Card>
          )}

          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowAdd(!showAdd)}>+ Add Contact</Button>
          </div>

          {showAdd && (
            <Card className="p-5 mb-6 flex items-end gap-4 flex-wrap">
              <div className="flex-1 min-w-36">
                <Input label="School" value={newSchool} onChange={(e) => setNewSchool(e.target.value)} placeholder="University name" />
              </div>
              <div className="flex-1 min-w-36">
                <Input label="Coach name" value={newCoach} onChange={(e) => setNewCoach(e.target.value)} placeholder="Coach name" />
              </div>
              <div className="flex-1 min-w-36">
                <Input label="Coach email" value={newCoachEmail} onChange={(e) => setNewCoachEmail(e.target.value)} placeholder="coach@school.edu" />
              </div>
              <div>
                <label className="text-xs text-[#64748b] block mb-1.5">Division</label>
                <select
                  value={newDivision}
                  onChange={(e) => setNewDivision(e.target.value as Division)}
                  className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded text-xs text-[#f1f5f9] px-3 py-2 focus:outline-none focus:border-[#eab308]"
                >
                  {['D1', 'D2', 'D3', 'NAIA', 'JUCO'].map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <Button onClick={addContact}>Add</Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            </Card>
          )}

          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total', value: counts.all, color: 'text-[#f1f5f9]' },
              { label: 'Contacted', value: counts.contacted, color: 'text-[#60a5fa]' },
              { label: 'Replied', value: counts.replied, color: 'text-[#4ade80]' },
              { label: 'Visit Scheduled', value: counts.scheduled_visit, color: 'text-[#eab308]' },
            ].map(({ label, value, color }) => (
              <Card key={label} className="p-4 text-center">
                <div className={`font-serif text-3xl font-black ${color}`}>{value}</div>
                <div className="text-xs text-[#64748b] mt-0.5">{label}</div>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 mb-5">
            {(['all', 'contacted', 'replied', 'scheduled_visit', 'no_response'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${
                  filter === f
                    ? 'bg-[#eab308] text-black border-[#eab308]'
                    : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>

          {contactsLoading ? (
            <div className="text-xs text-[#64748b] py-8 text-center">Loading contacts...</div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.07)]">
                      {['School', 'Coach', 'Div', 'Status', 'Interest', 'Last Reply', 'Actions'].map((h) => (
                        <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-xs text-[#64748b]">
                          No contacts yet. Add your first coach above.
                        </td>
                      </tr>
                    ) : filtered.map((c) => (
                      <ContactRow
                        key={c.id}
                        contact={c}
                        userId={user?.id ?? ''}
                        gmailConnected={gmailConnected}
                        onStatusChange={handleStatusChange}
                        onSendEmail={handleSendEmail}
                        sendingId={sendingId}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {gmailConnected && user?.id && (
            <UntrackedSection
              userId={user.id}
              threads={untrackedThreads}
              onContactAdded={loadContacts}
            />
          )}
        </>
      )}

      {tab === 'discovered' && user?.id && (
        <HistoryScanTab
          userId={user.id}
          gmailConnected={gmailConnected}
          onContactAdded={loadContacts}
        />
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
              <Textarea label="Coach's reply (paste the full email text)" value={resText} onChange={(e) => setResText(e.target.value)} placeholder="Paste the coach's email reply here..." rows={5} />
            ) : (
              <div className="flex flex-col gap-3 p-4 bg-[rgba(255,255,255,0.02)] rounded-xl border border-[rgba(255,255,255,0.07)]">
                <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">What happened in their reply?</div>
                {[
                  { id: 'visit', label: 'Invited me for a campus visit', checked: quickVisit, set: setQuickVisit },
                  { id: 'questions', label: 'Asked follow-up questions about me', checked: quickQuestions, set: setQuickQuestions },
                  { id: 'scholarship', label: 'Mentioned scholarship possibilities', checked: quickScholarship, set: setQuickScholarship },
                ].map((item) => (
                  <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={item.checked} onChange={(e) => item.set(e.target.checked)} className="w-4 h-4 accent-[#eab308]" />
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
                const cfg = ratingConfig[r.rating as keyof typeof ratingConfig]
                if (!cfg) return null
                const scoreColor = (r.score ?? 0) >= 8 ? 'text-[#4ade80]' : (r.score ?? 0) >= 5 ? 'text-[#fbbf24]' : 'text-[#60a5fa]'
                const genuinenessColor = (r.genuineness ?? 0) >= 8 ? 'text-[#4ade80]' : (r.genuineness ?? 0) >= 5 ? 'text-[#fbbf24]' : 'text-[#60a5fa]'
                return (
                  <Card key={r.id} className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                      <div>
                        <div className="font-medium text-[#f1f5f9]">{r.school}</div>
                        <div className="text-xs text-[#64748b]">{r.coachName} · {new Date(r.date).toLocaleDateString()}</div>
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg border text-sm font-bold whitespace-nowrap ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                        <span className="ml-2 text-xs font-normal opacity-70">{r.confidence}% confident</span>
                      </div>
                    </div>

                    {/* Score row */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-lg">
                        <div className="text-xs text-[#64748b] font-semibold uppercase tracking-wider mb-1">Interest Score</div>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-2xl font-black font-serif ${scoreColor}`}>{r.score ?? '—'}</span>
                          <span className="text-xs text-[#475569]">/ 10</span>
                        </div>
                        <div className="text-xs text-[#94a3b8] mt-0.5 font-medium">{r.interestLevel ?? ''}</div>
                        {r.scoreReason && <div className="text-xs text-[#64748b] mt-1 leading-relaxed">{r.scoreReason}</div>}
                      </div>
                      <div className="p-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-lg">
                        <div className="text-xs text-[#64748b] font-semibold uppercase tracking-wider mb-1">Genuineness</div>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-2xl font-black font-serif ${genuinenessColor}`}>{r.genuineness ?? '—'}</span>
                          <span className="text-xs text-[#475569]">/ 10</span>
                        </div>
                        {r.genuinenessReason && <div className="text-xs text-[#64748b] mt-1 leading-relaxed">{r.genuinenessReason}</div>}
                      </div>
                    </div>

                    {r.signals.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {r.signals.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded text-xs text-[#64748b]">{s}</span>
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
