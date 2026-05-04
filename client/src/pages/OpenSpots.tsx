import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { KickrIQLogo } from '../components/ui/KickrIQLogo'

type Gender = 'mens' | 'womens'
type Level = 'High' | 'Medium' | 'Low'
type Division = 'D1' | 'D2' | 'D3' | 'NAIA' | 'JUCO' | 'all'

interface PublicProgram {
  id: string
  school: string
  conference: string
  division: string
  location: string
  formationStyle: string
  notes: string
  gender: Gender
  recruitingLevel: Level | null
  topNeeds: string[]
}

interface PositionEntry {
  slug: string
  label: string
  counts: { mens: number; womens: number }
}

const DIVISIONS: Division[] = ['all', 'D1', 'D2', 'D3', 'NAIA', 'JUCO']

function setMeta(title: string, description: string, canonical: string) {
  document.title = title
  const setOrCreate = (selector: string, attr: string, value: string, content: string) => {
    let tag = document.querySelector<HTMLMetaElement | HTMLLinkElement>(selector)
    if (!tag) {
      const el = selector.startsWith('link') ? document.createElement('link') : document.createElement('meta')
      el.setAttribute(attr, value)
      document.head.appendChild(el)
      tag = el as HTMLMetaElement | HTMLLinkElement
    }
    if (tag instanceof HTMLLinkElement) tag.href = content
    else tag.content = content
  }
  setOrCreate('meta[name="description"]', 'name', 'description', description)
  setOrCreate('meta[property="og:title"]', 'property', 'og:title', title)
  setOrCreate('meta[property="og:description"]', 'property', 'og:description', description)
  setOrCreate('link[rel="canonical"]', 'rel', 'canonical', canonical)
}

