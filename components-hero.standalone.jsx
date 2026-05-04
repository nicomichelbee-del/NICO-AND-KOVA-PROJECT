/* global React */
const { useState, useEffect, useRef } = React;

/* ==============================================================
   ICONS. minimal stroked set, original drawings
   ============================================================== */
const Icon = ({ name, size = 20, stroke = 'currentColor', fill = 'none' }) => {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill, stroke, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (name) {
    case 'target':    return <svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill={stroke}/></svg>;
    case 'roster':    return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 14h3"/><path d="M8 17h6"/><circle cx="17" cy="15" r="2" fill={stroke} stroke="none"/></svg>;
    case 'mail':      return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></svg>;
    case 'video':     return <svg {...props}><rect x="3" y="6" width="14" height="12" rx="2"/><path d="M17 10l4-2v8l-4-2z"/></svg>;
    case 'track':     return <svg {...props}><path d="M3 17l5-5 4 4 8-9"/><path d="M14 7h6v6"/></svg>;
    case 'follow':    return <svg {...props}><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg>;
    case 'camp':      return <svg {...props}><path d="M3 21l9-15 9 15z"/><path d="M3 21h18"/></svg>;
    case 'timeline':  return <svg {...props}><path d="M4 12h16"/><circle cx="6" cy="12" r="2" fill={stroke} stroke="none"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>;
    case 'profile':   return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>;
    case 'arrow':     return <svg {...props}><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>;
    case 'check':     return <svg {...props}><path d="M5 12l4.5 4.5L19 7"/></svg>;
    case 'spark':     return <svg {...props}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M5.5 18.5l2.8-2.8M15.7 8.3l2.8-2.8"/></svg>;
    case 'ball':      return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 3l3 5-3 4-3-4z" fill={stroke} stroke="none" opacity="0.9"/><path d="M3 12l5 1 1 5"/><path d="M21 12l-5 1-1 5"/></svg>;
    case 'menu':      return <svg {...props}><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
    case 'close':     return <svg {...props}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'play':      return <svg {...props}><path d="M7 5l12 7-12 7z" fill={stroke} stroke="none"/></svg>;
    case 'shield':    return <svg {...props}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>;
    case 'sparkles':  return <svg {...props}><path d="M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5z"/><path d="M19 15l.8 2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-1z"/></svg>;
    default: return null;
  }
};

/* ==============================================================
   NAVBAR
   ============================================================== */
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={`nav ${scrolled ? 'nav-scrolled' : ''}`}>
      <div className="wrap nav-inner">
        <a href="#" className="brand brand-img" aria-label="KickrIQ">
          <KickrIQLogo height={32} />
        </a>
        <nav className="nav-links hide-mobile">
          <a href="#features">Features</a>
          <a href="#roster">Roster Intelligence</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#parents">For Parents</a>
          <a href="About.html">About us</a>
        </nav>
        <div className="nav-cta">
          <a href="#" className="nav-signin hide-mobile">Sign in</a>
          <a href="#" className="btn btn-primary nav-btn">
            Start Free
            <Icon name="arrow" size={16} />
          </a>
          <button className="nav-menu show-mobile" onClick={() => setOpen(!open)} aria-label="menu">
            <Icon name={open ? 'close' : 'menu'} size={22} />
          </button>
        </div>
      </div>
      {open && (
        <div className="nav-drawer show-mobile">
          <a href="#features" onClick={() => setOpen(false)}>Features</a>
          <a href="#roster" onClick={() => setOpen(false)}>Roster Intelligence</a>
          <a href="#how" onClick={() => setOpen(false)}>How it works</a>
          <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
          <a href="#parents" onClick={() => setOpen(false)}>For Parents</a>
          <a href="#" onClick={() => setOpen(false)}>Sign in</a>
        </div>
      )}
    </header>
  );
};

/* ==============================================================
   HERO
   ============================================================== */
