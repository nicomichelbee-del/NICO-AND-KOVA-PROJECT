import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { generateFollowUp, getGmailStatus, gmailGetThreads, gmailGetThread } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Textarea'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../../context/AuthContext'
import type { AthleteProfile, OutreachContact, UntrackedThread } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

const EMAIL_TYPES = [
  { value: 'followup' as const, label: '2-Week Follow-up', desc: "Coach hasn't responded after 2 weeks" },
  { value: 'thankyou' as const, label: 'Thank You Note', desc: 'After a campus visit or phone call' },
  { value: 'answer' as const, label: 'Answer Coach Question', desc: "Respond to a coach's inquiry" },
]

const PLACEHOLDERS: Record<string, string> = {
  followup: "e.g. Emailed Coach Smith at UNC Charlotte 2 weeks ago about the striker position. Haven't heard back.",
  thankyou: 'e.g. Just visited Notre Dame, met with Coach Williams, toured the facilities and training center.',
  answer: "e.g. Coach asked about my academic interests and whether I'm visiting other schools this fall.",
}

const PRESET_EVENTS = [
  { id: 'ecnl-playoffs', label: 'ECNL Girls Playoffs', date: 'June 2026' },
  { id: 'ecnl-nationals', label: 'ECNL Girls Nationals', date: 'July 2026' },
  { id: 'ecnl-boys-playoffs', label: 'ECNL Boys Playoffs', date: 'June 2026' },
  { id: 'ecnl-boys-nationals', label: 'ECNL Boys Nationals', date: 'July 2026' },
  { id: 'mls-next-fest', label: 'MLS NEXT Fest', date: 'June 2026' },
  { id: 'mls-next-fall', label: 'MLS NEXT Fall Showcase', date: 'September 2026' },
  { id: 'mls-next2-spring', label: 'MLS NEXT 2 Spring Showcase', date: 'April 2026' },
  { id: 'mls-next2-summer', label: 'MLS NEXT 2 Summer Showcase', date: 'July 2026' },
]

