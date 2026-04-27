import { useState } from 'react'
import { findCamps, generateCampEmails } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import type { AthleteProfile, IdCamp, School, CampCoach } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}
function getSchools(): School[] {
  try { return JSON.parse(localStorage.getItem('matchedSchools') ?? '[]') } catch { return [] }
}

type GeneratedEmail = { coachName: string; subject: string; body: string }

export function Camps() {
  const [camps, setCamps] = useState<IdCamp[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedCamp, setSelectedCamp] = useState<IdCamp | null>(null)
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([])
  const [emailLoading, setEmailLoading] = useState(false)
  const [emails, setEmails] = useState<GeneratedEmail[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null)

  async function handleFindCamps() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    setError(''); setLoading(true); setCamps([]); setSelectedCamp(null); setEmails([])
    try {
      const schools = getSchools()
      const { camps: found } = await findCamps(profile, schools)
      setCamps(found)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to find camps')
    } finally { setLoading(false) }
  }

  function toggleCoach(name: string) {
    setSelectedCoaches((prev) => prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name])
  }

  function selectCamp(camp: IdCamp) {
    setSelectedCamp(camp)
    setSelectedCoaches(camp.coaches.map((c) => c.name))
    setEmails([])
  }

  async function handleGenerateEmails() {
    const profile = getProfile()
    if (!profile || !selectedCamp) return
    const coachObjs: CampCoach[] = selectedCamp.coaches.filter((c) => selectedCoaches.includes(c.name))
    setEmailLoading(true)
    try {
      const { emails: generated } = await generateCampEmails(profile, selectedCamp, coachObjs)
      setEmails(generated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate emails')
    } finally { setEmailLoading(false) }
  }

  async function copyEmail(idx: number, text: string) {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000)
  }

  const divisionColor: Record<string, string> = {
    D1: 'text-[#f87171]', D2: 'text-[#fbbf24]', D3: 'text-[#4ade80]',
    NAIA: 'text-[#60a5fa]', JUCO: 'text-[#a78bfa]',
  }

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">ID Camps</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">ID Camp Finder</h1>
        <p className="text-[#64748b] mt-2 text-sm">Find ID camps at your target schools and email every coach in one click.</p>
      </div>

      <Card className="p-6 mb-8">
        <p className="text-sm text-[#64748b] mb-4">
          We'll find ID camps at the schools in your matched list plus top open events for your division and position.
        </p>
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <Button onClick={handleFindCamps} disabled={loading}>
          {loading ? 'Searching camps...' : '⛺ Find My ID Camps'}
        </Button>
      </Card>

      {camps.length > 0 && (
        <div className="grid grid-cols-2 gap-6">
          {/* Camp list */}
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">{camps.length} Camps Found</div>
            <div className="flex flex-col gap-3">
              {camps.map((camp) => (
                <button
                  key={camp.id}
                  onClick={() => selectCamp(camp)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    selectedCamp?.id === camp.id
                      ? 'border-[#eab308] bg-[rgba(234,179,8,0.06)]'
                      : 'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(234,179,8,0.3)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="font-medium text-[#f1f5f9] text-sm leading-snug">{camp.campName}</div>
                    <span className={`text-xs font-bold flex-shrink-0 ${divisionColor[camp.division] ?? 'text-[#64748b]'}`}>{camp.division}</span>
                  </div>
                  <div className="text-xs text-[#eab308] font-medium mb-1">{camp.school}</div>
                  <div className="text-xs text-[#64748b]">📅 {camp.date}</div>
                  <div className="text-xs text-[#64748b]">📍 {camp.location}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-[#64748b]">💰 {camp.cost}</span>
                    <span className="text-xs text-[#64748b]">{camp.coaches.length} coach{camp.coaches.length !== 1 ? 'es' : ''}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Camp detail / email panel */}
          <div>
            {selectedCamp ? (
              <div className="flex flex-col gap-4">
                <Card className="p-5">
                  <div className="font-serif text-lg font-bold text-[#f1f5f9] mb-1">{selectedCamp.campName}</div>
                  <div className="text-xs text-[#eab308] mb-3">{selectedCamp.school}</div>
                  <div className="flex flex-col gap-1.5 mb-4 text-xs text-[#64748b]">
                    <div>📅 {selectedCamp.date} · 📍 {selectedCamp.location} · 💰 {selectedCamp.cost}</div>
                    {selectedCamp.url && (
                      <a href={selectedCamp.url} target="_blank" rel="noopener noreferrer" className="text-[#60a5fa] hover:underline">
                        🔗 Camp registration page
                      </a>
                    )}
                  </div>

                  <div className="text-xs font-semibold text-[#f1f5f9] uppercase tracking-wider mb-2">Attending Coaches</div>
                  <div className="flex flex-col gap-2 mb-4">
                    {selectedCamp.coaches.map((coach) => (
                      <label key={coach.name} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedCoaches.includes(coach.name)}
                          onChange={() => toggleCoach(coach.name)}
                          className="w-4 h-4 accent-[#eab308]"
                        />
                        <div>
                          <div className="text-sm text-[#f1f5f9]">{coach.name}</div>
                          <div className="text-xs text-[#64748b]">{coach.title}</div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex gap-2 mb-4 flex-wrap">
                    <button
                      onClick={() => setSelectedCoaches(selectedCamp.coaches.map((c) => c.name))}
                      className="text-xs text-[#eab308] hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-xs text-[#64748b]">·</span>
                    <button
                      onClick={() => setSelectedCoaches([])}
                      className="text-xs text-[#64748b] hover:text-[#f1f5f9]"
                    >
                      Deselect all
                    </button>
                  </div>

                  <Button
                    onClick={handleGenerateEmails}
                    disabled={emailLoading || selectedCoaches.length === 0}
                    className="w-full"
                  >
                    {emailLoading
                      ? 'Generating...'
                      : `✉️ Generate ${selectedCoaches.length} Email${selectedCoaches.length !== 1 ? 's' : ''}`}
                  </Button>
                </Card>

                {emails.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">{emails.length} Emails Ready</div>
                    {emails.map((email, idx) => (
                      <Card key={idx} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-sm font-medium text-[#f1f5f9]">{email.coachName}</div>
                            <div className="text-xs text-[#64748b]">{email.subject}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setExpandedEmail(expandedEmail === idx ? null : idx)}
                              className="text-xs text-[#64748b] hover:text-[#f1f5f9] px-2 py-1 border border-[rgba(255,255,255,0.1)] rounded"
                            >
                              {expandedEmail === idx ? 'Hide' : 'View'}
                            </button>
                            <button
                              onClick={() => copyEmail(idx, `Subject: ${email.subject}\n\n${email.body}`)}
                              className="text-xs text-[#eab308] hover:text-[#ca9a06] px-2 py-1 border border-[rgba(234,179,8,0.3)] rounded"
                            >
                              {copiedIdx === idx ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                        {expandedEmail === idx && (
                          <pre className="text-xs text-[#64748b] whitespace-pre-wrap font-sans leading-relaxed mt-3 pt-3 border-t border-[rgba(255,255,255,0.07)]">
                            {email.body}
                          </pre>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Card className="p-12 h-full flex flex-col items-center justify-center text-center">
                <div className="text-3xl mb-3">⛺</div>
                <div className="font-serif text-base font-bold text-[#f1f5f9] mb-1">Select a camp</div>
                <p className="text-xs text-[#64748b]">Click any camp to see coaches and generate outreach emails</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {!loading && camps.length === 0 && (
        <Card className="p-16 text-center">
          <div className="text-4xl mb-4">⛺</div>
          <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Find your next ID camp</div>
          <p className="text-sm text-[#64748b] max-w-sm mx-auto">
            Click the button above and we'll find ID camps at your matched schools plus top events for your division and position.
          </p>
        </Card>
      )}
    </div>
  )
}
