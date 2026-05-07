import { useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import type { CoachInboundAthlete } from '../../lib/api'

interface Props {
  athlete: CoachInboundAthlete
  onReply: (a: CoachInboundAthlete) => void
}

const STATUS_COLOR: Record<string, string> = {
  hot: 'bg-[#4ade80] text-black',
  warm: 'bg-[#fbbf24] text-black',
  cold: 'bg-[#9a9385] text-black',
  not_interested: 'bg-[#7f1d1d] text-[#fca5a5]',
  pending: 'bg-[rgba(245,241,232,0.06)] text-[#9a9385]',
}

export function AthleteCard({ athlete: a, onReply }: Props) {
  const [open, setOpen] = useState(false)
  const initials = (a.name || 'KQ').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()
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
            <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${STATUS_COLOR[a.interestRating] ?? STATUS_COLOR.pending}`}>
              {a.interestRating}
            </span>
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
            <Button onClick={() => onReply(a)} className="ml-auto">Reply</Button>
          </div>
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
