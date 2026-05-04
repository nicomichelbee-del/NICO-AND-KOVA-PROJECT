/* global React, Icon */
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

/* ==============================================================
   WHAT KICKRIQ DOES. three-up
   ============================================================== */
const ThreeUp = () => {
  const items = [
    {
      icon: 'target',
      tag: 'MATCHING',
      title: 'Smart School Matching',
      body: 'AI ranks every program by athletic fit, academic fit, and cost, so your shortlist is built on signal, not vibes.',
      visual: 'match',
      accent: 'gold',
    },
    {
      icon: 'roster',
      tag: 'OUR DIFFERENTIATOR',
      title: 'Roster Intelligence',
      body: 'See which programs have open spots at your position right now. We scrape and AI-enrich every coach + roster across 2,500+ schools.',
      visual: 'roster',
      accent: 'crimson',
      featured: true,
    },
    {
      icon: 'mail',
      tag: 'OUTREACH',
      title: 'Coach Outreach',
      body: 'AI drafts personalized emails sent from your own Gmail, with follow-up reminders and response tracking that actually works.',
      visual: 'mail',
      accent: 'pitch',
    },
  ];

  return (
    <section id="features" className="section threeup-section">
      <div className="wrap">
        <div className="section-head" data-reveal="up">
          <span className="section-marker">What KickrIQ does</span>
          <h2 className="h-section" data-words>
            A recruiting counselor in your pocket. <span className="accent">Always on</span>, never tired.
          </h2>
        </div>

        <div className="threeup-grid" data-stagger="up">
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
  );
};

const MatchVisual = () => (
  <div className="vis-match">
    {[
      { name: 'Stanford', code: 'STA', tier: 'D1', score: 96, top: true },
      { name: 'Wake Forest', code: 'WF', tier: 'D1', score: 91 },
      { name: 'Amherst', code: 'AMH', tier: 'D3', score: 88 },
    ].map((s, i) => (
      <div key={i} className={`match-row ${s.top ? 'top' : ''}`}>
        <div className="match-logo">{s.code.charAt(0)}</div>
        <div className="match-info">
          <div className="match-name">{s.name}</div>
          <div className="match-meta mono">{s.tier} · FIT {s.score}</div>
        </div>
        <div className="match-score">
          <span className="serif">{s.score}</span>
        </div>
      </div>
    ))}
  </div>
);

const RosterVisual = () => (
  <div className="vis-roster">
    <div className="vis-roster-header mono">
      <span><span className="live-dot" />LIVE OPENINGS · GK</span>
      <span>UPDATED 2h</span>
    </div>
    {[
      { school: 'University of Portland', tier: 'D1', open: 1, year: "'27" },
      { school: 'Grand Valley State', tier: 'D2', open: 2, year: "'26" },
      { school: 'Keiser University', tier: 'NAIA', open: 3, year: "'27" },
    ].map((r, i) => (
      <div key={i} className="roster-row">
        <div>
          <div className="roster-school">{r.school}</div>
          <div className="roster-meta mono">{r.tier} · CLASS OF {r.year}</div>
        </div>
        <div className="roster-open">
          <span className="open-num serif">{r.open}</span>
          <span className="open-lbl mono">OPEN</span>
        </div>
      </div>
    ))}
  </div>
);

const MailVisual = () => (
  <div className="vis-mail">
    <div className="mail-bar mono">
      <span className="mail-from">FROM: jordan@gmail.com</span>
      <span className="mail-status"><span className="live-dot" />SENT</span>
    </div>
    <div className="mail-preview">
      <div className="mail-line"><span className="mail-key mono">TO</span><span>Coach Mendez · Stanford W. Soccer</span></div>
      <div className="mail-line"><span className="mail-key mono">SUBJ</span><span>2027 GK · Highlight Tape & Visit</span></div>
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
);

/* ==============================================================
   ROSTER INTELLIGENCE. full bleed feature
   ============================================================== */
const RosterSpotlight = () => {
  const [position, setPosition] = useState('GK');
  const positions = ['GK', 'CB', 'FB', 'CM', 'WG', 'ST'];

  const data = {
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
  };

  const rows = data[position] || [];
  const totalOpen = rows.reduce((s, r) => s + r.open, 0);

  return (
    <section id="roster" className="section roster-spotlight">
      <div className="halo" style={{ background: 'rgba(227,90,90,0.18)', width: 500, height: 500, top: -120, left: -120 }} />
      <div className="halo" style={{ background: 'rgba(240,182,90,0.16)', width: 600, height: 600, bottom: -200, right: -150 }} />

      <div className="wrap roster-inner">
        <div className="roster-copy" data-reveal="left">
          <span className="section-marker">Roster Intelligence</span>
          <h2 className="h-section" data-words>
            Stop guessing.<br/>
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

        <div className="roster-device">
          <PhoneMock>
            <div className="phone-screen">
              <div className="phone-statbar mono">
                <span>9:41</span>
                <span className="phone-notch" />
                <span>●●●●  ▮</span>
              </div>
              <div className="phone-app-bar">
                <div>
                  <div className="phone-eyebrow mono"><span className="live-dot" />LIVE</div>
                  <div className="phone-title serif">Roster Openings</div>
                </div>
                <div className="phone-counter">
                  <span className="phone-counter-num serif">{totalOpen}</span>
                  <span className="phone-counter-lbl mono">OPEN</span>
                </div>
              </div>

              <div className="phone-tabs">
                {positions.map(p => (
                  <button
                    key={p}
                    className={`phone-tab ${position === p ? 'active' : ''}`}
                    onClick={() => setPosition(p)}
                  >{p}</button>
                ))}
              </div>

              <div className="phone-list">
                {rows.map((r, i) => (
                  <div key={`${position}-${i}`} className="phone-row" style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="phone-row-l">
                      <div className="phone-school">{r.school}</div>
                      <div className="phone-school-meta mono">{r.tier} · {r.conf} · {r.year}</div>
                      <div className="phone-reason">{r.reason}</div>
                    </div>
                    <div className="phone-row-r">
                      <div className="phone-open serif">{r.open}</div>
                      <div className="phone-open-lbl mono">OPEN</div>
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
  );
};

const PhoneMock = ({ children }) => (
  <div className="phone-frame">
    <div className="phone-glow" />
    <div className="phone-bezel">
      <div className="phone-side phone-side-l" />
      <div className="phone-side phone-side-r" />
      {children}
    </div>
  </div>
);

window.ThreeUp = ThreeUp;
window.RosterSpotlight = RosterSpotlight;
window.PhoneMock = PhoneMock;

/* ==============================================================
   CINEMATIC BAND. full-bleed video interstitial
   Sits between major sections as a moment of breath + atmosphere.
   ============================================================== */
const CinematicBand = () => (
  <section className="cinematic-band" aria-hidden="false">
    <div className="cb-video-wrap">
      <video
        className="cb-video"
        autoPlay loop muted playsInline
        src="video-roster.mp4"
      />
      <div className="cb-veil" />
      <div className="cb-grain" />
    </div>
    <div className="wrap cb-inner">
      <div className="cb-marker mono">
        <span className="cb-dot" />
        <span>Made by players · For players</span>
      </div>
      <h3 className="cb-quote serif" data-reveal="up">
        "We sent the cold emails. We went to the showcases.<br/>
        We built <span className="accent">the tool we wish we'd had</span>."
      </h3>
      <div className="cb-attrib mono">Nicolas &amp; Alexander, Co-founders</div>
    </div>
  </section>
);
window.CinematicBand = CinematicBand;
