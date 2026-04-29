import { useState } from 'react'
import { generateEmail, findCoach } from '../../lib/api'
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
  const [gender, setGender] = useState<'mens' | 'womens'>('womens')
  const [coachName, setCoachName] = useState('')
  const [coachEmail, setCoachEmail] = useState('')
  const [coachConfidence, setCoachConfidence] = useState<'high' | 'low' | null>(null)
  const [findingCoach, setFindingCoach] = useState(false)
  const [coachFound, setCoachFound] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState<{ subject: string; body: string } | null>(null)
  const [history, setHistory] = useState<CoachEmail[]>([])
  const [copied, setCopied] = useState(false)

  async function handleFindCoach() {
    if (!school) { setError('Enter a school name first.'); return }
    setError(''); setFindingCoach(true); setCoachFound(false)
    setCoachName(''); setCoachEmail(''); setCoachConfidence(null)
    try {
      const result = await findCoach(school, division, gender)
      setCoachName(result.coachName)
      setCoachEmail(result.coachEmail)
      setCoachConfidence(result.confidence)
      setCoachFound(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to find coach')
    } finally { setFindingCoach(false) }
  }

  async function handleGenerate() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    if (!school || !coachName) { setError('Please find or enter a coach name.'); return }
    setError(''); setLoading(true)
    try {
      const result = await generateEmail(profile, school, division, coachName, gender)
      setGenerated(result)
      setHistory((prev) => [{
        id: crypto.randomUUID(), school, division, coachName, coachEmail,
        subject: result.subject, body: result.body, status: 'draft',
        createdAt: new Date().toISOString(),
      }, ...prev])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate email')
    } finally { setLoading(false) }
  }

  async function handleCopy() {
    if (!generated) return
    await navigator.clipboard.writeText(`Subject: ${generated.subject}\n\n${generated.body}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function resetCoach() {
    setCoachFound(false); setCoachName(''); setCoachEmail(''); setCoachConfidence(null)
  }

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Coach Emails</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Email Generator</h1>
        <p className="text-[#64748b] mt-2 text-sm">Enter a school and we'll find the coach — then generate a personalized outreach email.</p>
      </div>

      <div className="grid grid-cols-5 gap-8 mb-10">
        {/* Form */}
        <div className="col-span-2">
          <Card className="p-6 flex flex-col gap-4">
            <Input
              label="School / University"
              value={school}
              onChange={(e) => { setSchool(e.target.value); resetCoach() }}
              placeholder="Wake Forest University"
            />

            {/* Division */}
            <div>
              <label className="text-sm font-medium text-[#f1f5f9] block mb-2">Division</label>
              <div className="flex flex-wrap gap-2">
                {DIVISIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setDivision(d); resetCoach() }}
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

            {/* Gender */}
            <div>
              <label className="text-sm font-medium text-[#f1f5f9] block mb-2">Program</label>
              <div className="flex gap-2">
                {[{ id: 'womens', label: "Women's" }, { id: 'mens', label: "Men's" }].map((g) => (
                  <button
                    key={g.id}
                    onClick={() => { setGender(g.id as 'mens' | 'womens'); resetCoach() }}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold border transition-all ${
                      gender === g.id
                        ? 'bg-[#eab308] text-black border-[#eab308]'
                        : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Find Coach */}
            {!coachFound ? (
              <Button onClick={handleFindCoach} disabled={findingCoach || !school} variant="outline" className="w-full">
                {findingCoach ? 'Looking up coach...' : '🔍 Find Coach'}
              </Button>
            ) : (
              <div className={`p-3 rounded-xl border ${coachConfidence === 'high' ? 'border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.05)]' : 'border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.05)]'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#f1f5f9]">Coach Found</span>
                  {coachConfidence === 'low' && (
                    <span className="text-xs text-[#fbbf24]">⚠️ Verify before sending</span>
                  )}
                  {coachConfidence === 'high' && (
                    <span className="text-xs text-[#4ade80]">✓ Verified</span>
                  )}
                </div>
                <Input
                  label="Coach name"
                  value={coachName}
                  onChange={(e) => setCoachName(e.target.value)}
                  placeholder="Coach name"
                />
                <div className="mt-2">
                  <Input
                    label="Coach email"
                    value={coachEmail}
                    onChange={(e) => setCoachEmail(e.target.value)}
                    placeholder="coach@school.edu"
                  />
                </div>
                <button onClick={resetCoach} className="text-xs text-[#64748b] hover:text-[#f1f5f9] mt-2">
                  ← Search different coach
                </button>
              </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}

            <Button
              onClick={handleGenerate}
              disabled={loading || !coachFound}
              className="w-full mt-1"
            >
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
              <p className="text-sm text-[#64748b] max-w-xs">Enter the school, pick division and program, then click Find Coach to auto-fill the coach's info.</p>
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
                  <div className="text-xs text-[#64748b] truncate">To: {email.coachName} · {email.subject}</div>
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
