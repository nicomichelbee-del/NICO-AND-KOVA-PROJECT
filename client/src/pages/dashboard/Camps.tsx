import { useEffect, useMemo, useState } from 'react'
import { findCamps, generateCampEmails, getShowcaseEvents, getIdCamps } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import type { AthleteProfile, IdCamp, CampCoach, Division, IdEvent, IdCampEntry } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

type GeneratedEmail = { coachName: string; subject: string; body: string }
type Tab = 'showcase' | 'idcamps' | 'find'

const ALL_DIVISIONS: Division[] = ['D1', 'D2', 'D3', 'NAIA', 'JUCO']

const divisionColor: Record<string, string> = {
  D1: 'text-[#f87171]', D2: 'text-[#fbbf24]', D3: 'text-[#4ade80]',
  NAIA: 'text-[#60a5fa]', JUCO: 'text-[#a78bfa]',
}

const formatLabel: Record<IdCampEntry['format'], string> = {
  'residential': 'Residential ID Camp',
  'day': 'Day ID Camp',
  'prospect-day': 'Prospect Day',
  'elite-id': 'Elite ID Camp (invitation)',
}

export function Camps() {
  const [tab, setTab] = useState<Tab>('showcase')

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Camps & Showcases</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">ID Camps & Showcases</h1>
        <p className="text-[#64748b] mt-2 text-sm">Multi-school showcase events, individual school ID camps, and a finder for any school you target.</p>
      </div>

      {/* Honest disclaimer banner — surfaces our data limits up front */}
      <Card className="p-4 mb-6 border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.04)]">
        <div className="flex items-start gap-3">
          <span className="text-base">⚠️</span>
          <div className="text-xs text-[#cbd5e1] leading-relaxed">
            <strong className="text-[#fbbf24]">Dates and registration links change every year.</strong> Each entry below points to a Google search for the program's current registration page — that always returns real, up-to-date results. We do not store fabricated registration URLs.
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[rgba(255,255,255,0.07)] mb-8">
        {[
          { id: 'showcase' as const, label: '🌍 Showcase Events' },
          { id: 'idcamps' as const, label: '⛺ Major ID Camps' },
          { id: 'find' as const, label: '🔍 Find Camps at Your Schools' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? 'border-[#eab308] text-[#eab308]'
                : 'border-transparent text-[#64748b] hover:text-[#f1f5f9]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'showcase' && <ShowcaseTab />}
      {tab === 'idcamps' && <IdCampsTab />}
      {tab === 'find' && <FindCampsTab />}
    </div>
  )
}

// ── Showcase Events tab: multi-school showcase events (ECNL, Disney, Jefferson Cup, etc.) ──

function ShowcaseTab() {
  const [events, setEvents] = useState<IdEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [divFilter, setDivFilter] = useState<Division | 'all'>('all')
  const [genderFilter, setGenderFilter] = useState<'both' | 'mens' | 'womens'>('both')

  useEffect(() => {
    getShowcaseEvents()
      .then((res) => setEvents(res.events))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => events.filter((e) => {
    const d = divFilter === 'all' || e.divisions.includes(divFilter)
    const g = genderFilter === 'both' || e.gender === 'both' || e.gender === genderFilter
    return d && g
  }), [events, divFilter, genderFilter])

  return (
    <>
      <Card className="p-5 mb-6">
        <div className="flex flex-wrap gap-6">
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Division</div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'D1', 'D2', 'D3', 'NAIA', 'JUCO'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDivFilter(d)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all capitalize ${
                    divFilter === d
                      ? 'bg-[#eab308] text-black border-[#eab308]'
                      : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Gender</div>
            <div className="flex gap-2">
              {[{ id: 'both', label: 'All' }, { id: 'womens', label: "Women's" }, { id: 'mens', label: "Men's" }].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGenderFilter(g.id as 'both' | 'mens' | 'womens')}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                    genderFilter === g.id
                      ? 'bg-[#eab308] text-black border-[#eab308]'
                      : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-4">
        {loading ? 'Loading…' : `${filtered.length} Showcase Event${filtered.length !== 1 ? 's' : ''}`}
      </div>

      <div className="flex flex-col gap-4">
        {filtered.map((event) => (
          <Card key={event.id} hover className="p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="font-bold text-[#f1f5f9] text-sm mb-1">{event.name}</div>
                <div className="text-xs text-[#64748b]">{event.organizer}</div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                {event.divisions.map((d) => (
                  <span key={d} className={`text-xs font-bold ${divisionColor[d] ?? 'text-[#64748b]'}`}>{d}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-3 text-xs text-[#64748b]">
              <div>📅 {event.dateRange}</div>
              <div>📍 {event.location}</div>
              <div>👥 {event.coachAttendance}</div>
              <div>💰 {event.costRange}</div>
            </div>
            <p className="text-xs text-[#64748b] italic mb-3 leading-relaxed">{event.notes}</p>
            <div className="flex items-center gap-4 flex-wrap">
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#60a5fa] hover:underline"
              >
                🔗 Register / Learn More
              </a>
              <span className="text-xs text-[#64748b]">
                {event.gender === 'both' ? "Men's & Women's" : event.gender === 'womens' ? "Women's only" : "Men's only"}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <Card className="p-12 text-center">
          <div className="text-3xl mb-3">🌍</div>
          <p className="text-sm text-[#64748b]">No events match the selected filters.</p>
        </Card>
      )}
    </>
  )
}

// ── Major ID Camps tab: curated single-school ID camps ──

function IdCampsTab() {
  const [camps, setCamps] = useState<IdCampEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [divFilter, setDivFilter] = useState<Division | 'all'>('all')
  const [genderFilter, setGenderFilter] = useState<'both' | 'mens' | 'womens'>('both')
  const [search, setSearch] = useState('')

  useEffect(() => {
    getIdCamps()
      .then((res) => setCamps(res.camps))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return camps.filter((c) => {
      const d = divFilter === 'all' || c.division === divFilter
      const g = genderFilter === 'both' || c.gender === 'both' || c.gender === genderFilter
      const q = search.trim().toLowerCase()
      const s = !q || c.schoolName.toLowerCase().includes(q) || c.campName.toLowerCase().includes(q)
      return d && g && s
    }).sort((a, b) => a.schoolName.localeCompare(b.schoolName))
  }, [camps, divFilter, genderFilter, search])

  return (
    <>
      <Card className="p-5 mb-6">
        <div className="flex flex-wrap gap-6 items-start">
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Division</div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'D1', 'D2', 'D3', 'NAIA', 'JUCO'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDivFilter(d)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all capitalize ${
                    divFilter === d
                      ? 'bg-[#eab308] text-black border-[#eab308]'
                      : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Program</div>
            <div className="flex gap-2">
              {[{ id: 'both', label: 'All' }, { id: 'womens', label: "Women's" }, { id: 'mens', label: "Men's" }].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGenderFilter(g.id as 'both' | 'mens' | 'womens')}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                    genderFilter === g.id
                      ? 'bg-[#eab308] text-black border-[#eab308]'
                      : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-auto">
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Search</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="School name…"
              className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-1.5 text-xs text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#eab308] w-48"
            />
          </div>
        </div>
      </Card>

      <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-4">
        {loading ? 'Loading…' : `${filtered.length} ID Camp${filtered.length !== 1 ? 's' : ''}`}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((camp) => (
          <Card key={camp.id} hover className="p-5">
            <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-bold text-[#f1f5f9] text-sm">{camp.campName}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${divisionColor[camp.division]}`}>{camp.division}</span>
                  <span className="text-[10px] text-[#64748b] uppercase tracking-widest">
                    {camp.gender === 'both' ? 'Both' : camp.gender === 'womens' ? "Women's" : "Men's"}
                  </span>
                </div>
                <div className="text-xs text-[#eab308] font-medium">{camp.schoolName}</div>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-[#64748b] bg-[rgba(255,255,255,0.04)] px-2 py-1 rounded">
                {formatLabel[camp.format]}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 mt-3 text-xs text-[#64748b]">
              <div>📅 Typically: {camp.typicalMonths}</div>
              <div>👥 {camp.ageRange}</div>
              <div>💰 {camp.estimatedCost}</div>
            </div>
            <p className="text-xs text-[#64748b] italic mt-3 leading-relaxed">{camp.notes}</p>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <a
                href={camp.searchRegistrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#eab308] hover:underline font-semibold"
              >
                🔗 Register
              </a>
              <a
                href={camp.athleticsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#60a5fa] hover:underline"
              >
                Official athletics site ↗
              </a>
            </div>
          </Card>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <Card className="p-12 text-center">
          <div className="text-3xl mb-3">⛺</div>
          <p className="text-sm text-[#64748b]">No camps match these filters. Try the "Find Camps at Your Schools" tab to look up any program.</p>
        </Card>
      )}
    </>
  )
}

// ── Find Camps tab: user-driven lookup for arbitrary schools ──

function FindCampsTab() {
  const [targetSchools, setTargetSchools] = useState<{ name: string; division: Division }[]>([])
  const [schoolInput, setSchoolInput] = useState('')
  const [schoolDivision, setSchoolDivision] = useState<Division>('D1')
  const [camps, setCamps] = useState<IdCamp[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedCamp, setSelectedCamp] = useState<IdCamp | null>(null)
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([])
  const [emailLoading, setEmailLoading] = useState(false)
  const [emails, setEmails] = useState<GeneratedEmail[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null)

  function addSchool() {
    if (!schoolInput.trim() || targetSchools.length >= 8) return
    if (targetSchools.some((s) => s.name.toLowerCase() === schoolInput.trim().toLowerCase())) return
    setTargetSchools((prev) => [...prev, { name: schoolInput.trim(), division: schoolDivision }])
    setSchoolInput('')
  }

  function removeSchool(name: string) {
    setTargetSchools((prev) => prev.filter((s) => s.name !== name))
  }

  async function handleFindCamps() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    if (targetSchools.length === 0) { setError('Add at least one school above.'); return }
    setError(''); setLoading(true); setCamps([]); setSelectedCamp(null); setEmails([])
    try {
      const { camps: found } = await findCamps(profile, targetSchools)
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

  return (
    <>
      <Card className="p-6 mb-8">
        <div className="text-sm font-semibold text-[#f1f5f9] mb-4">Add up to 8 schools — we'll point you to each program's current ID-camp registration page.</div>
        <div className="flex gap-3 mb-4 flex-wrap">
          <input
            type="text"
            value={schoolInput}
            onChange={(e) => setSchoolInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSchool()}
            placeholder="University name..."
            className="flex-1 min-w-48 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#eab308]"
          />
          <div className="flex gap-1">
            {ALL_DIVISIONS.map((d) => (
              <button
                key={d}
                onClick={() => setSchoolDivision(d)}
                className={`px-2.5 py-2 rounded text-xs font-semibold border transition-all ${
                  schoolDivision === d
                    ? 'bg-[#eab308] text-black border-[#eab308]'
                    : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <Button onClick={addSchool} disabled={!schoolInput.trim() || targetSchools.length >= 8} size="sm">+ Add</Button>
        </div>

        {targetSchools.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {targetSchools.map((s) => (
              <div key={s.name} className="flex items-center gap-2 px-3 py-1.5 bg-[rgba(234,179,8,0.08)] border border-[rgba(234,179,8,0.2)] rounded-lg">
                <span className={`text-xs font-bold ${divisionColor[s.division]}`}>{s.division}</span>
                <span className="text-sm text-[#f1f5f9]">{s.name}</span>
                <button onClick={() => removeSchool(s.name)} className="text-[#64748b] hover:text-[#f1f5f9] text-xs ml-1">✕</button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <Button onClick={handleFindCamps} disabled={loading || targetSchools.length === 0}>
          {loading ? 'Searching…' : `🔍 Find ID Camps at ${targetSchools.length} School${targetSchools.length !== 1 ? 's' : ''}`}
        </Button>
      </Card>

      {camps.length > 0 && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">{camps.length} Result{camps.length !== 1 ? 's' : ''}</div>
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
                  <div className="text-xs text-[#64748b] italic">{camp.date}</div>
                  <a href={camp.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-[#60a5fa] hover:underline mt-1.5 inline-block">
                    🔗 Open registration search
                  </a>
                </button>
              ))}
            </div>
          </div>

          <div>
            {selectedCamp ? (
              <div className="flex flex-col gap-4">
                <Card className="p-5">
                  <div className="font-serif text-lg font-bold text-[#f1f5f9] mb-1">{selectedCamp.campName}</div>
                  <div className="text-xs text-[#eab308] mb-3">{selectedCamp.school}</div>
                  <div className="flex flex-col gap-1.5 mb-4 text-xs text-[#64748b]">
                    <div className="italic">📅 {selectedCamp.date}</div>
                    {selectedCamp.url && (
                      <a href={selectedCamp.url} target="_blank" rel="noopener noreferrer" className="text-[#60a5fa] hover:underline">
                        🔗 Find current registration page
                      </a>
                    )}
                  </div>

                  <div className="text-xs font-semibold text-[#f1f5f9] uppercase tracking-wider mb-2">Coaches to email</div>
                  <p className="text-[11px] text-[#64748b] italic mb-3">Coach name unknown — confirm on the school's roster page before sending. The email generator will use a generic salutation.</p>
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

                  <Button onClick={handleGenerateEmails} disabled={emailLoading || selectedCoaches.length === 0} className="w-full">
                    {emailLoading ? 'Generating...' : `✉️ Generate ${selectedCoaches.length} Email${selectedCoaches.length !== 1 ? 's' : ''}`}
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
                            <button onClick={() => setExpandedEmail(expandedEmail === idx ? null : idx)} className="text-xs text-[#64748b] hover:text-[#f1f5f9] px-2 py-1 border border-[rgba(255,255,255,0.1)] rounded">
                              {expandedEmail === idx ? 'Hide' : 'View'}
                            </button>
                            <button onClick={() => copyEmail(idx, `Subject: ${email.subject}\n\n${email.body}`)} className="text-xs text-[#eab308] hover:text-[#ca9a06] px-2 py-1 border border-[rgba(234,179,8,0.3)] rounded">
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
                <p className="text-xs text-[#64748b]">Click any result to draft outreach emails to the coaching staff.</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {!loading && camps.length === 0 && targetSchools.length === 0 && (
        <Card className="p-16 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Find ID camps at any school</div>
          <p className="text-sm text-[#64748b] max-w-md mx-auto">Add up to 8 schools above. For each school we generate a Google search link that returns the current ID-camp registration page — no fabricated URLs.</p>
        </Card>
      )}
    </>
  )
}
