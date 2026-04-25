import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import type { CoachEmail } from '../../types'

const DEMO: CoachEmail[] = [
  { id: '1', school: 'Wake Forest University', division: 'D1', coachName: 'Coach Hamilton', coachEmail: 'hamilton@wfu.edu', subject: 'Class of 2026 Striker — ECNL', body: '', status: 'responded', sentAt: '2025-04-10', respondedAt: '2025-04-14', createdAt: '2025-04-09' },
  { id: '2', school: 'Elon University', division: 'D1', coachName: 'Coach Rivera', coachEmail: '', subject: 'Class of 2026 Forward Interest', body: '', status: 'sent', sentAt: '2025-04-15', createdAt: '2025-04-14' },
  { id: '3', school: 'High Point University', division: 'D1', coachName: 'Coach Chen', coachEmail: '', subject: 'Prospective Student-Athlete Inquiry', body: '', status: 'draft', createdAt: '2025-04-18' },
  { id: '4', school: 'Appalachian State', division: 'D1', coachName: 'Coach Williams', coachEmail: '', subject: 'Class of 2026 Midfielder', body: '', status: 'sent', sentAt: '2025-04-20', createdAt: '2025-04-19' },
]

const statusColor: Record<CoachEmail['status'], 'green' | 'gold' | 'muted' | 'blue'> = {
  responded: 'green', sent: 'blue', draft: 'muted', not_interested: 'muted',
}

export function Tracker() {
  const [contacts, setContacts] = useState<CoachEmail[]>(DEMO)
  const [filter, setFilter] = useState<CoachEmail['status'] | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newSchool, setNewSchool] = useState('')
  const [newCoach, setNewCoach] = useState('')

  function addContact() {
    if (!newSchool) return
    setContacts((prev) => [{
      id: crypto.randomUUID(), school: newSchool, division: 'D1',
      coachName: newCoach, coachEmail: '', subject: '', body: '',
      status: 'draft', createdAt: new Date().toISOString(),
    }, ...prev])
    setNewSchool(''); setNewCoach(''); setShowAdd(false)
  }

  function updateStatus(id: string, status: CoachEmail['status']) {
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c))
  }

  const filtered = filter === 'all' ? contacts : contacts.filter((c) => c.status === filter)
  const counts = {
    all: contacts.length,
    draft: contacts.filter((c) => c.status === 'draft').length,
    sent: contacts.filter((c) => c.status === 'sent').length,
    responded: contacts.filter((c) => c.status === 'responded').length,
  }

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Outreach</span>
          </div>
          <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Outreach Tracker</h1>
          <p className="text-[#64748b] mt-2 text-sm">Track every contact, response, and follow-up in one place.</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>+ Add Contact</Button>
      </div>

      {showAdd && (
        <Card className="p-5 mb-6 flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-40">
            <Input label="School" value={newSchool} onChange={(e) => setNewSchool(e.target.value)} placeholder="University name" />
          </div>
          <div className="flex-1 min-w-40">
            <Input label="Coach name" value={newCoach} onChange={(e) => setNewCoach(e.target.value)} placeholder="Coach name" />
          </div>
          <Button onClick={addContact}>Add</Button>
          <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', value: counts.all, color: 'text-[#f1f5f9]' },
          { label: 'Drafted', value: counts.draft, color: 'text-[#64748b]' },
          { label: 'Sent', value: counts.sent, color: 'text-[#60a5fa]' },
          { label: 'Responded', value: counts.responded, color: 'text-[#4ade80]' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="p-4 text-center">
            <div className={`font-serif text-3xl font-black ${color}`}>{value}</div>
            <div className="text-xs text-[#64748b] mt-0.5">{label}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {(['all', 'draft', 'sent', 'responded'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${
              filter === f
                ? 'bg-[#eab308] text-black border-[#eab308]'
                : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
            }`}
          >
            {f} {f !== 'all' ? `(${counts[f as keyof typeof counts]})` : ''}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.07)]">
                {['School', 'Coach', 'Div', 'Status', 'Sent', 'Response', 'Update'].map((h) => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="px-5 py-4 font-medium text-[#f1f5f9] whitespace-nowrap">{c.school}</td>
                  <td className="px-5 py-4 text-[#64748b] whitespace-nowrap">{c.coachName}</td>
                  <td className="px-5 py-4"><Badge variant="muted">{c.division}</Badge></td>
                  <td className="px-5 py-4"><Badge variant={statusColor[c.status]}>{c.status}</Badge></td>
                  <td className="px-5 py-4 text-[#64748b] text-xs whitespace-nowrap">{c.sentAt ? new Date(c.sentAt).toLocaleDateString() : '—'}</td>
                  <td className="px-5 py-4 text-[#64748b] text-xs whitespace-nowrap">{c.respondedAt ? new Date(c.respondedAt).toLocaleDateString() : '—'}</td>
                  <td className="px-5 py-4">
                    <select
                      value={c.status}
                      onChange={(e) => updateStatus(c.id, e.target.value as CoachEmail['status'])}
                      className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded text-xs text-[#64748b] px-2 py-1.5 focus:outline-none focus:border-[#eab308]"
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="responded">Responded</option>
                      <option value="not_interested">Not Interested</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
