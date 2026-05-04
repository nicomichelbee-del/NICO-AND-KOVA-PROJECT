/* global React, Icon */
const { useState: useStateP, useEffect: useEffectP } = React;

/* ==============================================================
   PRICING
   ============================================================== */
const Pricing = () => {
  const tiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      desc: 'Try the engine. Send a few emails. See if it clicks.',
      features: ['3 coach emails', '5 school matches', 'Public player profile', 'Recruitment timeline'],
      cta: 'Start free',
      style: 'free',
    },
    {
      name: 'Pro',
      price: '$19',
      period: 'per month',
      desc: 'For athletes serious about getting recruited this season.',
      features: ['Unlimited coach emails', 'Unlimited school matches', 'Outreach tracker + follow-ups', 'AI Highlight Video Rater', 'Roster Intelligence', 'Priority support'],
      cta: 'Get Pro',
      style: 'pro',
      featured: true,
    },
    {
      name: 'Family',
      price: '$29',
      period: 'per month',
      desc: 'Pro for the athlete, plus visibility for the people paying for it.',
      features: [
        'Everything in Pro',
        'Parent view (read-only dashboard)',
        'Weekly progress email to parents',
        'Shared deadlines & visit calendar',
        'One bill, one login per parent',
      ],
      cta: 'Get Family',
      style: 'family',
    },
  ];

  return (
    <section id="pricing" className="section pricing-section">
      <div className="wrap">
        <div className="section-head section-head-center" data-reveal="up">
          <span className="section-marker">Pricing</span>
          <h2 className="h-section" data-words>
            Free to start. <span className="accent">Cheaper</span> than one ID camp.
          </h2>
          <p className="lede pricing-sub pricing-sub-quote">
            Pro is <span className="serif accent">nineteen dollars a month.</span> Less than one ID camp lunch.
          </p>
        </div>

        <div className="pricing-grid" data-stagger="up">
          {tiers.map((t, i) => (
            <article key={i} className={`pricing-card pricing-${t.style} ${t.featured ? 'featured' : ''}`}>
              {t.featured && <div className="pricing-ribbon mono">MOST POPULAR</div>}
              <div className="pricing-head">
                <h3 className="serif pricing-name">{t.name}</h3>
                <p className="pricing-desc">{t.desc}</p>
              </div>
              <div className="pricing-price">
                <span className="serif pricing-num">{t.price}</span>
                <span className="pricing-period mono">{t.period}</span>
              </div>
              <ul className="pricing-features">
                {t.features.map((f, j) => (
                  <li key={j}>
                    <Icon name="check" size={14} stroke={t.featured ? 'var(--gold)' : 'var(--fg-1)'} />
                    {f}
                  </li>
                ))}
              </ul>
              <a href="#" className={`btn ${t.featured ? 'btn-primary' : 'btn-ghost'} pricing-cta`}>
                {t.cta}
                <Icon name="arrow" size={14} stroke={t.featured ? '#1a1304' : 'var(--fg-0)'} />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ==============================================================
   FINAL CTA + FOOTER
   ============================================================== */
const FinalCTA = () => (
  <section className="section final-cta-section">
    <div className="cta-video-wrap">
      <video
        className="cta-video"
        autoPlay loop muted playsInline
        src="assets/cta-tunnel.mp4"
      />
      <div className="cta-video-veil" />
    </div>
    <div className="halo" style={{ background: 'rgba(240,182,90,0.45)', width: 700, height: 700, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', filter: 'blur(80px)' }} />
    <div className="wrap final-cta-inner" data-reveal="rise">
      <span className="section-marker">Your move</span>
      <h2 className="h-display final-h" data-words>
        Get <span className="accent">recruited</span>.<br/>
        Not <span style={{ opacity: 0.55 }}>overlooked</span>.
      </h2>
      <p className="lede final-sub">
        2,500+ programs. 98.8% D1–NAIA coverage. Drafts, sends, and tracks every contact.
        Free to start, no credit card.
      </p>
      <div className="final-ctas">
        <a href="#" className="btn btn-primary btn-lg">
          Start for Free
          <Icon name="arrow" size={16} />
        </a>
        <a href="#how" className="btn btn-ghost btn-lg">Talk to a counselor</a>
      </div>
      <div className="final-trust mono">
        FREE · 3 EMAILS · 5 MATCHES · NO CARD
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="footer">
    <div className="wrap footer-inner">
      <div className="footer-brand">
        <a href="#" className="footer-logo-lockup" aria-label="KickrIQ">
          <KickrIQLogo height={44} />
        </a>
        <p className="footer-tag">The smartest way to get recruited. Built by former college players + AI engineers.</p>
        <div className="footer-trust">
          <span className="chip chip-ghost">2,500+ PROGRAMS</span>
          <span className="chip chip-ghost">98.8% COVERAGE</span>
        </div>
      </div>

      <div className="footer-cols">
        <div>
          <div className="footer-h mono">PRODUCT</div>
          <a href="#features">Features</a>
          <a href="#roster">Roster Intelligence</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div>
          <div className="footer-h mono">FOR</div>
          <a href="#">Athletes</a>
          <a href="/for-parents">Parents</a>
          <a href="#">Club coaches</a>
          <a href="#">College coaches</a>
        </div>
        <div>
          <div className="footer-h mono">DIVISIONS</div>
          <a href="#">D1 Programs</a>
          <a href="#">D2 Programs</a>
          <a href="#">D3 Programs</a>
          <a href="#">NAIA · JUCO</a>
        </div>
        <div>
          <div className="footer-h mono">COMPANY</div>
          <a href="#">About</a>
          <a href="#">Careers</a>
          <a href="#">Stories</a>
          <a href="#">Press</a>
        </div>
      </div>
    </div>
    <div className="wrap footer-bottom">
      <div className="mono">© 2026 KickrIQ Athletics, Inc.</div>
      <div className="footer-links mono">
        <a href="#">Privacy</a>
        <a href="#">Terms</a>
        <a href="#">Security</a>
      </div>
    </div>
  </footer>
);

/* ==============================================================
   ROOT APP
   ============================================================== */
const App = () => {
  return (
    <div className="page">
      <window.Navbar />
      <window.Hero />
      <window.ThreeUp />
      <window.RosterSpotlight />
      <window.CinematicBand />
      <window.HowItWorks />
      <window.FeatureGrid />
      <window.Divisions />
      <window.Parents />
      <Pricing />
      <FinalCTA />
      <Footer />
      <window.KickrTweaks />
    </div>
  );
};

window.Pricing = Pricing;
window.FinalCTA = FinalCTA;
window.Footer = Footer;
window.App = App;
