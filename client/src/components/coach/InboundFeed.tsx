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
  const [gmailConnected, setGmailConnected] = useState(false)

  useEffect(() => {
    setLoading(true)
    getCoachInbound(coachUserId)
      .then(({ athletes }) => setAthletes(athletes))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
    fetch(`/api/gmail/status?userId=${encodeURIComponent(coachUserId)}`)
      .then((r) => r.json())
      .then((d) => setGmailConnected(!!d.connected))
      .catch(() => {})
  }, [coachUserId])

  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-[rgba(245,241,232,0.06)] bg-[rgba(255,255,255,0.02)] p-5 flex items-start gap-4 animate-pulse"
          >
            <div className="w-14 h-14 rounded-full bg-[rgba(245,241,232,0.06)]" />
            <div className="flex-1">
              <div className="h-4 w-2/5 rounded bg-[rgba(245,241,232,0.06)]" />
              <div className="h-3 w-3/5 rounded bg-[rgba(245,241,232,0.04)] mt-2" />
              <div className="h-3 w-1/2 rounded bg-[rgba(245,241,232,0.04)] mt-1.5" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (error) return <div className="text-sm text-red-400 py-8 text-center">{error}</div>
  if (athletes.length === 0) {
    return (
      <div className="rounded-lg border border-[rgba(245,241,232,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-5 text-sm text-[#9a9385] leading-relaxed">
        <p className="text-[#cfc7b2] font-medium mb-2">No athletes yet.</p>
        <p>
          When a KickrIQ athlete sends an email to your program's listed coach address, they'll show up here
          with their full profile, position, GPA, and a one-click reply.
        </p>
        <p className="mt-2 text-[11px] text-[#9a9385]">
          Make sure your contact info on KickrIQ matches what's on your athletics website. Athletes find you faster that way.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {athletes.map((a) => (
        <AthleteCard key={a.athleteId} athlete={a} onReply={setReplyTo} gmailConnected={gmailConnected} />
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