const Hero = () => {
  const videoRef = useRef(null);
  const [, force] = useState(0);
  const [kickerIdx, setKickerIdx] = useState(0);
  const [heroIdx, setHeroIdx] = useState(0);
  const KICKER_OUTCOMES = ['recruited.', 'noticed.', 'seen.', 'signed.'];
  const HERO_WORDS = ['smartest', 'quickest', 'sharpest', 'boldest'];
  useEffect(() => {
    // Kicker rotates every 3.4s, hero H1 rotates every 3.4s but offset by 1.7s
    // so they never swap at the same moment. Slowed from 2.4s for less visual chatter.
    const kickerId = setInterval(() => {
      setKickerIdx((i) => (i + 1) % KICKER_OUTCOMES.length);
    }, 3400);
    const heroDelay = setTimeout(() => {
      setHeroIdx((i) => (i + 1) % HERO_WORDS.length);
      const heroId = setInterval(() => {
        setHeroIdx((i) => (i + 1) % HERO_WORDS.length);
      }, 3400);
      // store on window so cleanup catches it (closure escape)
      window.__heroRotatorId = heroId;
    }, 1700);
    return () => {
      clearInterval(kickerId);
      clearTimeout(heroDelay);
      if (window.__heroRotatorId) clearInterval(window.__heroRotatorId);
    };
  }, []);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.75;
    }
    const onTweak = () => force(n => n + 1);
    window.addEventListener('kickr-tweaks-changed', onTweak);
    return () => window.removeEventListener('kickr-tweaks-changed', onTweak);
  }, []);

  return (
    <section className="hero">
      <div className="hero-video-wrap">
        <video
          ref={videoRef}
          className="hero-video"
          autoPlay loop muted playsInline
          poster=""
          src={window.__resources.heroVideo}
        />
        <div className="hero-veil" />
        <div className="hero-radial" />
        <div className="hero-vignette" />
      </div>

      {/* Broadcast-style live ticker. opt-in via Tweaks */}
      {window.__kickrTweaks?.showTicker && (
      <div className="hero-ticker hide-mobile" data-kickr-ticker>
        <div className="ticker-track">
          {[1,2].map(k => (
            <div className="ticker-row" key={k}>
              <span className="ticker-kicker"><span className="live-dot" />LIVE · KICKRIQ WIRE</span>

              <span className="tk-tag tk-open">OPENING</span>
              <span>D1 · STANFORD W. SOCCER · GK <b>1 OPEN</b> · CLASS OF '27</span>
              <span className="tk-sep">◆</span>

              <span className="tk-tag tk-signed">SIGNED</span>
              <span>JORDAN A. (PORTLAND, OR) <b>→ UNIVERSITY OF PORTLAND</b> · GK</span>
              <span className="tk-sep">◆</span>

              <span className="tk-tag tk-portal">PORTAL</span>
              <span>UNC CHAPEL HILL · CB DEPARTING <b>2 SLOTS OPEN</b></span>
              <span className="tk-sep">◆</span>

              <span className="tk-tag tk-open">OPENING</span>
              <span>NAIA · KEISER · ST <b>3 OPEN</b> · ROSTER EXPANDING</span>
              <span className="tk-sep">◆</span>

              <span className="tk-tag tk-camp">ID CAMP</span>
              <span>WAKE FOREST · APR 12 · <b>SPOTS LEFT</b> · COACH ON SIDELINE</span>
              <span className="tk-sep">◆</span>

              <span className="tk-tag tk-watch">SCOUTING</span>
              <span>NOTRE DAME STAFF VIEWED <b>14 PROFILES</b> THIS WEEK</span>
              <span className="tk-sep">◆</span>

              <span className="tk-tag tk-open">OPENING</span>
              <span>D2 · GRAND VALLEY · CB <b>2 OPEN</b> · CLASS OF '26</span>
              <span className="tk-sep">◆</span>

              <span className="tk-tag tk-reply">REPLY</span>
              <span>COACH MENDEZ (STANFORD) <b>RESPONDED</b> · 4M AGO</span>
              <span className="tk-sep">◆</span>

              <span className="tk-tag tk-open">OPENING</span>
              <span>JUCO · IOWA WESTERN · 4 POSITIONS · <b>8 OPEN</b></span>
              <span className="tk-sep">◆</span>

              <span className="tk-tag tk-portal">PORTAL</span>
              <span>SMU · ST PRO CONTRACT EXIT · <b>1 SLOT</b></span>
              <span className="tk-sep">◆</span>

              <span className="tk-tag tk-camp">ID CAMP</span>
              <span>CLEMSON · MAR 28 · <b>WAITLIST</b></span>
              <span className="tk-sep">◆</span>
            </div>
          ))}
        </div>
        <div className="ticker-fade ticker-fade-l" />
        <div className="ticker-fade ticker-fade-r" />
      </div>
      )}

      <div className="wrap hero-inner">
        <div className="hero-eyebrow">
          <span className="hero-kicker">
            <span className="hk-line" />
            <span className="hk-text serif">
              AI that puts in the work to get you <span className="hk-rotator" key={kickerIdx}>{KICKER_OUTCOMES[kickerIdx % KICKER_OUTCOMES.length]}</span>
            </span>
            <span className="hk-line" />
          </span>
        </div>

        <h1 className="h-display hero-headline">
          The <span className="accent hero-rotator" key={`hr-${heroIdx}`}>{HERO_WORDS[heroIdx % HERO_WORDS.length]}</span> way<br/>
          to get recruited.
        </h1>

        <p className="lede hero-sub hero-sub-editorial">
          Your <span className="serif accent">personal recruiting coach</span>. Match with the right college programs, email the right coaches, and track every response. <span className="hero-sub-divs">D1 · D2 · D3 · NAIA · JUCO</span>.
        </p>

        <div className="hero-ctas">
          <a href="#" className="btn btn-primary btn-lg">
            Start for Free
            <Icon name="arrow" size={16} />
          </a>
          <a href="#how" className="btn btn-ghost btn-lg">
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
  );
};

window.Icon = Icon;
window.Navbar = Navbar;
window.Hero = Hero;
