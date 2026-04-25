import { useState } from 'react'
import { generateEmail } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { Division, CoachEmail, AthleteProfile } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

const DIVISIONS: Division[] = ['D1', 'D2', 'D3', 'NAIA', 'JUCO']

export function Emails() {
  const [school, setSchool] = useState('')
  const [division, setDivision] = useState<Division>('D2')
  const [coachName, setCoachName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState<{ subject: string; body: string } | null>(null)
  const [history, setHistory] = useState<CoachEmail[]>([])
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    if (!school || !coachName) { setError('Please fill in school name and coach name.'); return }
    setError(''); setLoading(true)
    try {
      const result = await generateEmail(profile, school, division, coachName)
      setGenerated(result)
      setHistory((prev) => [{
        id: crypto.randomUUID(), school, division, coachName, coachEmail: '',
        subject: result.subject, body: result.body, status: 'draft',
        createdAt: new Date().toISOString(),
      }, ...prev])
      setSchool(''); setCoachName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate email')
    } finally { setLoading(false) }
  }

  async function handleCopy() {
    if (!generated) return
    await navigator.clipboard.writeText(`Subject: ${generated.subject}\n\n${generated.body}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Coach Emails</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Email Generator</h1>
        <p className="text-[#64748b] mt-2 text-sm">Personalized cold outreach written for each division and program.</p>
      </div>

      <div className="grid grid-cols-5 gap-8 mb-10">
        {/* Form */}
        <div className="col-span-2">
          <Card className="p-6 flex flex-col gap-4">
            <Input label="School / University" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Wake Forest University" />
            <Input label="Coach name" value={coachName} onChange={(e) => setCoachName(e.target.value)} placeholder="Coach Smith" />
            <div>
              <label className="text-sm font-medium text-[#f1f5f9] block mb-2">Division</label>
              <div className="flex flex-wrap gap-2">
                {DIVISIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDivision(d)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                      division === d
                        ? 'bg-[#eab308] text-black border-[#eab308]'
                        : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button onClick={handleGenerate} disabled={loading} className="w-full mt-1">
              {loading ? 'Generating...' : 'Generate Email'}
            </Button>
            <p className="text-xs text-[#64748b] text-center">3 free emails · Unlimited with Pro</p>
          </Card>
        </div>

        {/* Output */}
        <div className="col-span-3">
          {generated ? (
            <Card className="p-6 h-full">
              <div className="flex items-center justify-between mb-5">
                <Badge variant="green">✓ Generated</Badge>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? '✓ Copied' : 'Copy email'}
                </Button>
              </div>
              <div className="mb-4">
                <div className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-1.5">Subject</div>
                <div className="text-sm font-medium text-[#f1f5f9] bg-[rgba(255,255,255,0.04)] px-3 py-2 rounded-lg">
                  {generated.subject}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-1.5">Body</div>
                <pre className="text-sm text-[#f1f5f9] whitespace-pre-wrap font-sans leading-relaxed bg-[rgba(255,255,255,0.04)] px-4 py-3 rounded-lg max-h-80 overflow-y-auto scrollbar-hide">
                  {generated.body}
                </pre>
              </div>
            </Card>
          ) : (
            <Card className="p-16 text-center h-full flex flex-col items-center justify-center">
              <div className="text-4xl mb-4">✉️</div>
              <div className="font-serif text-lg font-bold text-[#f1f5f9] mb-2">Ready to send</div>
              <p className="text-sm text-[#64748b] max-w-xs">Fill in the school and coach, then generate a personalized email.</p>
            </Card>
          )}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 className="font-serif text-xl font-bold text-[#f1f5f9] mb-5">Email history</h2>
          <div className="flex flex-col gap-3">
            {history.map((email) => (
              <Card key={email.id} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-bold text-[#f1f5f9]">{email.school}</span>
                    <Badge variant="muted">{email.division}</Badge>
                    <Badge variant="muted">{email.status}</Badge>
                  </div>
                  <div className="text-xs text-[#64748b] truncate">Subject: {email.subject}</div>
                </div>
                <div className="text-xs text-[#64748b] flex-shrink-0">
                  {new Date(email.createdAt).toLocaleDateString()}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
