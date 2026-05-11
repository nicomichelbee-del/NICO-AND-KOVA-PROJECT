import { useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { getCoachFitScore, type CoachInboundAthlete, type CoachFitScore } from '../../lib/api'

interface Props {
  athlete: CoachInboundAthlete
  onReply: (a: CoachInboundAthlete) => void
  gmailConnected?: boolean
  // Coach user id is needed to call the fit-score endpoint. Optional so
  // legacy callers (and any non-portal embed) still compile.
  coachUserId?: string | null
}

// Color the fit-score pill by tier. Same palette family as interestRating so
// the dashboard reads at a glance: green = strong, amber = solid, gray = soft,
// red = mismatch. 1-3 reserved for clear-mismatch verdicts.
function fitColor(score: number): string {
  if (score >= 8) return 'bg-[#4ade80] text-black'
  if (score >= 6) return 'bg-[#fbbf24] text-black'
  if (score >= 4) return 'bg-[#9a9385] text-black'
  return 'bg-[#7f1d1d] text-[#fca5a5]'
}

function consentedAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const day = 24 * 60 * 60 * 1000
  if (ms < day) return 'today'
  const days = Math.floor(ms / day)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

const STATUS_COLOR: Record<string, string> = {
  hot: 'bg-[#4ade80] text-black',
  warm: 'bg-[#fbbf24] text-black',
  cold: 'bg-[#9a9385] text-black',
  not_interested: 'bg-[#7f1d1d] text-[#fca5a5]',
  pending: 'bg-[rgba(245,241,232,0.06)] text-[#9a9385]',
}

export function AthleteCard({ athlete: a, onReply, gmailConnected = true, coachUserId }: Props) {
  const [open, setOpen] = useState(false)
  const [fit, setFit] = useState<CoachFitScore | null>(null)
  const [fitLoading, setFitLoading] = useState(false)
  const [fitError, setFitError] = useState('')
  const [fitCached, setFitCached] = useState(false)
  const initials = (a.name || 'KQ').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()

  async function handleFit(refresh = false) {
    if (!coachUserId) { setFitError('Sign in as a claimed coach to use fit scoring.'); return }
    setFitLoading(true); setFitError('')
    try {
      const r = await getCoachFitScore(coachUserId, a.athleteId, refresh)
      setFit(r.fit)
      setFitCached(r.cached)
    } catch (e) {
      setFitError(e instanceof Error ? e.message : 'Fit-score request failed')
    } finally {
      setFitLoading(false)
    }
  }
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        {a.photoUrl ? (
          <img src={a.photoUrl} alt={a.name} className="w-14 h-14 rounded-full object-cover" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[rgba(240,182,90,0.12)] flex items-center justify-center text-[#f0b65a] font-serif font-bold">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div className="font-serif text-base font-bold text-[#f5f1e8] truncate">{a.name}</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#9a9385]">
                {consentedAgo(a.consentedAt)}
              </span>
              <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${STATUS_COLOR[a.interestRating] ?? STATUS_COLOR.pending}`}>
                {a.interestRating}
              </span>
            </div>
          </div>
          <div className="text-xs text-[#9a9385] mt-1">
            {[a.position, a.gradYear ? `'${String(a.gradYear).slice(-2)}` : null, a.club, a.location].filter(Boolean).join(' · ')}
          </div>
          <div className="text-xs text-[#9a9385] mt-0.5">
            {[a.gpa ? `GPA ${a.gpa}` : null, a.heightCm ? `${Math.round(a.heightCm / 2.54)} in` : null, a.intendedMajor].filter(Boolean).join(' · ')}
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {a.slug && (
              <a
                href={`/players/${a.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono uppercase tracking-wider text-[#f0b65a] hover:underline"
              >
                Full profile →
              </a>
            )}
            {a.highlightUrl && (
              <a
                href={a.highlightUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono uppercase tracking-wider text-[#f0b65a] hover:underline"
              >
                Highlight video →
              </a>
            )}
            {!fit && !fitLoading && (
              <button
                type="button"
                onClick={() => handleFit(false)}
                className="text-xs font-mono uppercase tracking-wider text-[#f0b65a] hover:underline disabled:opacity-50"
                disabled={!coachUserId}
                title={coachUserId ? 'Score how well this athlete fits your program needs (AI)' : 'Sign in as a claimed coach to use this'}
              >
                {coachUserId ? 'AI fit score →' : 'AI fit score (claim first)'}
              </button>
            )}
            {fitLoading && (
              <span className="text-xs font-mono uppercase tracking-wider text-[#9a9385]">
                Scoring fit…
              </span>
            )}
            {fit && (
              <span
                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${fitColor(fit.score)}`}
                title={fitCached ? 'Cached — recomputes when your needs or the athlete profile changes' : 'Fresh AI assessment'}
              >
                Fit {fit.score}/10
              </span>
            )}
            <Button
              onClick={() => onReply(a)}
              className="ml-auto"
              title={gmailConnected ? 'Reply via your Gmail' : 'Connect Gmail above to reply'}
            >
              Reply{gmailConnected ? '' : ' (connect Gmail)'}
            </Button>
          </div>
          {fitError && (
            <div className="mt-3 text-[11px] text-[#fca5a5] bg-[rgba(127,29,29,0.15)] border border-[rgba(127,29,29,0.4)] rounded px-3 py-2">
              {fitError}
            </div>
          )}
          {fit && (
            <div className="mt-3 text-xs text-[#cfc7b2] bg-[rgba(255,255,255,0.02)] border border-[rgba(245,241,232,0.06)] rounded px-3 py-2">
              <div className="text-[#f5f1e8] mb-2">{fit.oneLine}</div>
              {fit.strengths.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#4ade80] mb-1">Strengths</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {fit.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {fit.concerns.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#fbbf24] mb-1">To verify</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {fit.concerns.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              <button
                type="button"
                onClick={() => handleFit(true)}
                disabled={fitLoading}
                className="text-[10px] font-mono uppercase tracking-wider text-[#9a9385] hover:text-[#f0b65a] disabled:opacity-50"
              >
                {fitLoading ? 'Re-scoring…' : 'Regenerate'}
              </button>
            </div>
          )}
          {a.lastReplySnippet && (
            <button onClick={() => setOpen(!open)} className="text-[11px] text-[#9a9385] mt-3 hover:text-[#f0b65a]">
              {open ? 'Hide last reply' : 'Show last reply'}
            </button>
          )}
          {open && a.lastReplySnippet && (
            <div className="mt-2 text-xs text-[#cfc7b2] bg-[rgba(255,255,255,0.02)] border border-[rgba(245,241,232,0.06)] rounded px-3 py-2">
              {a.lastReplySnippet}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