export function OpenSpots() {
  const { gender: genderParam, position: positionParam } = useParams<{ gender?: string; position?: string }>()
  const navigate = useNavigate()

  const gender: Gender = genderParam === 'mens' ? 'mens' : 'womens'
  const positionSlug = positionParam ?? null

  const [programs, setPrograms] = useState<PublicProgram[]>([])
  const [counts, setCounts] = useState<{ total: number; high: number; medium: number; byDivision: Record<string, number> } | null>(null)
  const [positions, setPositions] = useState<PositionEntry[]>([])
  const [division, setDivision] = useState<Division>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Compose page metadata for SEO. Targets the "open spots at [position] for [gender]
  // [division] college soccer" long-tail queries that have near-zero competition.
  useEffect(() => {
    const positionLabel = positions.find((p) => p.slug === positionSlug)?.label
    const genderLabel = gender === 'mens' ? "Men's" : "Women's"
    const divisionLabel = division === 'all' ? '' : ` ${division}`
    const title = positionLabel
      ? `${positionLabel} Open Spots${divisionLabel} ${genderLabel} College Soccer | KickrIQ`
      : `Open Spots in${divisionLabel} ${genderLabel} College Soccer | KickrIQ`
    const description = positionLabel
      ? `Live list of ${genderLabel.toLowerCase()}${divisionLabel} college soccer programs actively recruiting ${positionLabel.toLowerCase()}s. Updated weekly. Free to view.`
      : `Live list of ${genderLabel.toLowerCase()}${divisionLabel} college soccer programs with open recruiting spots. Filter by position. Updated weekly.`
    const canonical = `${window.location.origin}/open-spots/${gender}${positionSlug ? `/${positionSlug}` : ''}`
    setMeta(title, description, canonical)
  }, [gender, positionSlug, division, positions])

  useEffect(() => {
    setLoading(true); setError('')
    const params = new URLSearchParams({ gender })
    if (positionSlug) params.set('position', positionSlug)
    if (division !== 'all') params.set('division', division)

    Promise.all([
      fetch(`/api/public/open-spots?${params.toString()}`).then((r) => r.json()),
      positions.length === 0 ? fetch('/api/public/positions').then((r) => r.json()) : Promise.resolve(null),
    ])
      .then(([data, posData]) => {
        setPrograms(data.programs)
        setCounts(data.counts)
        if (posData) setPositions(posData.positions)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [gender, positionSlug, division])

  const positionLabel = useMemo(
    () => positions.find((p) => p.slug === positionSlug)?.label ?? null,
    [positionSlug, positions],
  )

  const genderLabel = gender === 'mens' ? "Men's" : "Women's"

  return (
    <div className="kickriq min-h-screen">
      <div className="page">
        {/* Slim public nav */}
        <header className="knav knav-scrolled">
          <div className="wrap knav-inner">
            <Link to="/" className="brand" aria-label="KickrIQ">
              <KickrIQLogo height={28} />
            </Link>
            <nav className="knav-links hide-mobile">
              <Link to="/open-spots/womens">Women's Spots</Link>
              <Link to="/open-spots/mens">Men's Spots</Link>
              <a href="/#features">Features</a>
              <a href="/#pricing">Pricing</a>
            </nav>
            <div className="knav-cta">
              <Link to="/login" className="nav-signin hide-mobile">Sign in</Link>
              <Link to="/signup" className="kbtn kbtn-primary knav-btn">Start Free</Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="section" style={{ paddingTop: 100, paddingBottom: 36 }}>
          <div className="wrap">
            <div className="section-head">
              <span className="section-marker">Open Spots · Live</span>
              <h1 className="h-section" style={{ marginBottom: 16 }}>
                {positionLabel ? (
                  <>
                    {genderLabel} <span className="accent">{positionLabel}</span> spots open right now.
                  </>
                ) : (
                  <>
                    {genderLabel} college soccer programs <span className="accent">recruiting now</span>.
                  </>
                )}
              </h1>
              <p className="lede" style={{ marginTop: 8 }}>
                Live recruiting needs across {counts?.total ?? '...'} programs. Updated weekly. Coach contact info is unlocked when you start a free profile.
              </p>
            </div>

            {/* Gender + division filters */}
            <div className="flex flex-wrap gap-3 mt-8 mb-2 items-center">
              <div className="flex gap-2">
                {(['womens', 'mens'] as Gender[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => navigate(`/open-spots/${g}${positionSlug ? `/${positionSlug}` : ''}`)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                      gender === g
                        ? 'bg-[#f0b65a] text-black border-[#f0b65a]'
                        : 'bg-transparent text-[#9a9385] border-[rgba(245,241,232,0.10)] hover:border-[#f0b65a] hover:text-[#f0b65a]'
                    }`}
                  >
                    {g === 'mens' ? "Men's" : "Women's"}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {DIVISIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDivision(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all uppercase ${
                      division === d
                        ? 'bg-[#f0b65a] text-black border-[#f0b65a]'
                        : 'bg-transparent text-[#9a9385] border-[rgba(245,241,232,0.10)] hover:border-[#f0b65a] hover:text-[#f0b65a]'
                    }`}
                  >
                    {d === 'all' ? 'All Divisions' : d}
                  </button>
                ))}
              </div>
            </div>

            {/* Position chips — link form so each is a real indexable URL */}
            {positions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                <Link
                  to={`/open-spots/${gender}`}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all no-underline ${
                    !positionSlug
                      ? 'bg-[rgba(240,182,90,0.10)] border-[#f0b65a] text-[#f0b65a]'
                      : 'bg-transparent border-[rgba(245,241,232,0.10)] text-[#9a9385] hover:border-[rgba(240,182,90,0.45)] hover:text-[#f5f1e8]'
                  }`}
                >
                  All positions
                </Link>
                {positions.map((p) => (
                  <Link
                    key={p.slug}
                    to={`/open-spots/${gender}/${p.slug}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all no-underline ${
                      positionSlug === p.slug
                        ? 'bg-[rgba(240,182,90,0.10)] border-[#f0b65a] text-[#f0b65a]'
                        : 'bg-transparent border-[rgba(245,241,232,0.10)] text-[#9a9385] hover:border-[rgba(240,182,90,0.45)] hover:text-[#f5f1e8]'
                    }`}
                  >
                    {p.label}
                    <span className="ml-1 opacity-60">({p.counts[gender]})</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Stats strip */}
        {counts && (
          <section className="section" style={{ paddingTop: 0, paddingBottom: 24 }}>
            <div className="wrap">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Total programs', value: counts.total, color: 'text-[#f5f1e8]' },
                  { label: 'High need', value: counts.high, color: 'text-[#4ade80]' },
                  { label: 'D1', value: counts.byDivision.D1, color: 'text-[#f0b65a]' },
                  { label: 'D2 + D3', value: counts.byDivision.D2 + counts.byDivision.D3, color: 'text-[#60a5fa]' },
                  { label: 'NAIA + JUCO', value: counts.byDivision.NAIA + counts.byDivision.JUCO, color: 'text-[#fbbf24]' },
                ].map((s) => (
                  <div key={s.label} className="p-4 text-center rounded-xl border border-[rgba(245,241,232,0.08)] bg-[rgba(255,255,255,0.02)]">
                    <div className={`font-serif text-3xl font-black ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-[#9a9385] mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Programs table */}
        <section className="section" style={{ paddingTop: 12 }}>
          <div className="wrap">
            {loading ? (
              <div className="text-center py-16 text-sm text-[#9a9385]">Loading open spots…</div>
            ) : error ? (
              <div className="text-center py-16 text-sm text-red-400">{error}</div>
            ) : programs.length === 0 ? (
              <div className="text-center py-16 text-sm text-[#9a9385]">
                No programs match this filter. Try a different position or division.
              </div>
            ) : (
              <div className="rounded-2xl border border-[rgba(245,241,232,0.08)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[rgba(245,241,232,0.08)]">
                        {['School', 'Division', 'Conference', 'Location', positionLabel ? 'Need' : 'Top Needs', ''].map((h) => (
                          <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-[#9a9385] uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {programs.map((p) => (
                        <tr key={p.id} className="border-b border-[rgba(245,241,232,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                          <td className="px-5 py-4 font-medium text-[#f5f1e8] whitespace-nowrap">{p.school}</td>
                          <td className="px-5 py-4">
                            <span className="px-2 py-0.5 rounded text-xs border border-[rgba(245,241,232,0.10)] text-[#f0b65a] uppercase tracking-wider">{p.division}</span>
                          </td>
                          <td className="px-5 py-4 text-[#9a9385] text-xs whitespace-nowrap">{p.conference}</td>
                          <td className="px-5 py-4 text-[#9a9385] text-xs whitespace-nowrap">{p.location}</td>
                          <td className="px-5 py-4">
                            {positionLabel && p.recruitingLevel ? (
                              <span
                                className={`px-2 py-0.5 rounded text-xs border font-medium ${
                                  p.recruitingLevel === 'High'
                                    ? 'text-[#4ade80] bg-[rgba(74,222,128,0.08)] border-[rgba(74,222,128,0.25)]'
                                    : p.recruitingLevel === 'Medium'
                                    ? 'text-[#fbbf24] bg-[rgba(251,191,36,0.08)] border-[rgba(251,191,36,0.25)]'
                                    : 'text-[#9a9385] border-[rgba(245,241,232,0.10)]'
                                }`}
                              >
                                {p.recruitingLevel}
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {p.topNeeds.slice(0, 3).map((n) => (
                                  <span key={n} className="px-2 py-0.5 rounded text-xs border border-[rgba(74,222,128,0.25)] text-[#4ade80] bg-[rgba(74,222,128,0.05)]">
                                    {n}
                                  </span>
                                ))}
                                {p.topNeeds.length === 0 && <span className="text-xs text-[#9a9385]">—</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Link
                              to="/signup"
                              className="text-xs font-mono uppercase tracking-wider text-[#f0b65a] hover:underline underline-offset-4 no-underline"
                            >
                              Email coach →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Inline conversion strip */}
                <div className="p-5 border-t border-[rgba(245,241,232,0.08)] bg-[rgba(240,182,90,0.04)] flex items-center justify-between gap-4 flex-wrap">
                  <div className="text-sm text-[#f5f1e8]">
                    Want the coach's name and email?{' '}
                    <span className="text-[#9a9385]">Free signup unlocks contact info for every program.</span>
                  </div>
                  <Link to="/signup" className="kbtn kbtn-primary">Start free — no card</Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SEO body copy — gives search engines real content to index */}
        <section className="section" style={{ paddingTop: 24 }}>
          <div className="wrap" style={{ maxWidth: 760 }}>
            <h2 className="h-card" style={{ marginBottom: 12 }}>
              How "open spots" is calculated
            </h2>
            <p className="lede" style={{ fontSize: 15, marginBottom: 16 }}>
              Each program's recruiting need is inferred from class composition, recent
              transfer-portal activity, and graduating senior counts at every position.
              "High" means the program is actively prioritising that position in the next
              recruiting class. "Medium" means a slot is likely to open. We refresh weekly
              across {counts?.total ?? '2,500+'} {genderLabel.toLowerCase()} programs spanning D1,
              D2, D3, NAIA, and JUCO.
            </p>
            <h2 className="h-card" style={{ marginBottom: 12, marginTop: 24 }}>
              Why this matters for {positionLabel ? `${positionLabel.toLowerCase()}s` : 'recruits'}
            </h2>
            <p className="lede" style={{ fontSize: 15 }}>
              Most athletes waste outreach on programs that already have your position
              locked in for the next two classes. By targeting programs with confirmed
              openings at your specific position, the same number of emails turns into far
              more visits and far more offers. It's the single highest-leverage move in the
              recruiting process — and the data is free to view.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="section final-cta-section">
          <div className="wrap final-cta-inner">
            <h2 className="h-display final-h">
              Ready to <span className="accent">email the coach</span>?
            </h2>
            <p className="lede final-sub">
              Start a free profile to unlock coach contact info, AI-drafted outreach, and the full Roster Intelligence feed.
            </p>
            <div className="final-ctas">
              <Link to="/signup" className="kbtn kbtn-primary kbtn-lg">Start for Free</Link>
              <Link to="/" className="kbtn kbtn-ghost kbtn-lg">Learn more</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
