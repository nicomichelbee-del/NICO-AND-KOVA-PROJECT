import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ThreadView } from './ThreadView'
import type { OutreachContact } from '../../types'

const interestConfig = {
  hot: { label: '🔥 Hot', color: 'text-[#4ade80]', bg: 'bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)]' },
  warm: { label: '☀️ Warm', color: 'text-[#fbbf24]', bg: 'bg-[rgba(251,191,36,0.1)] border-[rgba(251,191,36,0.2)]' },
  cold: { label: '❄️ Cold', color: 'text-[#60a5fa]', bg: 'bg-[rgba(96,165,250,0.1)] border-[rgba(96,165,250,0.2)]' },
  not_interested: { label: '⛔ No', color: 'text-[#64748b]', bg: 'bg-[rgba(100,116,139,0.1)] border-[rgba(100,116,139,0.2)]' },
  pending: { label: '· · ·', color: 'text-[#64748b]', bg: 'bg-[rgba(100,116,139,0.05)] border-[rgba(100,116,139,0.1)]' },
}

const statusColor: Record<OutreachContact['status'], 'green' | 'gold' | 'muted' | 'blue'> = {
  replied: 'green', contacted: 'blue', scheduled_visit: 'gold',
  committed: 'green', no_response: 'muted',
}

interface Props {
  contact: OutreachContact
  userId: string
  gmailConnected: boolean
  onStatusChange: (id: string, status: OutreachContact['status']) => void
  onSendEmail: (contact: OutreachContact) => void
  sendingId: string | null
}

export function ContactRow({ contact, userId, gmailConnected, onStatusChange, onSendEmail, sendingId }: Props) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const cfg = interestConfig[contact.interestRating]

  function handleGenerateReply(coachMessage: string) {
    const params = new URLSearchParams({
      type: 'answer',
      coachName: contact.coachName,
      school: contact.schoolName,
      message: coachMessage.slice(0, 500),
    })
    navigate(`/dashboard/followup?${params.toString()}`)
  }

  return (
    <>
      <tr
        className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
        onClick={() => contact.gmailThreadId && setExpanded((e) => !e)}
      >
        <td className="px-5 py-4 font-medium text-[#f1f5f9] whitespace-nowrap">{contact.schoolName}</td>
        <td className="px-5 py-4 text-xs">
          <div className="text-[#64748b]">{contact.coachName}</div>
          {contact.coachEmail && <div className="text-[#475569] text-xs">{contact.coachEmail}</div>}
          {contact.lastReplySnippet && (
            <div className="text-[#475569] text-xs mt-0.5 italic truncate max-w-[200px]">
              "{contact.lastReplySnippet}"
            </div>
          )}
        </td>
        <td className="px-5 py-4"><Badge variant="muted">{contact.division}</Badge></td>
        <td className="px-5 py-4"><Badge variant={statusColor[contact.status]}>{contact.status.replace('_', ' ')}</Badge></td>
        <td className="px-5 py-4">
          {contact.interestRating !== 'pending' || contact.lastReplyAt ? (
            <span className={`px-2 py-1 rounded text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
          ) : (
            <span className="text-xs text-[#475569]">—</span>
          )}
        </td>
        <td className="px-5 py-4 text-[#64748b] text-xs whitespace-nowrap">
          {contact.lastReplyAt ? new Date(contact.lastReplyAt).toLocaleDateString() : '—'}
        </td>
        <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={contact.status}
              onChange={(e) => onStatusChange(contact.id, e.target.value as OutreachContact['status'])}
              className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded text-xs text-[#64748b] px-2 py-1.5 focus:outline-none focus:border-[#eab308]"
            >
              <option value="contacted">Contacted</option>
              <option value="replied">Replied</option>
              <option value="scheduled_visit">Visit Scheduled</option>
              <option value="committed">Committed</option>
              <option value="no_response">No Response</option>
            </select>
            {gmailConnected && contact.coachEmail && (
              <button
                onClick={() => onSendEmail(contact)}
                disabled={sendingId === contact.id}
                className="text-xs text-[#eab308] hover:text-[#ca9a06] px-2 py-1.5 border border-[rgba(234,179,8,0.3)] rounded whitespace-nowrap"
              >
                {sendingId === contact.id ? 'Going...' : '✉️ Email'}
              </button>
            )}
            {contact.gmailThreadId && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-xs text-[#64748b] hover:text-[#f1f5f9] px-2 py-1.5 border border-[rgba(255,255,255,0.1)] rounded"
              >
                {expanded ? '▲ Hide' : '▼ Thread'}
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && contact.gmailThreadId && (
        <tr>
          <td colSpan={7} className="px-0 py-0 bg-[rgba(255,255,255,0.015)]">
            <ThreadView
              userId={userId}
              threadId={contact.gmailThreadId}
              contactId={contact.id}
              coachEmail={contact.coachEmail}
              coachName={contact.coachName}
              school={contact.schoolName}
              onGenerateReply={handleGenerateReply}
              onMarkVisit={() => onStatusChange(contact.id, 'scheduled_visit')}
              onArchive={() => onStatusChange(contact.id, 'no_response')}
            />
          </td>
        </tr>
      )}
    </>
  )
}
