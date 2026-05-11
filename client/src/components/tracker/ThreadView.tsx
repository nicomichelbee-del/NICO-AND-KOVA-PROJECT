import { useEffect, useState } from 'react'
import { gmailGetThread, gmailRateAndLog } from '../../lib/api'
import { Button } from '../ui/Button'
import { readLegacyProfile } from '../../lib/profileAdapter'
import type { ThreadMessage } from '../../types'

interface Props {
  userId: string
  threadId: string
  contactId: string
  coachEmail: string
  coachName: string
  school: string
  onGenerateReply: (coachMessage: string) => void
  onMarkVisit: () => void
  onArchive: () => void
}

export function ThreadView({ userId, threadId, contactId, coachEmail, coachName, school, onGenerateReply, onMarkVisit, onArchive }: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState<{ rating: string; nextAction: string } | null>(null)
  const [ratingLoading, setRatingLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    gmailGetThread(userId, threadId)
      .then(({ messages: msgs }) => {
        // A blank coachEmail would make `.includes('')` true for every message and cause
        // us to rate the athlete's own outbound. Only tag isFromCoach when we have an
        // actual address to match.
        const lowerCoachEmail = coachEmail.trim().toLowerCase()
        const tagged = msgs.map((m) => ({
          ...m,
          isFromCoach: !!lowerCoachEmail && m.sender.toLowerCase().includes(lowerCoachEmail),
        }))
        setMessages(tagged)

        const lastCoachMsg = [...tagged].reverse().find((m) => m.isFromCoach)
        if (!lastCoachMsg) return

        // Cache the rating per-message in localStorage. Re-expanding the row, switching
        // tabs, or navigating back must not trigger another Claude call — the rating only
        // re-runs when a NEW coach message arrives (different message id).
        const cacheKey = `kr-rate-${contactId}-${lastCoachMsg.id}`
        try {
          const cached = localStorage.getItem(cacheKey)
          if (cached) {
            setRating(JSON.parse(cached))
            return
          }
        } catch { /* corrupt entry — fall through to fresh rate */ }

        // Gender comes from the athlete profile — the AI calibrates the
        // rating against gender-specific recruiting-cycle norms. Skip the
        // auto-rate silently if profile lacks gender (the UI elsewhere
        // already prompts the user to complete it).
        const profile = readLegacyProfile()
        if (profile?.gender !== 'mens' && profile?.gender !== 'womens') return
        setRatingLoading(true)
        gmailRateAndLog(userId, contactId, lastCoachMsg.body, coachName, school, profile.gender)
          .then((r) => {
            setRating(r)
            try { localStorage.setItem(cacheKey, JSON.stringify(r)) } catch { /* quota — non-fatal */ }
          })
          .catch(() => {})
          .finally(() => setRatingLoading(false))
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }, [threadId, userId, coachEmail, contactId, coachName, school])

  const lastCoachMessage = [...messages].reverse().find((m) => m.isFromCoach)

  if (loading) {
    return (
      <div className="px-6 py-4 text-xs text-[#64748b]">Loading thread...</div>
    )
  }

  return (
    <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.04)]">
      {(rating || ratingLoading) && (
        <div className="mb-4 p-3 rounded-lg bg-[rgba(234,179,8,0.04)] border border-[rgba(234,179,8,0.15)]">
          {ratingLoading ? (
            <span className="text-xs text-[#64748b]">Analyzing...</span>
          ) : (
            <>
              <span className="text-xs font-semibold text-[#eab308]">AI Read: </span>
              <span className="text-xs text-[#f1f5f9]">{rating?.nextAction}</span>
            </>
          )}
        </div>
      )}
      <div className="flex flex-col gap-3 mb-4 max-h-64 overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg p-3 text-xs ${
              msg.isFromCoach
                ? 'bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] ml-0 mr-12'
                : 'bg-[rgba(234,179,8,0.05)] border border-[rgba(234,179,8,0.1)] ml-12 mr-0'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-semibold text-[#f1f5f9]">
                {msg.isFromCoach ? coachName || msg.sender : 'You'}
              </span>
              <span className="text-[#475569]">
                {new Date(msg.timestamp).toLocaleDateString()}
              </span>
            </div>
            <div className="text-[#94a3b8] whitespace-pre-wrap leading-relaxed">
              {msg.body.slice(0, 600)}{msg.body.length > 600 ? '...' : ''}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-xs text-[#64748b]">No messages found in this thread.</div>
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {lastCoachMessage && (
          <Button size="sm" onClick={() => onGenerateReply(lastCoachMessage.body)}>
            ✍️ Generate Reply
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onMarkVisit}>
          📅 Mark Visit Scheduled
        </Button>
        <Button size="sm" variant="ghost" onClick={onArchive}>
          Archive
        </Button>
      </div>
    </div>
  )
}
