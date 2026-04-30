import { useEffect, useState } from 'react'
import { gmailGetThread, gmailRateAndLog } from '../../lib/api'
import { Button } from '../ui/Button'
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
        const tagged = msgs.map((m) => ({
          ...m,
          isFromCoach: m.sender.toLowerCase().includes(coachEmail.toLowerCase()),
        }))
        setMessages(tagged)
        // Auto-rate if there's a coach reply
        const lastCoachMsg = [...tagged].reverse().find((m) => m.isFromCoach)
        if (lastCoachMsg) {
          setRatingLoading(true)
          gmailRateAndLog(userId, contactId, lastCoachMsg.body, coachName, school)
            .then((r) => setRating(r))
            .catch(() => {})
            .finally(() => setRatingLoading(false))
        }
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }, [threadId])

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
            <span className="text-xs text-[#64748b]">Analyzing coach reply...</span>
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
