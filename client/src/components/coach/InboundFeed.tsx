import { useEffect, useState } from 'react'
import { AthleteCard } from './AthleteCard'
import { getCoachInbound, type CoachInboundAthlete } from '../../lib/api'
import { ReplyComposer } from './ReplyComposer'

interface Props {
  coachUserId: string
}

export function InboundFeed({ coachUserId }: Props) {
  const [loading, setLoading] = useState(true)
  const [athletes, setAthletes] = useState<CoachInboundAthlete[]>([])
  const [error, setError] = useState('')
  const [replyTo, setReplyTo] = useState<CoachInboundAthlete | null>(null)

  useEffect(() => {
    setLoading(true)
    getCoachInbound(coachUserId)
      .then(({ athletes }) => setAthletes(athletes))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [coachUserId])

  if (loading) return <div className="text-sm text-[#9a9385] py-8 text-center">Loading inbound athletes…</div>
  if (error) return <div className="text-sm text-red-400 py-8 text-center">{error}</div>
  if (athletes.length === 0) {
    return (
      <p className="text-sm text-[#9a9385]">
        No KickrIQ athletes have emailed you yet. As they reach out using your program's contact info, they'll appear here.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {athletes.map((a) => (
        <AthleteCard key={a.athleteId} athlete={a} onReply={setReplyTo} />
      ))}
      {replyTo && (
        <ReplyComposer
          coachUserId={coachUserId}
          athlete={replyTo}
          onClose={() => setReplyTo(null)}
          onSent={() => {
            setReplyTo(null)
            getCoachInbound(coachUserId).then(({ athletes }) => setAthletes(athletes)).catch(() => {})
          }}
        />
      )}
    </div>
  )
}
