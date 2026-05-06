import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

/* ============================================================
   SCROLL REVEAL — same shape as Landing's useScrollMotion
   ============================================================ */
function useScrollMotion() {
  useEffect(() => {
    const root = document.querySelector('.kickriq')
    if (!root) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-revealed')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    root.querySelectorAll('[data-reveal], [data-stagger]').forEach((el) => io.observe(el))

    const safety = window.setTimeout(() => {
      root.querySelectorAll('[data-reveal], [data-stagger]').forEach((el) => {
        if (!el.classList.contains('is-revealed')) el.classList.add('is-revealed')
      })
    }, 2000)

    return () => {
      io.disconnect()
      window.clearTimeout(safety)
    }
  }, [])
}

/* ============================================================
   ICONS
   ============================================================ */
type IconName = 'arrow' | 'menu' | 'close' | 'play'
function Icon({ name, size = 20, stroke = 'currentColor', fill = 'none' }: {
  name: IconName; size?: number; stroke?: string; fill?: string
}) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill, stroke, strokeWidth: 1.6,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'arrow': return <svg {...props}><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>
    case 'menu':  return <svg {...props}><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    case 'close': return <svg {...props}><path d="M6 6l12 12M18 6L6 18"/></svg>
    case 'play':  return <svg {...props}><path d="M7 5l12 7-12 7z" fill={stroke} stroke="none"/></svg>
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
   ABOUT NAVBAR — homepage anchors, About us highlighted
   ============================================================ */
function AboutNav() {
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
          <Link to="/#features">Features</Link>
          <Link to="/#roster">Roster Intelligence</Link>
          <Link to="/#how">How it works</Link>
          <Link to="/#pricing">Pricing</Link>
          <Link to="/#parents">For Parents</Link>
          <Link to="/about" className="nav-about-active">About us</Link>
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
          <Link to="/#features" onClick={() => setOpen(false)}>Features</Link>
          <Link to="/#roster" onClick={() => setOpen(false)}>Roster Intelligence</Link>
          <Link to="/#how" onClick={() => setOpen(false)}>How it works</Link>
          <Link to="/#pricing" onClick={() => setOpen(false)}>Pricing</Link>
          <Link to="/#parents" onClick={() => setOpen(false)}>For Parents</Link>
          <Link to="/about" onClick={() => setOpen(false)} className="nav-about-active">About us</Link>
          <Link to="/login" onClick={() => setOpen(false)}>Sign in</Link>
        </div>
      )}
    </header>
  )
}

/* ============================================================
   MASTHEAD
   ============================================================ */