export function FollowUp() {
  const { user } = useAuth()
  const [type, setType] = useState<'followup' | 'thankyou' | 'answer'>('followup')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [advice, setAdvice] = useState('')
  const [copied, setCopied] = useState(false)
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [customEvent, setCustomEvent] = useState('')
  const [searchParams] = useSearchParams()

  // Gmail state
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)
  const [gmailLoading, setGmailLoading] = useState(false)
  const [inboxContacts, setInboxContacts] = useState<OutreachContact[]>([])
  const [inboxUntracked, setInboxUntracked] = useState<UntrackedThread[]>([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const [pickingThreadId, setPickingThreadId] = useState<string | null>(null)
  const [showInbox, setShowInbox] = useState(false)

  useEffect(() => {
    const prefillType = searchParams.get('type') as 'followup' | 'thankyou' | 'answer' | null
    const prefillCoachName = searchParams.get('coachName')
    const prefillSchool = searchParams.get('school')
    const prefillMessage = searchParams.get('message')

    if (prefillType && ['followup', 'thankyou', 'answer'].includes(prefillType)) {
      setType(prefillType)
    }
    if (prefillMessage && prefillCoachName && prefillSchool) {
      setContext(
        `Coach ${prefillCoachName} at ${prefillSchool} replied:\n\n"${prefillMessage}"`
      )
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return
    getGmailStatus(user.id).then((s) => {
      setGmailConnected(s.connected)
      setGmailEmail(s.email)
    }).catch(() => {})
  }, [user?.id])

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'gmail-connected') {
        setGmailConnected(true)
        setGmailEmail(e.data.email ?? null)
        setGmailLoading(false)
      } else if (e.data?.type === 'gmail-error') {
        setGmailLoading(false)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

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

  const loadInbox = useCallback(async () => {
    if (!user?.id) return
    setInboxLoading(true)
    try {
      const { tracked, untracked } = await gmailGetThreads(user.id)
      const replied = tracked.filter((c) => c.status === 'replied' || c.lastReplySnippet)
      setInboxContacts(replied)
      // Only coach threads (skip ID-camp blasts) — these are coaches who replied
      // but aren't yet in the outreach tracker.
      setInboxUntracked(untracked.filter((t) => t.category === 'coach'))
    } catch { /* silent */ }
    finally { setInboxLoading(false) }
  }, [user?.id])

  useEffect(() => {
    if (gmailConnected && user?.id) loadInbox()
  }, [gmailConnected, user?.id, loadInbox])

  // Refresh inbox whenever the user opens the picker so they see latest replies.
  useEffect(() => {
    if (showInbox && gmailConnected) loadInbox()
  }, [showInbox, gmailConnected, loadInbox])

  async function pickFromInbox(contact: OutreachContact) {
    if (!user?.id) return
    setShowInbox(false)
    setResult('')
    setAdvice('')
    // Fetch the FULL latest coach message — far better context than 150-char snippet.
    if (contact.gmailThreadId) {
      setPickingThreadId(contact.gmailThreadId)
      try {
        const { messages } = await gmailGetThread(user.id, contact.gmailThreadId)
        const coachEmail = (contact.coachEmail ?? '').toLowerCase()
        const fromCoach = messages.filter((m) => coachEmail && m.sender.toLowerCase().includes(coachEmail))
        const latest = fromCoach[fromCoach.length - 1] ?? messages[messages.length - 1]
        if (latest?.body) {
          setContext(`Coach ${contact.coachName} at ${contact.schoolName} replied:\n\n"${latest.body.trim()}"`)
          return
        }
      } catch { /* fall through to snippet */ }
      finally { setPickingThreadId(null) }
    }
    const fallback = contact.lastReplySnippet
      ? `Coach ${contact.coachName} at ${contact.schoolName} replied:\n\n"${contact.lastReplySnippet}"`
      : `Reached out to Coach ${contact.coachName} at ${contact.schoolName}.`
    setContext(fallback)
  }

  async function pickFromUntracked(thread: UntrackedThread) {
    if (!user?.id) return
    setShowInbox(false)
    setResult('')
    setAdvice('')
    setPickingThreadId(thread.threadId)
    try {
      const { messages } = await gmailGetThread(user.id, thread.threadId)
      const fromCoach = messages.filter((m) => m.sender.toLowerCase().includes(thread.senderEmail.toLowerCase()))
      const latest = fromCoach[fromCoach.length - 1] ?? messages[messages.length - 1]
      const body = latest?.body?.trim()
      const senderLabel = thread.senderName || thread.senderEmail
      if (body) {
        setContext(`${senderLabel} (${thread.senderEmail}) emailed about "${thread.subject}":\n\n"${body}"`)
        return
      }
    } catch { /* fall through */ }
    finally { setPickingThreadId(null) }
    const senderLabel = thread.senderName || thread.senderEmail
    setContext(`${senderLabel} (${thread.senderEmail}) emailed about "${thread.subject}":\n\n"${thread.snippet}"`)
  }

  function toggleEvent(id: string) {
    setSelectedEvents((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id])
  }

  function buildScheduleContext() {
    const presetLabels = PRESET_EVENTS.filter((e) => selectedEvents.includes(e.id)).map((e) => `${e.label} (${e.date})`)
    const all = customEvent.trim() ? [...presetLabels, customEvent.trim()] : presetLabels
    if (all.length === 0) return ''
    return `\n\nUpcoming schedule: ${all.join(', ')}.`
  }

  async function handleGenerate() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    setError(''); setLoading(true)
    try {
      const fullContext = context + buildScheduleContext()
      const res = await generateFollowUp(profile, fullContext, type)
      setResult(res.body)
      setAdvice(res.advice ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate email')
    } finally { setLoading(false) }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="px-10 py-10 max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Follow-up Assistant</span>
          </div>
          <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Follow-up Assistant</h1>
          <p className="text-[#64748b] mt-2 text-sm">Never stall a recruiting conversation. Always know exactly what to send next.</p>
        </div>

        {/* Gmail connection */}
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
              <Button variant="outline" size="sm" onClick={() => setShowInbox((v) => !v)}>
                {showInbox ? 'Hide Inbox' : '📬 Pick from Inbox'}
              </Button>
            </div>
          ) : (
            <Button onClick={connectGmail} disabled={gmailLoading || !user?.id} size="sm">
              {gmailLoading ? 'Connecting...' : '📧 Connect Gmail'}
            </Button>
          )}
          {!user?.id && <div className="text-xs text-[#64748b]">Sign in to connect Gmail</div>}
        </div>
      </div>

      {/* Inbox picker panel */}
      {showInbox && gmailConnected && (
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-[#eab308] uppercase tracking-wider">📬 Coach Inbox — Click to Pre-fill Context</div>
            <button
              onClick={loadInbox}
              disabled={inboxLoading}
              className="text-[11px] text-[#64748b] hover:text-[#eab308] disabled:opacity-50 transition-colors"
            >
              {inboxLoading ? 'Syncing…' : '⟳ Refresh'}
            </button>
          </div>

          {inboxLoading && inboxContacts.length === 0 && inboxUntracked.length === 0 ? (
            <p className="text-xs text-[#64748b]">Syncing your inbox…</p>
          ) : inboxContacts.length === 0 && inboxUntracked.length === 0 ? (
            <p className="text-xs text-[#64748b]">No coach emails found in your inbox yet.</p>
          ) : (
            <div className="flex flex-col gap-4 max-h-72 overflow-y-auto pr-1 scrollbar-hide">
              {inboxContacts.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest mb-2">Tracked coach replies</div>
                  <div className="flex flex-col gap-2">
                    {inboxContacts.map((c) => {
                      const loading = pickingThreadId === c.gmailThreadId
                      return (
                        <button
                          key={c.id}
                          onClick={() => pickFromInbox(c)}
                          disabled={loading}
                          className="text-left px-3 py-2.5 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(234,179,8,0.4)] hover:bg-[rgba(234,179,8,0.04)] transition-all disabled:opacity-60"
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-[#f1f5f9]">{c.schoolName}</span>
                            <span className="text-[10px] uppercase tracking-widest text-[#eab308]">{c.division}</span>
                            {c.status === 'replied' && <span className="text-[10px] text-[#4ade80] font-semibold">Replied</span>}
                            {loading && <span className="text-[10px] text-[#64748b]">Loading thread…</span>}
                          </div>
                          <div className="text-xs text-[#64748b]">Coach {c.coachName}</div>
                          {c.lastReplySnippet && (
                            <div className="text-xs text-[#94a3b8] mt-0.5 truncate italic">"{c.lastReplySnippet}"</div>
                          )}
                          {c.lastReplyAt && (
                            <div className="text-[10px] text-[#475569] mt-0.5">{new Date(c.lastReplyAt).toLocaleDateString()}</div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {inboxUntracked.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest mb-2">
                    New coach emails (not yet tracked)
                  </div>
                  <div className="flex flex-col gap-2">
                    {inboxUntracked.map((t) => {
                      const loading = pickingThreadId === t.threadId
                      return (
                        <button
                          key={t.threadId}
                          onClick={() => pickFromUntracked(t)}
                          disabled={loading}
                          className="text-left px-3 py-2.5 rounded-lg border border-[rgba(74,222,128,0.15)] bg-[rgba(74,222,128,0.03)] hover:border-[rgba(74,222,128,0.4)] hover:bg-[rgba(74,222,128,0.06)] transition-all disabled:opacity-60"
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-[#f1f5f9]">{t.senderName || t.senderEmail}</span>
                            <span className="text-[10px] text-[#4ade80] font-semibold uppercase tracking-widest">New</span>
                            {loading && <span className="text-[10px] text-[#64748b]">Loading thread…</span>}
                          </div>
                          <div className="text-xs text-[#64748b] truncate">{t.subject}</div>
                          {t.snippet && (
                            <div className="text-xs text-[#94a3b8] mt-0.5 truncate italic">"{t.snippet}"</div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Gmail connect nudge */}
      {!gmailConnected && user?.id && (
        <Card className="p-4 mb-6 flex items-center justify-between gap-4">
          <div className="text-sm text-[#94a3b8]">
            📧 Connect Gmail to pull coach replies directly into your context — no copy-pasting needed.
          </div>
          <Button size="sm" onClick={connectGmail} disabled={gmailLoading}>
            {gmailLoading ? 'Connecting...' : 'Connect Gmail'}
          </Button>
        </Card>
      )}

      {/* Type selector */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {EMAIL_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => { setType(t.value); setResult(''); setAdvice('') }}
            className={`p-4 rounded-xl border text-left transition-all ${
              type === t.value
                ? 'border-[#eab308] bg-[rgba(234,179,8,0.06)]'
                : 'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(234,179,8,0.3)]'
            }`}
          >
            <div className={`text-sm font-bold mb-1 ${type === t.value ? 'text-[#eab308]' : 'text-[#f1f5f9]'}`}>{t.label}</div>
            <div className="text-xs text-[#64748b]">{t.desc}</div>
          </button>
        ))}
      </div>

      {/* Schedule Picker */}
      <Card className="p-5 mb-6">
        <div className="text-xs font-semibold text-[#eab308] uppercase tracking-wider mb-3">📅 My Upcoming Schedule (optional)</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESET_EVENTS.map((event) => (
            <button
              key={event.id}
              onClick={() => toggleEvent(event.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                selectedEvents.includes(event.id)
                  ? 'bg-[rgba(234,179,8,0.1)] border-[#eab308] text-[#eab308]'
                  : 'bg-transparent border-[rgba(255,255,255,0.1)] text-[#64748b] hover:border-[rgba(234,179,8,0.4)] hover:text-[#f1f5f9]'
              }`}
            >
              {selectedEvents.includes(event.id) ? '✓ ' : ''}{event.label}
              <span className="ml-1 opacity-60">({event.date})</span>
            </button>
          ))}
        </div>
        <Input
          placeholder="+ Custom event (e.g. Regional Showcase in Dallas, May 2026)"
          value={customEvent}
          onChange={(e) => setCustomEvent(e.target.value)}
        />
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <Textarea
            label="Context (optional but recommended)"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={PLACEHOLDERS[type]}
            rows={6}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Email'}
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          {result ? (
            <>
              <Card className="p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="green">✓ Ready to send</Badge>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </Button>
                </div>
                <pre className="text-sm text-[#f1f5f9] whitespace-pre-wrap font-sans leading-relaxed overflow-y-auto scrollbar-hide max-h-64">
                  {result}
                </pre>
              </Card>

              {advice && (
                <Card className="p-4 border border-[rgba(234,179,8,0.2)] bg-[rgba(234,179,8,0.04)]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#eab308]">Counselor's Take</span>
                  </div>
                  <p className="text-sm text-[#f1f5f9] leading-relaxed">{advice}</p>
                </Card>
              )}
            </>
          ) : (
            <Card className="p-12 h-full flex flex-col items-center justify-center text-center">
              <div className="text-3xl mb-3">💬</div>
              <div className="font-serif text-base font-bold text-[#f1f5f9] mb-1">Your email appears here</div>
              <p className="text-xs text-[#64748b]">Choose a type, pick your events, and click Generate</p>
              <p className="text-xs text-[#64748b] mt-1">You'll also get a counselor's read on the situation.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
