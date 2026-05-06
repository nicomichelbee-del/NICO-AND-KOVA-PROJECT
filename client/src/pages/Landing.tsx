import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { WaitlistModal } from '../components/ui/WaitlistModal'

/* ============================================================
   SCROLL MOTION
   - Sets up a scroll-progress rail at top of page
   - IntersectionObserver reveals [data-reveal] / [data-stagger] / [data-words]
   - Splits headline text marked with data-words into spans on mount
   ============================================================ */
function useScrollMotion() {
  useEffect(() => {
    const root = document.querySelector('.kickriq')
    if (!root) return

    // Split [data-words] into per-word spans
    root.querySelectorAll<HTMLElement>('[data-words]').forEach((el) => {
      if (el.dataset.wordsApplied) return
      const html = el.innerHTML
      const tokens = html.split(/(<[^>]+>|\s+)/g)
      let out = ''
      for (const t of tokens) {
        if (!t) continue
        if (/^<.+>$/.test(t) || /^\s+$/.test(t)) {
          out += t
        } else {
          // Wrap each word in a span
          out += t.split(/(\s+)/).map((w) =>
            w.trim() ? `<span class="kr-word">${w}</span>` : w
          ).join('')
        }
      }
      el.innerHTML = out
      el.dataset.wordsApplied = '1'
    })

    // Reveal on intersect
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-revealed')
          io.unobserve(e.target)
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })

    root.querySelectorAll('[data-reveal], [data-stagger], [data-words]').forEach((el) => io.observe(el))

    // Scroll progress rail
    const rail = document.createElement('div')
    rail.className = 'kr-progress-rail'
    document.body.appendChild(rail)
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        const pct = max > 0 ? (window.scrollY / max) * 100 : 0
        rail.style.width = `${Math.max(0, Math.min(100, pct))}%`
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    // Safety: ensure anything still hidden after 2s gets revealed
    const safety = window.setTimeout(() => {
      root.querySelectorAll('[data-reveal], [data-stagger], [data-words]').forEach((el) => {
        if (!el.classList.contains('is-revealed')) el.classList.add('is-revealed')
      })
    }, 2000)

    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
      window.clearTimeout(safety)
      rail.remove()
    }
  }, [])
}

/* ============================================================
   REDUCED MOTION
   ============================================================ */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])
  return reduced
}

/* ============================================================
   ICONS
   ============================================================ */
type IconName =
  | 'target' | 'roster' | 'mail' | 'video' | 'track' | 'follow'
  | 'camp' | 'timeline' | 'profile' | 'arrow' | 'check' | 'play'
  | 'menu' | 'close'

function Icon({ name, size = 20, stroke = 'currentColor', fill = 'none' }: {
  name: IconName; size?: number; stroke?: string; fill?: string
}) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill, stroke, strokeWidth: 1.6,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'target':   return <svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill={stroke}/></svg>
    case 'roster':   return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 14h3"/><path d="M8 17h6"/><circle cx="17" cy="15" r="2" fill={stroke} stroke="none"/></svg>
    case 'mail':     return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></svg>
    case 'video':    return <svg {...props}><rect x="3" y="6" width="14" height="12" rx="2"/><path d="M17 10l4-2v8l-4-2z"/></svg>
    case 'track':    return <svg {...props}><path d="M3 17l5-5 4 4 8-9"/><path d="M14 7h6v6"/></svg>
    case 'follow':   return <svg {...props}><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg>
    case 'camp':     return <svg {...props}><path d="M3 21l9-15 9 15z"/><path d="M3 21h18"/></svg>
    case 'timeline': return <svg {...props}><path d="M4 12h16"/><circle cx="6" cy="12" r="2" fill={stroke} stroke="none"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>
    case 'profile':  return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>
    case 'arrow':    return <svg {...props}><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>
    case 'check':    return <svg {...props}><path d="M5 12l4.5 4.5L19 7"/></svg>
    case 'play':     return <svg {...props}><path d="M7 5l12 7-12 7z" fill={stroke} stroke="none"/></svg>
    case 'menu':     return <svg {...props}><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    case 'close':    return <svg {...props}><path d="M6 6l12 12M18 6L6 18"/></svg>
    default: return null
  }
}

/* ============================================================
   LOGO
   ============================================================ */
function KickrIQLogo({ height = 32 }: { height?: number }) {
  return (
    <span
      className="kickriq-logo"
      style={{ ['--logo-h' as string]: `${height}px` } as React.CSSProperties}
      aria-label="KickrIQ"
      role="img"
    >
      <span className="klogo-kickr">Kickr</span>
      <span className="klogo-iq">
        <span className="klogo-i">i</span>
        <span className="klogo-q">Q</span>
      </span>
    </span>
  )
}

