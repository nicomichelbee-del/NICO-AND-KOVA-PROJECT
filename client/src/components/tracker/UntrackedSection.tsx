import { useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { createContact } from '../../lib/api'
import type { UntrackedThread, Division } from '../../types'

interface Props {
  userId: string
  threads: UntrackedThread[]
  onContactAdded: () => void
}

export function UntrackedSection({ userId, threads, onContactAdded }: Props) {
  const [adding, setAdding] = useState<string | null>(null) // threadId being added
  const [coachName, setCoachName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [division, setDivision] = useState<Division>('D1')
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = threads.filter((t) => !dismissed.has(t.threadId))
  if (visible.length === 0) return null

  async function handleAdd(thread: UntrackedThread) {
    if (!schoolName) return
    setLoading(true)
    try {
      await createContact(userId, {
        coachName,
        schoolName,
        coachEmail: thread.senderEmail,
        division,
        gmailThreadId: thread.threadId,
      })
      onContactAdded()
      setAdding(null)
      setCoachName(''); setSchoolName('')
      setDismissed((prev) => new Set([...prev, thread.threadId]))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add contact')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-8">
      <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">
        Possible Coach Replies ({visible.length})
      </div>
      <div className="flex flex-col gap-3">
        {visible.map((thread) => (
          <Card key={thread.threadId} className="p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm text-[#f1f5f9] font-medium">
                  {thread.senderName || thread.senderEmail}
                </div>
                <div className="text-xs text-[#64748b]">{thread.senderEmail}</div>
                <div className="text-xs text-[#475569] mt-0.5 italic">"{thread.subject}"</div>
                {thread.snippet && (
                  <div className="text-xs text-[#475569] mt-1 truncate max-w-[400px]">{thread.snippet}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setAdding(thread.threadId)}>
                  + Add to Tracker
                </Button>
                <button
                  onClick={() => setDismissed((prev) => new Set([...prev, thread.threadId]))}
                  className="text-xs text-[#475569] hover:text-[#64748b]"
                >
                  Dismiss
                </button>
              </div>
            </div>
            {adding === thread.threadId && (
              <div className="mt-4 flex items-end gap-3 flex-wrap border-t border-[rgba(255,255,255,0.07)] pt-4">
                <div className="flex-1 min-w-36">
                  <Input label="School name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="University name" />
                </div>
                <div className="flex-1 min-w-36">
                  <Input label="Coach name" value={coachName} onChange={(e) => setCoachName(e.target.value)} placeholder="Coach name" />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] block mb-1.5">Division</label>
                  <select
                    value={division}
                    onChange={(e) => setDivision(e.target.value as Division)}
                    className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded text-xs text-[#f1f5f9] px-3 py-2 focus:outline-none focus:border-[#eab308]"
                  >
                    {(['D1', 'D2', 'D3', 'NAIA', 'JUCO'] as Division[]).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <Button size="sm" onClick={() => handleAdd(thread)} disabled={loading || !schoolName}>
                  {loading ? 'Adding...' : 'Add'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