function Masthead() {
  return (
    <section className="about-masthead about-top">
      <div className="wrap">
        <div className="about-eyebrow-row">
          <span className="rule" />
          <span className="about-issue">About · Vol. 01 · Filed from the sideline</span>
        </div>
        <div className="about-mast-grid">
          <h1 className="about-h1">
            Built by two players who <span className="accent">just went through it</span>.
          </h1>
          <div>
            <p className="about-deck">
              We are not a venture-backed studio. We are two Bay Area teammates who got recruited the hard way and decided the next kid shouldn't have to."
            </p>
            <div className="about-byline">
              <span><b>Founded</b> · 2026 · Bay Area, CA</span>
              <span><b>Founders</b> · Nicolas Bee · Alexander Kovalenko</span>
              <span><b>Stage</b> · Player-built</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   THE WHY
   ============================================================ */
function TheWhy() {
  return (
    <section className="why-section">
      <div className="wrap">
        <div className="why-grid">
          <div className="why-marker">The why</div>
          <div className="why-prose">
            <p>
              Every year, roughly 450,000 kids play high school soccer in the United States. About 7% of them play in college. The math isn't kind, but the path is even worse — buried in spreadsheets, ID-camp invoices, and 200-coach email blasts that nobody reads.
            </p>
            <p>
              We know, because we lived it. We are <span className="pull">Nicolas Bee and Alexander Kovalenko</span>, two Bay Area defenders and midfielders who spent two years figuring out which coaches to email, what to say, when to follow up, and which programs were actually a fit. We committed — Nicolas to Pomona-Pitzer, Alex to Johns Hopkins — and immediately realized how much luck and time the process had taken.
            </p>
            <p>
              KickrIQ is the tool we wish we'd had on day one. Not a recruiting service. Not a pay-to-play camp. A focused product that closes the gap between <span className="pull">good players</span> and the coaches who would want them, if only the right email had landed in the right inbox.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   STATS STRIP
   ============================================================ */
function StatsStrip() {
  return (
    <section className="stats-strip">
      <div className="wrap">
        <div className="stats-strip-grid">
          <div className="stats-cell">
            <span className="stats-num">2,500<em>+</em></span>
            <span className="stats-label">College programs</span>
            <span className="stats-foot">D1, D2, D3, NAIA, JUCO. Updated weekly from public roster data and verified coach contacts.</span>
          </div>
          <div className="stats-cell">
            <span className="stats-num">98.8<em>%</em></span>
            <span className="stats-label">D1–NAIA coverage</span>
            <span className="stats-foot">Of accredited four-year soccer programs in the U.S. — nearly the entire universe.</span>
          </div>
          <div className="stats-cell">
            <span className="stats-num">11<em>×</em></span>
            <span className="stats-label">Avg response lift</span>
            <span className="stats-foot">Vs. generic outreach. Personalized highlight-driven emails get answered, not deleted.</span>
          </div>
          <div className="stats-cell">
            <span className="stats-num">$0</span>
            <span className="stats-label">To start</span>
            <span className="stats-foot">No card. Three coach emails, five matches, and a public profile, free forever.</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   PRINCIPLES
   ============================================================ */
function Principles() {
  const items = [
    { n: '01', h: 'Athletes first. Always.', p: "We don't sell coach access, leads, or eyeballs. The athlete is the customer; their outcome is the only metric that matters to us." },
    { n: '02', h: 'No pay-to-play.',         p: "We don't boost paying users in coach searches. Match quality and effort decide who gets seen. Period." },
    { n: '03', h: 'Private by default.',     p: 'Your highlights, grades, and contact data are yours. We never sell, license, or train on athlete information.' },
    { n: '04', h: 'Honest about AI.',        p: 'AI drafts. Athletes send. We label every AI-assisted message and teach you to write better ones — not pretend the bot did the work.' },
    { n: '05', h: 'Cheaper than one camp.',  p: 'Recruiting tools cost more than a week of groceries for most families. Pro is $19. Less than one ID camp lunch.' },
    { n: '06', h: 'Coach time is sacred.',   p: 'We rate-limit and quality-gate every outbound. If a coach unsubscribes, we honor it across the entire platform forever.' },
  ]
  return (
    <section className="principles">
      <div className="wrap">
        <div className="principles-head" data-reveal>
          <span className="section-marker">Principles</span>
          <h2 className="h-section" style={{ marginTop: 18 }}>
            Six rules we don't <span className="accent">break</span>.
          </h2>
        </div>
        <div className="principles-grid" data-stagger>
          {items.map((it) => (
            <div className="principle" key={it.n}>
              <span className="principle-num">{it.n}</span>
              <h3>{it.h}</h3>
              <p>{it.p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   TIMELINE
   ============================================================ */
function AboutTimeline() {
  const events = [
    { date: 'SOPH YR',     h: 'The first spreadsheet.',          p: 'Nicolas and Alex — Bay Area club teammates — start tracking coaches, camps, and email replies in a shared Google Sheet. It grows across two seasons.' },
    { date: 'SOPH–JR YR',  h: 'The unanswered emails.',          p: 'Both send dozens of cold emails to college coaches. Most go unread. The ones that work share a pattern: specific, short, and tied to a real highlight.' },
    { date: 'WINTER 2025', h: 'Two commits, one realization.',   p: 'Nicolas commits to Pomona-Pitzer. Alex commits to Johns Hopkins. Different schools, same conclusion: the recruiting process is solvable, and nobody is solving it for the athlete.' },
    { date: 'JAN 2026',    h: 'First prototype.',                p: 'We build a small tool to draft emails from a player profile and a target program. We test it on younger teammates. Reply rates jump immediately.' },
    { date: 'FEB 2026',    h: 'KickrIQ becomes a product.',      p: 'We name it, build it for real, and open it to the next wave of Bay Area players going through the same thing we just did.' },
    { date: 'NOW',         h: "You're reading this.",            p: 'Built by two players, for the next class of players. The roadmap is shaped by every family we talk to — because we were that family two years ago.' },
  ]
  return (
    <section className="about-timeline-section">
      <div className="wrap">
        <div className="about-timeline-head" data-reveal>
          <span className="section-marker">Timeline</span>
          <h2 className="h-section" style={{ marginTop: 18 }}>
            Two years, in <span className="accent">six moments</span>.
          </h2>
        </div>
        <div className="about-timeline" data-stagger>
          {events.map((e, i) => (
            <div className="tl-row" key={i}>
              <div className="tl-date">{e.date}</div>
              <div className="tl-content">
                <h4>{e.h}</h4>
                <p>{e.p}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   TEAM
   ============================================================ */
function Team() {
  const people = [
    {
      name: 'Nicolas Bee',
      role: 'Co-founder · Pomona-Pitzer commit',
      school: 'POMONA-PITZER',
      photo: '/kickriq/team/nicolas-bee.jpg',
      bio: "Bay Area defender committed to Pomona-Pitzer men's soccer. Known for decision-making, communication, and organizing the back line — a steady, problem-solving presence on the field. Brings the same dependability and structure to building KickrIQ that he brings to a back four.",
    },
    {
      name: 'Alexander Kovalenko',
      role: 'Co-founder · Johns Hopkins commit',
      school: 'JOHNS HOPKINS',
      photo: '/kickriq/team/alex-kovalenko.jpg',
      bio: 'Bay Area midfielder/attacker committed to Johns Hopkins. A connector — links defense to attack, reads patterns early, and creates under pressure. The same composure and step-ahead thinking shapes the product: clear, intentional, built around how the game actually unfolds.',
    },
  ]
  return (
    <section className="team-section">
      <div className="wrap">
        <div className="team-head" data-reveal>
          <span className="section-marker">The founders</span>
          <h2 className="h-section" style={{ marginTop: 18 }}>
            Two players. One <span className="accent">shared problem</span>.
          </h2>
          <p className="lede" style={{ marginTop: 18 }}>
            We met as Bay Area club teammates, went through the recruiting process side by side, and ended up at two very different schools. KickrIQ is what we built so the next class doesn't have to figure it out the way we did.
          </p>
        </div>
        <div className="team-grid" data-stagger>
          {people.map((p) => (
            <article className="team-card" key={p.name}>
              <div className="team-portrait">
                <img src={p.photo} alt={p.name} loading="lazy" />
                <span className="school-tag">{p.school}</span>
              </div>
              <div>
                <div className="team-name">{p.name}</div>
                <div className="team-role">{p.role}</div>
              </div>
              <p className="team-bio">{p.bio}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   PULL QUOTE
   ============================================================ */
function PullQuote() {
  return (
    <section className="quote-section">
      <div className="wrap">
        <div className="quote-block" data-reveal>
          <p className="pullquote">
            We didn't want to start a <span className="accent">company</span>. We wanted the tool to <span className="accent">exist</span>. Nobody was building it, so we did.
          </p>
          <div className="quote-attrib">
            — <b>Nicolas Bee &amp; Alexander Kovalenko</b> · Co-founders, KickrIQ
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   ABOUT CTA
   ============================================================ */
function AboutCTA() {
  return (
    <section className="about-cta">
      <div className="wrap">
        <h2>Ready when you are.</h2>
        <p>
          Free to start. Three coach emails on the house. No credit card. The only thing we ask is that you actually send them.
        </p>
        <div className="ctas">
          <Link to="/signup" className="kbtn kbtn-primary kbtn-lg">
            Start for Free
            <Icon name="arrow" size={16} />
          </Link>
          <Link to="/#how" className="kbtn kbtn-ghost kbtn-lg">
            See how it works
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   FOOTER (mirrors homepage; About link highlighted)
   ============================================================ */
function AboutFooter() {
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
            <Link to="/#features">Features</Link>
            <Link to="/#roster">Roster Intelligence</Link>
            <Link to="/#how">How it works</Link>
            <Link to="/#pricing">Pricing</Link>
          </div>
          <div>
            <div className="footer-h">FOR</div>
            <Link to="/#parents">Parents</Link>
            <Link to="/#features">Athletes</Link>
            <Link to="/#features">Club coaches</Link>
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
            <Link to="/about" className="footer-about-active">About</Link>
            <a href="#">Stories</a>
            <a href="#">Press</a>
            <a href="#">Careers</a>
          </div>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <div>© 2026 KickrIQ Athletics, Inc.</div>
        <div className="footer-links">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="#">Security</a>
        </div>
      </div>
    </footer>
  )
}

/* ============================================================
   ROOT
   ============================================================ */
export function About() {
  useScrollMotion()
  useEffect(() => { document.title = 'About · KickrIQ' }, [])
  return (
    <div className="kickriq about-page">
      <div className="page">
        <AboutNav />
        <Masthead />
        <TheWhy />
        <StatsStrip />
        <Principles />
        <AboutTimeline />
        <Team />
        <PullQuote />
        <AboutCTA />
        <AboutFooter />
      </div>
    </div>
  )
}

export default About
