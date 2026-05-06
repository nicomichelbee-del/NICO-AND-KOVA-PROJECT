import { useEffect, useMemo, useState } from 'react'
import { generateEmail, findCoach, listAllSchools, getGmailStatus, gmailSend, type FindCoachResult } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { PageHeader } from '../../components/ui/PageHeader'
import { readLegacyProfile } from '../../lib/profileAdapter'
import { useAuth } from '../../context/AuthContext'
import type { Division, CoachEmail, AthleteProfile, SchoolDirectoryEntry } from '../../types'

function getProfile(): AthleteProfile | null {
  return readLegacyProfile()
}

const DIVISIONS: Division[] = ['D1', 'D2', 'D3', 'NAIA', 'JUCO']

const REGION_TABS = ['All', 'West', 'Southwest', 'Midwest', 'Southeast', 'Northeast'] as const
type RegionTab = typeof REGION_TABS[number]

export function Emails() {
  const { user } = useAuth()
  const [school, setSchool] = useState('')
  const [division, setDivision] = useState<Division>('D2')
  const [gender, setGender] = useState<'mens' | 'womens'>('womens')
  const [coachName, setCoachName] = useState('')
  const [coachEmail, setCoachEmail] = useState('')
  const [coachSource, setCoachSource] = useState<FindCoachResult['source'] | null>(null)
  const [findingCoach, setFindingCoach] = useState(false)
  const [coachFound, setCoachFound] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState<{ subject: string; body: string } | null>(null)
  const [generatedId, setGeneratedId] = useState<string | null>(null)
  const [history, setHistory] = useState<CoachEmail[]>([])
  const [copied, setCopied] = useState(false)

  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)
  const [gmailLoading, setGmailLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentMsg, setSentMsg] = useState('')

  // Snapshot of the school/division/gender used for the last successful coach
  // lookup. When the user edits fields after a coach is found, surface a Save
  // button so they can re-run the lookup against the new selection.
  const [appliedLookup, setAppliedLookup] = useState<{
    school: string
    division: Division
    gender: 'mens' | 'womens'
  } | null>(null)
  const lookupDirty = coachFound && appliedLookup !== null && (
    appliedLookup.school !== school ||
    appliedLookup.division !== division ||
    appliedLookup.gender !== gender
  )

  // Browser state
  const [directory, setDirectory] = useState<SchoolDirectoryEntry[]>([])
  const [region, setRegion] = useState<RegionTab>('All')
  const [divisionFilter, setDivisionFilter] = useState<Division | 'All'>('All')
  const [conference, setConference] = useState<string>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    listAllSchools()
      .then((res) => setDirectory(res.schools))
      .catch(() => { /* directory is optional; the manual entry path still works */ })
  }, [])

  useEffect(() => {
    if (!user?.id) return
    getGmailStatus(user.id)
      .then((s) => { setGmailConnected(s.connected); setGmailEmail(s.email) })
      .catch(() => { /* status check is non-fatal */ })
  }, [user?.id])

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'gmail-connected') {
        setGmailConnected(true)
        setGmailEmail(e.data.email ?? null)
        setGmailLoading(false)
      } else if (e.data?.type === 'gmail-error') {
        setGmailLoading(false)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  async function connectGmail() {
    if (!user?.id) return
    setGmailLoading(true)
    try {
      const res = await fetch(`/api/gmail/auth?userId=${encodeURIComponent(user.id)}`)
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Failed to get auth URL')
      window.open(data.url, 'gmail-auth', 'width=500,height=600,left=200,top=100')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start Gmail auth')
      setGmailLoading(false)
    }
  }

  async function handleSend() {
    if (!user?.id || !generated || !coachEmail) return
    setSending(true); setError(''); setSentMsg('')
    try {
      await gmailSend(user.id, coachEmail, generated.subject, generated.body, { emailType: 'initial_outreach' })
      setSentMsg(`Sent to ${coachEmail}`)
      if (generatedId) {
        setHistory((prev) => prev.map((h) =>
          h.id === generatedId ? { ...h, status: 'sent', sentAt: new Date().toISOString() } : h,
        ))
      }
      setTimeout(() => setSentMsg(''), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send email')
    } finally { setSending(false) }
  }

  // Conferences available within the current region tab and division.
  const conferenceOptions = useMemo(() => {
    let pool = region === 'All' ? directory : directory.filter((s) => s.region === region)
    if (divisionFilter !== 'All') pool = pool.filter((s) => s.division === divisionFilter)
    const counts = new Map<string, number>()
    for (const s of pool) {
      if (!s.conference) continue
      counts.set(s.conference, (counts.get(s.conference) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }))
  }, [directory, region, divisionFilter])

  // Reset conference filter when changing region (a conference may not exist in
  // the new region).
  useEffect(() => {
    if (conference === 'all') return
    if (!conferenceOptions.some((c) => c.name === conference)) setConference('all')
  }, [region, conferenceOptions, conference])

  const filteredSchools = useMemo(() => {
    let pool = directory
    if (region !== 'All') pool = pool.filter((s) => s.region === region)
    if (divisionFilter !== 'All') pool = pool.filter((s) => s.division === divisionFilter)
    if (conference !== 'all') pool = pool.filter((s) => s.conference === conference)
    if (search.trim()) {
      const q = search.toLowerCase()
      pool = pool.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.conference.toLowerCase().includes(q),
      )
    }
    return pool.sort((a, b) => a.name.localeCompare(b.name))
  }, [directory, region, divisionFilter, conference, search])

  function pickSchoolFromDirectory(entry: SchoolDirectoryEntry) {
    setSchool(entry.name)
    setDivision(entry.division)
    resetCoach()
  }

  async function handleFindCoach() {
    if (!school) { setError('Enter a school name first.'); return }
    setError(''); setFindingCoach(true); setCoachFound(false)
    setCoachName(''); setCoachEmail(''); setCoachSource(null)
    try {
      const result = await findCoach(school, division, gender)
      setCoachName(result.coachName)
      setCoachEmail(result.coachEmail)
      setCoachSource(result.source ?? null)
      setCoachFound(true)
      setAppliedLookup({ school, division, gender })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to find coach')
    } finally { setFindingCoach(false) }
  }

  async function handleGenerate() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    if (!school || !coachName) { setError('Please find or enter a coach name.'); return }
    setError(''); setLoading(true); setSentMsg('')
    try {
      const result = await generateEmail(profile, school, division, coachName, gender)
      setGenerated(result)
      const id = crypto.randomUUID()
      setGeneratedId(id)
      setHistory((prev) => [{
        id, school, division, coachName, coachEmail,
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
    setCoachFound(false); setCoachName(''); setCoachEmail(''); setCoachSource(null)
  }

  return (
    <div className="kr-page max-w-6xl">
      <PageHeader
        eyebrow="Coach outreach"
        title={<>Email a <span className="kr-accent">coach</span>.</>}
        lede={`Browse ${directory.length || 'all'} programs by region or conference, or type a school directly. We'll find the coach and draft your outreach.`}
        aside={
          <div className="flex flex-col items-end gap-2">
            {gmailConnected ? (
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-pitch-light shadow-[0_0_8px_var(--pitch-2)] inline-block" />
                  <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-pitch-light">Gmail connected</span>
                </div>
                {gmailEmail && <div className="text-[12px] text-ink-2 mt-1">{gmailEmail}</div>}
              </div>
            ) : (
              <Button onClick={connectGmail} disabled={gmailLoading || !user?.id} size="sm">
                {gmailLoading ? 'Connecting…' : 'Connect Gmail'}
              </Button>
            )}
            {!user?.id && <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-ink-3">Sign in to connect</div>}
          </div>
        }
      />

      {/* School browser: region tabs → optional conference filter → school list */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col gap-3 mb-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-wrap gap-2">
              {REGION_TABS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    region === r
                      ? 'bg-[#f0b65a] text-black border-[#f0b65a]'
                      : 'bg-transparent text-[#9a9385] border-[rgba(245,241,232,0.10)] hover:border-[#f0b65a] hover:text-[#f0b65a]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <select
                value={conference}
                onChange={(e) => setConference(e.target.value)}
                className="bg-[rgba(245,241,232,0.04)] border border-[rgba(245,241,232,0.10)] rounded-lg px-3 py-1.5 text-xs text-[#f5f1e8] focus:outline-none focus:border-[#f0b65a]"
              >
                <option value="all">All conferences (optional)</option>
                {conferenceOptions.map((c) => (
                  <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
                ))}
              </select>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search school..."
                className="bg-[rgba(245,241,232,0.04)] border border-[rgba(245,241,232,0.10)] rounded-lg px-3 py-1.5 text-xs text-[#f5f1e8] placeholder-[#9a9385] focus:outline-none focus:border-[#f0b65a] w-44"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['All', ...DIVISIONS] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDivisionFilter(d)}
                className={`px-3 py-1 rounded text-xs font-semibold border transition-all ${
                  divisionFilter === d
                    ? 'bg-[rgba(240,182,90,0.18)] text-[#f0b65a] border-[#f0b65a]'
                    : 'bg-transparent text-[#9a9385] border-[rgba(245,241,232,0.08)] hover:border-[rgba(240,182,90,0.45)] hover:text-[#f5f1e8]'
                }`}
              >
                {d === 'All' ? 'All Divisions' : d}
              </button>
            ))}
          </div>
        </div>

        {directory.length === 0 ? (
          <p className="text-xs text-[#9a9385] py-3">Loading school directory…</p>
        ) : filteredSchools.length === 0 ? (
          <p className="text-xs text-[#9a9385] py-3">No schools match these filters.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1 scrollbar-hide">
            {filteredSchools.map((s) => {
              const active = s.name === school
              return (
                <button
                  key={s.id}
                  onClick={() => pickSchoolFromDirectory(s)}
                  className={`text-left rounded-lg px-3 py-2 text-xs border transition-all ${
                    active
                      ? 'bg-[rgba(240,182,90,0.12)] border-[rgba(234,179,8,0.5)]'
                      : 'bg-[rgba(255,255,255,0.02)] border-[rgba(245,241,232,0.06)] hover:border-[rgba(240,182,90,0.35)] hover:bg-[rgba(234,179,8,0.04)]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-[#f5f1e8]">{s.name}</span>
                    <span className="text-[10px] uppercase tracking-widest text-[#f0b65a]">{s.division}</span>
                  </div>
                  <div className="text-[#9a9385] truncate">
                    {s.conference} · {s.location}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <p className="text-[11px] text-[#9a9385] mt-3 italic">
          Click a school to auto-fill the form below — or type one in manually.
        </p>
      </Card>

      <div className="grid grid-cols-5 gap-6 mb-8">
        {/* Form */}
        <div className="col-span-2">
          <Card className="p-6 flex flex-col gap-7">
            <Input
              label="School / University"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="Wake Forest University"
            />

            {/* Division */}
            <div>
              <label className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-[#9a9385] block mb-2.5">Division</label>
              <div className="flex flex-wrap gap-2">
                {DIVISIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDivision(d)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                      division === d
                        ? 'bg-[#f0b65a] text-black border-[#f0b65a]'
                        : 'bg-transparent text-[#9a9385] border-[rgba(245,241,232,0.10)] hover:border-[#f0b65a] hover:text-[#f0b65a]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-[#9a9385] block mb-2.5">Program</label>
              <div className="flex gap-2">
                {[{ id: 'womens', label: "Women's" }, { id: 'mens', label: "Men's" }].map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGender(g.id as 'mens' | 'womens')}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold border transition-all ${
                      gender === g.id
                        ? 'bg-[#f0b65a] text-black border-[#f0b65a]'
                        : 'bg-transparent text-[#9a9385] border-[rgba(245,241,232,0.10)] hover:border-[#f0b65a] hover:text-[#f0b65a]'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Find Coach — visually separated from form fields above */}
            <div className="pt-5 mt-1 border-t border-[rgba(245,241,232,0.08)]">
            {!coachFound ? (
              <Button onClick={handleFindCoach} disabled={findingCoach || !school} variant="outline" className="w-full">
                {findingCoach ? 'Looking up coach...' : '🔍 Find Coach'}
              </Button>
            ) : (
              <div className={`p-3 rounded-xl border ${coachSource === 'scraped' ? 'border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.05)]' : 'border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.05)]'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#f5f1e8]">Coach Found</span>
                  {coachSource === 'scraped' && (
                    <span className="text-xs text-[#4ade80]">✓ Official site</span>
                  )}
                  {coachSource === 'scraped-partial' && (
                    <span className="text-xs text-[#fbbf24]">⚠️ Verify email</span>
                  )}
                  {coachSource === 'ai-recall' && (
                    <span className="text-xs text-[#fbbf24]">⚠️ Verify before sending</span>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <Input
                    label="Coach name"
                    value={coachName}
                    onChange={(e) => setCoachName(e.target.value)}
                    placeholder="Coach name"
                  />
                  <Input
                    label="Coach email"
                    value={coachEmail}
                    onChange={(e) => setCoachEmail(e.target.value)}
                    placeholder="coach@school.edu"
                  />
                </div>
                <button onClick={resetCoach} className="text-xs text-[#9a9385] hover:text-[#f5f1e8] mt-3">
                  ← Search different coach
                </button>
                {lookupDirty && (
                  <div className="mt-3 pt-3 border-t border-[rgba(245,241,232,0.10)] flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-[#f0b65a]">
                      Fields changed — save to apply.
                    </span>
                    <Button onClick={handleFindCoach} disabled={findingCoach} size="sm">
                      {findingCoach ? 'Saving…' : 'Save changes'}
                    </Button>
                  </div>
                )}
              </div>
            )}
            </div>

            {error && <p className="text-xs text-red-400 -mt-2">{error}</p>}

            <div>
              <Button
                onClick={handleGenerate}
                disabled={loading || !coachFound}
                className="w-full"
              >
                {loading ? 'Generating...' : 'Generate Email'}
              </Button>
              <p className="text-[11px] text-[#9a9385] text-center mt-2">3 free emails · Unlimited with Pro</p>
            </div>
          </Card>
        </div>

        {/* Output */}
        <div className="col-span-3">
          {generated ? (
            <Card className="p-6 h-full">
              <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                <Badge variant="green">✓ Generated</Badge>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? '✓ Copied' : 'Copy email'}
                  </Button>
                  {gmailConnected ? (
                    <Button
                      size="sm"
                      onClick={handleSend}
                      disabled={sending || !coachEmail}
                      title={!coachEmail ? 'Add a coach email to send' : `Send from ${gmailEmail ?? 'your Gmail'}`}
                    >
                      {sending ? 'Sending…' : '✉️ Send via Gmail'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={connectGmail}
                      disabled={gmailLoading || !user?.id}
                    >
                      {gmailLoading ? 'Connecting…' : 'Connect Gmail to send'}
                    </Button>
                  )}
                </div>
              </div>
              {sentMsg && (
                <div className="mb-4 px-3 py-2 rounded-lg text-xs text-[#4ade80] bg-[rgba(74,222,128,0.08)] border border-[rgba(74,222,128,0.25)]">
                  ✓ {sentMsg}
                </div>
              )}
              {gmailConnected && gmailEmail && (
                <div className="text-[11px] text-[#9a9385] mb-4">
                  Sending from <span className="text-[#f5f1e8]">{gmailEmail}</span> — replies go straight to your inbox.
                </div>
              )}
              <div className="mb-4">
                <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-widest mb-1.5">Subject</div>
                <div className="text-sm font-medium text-[#f5f1e8] bg-[rgba(245,241,232,0.04)] px-3 py-2 rounded-lg">
                  {generated.subject}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-widest mb-1.5">Body</div>
                <pre className="text-sm text-[#f5f1e8] whitespace-pre-wrap font-sans leading-relaxed bg-[rgba(245,241,232,0.04)] px-4 py-3 rounded-lg max-h-80 overflow-y-auto scrollbar-hide">
                  {generated.body}
                </pre>
              </div>
            </Card>
          ) : (
            <Card className="p-10 text-center h-full flex flex-col items-center justify-center">
              <div className="text-3xl mb-3">✉️</div>
              <div className="font-serif text-lg font-bold text-[#f5f1e8] mb-1.5">Ready to send</div>
              <p className="text-sm text-[#9a9385] max-w-xs leading-relaxed">Pick a school above (filter by region or conference), then Find Coach and Generate Email.</p>
            </Card>
          )}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 className="font-serif text-xl font-bold text-[#f5f1e8] mb-4">Email history</h2>
          <div className="flex flex-col gap-2.5">
            {history.map((email) => (
              <Card key={email.id} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-bold text-[#f5f1e8]">{email.school}</span>
                    <Badge variant="muted">{email.division}</Badge>
                    <Badge variant="muted">{email.status}</Badge>
                  </div>
                  <div className="text-xs text-[#9a9385] truncate">To: {email.coachName} · {email.subject}</div>
                </div>
                <div className="text-xs text-[#9a9385] flex-shrink-0">
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
