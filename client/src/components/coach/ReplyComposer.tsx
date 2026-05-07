import { useEffect, useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import type { CoachInboundAthlete } from '../../lib/api'

interface Props {
  coachUserId: string
  athlete: CoachInboundAthlete
  onClose: () => void
  onSent: () => void
}

export function ReplyComposer({ coachUserId, athlete, onClose, onSent }: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [gmailNotConnected, setGmailNotConnected] = useState(false)

  useEffect(() => {
    setLoading(true); setError('')
    fetch('/api/coach/reply/draft', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachUserId, athleteId: athlete.athleteId }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Draft failed')
        return r.json()
      })
      .then(({ subject, body }) => { setSubject(subject ?? ''); setBody(body ?? '') })
      .catch((e) => setError(e instanceof Error ? e.message : 'Draft failed'))
      .finally(() => setLoading(false))
  }, [coachUserId, athlete.athleteId])

  async function handleSend() {
    setSending(true); setError(''); setGmailNotConnected(false)
    try {
      const r = await fetch('/api/coach/reply/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachUserId, athleteId: athlete.athleteId, subject, body }),
      })
      const j = await r.json()
      if (!r.ok) {
        if (j.error === 'gmail_not_connected') setGmailNotConnected(true)
        throw new Error(j.error ?? 'Send failed')
      }
      onSent()
    } catch (e) {
      if (!gmailNotConnected) setError(e instanceof Error ? e.message : 'Send failed')
    } finally { setSending(false) }
  }

  function connectGmail() {
    fetch(`/api/gmail/auth?userId=${encodeURIComponent(coachUserId)}`)
      .then((r) => r.json())
      .then(({ url }) => { if (url) window.open(url, '_blank', 'width=500,height=600') })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl mt-12" onClick={(e) => e.stopPropagation()}>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.18em] text-[#f0b65a]">Reply to</div>
            <div className="font-serif text-lg font-bold text-[#f5f1e8]">{athlete.name}</div>
          </div>
          <button onClick={onClose} className="text-[#9a9385] hover:text-[#f5f1e8] text-xl">×</button>
        </div>

        {gmailNotConnected ? (
          <div className="text-center py-6">
            <p className="text-sm text-[#cfc7b2] mb-4">Connect your Gmail to send replies through KickrIQ.</p>
            <Button onClick={connectGmail}>Connect Gmail</Button>
          </div>
        ) : loading ? (
          <div className="text-center py-12 text-sm text-[#9a9385]">Drafting reply with AI…</div>
        ) : (
          <>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full bg-[rgba(245,241,232,0.04)] border border-[rgba(245,241,232,0.10)] rounded text-sm text-[#f5f1e8] px-3 py-2 mb-3 focus:outline-none focus:border-[#f0b65a]"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Reply…"
              className="w-full bg-[rgba(245,241,232,0.04)] border border-[rgba(245,241,232,0.10)] rounded text-sm text-[#f5f1e8] px-3 py-2 focus:outline-none focus:border-[#f0b65a]"
            />
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={onClose} className="bg-transparent border border-[rgba(245,241,232,0.10)]">Cancel</Button>
              <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}>
                {sending ? 'Sending…' : 'Send via Gmail'}
              </Button>
            </div>
          </>
        )}
      </Card>
      </div>
    </div>
  )
}
