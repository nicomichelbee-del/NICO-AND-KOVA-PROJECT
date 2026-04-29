import { useState } from 'react'
import { findCamps, generateCampEmails } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { AthleteProfile, IdCamp, CampCoach, Division, IdEvent } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

type GeneratedEmail = { coachName: string; subject: string; body: string }

const ALL_DIVISIONS: Division[] = ['D1', 'D2', 'D3', 'NAIA', 'JUCO']

// Major multi-school ID events — static curated list
const ID_EVENTS: IdEvent[] = [
  { id: "usc-national-id", name: "United Soccer Coaches National ID Program", organizer: "United Soccer Coaches", divisions: ["D1","D2","D3","NAIA"], gender: "both", dateRange: "January 14–17, 2027", location: "Baltimore, MD", coachAttendance: "200+ coaches", costRange: "$350–$500", url: "https://unitedsoccercoaches.org/events/national-convention", notes: "Largest college soccer coaching convention in the country — every division sends coaches" },
  { id: "jefferson-cup", name: "Jefferson Cup Showcase", organizer: "Richmond Strikers", divisions: ["D1","D2","D3"], gender: "both", dateRange: "March 6–8, 2027", location: "Richmond, VA", coachAttendance: "100+ coaches", costRange: "$350–$500", url: "https://jeffersoncup.com", notes: "Top early-spring showcase on the East Coast — ACC and Big East coaches attend heavily" },
  { id: "disney-showcase", name: "Disney Soccer Showcase", organizer: "Disney Sports", divisions: ["D1","D2","D3"], gender: "both", dateRange: "December 26–30, 2026", location: "Orlando, FL (ESPN Wide World of Sports)", coachAttendance: "150+ coaches", costRange: "$400–$600", url: "https://disneysports.com/soccer", notes: "Premier late-December showcase — excellent visibility for 2027 and 2028 grads" },
  { id: "ecnl-girls-nationals", name: "ECNL Girls National Event", organizer: "Elite Clubs National League", divisions: ["D1","D2"], gender: "womens", dateRange: "June 20–25, 2026", location: "Frisco, TX", coachAttendance: "200+ coaches", costRange: "Team qualifying required", url: "https://ecnlgirls.com", notes: "The top women's club showcase — D1 coaches prioritize recruiting here above all other events" },
  { id: "ecnl-boys-nationals", name: "ECNL Boys National Event", organizer: "Elite Clubs National League", divisions: ["D1","D2"], gender: "mens", dateRange: "June 12–17, 2026", location: "Austin, TX", coachAttendance: "150+ coaches", costRange: "Team qualifying required", url: "https://ecnlboys.com", notes: "Premier men's club showcase — top D1 programs send full coaching staffs" },
  { id: "mlsnext-showcase", name: "MLS NEXT Showcase", organizer: "MLS NEXT", divisions: ["D1","D2"], gender: "mens", dateRange: "July 8–12, 2026", location: "Atlanta, GA", coachAttendance: "100+ coaches", costRange: "Team qualifying required", url: "https://mlsnext.com", notes: "Top men's pathway showcase — D1 coaches actively recruit from MLS NEXT clubs at this event" },
  { id: "nike-premier-id", name: "Nike Premier ID Camp", organizer: "Nike Soccer", divisions: ["D1","D2"], gender: "both", dateRange: "June 15–17, 2026", location: "Chicago, IL", coachAttendance: "40+ coaches", costRange: "$595–$695", url: "https://nikesoccercamps.com", notes: "Individual player ID camp — coaches from Big Ten and ACC programs attend" },
  { id: "adidas-id-dallas", name: "Adidas Soccer Regional ID Camp", organizer: "Adidas Soccer", divisions: ["D1","D2","D3"], gender: "both", dateRange: "July 10–12, 2026", location: "Dallas, TX", coachAttendance: "30+ coaches", costRange: "$450–$550", url: "https://adidascoachingsoccer.com", notes: "Strong Southwest and Big 12 presence — great for Texas and Plains-targeting athletes" },
  { id: "img-academy-id-womens", name: "IMG Academy College ID Showcase (Women)", organizer: "IMG Academy", divisions: ["D1"], gender: "womens", dateRange: "June 4–6, 2026", location: "Bradenton, FL", coachAttendance: "30+ coaches", costRange: "$595–$750", url: "https://imgacademy.com/soccer", notes: "Elite D1-focused individual showcase — SEC and ACC coaches attend regularly" },
  { id: "img-academy-id-mens", name: "IMG Academy College ID Showcase (Men)", organizer: "IMG Academy", divisions: ["D1"], gender: "mens", dateRange: "July 9–11, 2026", location: "Bradenton, FL", coachAttendance: "30+ coaches", costRange: "$595–$750", url: "https://imgacademy.com/soccer", notes: "Elite D1 individual showcase — coaches from ACC, Big East, and Sun Belt programs attend" },
  { id: "surf-cup-nit", name: "Surf Cup Sports NIT", organizer: "Surf Cup Sports", divisions: ["D1","D2"], gender: "both", dateRange: "August 1–3, 2026", location: "San Diego, CA", coachAttendance: "80+ coaches", costRange: "Team event", url: "https://surfcupsports.com", notes: "Top West Coast team showcase — Pac-12 and WCC coaches recruit heavily here" },
  { id: "las-vegas-showcase", name: "Las Vegas Showcase", organizer: "Las Vegas Soccer Events", divisions: ["D1","D2","D3"], gender: "both", dateRange: "November 14–16, 2026", location: "Las Vegas, NV", coachAttendance: "100+ coaches", costRange: "Team event", url: "https://lasvegassoccer.com", notes: "Large fall showcase attracting coaches from across all divisions" },
  { id: "florida-showcase-usys", name: "Florida Showcase (USYS)", organizer: "US Youth Soccer / Florida", divisions: ["D2","D3","NAIA"], gender: "both", dateRange: "November 20–22, 2026", location: "Kissimmee, FL", coachAttendance: "75+ coaches", costRange: "Team event", url: "https://floridasoccer.com", notes: "Strong D2 and D3 representation — SSC, Gulf South, and Sunshine State coaches prioritize this" },
  { id: "carolina-invitational", name: "Carolina Invitational Showcase", organizer: "Charlotte Soccer Academy", divisions: ["D1","D2","D3"], gender: "both", dateRange: "October 10–12, 2026", location: "Charlotte, NC", coachAttendance: "60+ coaches", costRange: "Team event", url: "https://charlottesoccer.com", notes: "Fall showcase with heavy ACC, Big South, and SAC attendance" },
  { id: "pacific-showcase", name: "Pacific Northwest Showcase", organizer: "Washington Youth Soccer", divisions: ["D1","D2","D3"], gender: "both", dateRange: "July 18–20, 2026", location: "Portland, OR", coachAttendance: "50+ coaches", costRange: "Team event", url: "https://washingtonys.com", notes: "Premier West Coast exposure event — Big Sky, Pac-12, and WCC programs attend in force" },
  { id: "midwest-id-camp", name: "Midwest College ID Camp", organizer: "Indiana Soccer", divisions: ["D2","D3","NAIA"], gender: "both", dateRange: "July 22–24, 2026", location: "Indianapolis, IN", coachAttendance: "35+ coaches", costRange: "$295–$395", url: "https://indianasoccer.org", notes: "Individual ID camp focused on MIAA, Great Lakes, and Midwest region programs" },
  { id: "northeast-id-series", name: "Northeast ID Camp Series", organizer: "New England College Soccer", divisions: ["D3","NAIA"], gender: "both", dateRange: "July 25–27, 2026", location: "Boston, MA", coachAttendance: "30+ coaches", costRange: "$275–$350", url: "https://nescac.com", notes: "Specifically targets NESCAC and Liberty League D3 programs — ideal for academically strong athletes" },
  { id: "southwest-showcase", name: "Southwest Regional Showcase", organizer: "Texas Youth Soccer", divisions: ["D2","D3","NAIA"], gender: "both", dateRange: "November 7–9, 2026", location: "Phoenix, AZ", coachAttendance: "40+ coaches", costRange: "Team event", url: "https://texasyouthsoccer.org", notes: "Strong LSC, Lone Star, and Sun Belt D2 presence" },
  { id: "naia-national-showcase", name: "NAIA National Showcase", organizer: "NAIA Soccer", divisions: ["NAIA"], gender: "both", dateRange: "July 15–17, 2026", location: "Kansas City, MO", coachAttendance: "60+ coaches", costRange: "$250–$350", url: "https://naia.org/sports/msoc", notes: "The premier NAIA-specific showcase — every major NAIA program sends coaching staff" },
  { id: "colorado-id-showcase", name: "Colorado College ID Showcase", organizer: "Colorado Youth Soccer", divisions: ["D2","D3"], gender: "both", dateRange: "July 24–26, 2026", location: "Colorado Springs, CO", coachAttendance: "40+ coaches", costRange: "$325–$425", url: "https://coloradoyouthsoccer.org", notes: "Strong RMAC and Mountain West D2/D3 representation" },
  { id: "juco-regional", name: "NJCAA Regional Qualifier Showcase", organizer: "National Junior College Athletic Association", divisions: ["JUCO"], gender: "both", dateRange: "August 14–16, 2026", location: "Wichita, KS", coachAttendance: "30+ coaches", costRange: "$150–$250", url: "https://njcaa.org/sports/msoc", notes: "NJCAA-specific showcase for JUCO-bound athletes — direct exposure to KJCCC and Region 6 programs" },
  { id: "topdrawer-id-camp", name: "TopDrawerSoccer All-American ID Camp", organizer: "TopDrawerSoccer", divisions: ["D1"], gender: "womens", dateRange: "August 6–8, 2026", location: "Chicago, IL", coachAttendance: "50+ coaches", costRange: "$595–$695", url: "https://topdrawersoccer.com", notes: "Invite-only individual ID camp for top women's players — Big Ten and ACC coaches attend heavily" },
]