/* ============================================================
   NAVBAR
   ============================================================ */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header className={`knav ${scrolled ? 'knav-scrolled' : ''}`}>
      <div className="wrap knav-inner">
        <Link to="/" className="brand" aria-label="KickrIQ">
          <KickrIQLogo height={32} />
        </Link>
        <nav className="knav-links hide-mobile">
          <a href="#features">Features</a>
          <a href="#roster">Roster Intelligence</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#parents">For Parents</a>
          <Link to="/about">About us</Link>
        </nav>
        <div className="knav-cta">
          <Link to="/login" className="nav-signin hide-mobile">Sign in</Link>
          <Link to="/signup" className="kbtn kbtn-primary knav-btn">
            Start Free
            <Icon name="arrow" size={16} />
          </Link>
          <button className="knav-menu show-mobile" onClick={() => setOpen(!open)} aria-label="menu">
            <Icon name={open ? 'close' : 'menu'} size={22} />
          </button>
        </div>
      </div>
      {open && (
        <div className="knav-drawer show-mobile">
          <a href="#features" onClick={() => setOpen(false)}>Features</a>
          <a href="#roster" onClick={() => setOpen(false)}>Roster Intelligence</a>
          <a href="#how" onClick={() => setOpen(false)}>How it works</a>
          <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
          <a href="#parents" onClick={() => setOpen(false)}>For Parents</a>
          <Link to="/about" onClick={() => setOpen(false)}>About us</Link>
          <Link to="/login" onClick={() => setOpen(false)}>Sign in</Link>
        </div>
      )}
    </header>
  )
}

/* ============================================================
   HERO
   ============================================================ */
const KICKER_OUTCOMES = ['recruited.', 'noticed.', 'seen.', 'signed.']
const HERO_WORDS = ['smartest', 'quickest', 'sharpest', 'boldest']