const divisionColor: Record<string, string> = {
  D1: 'text-[#f87171]', D2: 'text-[#fbbf24]', D3: 'text-[#4ade80]',
  NAIA: 'text-[#60a5fa]', JUCO: 'text-[#a78bfa]',
}

export function Camps() {
  const [mainTab, setMainTab] = useState<'school' | 'events'>('school')

  // School camps tab state
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

  // Major events tab state
  const [eventDivFilter, setEventDivFilter] = useState<Division | 'all'>('all')
  const [eventGenderFilter, setEventGenderFilter] = useState<'both' | 'mens' | 'womens'>('both')

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

  const filteredEvents = ID_EVENTS.filter((e) => {
    const divMatch = eventDivFilter === 'all' || e.divisions.includes(eventDivFilter)
    const genderMatch = eventGenderFilter === 'both' || e.gender === 'both' || e.gender === eventGenderFilter
    return divMatch && genderMatch
  })

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">ID Camps</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">ID Camp Finder</h1>
        <p className="text-[#64748b] mt-2 text-sm">Find individual school ID camps or browse major multi-school showcase events.</p>
      </div>

      {/* Main tabs */}
      <div className="flex gap-0 border-b border-[rgba(255,255,255,0.07)] mb-8">
        {[
          { id: 'school', label: '🏫 School ID Camps' },
          { id: 'events', label: '🌍 Major Showcase Events' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setMainTab(t.id as 'school' | 'events')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              mainTab === t.id
                ? 'border-[#eab308] text-[#eab308]'
                : 'border-transparent text-[#64748b] hover:text-[#f1f5f9]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SCHOOL ID CAMPS TAB ── */}
      {mainTab === 'school' && (
        <>
          <Card className="p-6 mb-8">
            <div className="text-sm font-semibold text-[#f1f5f9] mb-4">Add schools to find their ID camps (up to 8)</div>
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
              <Button onClick={addSchool} disabled={!schoolInput.trim() || targetSchools.length >= 8} size="sm">
                + Add
              </Button>
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
              {loading ? 'Searching camps...' : `⛺ Find ID Camps at ${targetSchools.length} School${targetSchools.length !== 1 ? 's' : ''}`}
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

                      <div className="flex gap-2 mb-4">
                        <button onClick={() => setSelectedCoaches(selectedCamp.coaches.map((c) => c.name))} className="text-xs text-[#eab308] hover:underline">Select all</button>
                        <span className="text-xs text-[#64748b]">·</span>
                        <button onClick={() => setSelectedCoaches([])} className="text-xs text-[#64748b] hover:text-[#f1f5f9]">Deselect all</button>
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
                    <p className="text-xs text-[#64748b]">Click any camp to see coaches and generate outreach emails</p>
                  </Card>
                )}
              </div>
            </div>
          )}

          {!loading && camps.length === 0 && targetSchools.length > 0 && (
            <Card className="p-12 text-center">
              <div className="text-3xl mb-3">⛺</div>
              <div className="font-serif text-base font-bold text-[#f1f5f9] mb-1">Ready to search</div>
              <p className="text-xs text-[#64748b]">Click "Find ID Camps" to search for camps at your selected schools.</p>
            </Card>
          )}

          {!loading && camps.length === 0 && targetSchools.length === 0 && (
            <Card className="p-16 text-center">
              <div className="text-4xl mb-4">⛺</div>
              <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Find school ID camps</div>
              <p className="text-sm text-[#64748b] max-w-sm mx-auto">Add schools above, select their division, and we'll find their ID camp schedule plus nearby events.</p>
            </Card>
          )}
        </>
      )}

      {/* ── MAJOR EVENTS TAB ── */}
      {mainTab === 'events' && (
        <>
          <Card className="p-5 mb-6">
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Division</div>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'D1', 'D2', 'D3', 'NAIA', 'JUCO'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setEventDivFilter(d)}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all capitalize ${
                        eventDivFilter === d
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
                      onClick={() => setEventGenderFilter(g.id as 'both' | 'mens' | 'womens')}
                      className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                        eventGenderFilter === g.id
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
            {filteredEvents.length} Major Events
          </div>

          <div className="flex flex-col gap-4">
            {filteredEvents.map((event) => (
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
                <div className="flex items-center gap-4">
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#60a5fa] hover:underline"
                  >
                    🔗 Register / Learn More
                  </a>
                  <span className="text-xs text-[#64748b]">
                    {event.gender === 'both' ? 'Men\'s & Women\'s' : event.gender === 'womens' ? 'Women\'s only' : 'Men\'s only'}
                  </span>
                </div>
              </Card>
            ))}
          </div>

          {filteredEvents.length === 0 && (
            <Card className="p-12 text-center">
              <div className="text-3xl mb-3">🌍</div>
              <p className="text-sm text-[#64748b]">No events match the selected filters.</p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