function Hero() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const reduced = usePrefersReducedMotion()
  const [kickerIdx, setKickerIdx] = useState(0)
  const [heroIdx, setHeroIdx] = useState(0)

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 0.75
  }, [])

  useEffect(() => {
    if (reduced) return
    // Kicker every 3.4s. Hero H1 every 3.4s but offset 1.7s so they never swap together.
    const kickerId = window.setInterval(() => {
      setKickerIdx((i) => (i + 1) % KICKER_OUTCOMES.length)
    }, 3400)
    let heroId = 0
    const heroDelay = window.setTimeout(() => {
      setHeroIdx((i) => (i + 1) % HERO_WORDS.length)
      heroId = window.setInterval(() => {
        setHeroIdx((i) => (i + 1) % HERO_WORDS.length)
      }, 3400)
    }, 1700)
    return () => {
      window.clearInterval(kickerId)
      window.clearTimeout(heroDelay)
      if (heroId) window.clearInterval(heroId)
    }
  }, [reduced])

  return (
    <section className="hero">
      <div className="hero-video-wrap">
        <video
          ref={videoRef}
          className="hero-video"
          autoPlay loop muted playsInline
          src="/kickriq/hero-stadium.mp4"
        />
        <div className="hero-veil" />
        <div className="hero-radial" />
        <div className="hero-vignette" />
      </div>

      <div className="wrap hero-inner">
        <div className="hero-eyebrow">
          <span className="hero-kicker">
            <span className="hk-line" />
            <span className="hk-text serif">
              AI that puts in the work to get you{' '}
              <span className="hk-rotator" key={`hk-${kickerIdx}`}>
                {KICKER_OUTCOMES[kickerIdx]}
              </span>
            </span>
            <span className="hk-line" />
          </span>
        </div>

        <h1 className="h-display hero-headline">
          The{' '}
          <span className="accent hero-rotator" key={`hr-${heroIdx}`}>
            {HERO_WORDS[heroIdx]}
          </span>
          {' '}way<br />
          to get recruited.
        </h1>

        <p className="lede hero-sub hero-sub-editorial">
          Your <span className="serif accent">personal recruiting coach</span>. Match with the right college programs, email the right coaches, and track every response.{' '}
          <span className="hero-sub-divs">D1 · D2 · D3 · NAIA · JUCO</span>.
        </p>

        <div className="hero-ctas">
          <Link to="/signup" className="kbtn kbtn-primary kbtn-lg">
            Start for Free
            <Icon name="arrow" size={16} />
          </Link>
          <a href="#how" className="kbtn kbtn-ghost kbtn-lg">
            <Icon name="play" size={14} stroke="#f5f1e8" />
            See how it works
          </a>
        </div>

        <div className="hero-trust">
          <div className="trust-item">
            <span className="trust-num">2,500<span className="trust-sm">+</span></span>
            <span className="trust-lbl">College programs</span>
          </div>
          <span className="trust-sep" />
          <div className="trust-item">
            <span className="trust-num">98.8<span className="trust-sm">%</span></span>
            <span className="trust-lbl">D1–NAIA coverage</span>
          </div>
          <span className="trust-sep" />
          <div className="trust-item">
            <span className="trust-num" style={{ color: 'var(--gold)' }}>Free</span>
            <span className="trust-lbl">to start · no card</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   THREE-UP
   ============================================================ */
function MatchVisual() {
  const rows = [
    { name: 'Stanford', code: 'S', tier: 'D1', score: 96, top: true },
    { name: 'Wake Forest', code: 'W', tier: 'D1', score: 91, top: false },
    { name: 'Amherst', code: 'A', tier: 'D3', score: 88, top: false },
  ]
  return (
    <div className="vis-match">
      {rows.map((s, i) => (
        <div key={i} className={`match-row ${s.top ? 'top' : ''}`}>
          <div className="match-logo">{s.code}</div>
          <div className="match-info">
            <div className="match-name">{s.name}</div>
            <div className="match-meta kr-mono">{s.tier} · FIT {s.score}</div>
          </div>
          <div className="match-score">
            <span className="serif">{s.score}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function RosterVisual() {
  const rows = [
    { school: 'University of Portland', tier: 'D1', open: 1, year: "'27" },
    { school: 'Grand Valley State', tier: 'D2', open: 2, year: "'26" },
    { school: 'Keiser University', tier: 'NAIA', open: 3, year: "'27" },
  ]
  return (
    <div className="vis-roster">
      <div className="vis-roster-header kr-mono">
        <span><span className="live-dot" />LIVE OPENINGS · GK</span>
        <span>UPDATED 2h</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="roster-row">
          <div>
            <div className="roster-school">{r.school}</div>
            <div className="roster-meta kr-mono">{r.tier} · CLASS OF {r.year}</div>
          </div>
          <div className="roster-open">
            <span className="open-num serif">{r.open}</span>
            <span className="open-lbl kr-mono">OPEN</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function MailVisual() {
  return (
    <div className="vis-mail">
      <div className="mail-bar kr-mono">
        <span className="mail-from">FROM: jordan@gmail.com</span>
        <span className="mail-status"><span className="live-dot" />SENT</span>
      </div>
      <div className="mail-preview">
        <div className="mail-line"><span className="mail-key kr-mono">TO</span><span>Coach Mendez · Stanford W. Soccer</span></div>
        <div className="mail-line"><span className="mail-key kr-mono">SUBJ</span><span>2027 GK · Highlight Tape & Visit</span></div>
        <div className="mail-body">
          <p>Coach Mendez,</p>
          <p>I'm a 2027 goalkeeper from Portland, OR. After watching Stanford's Pac-12 run last fall, the way your back line plays out from goal is exactly the system I want to grow in…</p>
        </div>
      </div>
      <div className="mail-track">
        <span className="dot dot-on" /> Drafted
        <span className="line" />
        <span className="dot dot-on" /> Sent
        <span className="line" />
        <span className="dot dot-on" /> Opened
        <span className="line" />
        <span className="dot dot-pulse" /> Reply
      </div>
    </div>
  )
}

function ThreeUp() {
  const items: Array<{
    icon: IconName; tag: string; title: string; body: string;
    visual: 'match' | 'roster' | 'mail'; accent: 'gold' | 'crimson' | 'pitch';
    featured?: boolean
  }> = [
    {
      icon: 'target', tag: 'MATCHING', title: 'Smart School Matching',
      body: 'AI ranks every program by athletic fit, academic fit, and cost, so your shortlist is built on signal, not vibes.',
      visual: 'match', accent: 'gold',
    },
    {
      icon: 'roster', tag: 'OUR DIFFERENTIATOR', title: 'Roster Intelligence',
      body: 'See which programs have open spots at your position right now. We track every coach + roster across 2,500+ schools.',
      visual: 'roster', accent: 'crimson', featured: true,
    },
    {
      icon: 'mail', tag: 'OUTREACH', title: 'Coach Outreach',
      body: 'AI drafts personalized emails sent from your own Gmail, with follow-up reminders and response tracking that actually works.',
      visual: 'mail', accent: 'pitch',
    },
  ]
  return (
    <section id="features" className="section threeup-section">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <span className="section-marker">What KickrIQ does</span>
          <h2 className="h-section" data-words>
            A recruiting counselor in your pocket. <span className="accent">Always on</span>, never tired.
          </h2>
        </div>

        <div className="threeup-grid" data-stagger>
          {items.map((it, i) => (
            <article key={i} className={`threeup-card ${it.featured ? 'featured' : ''}`}>
              <div className="threeup-top">
                <div className={`threeup-icon icon-${it.accent}`}>
                  <Icon name={it.icon} size={20} />
                </div>
                <span className={`chip ${it.accent === 'crimson' ? 'chip-crimson' : it.accent === 'pitch' ? 'chip-pitch' : ''}`}>
                  {it.tag}
                </span>
              </div>

              <h3 className="h-card threeup-title">{it.title}</h3>
              <p className="threeup-body">{it.body}</p>

              <div className="threeup-visual">
                {it.visual === 'match' && <MatchVisual />}
                {it.visual === 'roster' && <RosterVisual />}
                {it.visual === 'mail' && <MailVisual />}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   ROSTER SPOTLIGHT
   ============================================================ */
type Position = 'GK' | 'CB' | 'FB' | 'CM' | 'WG' | 'ST'

const ROSTER_DATA: Record<Position, Array<{
  school: string; tier: string; conf: string; open: number; year: string; reason: string
}>> = {
  GK: [
    { school: 'University of Portland', tier: 'D1', conf: 'WCC', open: 1, year: "'27", reason: 'Senior starter graduating' },
    { school: 'Wake Forest', tier: 'D1', conf: 'ACC', open: 1, year: "'27", reason: 'Recruiting class incomplete' },
    { school: 'Grand Valley State', tier: 'D2', conf: 'GLIAC', open: 2, year: "'26", reason: 'Two transfers leaving' },
    { school: 'Amherst College', tier: 'D3', conf: 'NESCAC', open: 1, year: "'27", reason: 'Senior + injury exit' },
    { school: 'Keiser University', tier: 'NAIA', conf: 'Sun', open: 3, year: "'27", reason: 'Program expanding roster' },
  ],
  CB: [
    { school: 'UNC Chapel Hill', tier: 'D1', conf: 'ACC', open: 2, year: "'27", reason: 'Two seniors graduating' },
    { school: 'Notre Dame', tier: 'D1', conf: 'ACC', open: 1, year: "'27", reason: 'Transfer portal exit' },
    { school: 'Messiah University', tier: 'D3', conf: 'MAC', open: 2, year: "'26", reason: 'Class size below cap' },
    { school: 'Lewis University', tier: 'D2', conf: 'GLVC', open: 3, year: "'27", reason: 'Roster overhaul' },
    { school: 'Iowa Western CC', tier: 'JUCO', conf: 'NJCAA', open: 4, year: "'26", reason: 'Annual turnover' },
  ],
  FB: [
    { school: 'Stanford', tier: 'D1', conf: 'Pac-12', open: 1, year: "'27", reason: 'Outside back vacancy' },
    { school: 'Charleston', tier: 'D1', conf: 'CAA', open: 2, year: "'27", reason: 'Two graduating' },
    { school: 'Williams', tier: 'D3', conf: 'NESCAC', open: 1, year: "'26", reason: 'Mid-class need' },
    { school: 'Cal Baptist', tier: 'D1', conf: 'WAC', open: 2, year: "'27", reason: 'Class building' },
  ],
  CM: [
    { school: 'Indiana', tier: 'D1', conf: 'Big Ten', open: 2, year: "'27", reason: 'Three seniors graduating' },
    { school: 'Tufts', tier: 'D3', conf: 'NESCAC', open: 1, year: "'26", reason: 'Transfer to D1' },
    { school: 'Lynn University', tier: 'D2', conf: 'SSC', open: 3, year: "'27", reason: 'Roster expansion' },
  ],
  WG: [
    { school: 'Clemson', tier: 'D1', conf: 'ACC', open: 1, year: "'27", reason: 'Pac-12 transfer out' },
    { school: 'Akron', tier: 'D1', conf: 'MAC', open: 2, year: "'27", reason: 'MLS SuperDraft picks' },
    { school: 'Trinity (TX)', tier: 'D3', conf: 'SAA', open: 2, year: "'26", reason: 'Speed need on flanks' },
  ],
  ST: [
    { school: 'Maryland', tier: 'D1', conf: 'Big Ten', open: 1, year: "'27", reason: 'Top scorer graduating' },
    { school: 'SMU', tier: 'D1', conf: 'ACC', open: 1, year: "'27", reason: 'Pro contract exit' },
    { school: 'Bowdoin', tier: 'D3', conf: 'NESCAC', open: 1, year: "'26", reason: 'Recruiting target' },
    { school: 'Eastern Florida State', tier: 'JUCO', conf: 'NJCAA', open: 5, year: "'26", reason: 'Full roster reset' },
  ],
}

const POSITIONS: Position[] = ['GK', 'CB', 'FB', 'CM', 'WG', 'ST']

function PhoneMock({ children }: { children: React.ReactNode }) {
  return (
    <div className="phone-frame">
      <div className="phone-glow" />
      <div className="phone-bezel">
        <div className="phone-side phone-side-l" />
        <div className="phone-side phone-side-r" />
        {children}
      </div>
    </div>
  )
}

function RosterSpotlight() {
  const [position, setPosition] = useState<Position>('GK')
  const rows = ROSTER_DATA[position]
  const totalOpen = rows.reduce((s, r) => s + r.open, 0)

  return (
    <section id="roster" className="section roster-spotlight">
      <div className="halo" style={{ background: 'rgba(227,90,90,0.18)', width: 500, height: 500, top: -120, left: -120 }} />
      <div className="halo" style={{ background: 'rgba(240,182,90,0.16)', width: 600, height: 600, bottom: -200, right: -150 }} />

      <div className="wrap roster-inner">
        <div className="roster-copy" data-reveal="left">
          <span className="section-marker">Roster Intelligence</span>
          <h2 className="h-section" data-words>
            Stop guessing.<br />
            Start <span className="accent">targeting</span>.
          </h2>
          <p className="lede">
            We track coach and roster data across 2,500+ programs and surface real-time
            openings by position, class year, and division. You stop emailing programs that
            don't need you, and start showing up where the door is actually open.
          </p>

          <ul className="roster-bullets">
            <li><Icon name="check" size={16} stroke="var(--gold)" /> Updated weekly across D1, D2, D3, NAIA, JUCO</li>
            <li><Icon name="check" size={16} stroke="var(--gold)" /> Inferred openings from grad classes &amp; transfer portal</li>
            <li><Icon name="check" size={16} stroke="var(--gold)" /> Filter by position, class year, region, fit</li>
          </ul>

          <div className="roster-stats">
            <div className="stat">
              <div className="stat-num">2,500<span className="accent">+</span></div>
              <div className="stat-label">Programs tracked</div>
            </div>
            <div className="stat">
              <div className="stat-num">98.8<span className="accent">%</span></div>
              <div className="stat-label">D1–NAIA coverage</div>
            </div>
          </div>
        </div>

        <div className="roster-device" data-reveal="right">
          <PhoneMock>
            <div className="phone-screen">
              <div className="phone-statbar kr-mono">
                <span>9:41</span>
                <span className="phone-notch" />
                <span>●●●●  ▮</span>
              </div>
              <div className="phone-app-bar">
                <div>
                  <div className="phone-eyebrow kr-mono"><span className="live-dot" />LIVE</div>
                  <div className="phone-title serif">Roster Openings</div>
                </div>
                <div className="phone-counter">
                  <span className="phone-counter-num serif">{totalOpen}</span>
                  <span className="phone-counter-lbl kr-mono">OPEN</span>
                </div>
              </div>

              <div className="phone-tabs">
                {POSITIONS.map(p => (
                  <button
                    key={p}
                    className={`phone-tab ${position === p ? 'active' : ''}`}
                    onClick={() => setPosition(p)}
                  >{p}</button>
                ))}
              </div>

              <div className="phone-list">
                {rows.map((r, i) => (
                  <div
                    key={`${position}-${i}`}
                    className="phone-row"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="phone-row-l">
                      <div className="phone-school">{r.school}</div>
                      <div className="phone-school-meta kr-mono">{r.tier} · {r.conf} · {r.year}</div>
                      <div className="phone-reason">{r.reason}</div>
                    </div>
                    <div className="phone-row-r">
                      <div className="phone-open serif">{r.open}</div>
                      <div className="phone-open-lbl kr-mono">OPEN</div>
                    </div>
                  </div>
                ))}
              </div>

              <button className="phone-cta">
                Email these coaches
                <Icon name="arrow" size={14} stroke="#1a1304" />
              </button>
            </div>
          </PhoneMock>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   CINEMATIC BAND — full-bleed video interstitial
   ============================================================ */
function CinematicBand() {
  return (
    <section className="cinematic-band" aria-hidden="false">
      <div className="cb-video-wrap">
        <video
          className="cb-video"
          autoPlay loop muted playsInline
          src="/kickriq/video-roster.mp4"
        />
        <div className="cb-veil" />
        <div className="cb-grain" />
      </div>
      <div className="wrap cb-inner">
        <div className="cb-marker kr-mono">
          <span className="cb-dot" />
          <span>Made by players · For players</span>
        </div>
        <h3 className="cb-quote serif" data-reveal>
          "We sent the cold emails. We went to the showcases.<br />
          We built <span className="accent">the tool we wish we'd had</span>."
        </h3>
        <div className="cb-attrib kr-mono">Nicolas &amp; Alexander, Co-founders</div>
      </div>
    </section>
  )
}

/* ============================================================
   HOW IT WORKS
   ============================================================ */
function HowItWorks() {
  const steps = [
    { n: '01', title: 'Build your profile', body: 'Position, class year, club, GPA, highlight tape. Takes 6 minutes. Most of it pulled in automatically.', pill: 'PROFILE' },
    { n: '02', title: 'Match with schools', body: 'AI scores every program on athletic, academic, and cost fit. You get a ranked shortlist, not a 600-school dump.', pill: 'MATCH' },
    { n: '03', title: 'Email coaches', body: "Personalized drafts sent from your own Gmail. Each one references the coach's system, season, and your fit.", pill: 'OUTREACH' },
    { n: '04', title: 'Track responses', body: 'Opens, replies, follow-ups, visits. Every coach conversation in one timeline you can actually act on.', pill: 'TRACK' },
  ]
  return (
    <section id="how" className="section how-section">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <span className="section-marker">How it works</span>
          <h2 className="h-section" data-words>
            Four steps from <span className="accent">unknown</span> to recruited.
          </h2>
        </div>

        <div className="how-grid" data-stagger>
          {steps.map((s, i) => (
            <div className="how-card" key={i}>
              <div className="how-top">
                <span className="num">{s.n}</span>
                <span className="chip chip-ghost">{s.pill}</span>
              </div>
              <h3 className="h-card how-title">{s.title}</h3>
              <p className="how-body">{s.body}</p>
              <div className="how-bar">
                <span className="how-bar-fill" style={{ width: `${(i + 1) * 25}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   FEATURE GRID
   ============================================================ */
function FeatureGrid() {
  const features: Array<{ icon: IconName; title: string; body: string; tag: string }> = [
    { icon: 'video',    title: 'Highlight Video Rater', body: 'AI scores your tape on technique, decision-making, and athleticism, and tells you the clips to cut.', tag: 'AI' },
    { icon: 'track',    title: 'Outreach Tracker',      body: 'Every email, every open, every reply. One timeline per coach, automatic.', tag: 'CRM' },
    { icon: 'follow',   title: 'Follow-up Assistant',   body: 'AI nudges you exactly when to follow up. Not too eager, not forgotten.', tag: 'AI' },
    { icon: 'camp',     title: 'ID Camps',              body: "Find ID camps where the coaches you're emailing will actually be on the touchline.", tag: 'EVENTS' },
    { icon: 'timeline', title: 'Recruitment Timeline',  body: 'A monthly playbook tuned to your class year and division target.', tag: 'PLAN' },
    { icon: 'profile',  title: 'Public Player Profile', body: 'A shareable link with stats, video, transcripts, and a coach quote. Built for the inbox.', tag: 'SHARE' },
  ]
  return (
    <section className="section feature-grid-section">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <span className="section-marker">Built into the platform</span>
          <h2 className="h-section" data-words>
            Every tool a recruit needs. <span className="accent">None</span> of the busywork.
          </h2>
        </div>

        <div className="feature-grid" data-stagger>
          {features.map((f, i) => (
            <article className="feature-card" key={i}>
              <div className="feature-icon"><Icon name={f.icon} size={22} stroke="var(--gold)" /></div>
              <span className="chip chip-ghost feature-tag">{f.tag}</span>
              <h3 className="h-card feature-title">{f.title}</h3>
              <p className="feature-body">{f.body}</p>
              <div className="feature-arrow"><Icon name="arrow" size={16} /></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   DIVISIONS
   ============================================================ */
function Divisions() {
  const divs = [
    { code: 'D1',   programs: 207, scholarships: 'Full',     color: 'gold',    desc: 'Top of the pyramid. Athletic scholarships, big stages.' },
    { code: 'D2',   programs: 215, scholarships: 'Partial',  color: 'crimson', desc: 'Hidden value. Strong soccer, real scholarship money.' },
    { code: 'D3',   programs: 415, scholarships: 'Academic', color: 'pitch',   desc: 'Best academics in college soccer. Aid is academic, not athletic.' },
    { code: 'NAIA', programs: 192, scholarships: 'Athletic', color: 'gold',    desc: 'Smaller schools, real funding, faster recruiting cycles.' },
    { code: 'JUCO', programs: 175, scholarships: 'Athletic', color: 'crimson', desc: 'Two-year springboard. Game time fast, transfer pipelines proven.' },
  ]
  return (
    <section className="section divisions-section">
      <div className="wrap">
        <div className="div-grid">
          <div className="div-copy" data-reveal="left">
            <span className="section-marker">Built for every division</span>
            <h2 className="h-section" data-words>
              98.8% coverage.<br />
              Every <span className="accent">level</span> of the game.
            </h2>
            <p className="lede">
              KickrIQ doesn't push you toward D1 because the website does. We rank by fit,
              and most great college soccer careers happen below the D1 line.
            </p>
            <div className="div-stat-big">
              <span className="serif div-stat-num">98.8%</span>
              <span className="div-stat-lbl">D1–NAIA program coverage. JUCO and emerging programs added monthly.</span>
            </div>
          </div>

          <div className="div-cards" data-stagger>
            {divs.map((d, i) => (
              <div className={`div-card div-${d.color}`} key={i}>
                <div className="div-code serif">{d.code}</div>
                <div className="div-info">
                  <div className="div-meta kr-mono">
                    <span>{d.programs} programs</span>
                    <span className="div-dot">·</span>
                    <span>{d.scholarships}</span>
                  </div>
                  <div className="div-desc">{d.desc}</div>
                </div>
                <div className="div-bar"><span style={{ width: `${(d.programs / 415) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   PARENTS
   ============================================================ */
function Parents() {
  return (
    <section id="parents" className="section parents-section">
      <div className="wrap">
        <div className="parents-card">
          <div className="parents-pattern" />
          <div className="parents-copy" data-reveal="left">
            <span className="section-marker">For parents</span>
            <h2 className="h-section parents-h" data-words>
              Parents stay in <span className="accent">the loop</span>.
            </h2>
            <p className="lede">
              The Family tier gives parents a quiet dashboard. Every email sent, every coach
              response, every visit booked. No nagging. No surprises. The whole recruiting
              cycle, finally on one page.
            </p>
            <div className="parents-ctas">
              <Link to="/signup" className="kbtn kbtn-primary">
                See the Family tier
                <Icon name="arrow" size={16} />
              </Link>
              <a href="#pricing" className="kbtn kbtn-link">/for-parents →</a>
            </div>
          </div>

          <div className="parents-visual" data-reveal="right">
            <div className="parents-mock">
              <div className="parents-mock-head">
                <div>
                  <div className="parents-mock-eyebrow kr-mono">FAMILY DASHBOARD · MARCH</div>
                  <div className="parents-mock-title serif">Jordan's recruiting · this week</div>
                </div>
                <span className="chip">QUIET MODE</span>
              </div>
              <div className="parents-rows">
                <div className="parents-row">
                  <span className="parents-dot dot-on" />
                  <div>
                    <div className="parents-row-t">Coach Mendez · Stanford</div>
                    <div className="parents-row-s kr-mono">REPLIED · TUE 4:12pm</div>
                  </div>
                  <span className="chip chip-pitch">REPLY</span>
                </div>
                <div className="parents-row">
                  <span className="parents-dot dot-on" />
                  <div>
                    <div className="parents-row-t">Coach Patel · UNC Chapel Hill</div>
                    <div className="parents-row-s kr-mono">OPENED 3× · WED 9:02am</div>
                  </div>
                  <span className="chip">OPENED</span>
                </div>
                <div className="parents-row">
                  <span className="parents-dot dot-on" />
                  <div>
                    <div className="parents-row-t">ID Camp · Wake Forest</div>
                    <div className="parents-row-s kr-mono">BOOKED · APR 12</div>
                  </div>
                  <span className="chip chip-crimson">CAMP</span>
                </div>
              </div>
              <div className="parents-summary kr-mono">
                7 emails sent · 4 opened · 2 replies · 1 visit booked
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   PRICING
   ============================================================ */
function Pricing() {
  const [waitlistTier, setWaitlistTier] = useState<'pro' | 'family' | null>(null)

  const tiers = [
    {
      key: 'free' as const,
      name: 'Free', price: '$0', period: 'forever',
      desc: 'Try the engine. Send a few emails. See if it clicks.',
      features: ['3 coach emails', '5 school matches', 'Public player profile', 'Recruitment timeline'],
      cta: 'Start free', featured: false,
    },
    {
      key: 'pro' as const,
      name: 'Pro', price: 'Coming soon', period: 'waitlist open',
      desc: 'For athletes serious about getting recruited this season.',
      features: ['Unlimited coach emails', 'Unlimited school matches', 'Outreach tracker + follow-ups', 'AI Highlight Video Rater', 'Roster Intelligence', 'Priority support'],
      cta: 'Join Pro waitlist', featured: true,
    },
    {
      key: 'family' as const,
      name: 'Family', price: 'Coming soon', period: 'waitlist open',
      desc: 'Pro for the athlete, plus visibility for the people paying for it.',
      features: [
        'Everything in Pro',
        'Parent view (read-only dashboard)',
        'Weekly progress email to parents',
        'Shared deadlines & visit calendar',
        'One bill, one login per parent',
      ],
      cta: 'Join Family waitlist', featured: false,
    },
  ]

  return (
    <section id="pricing" className="section pricing-section">
      <div className="wrap">
        <div className="section-head section-head-center" data-reveal>
          <span className="section-marker">Pricing</span>
          <h2 className="h-section" data-words>
            Free to start. <span className="accent">Cheaper</span> than one ID camp.
          </h2>
          <p className="lede pricing-sub pricing-sub-quote">
            Pro is <span className="serif accent">nineteen dollars a month.</span> Less than one ID camp lunch.
          </p>
        </div>

        <div className="pricing-grid" data-stagger>
          {tiers.map((t, i) => (
            <article key={i} className={`pricing-card pricing-${t.name.toLowerCase()} ${t.featured ? 'featured' : ''}`}>
              {t.featured && <div className="pricing-ribbon kr-mono">MOST POPULAR</div>}
              <div className="pricing-head">
                <h3 className="serif pricing-name">{t.name}</h3>
                <p className="pricing-desc">{t.desc}</p>
              </div>
              <div className="pricing-price">
                <span className="serif pricing-num">{t.price}</span>
                <span className="pricing-period kr-mono">{t.period}</span>
              </div>
              <ul className="pricing-features">
                {t.features.map((f, j) => (
                  <li key={j}>
                    <Icon name="check" size={14} stroke={t.featured ? 'var(--gold)' : 'var(--fg-1)'} />
                    {f}
                  </li>
                ))}
              </ul>
              {t.key === 'free' ? (
                <Link
                  to="/signup"
                  className={`kbtn ${t.featured ? 'kbtn-primary' : 'kbtn-ghost'} pricing-cta`}
                >
                  {t.cta}
                  <Icon name="arrow" size={14} stroke={t.featured ? '#1a1304' : 'var(--fg-0)'} />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setWaitlistTier(t.key)}
                  className={`kbtn ${t.featured ? 'kbtn-primary' : 'kbtn-ghost'} pricing-cta`}
                >
                  {t.cta}
                  <Icon name="arrow" size={14} stroke={t.featured ? '#1a1304' : 'var(--fg-0)'} />
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
      <WaitlistModal
        open={waitlistTier !== null}
        onClose={() => setWaitlistTier(null)}
        feature="general"
        tier={waitlistTier ?? 'pro'}
      />
    </section>
  )
}

/* ============================================================
   FINAL CTA + FOOTER
   ============================================================ */
function FinalCTA() {
  return (
    <section className="section final-cta-section">
      <div className="cta-video-wrap">
        <video className="cta-video" autoPlay loop muted playsInline src="/kickriq/cta-tunnel.mp4" />
        <div className="cta-video-veil" />
      </div>
      <div className="halo" style={{ background: 'rgba(240,182,90,0.45)', width: 700, height: 700, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', filter: 'blur(80px)' }} />
      <div className="wrap final-cta-inner" data-reveal>
        <span className="section-marker">Your move</span>
        <h2 className="h-display final-h" data-words>
          Get <span className="accent">recruited</span>.<br />
          Not <span style={{ opacity: 0.55 }}>overlooked</span>.
        </h2>
        <p className="lede final-sub">
          2,500+ programs. 98.8% D1–NAIA coverage. Drafts, sends, and tracks every contact.
          Free to start, no credit card.
        </p>
        <div className="final-ctas">
          <Link to="/signup" className="kbtn kbtn-primary kbtn-lg">
            Start for Free
            <Icon name="arrow" size={16} />
          </Link>
          <a href="#how" className="kbtn kbtn-ghost kbtn-lg">Talk to a counselor</a>
        </div>
        <div className="final-trust">FREE · 3 EMAILS · 5 MATCHES · NO CARD</div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div className="footer-brand">
          <Link to="/" className="brand" aria-label="KickrIQ">
            <KickrIQLogo height={44} />
          </Link>
          <p className="footer-tag">The smartest way to get recruited. Built by former college players + AI engineers.</p>
          <div className="footer-trust">
            <span className="chip chip-ghost">2,500+ PROGRAMS</span>
            <span className="chip chip-ghost">98.8% COVERAGE</span>
          </div>
        </div>

        <div className="footer-cols">
          <div>
            <div className="footer-h">PRODUCT</div>
            <a href="#features">Features</a>
            <a href="#roster">Roster Intelligence</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div>
            <div className="footer-h">FOR</div>
            <a href="#parents">Parents</a>
            <a href="#features">Athletes</a>
            <a href="#features">Club coaches</a>
            <Link to="/for-coaches">College coaches</Link>
          </div>
          <div>
            <div className="footer-h">OPEN SPOTS</div>
            <Link to="/open-spots/womens">Women's Programs</Link>
            <Link to="/open-spots/mens">Men's Programs</Link>
            <Link to="/open-spots/womens/goalkeeper">By Position</Link>
            <Link to="/open-spots">All Open Spots</Link>
          </div>
          <div>
            <div className="footer-h">COMPANY</div>
            <Link to="/about">About</Link>
            <a href="#features">Stories</a>
            <a href="#features">Press</a>
            <a href="#features">Careers</a>
          </div>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <div>© 2026 KickrIQ Athletics, Inc.</div>
        <div className="footer-links">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy#security">Security</Link>
        </div>
      </div>
    </footer>
  )
}

/* ============================================================
   ROOT
   ============================================================ */
export function Landing() {
  useScrollMotion()
  return (
    <div className="kickriq">
      <div className="page">
        <Navbar />
        <Hero />
        <ThreeUp />
        <RosterSpotlight />
        <CinematicBand />
        <HowItWorks />
        <FeatureGrid />
        <Divisions />
        <Parents />
        <Pricing />
        <FinalCTA />
        <Footer />
      </div>
    </div>
  )
}
