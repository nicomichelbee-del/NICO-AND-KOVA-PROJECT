/* global React, Icon */

/* ==============================================================
   HOW IT WORKS. 4 numbered steps
   ============================================================== */
const HowItWorks = () => {
  const steps = [
    {
      n: '01',
      title: 'Build your profile',
      body: 'Position, class year, club, GPA, highlight tape. Takes 6 minutes. most of it pulled in automatically.',
      pill: 'PROFILE',
    },
    {
      n: '02',
      title: 'Match with schools',
      body: 'AI scores every program on athletic, academic, and cost fit. You get a ranked shortlist, not a 600-school dump.',
      pill: 'MATCH',
    },
    {
      n: '03',
      title: 'Email coaches',
      body: 'Personalized drafts sent from your own Gmail. Each one references the coach\'s system, season, and your fit.',
      pill: 'OUTREACH',
    },
    {
      n: '04',
      title: 'Track responses',
      body: 'Opens, replies, follow-ups, visits. Every coach conversation in one timeline you can actually act on.',
      pill: 'TRACK',
    },
  ];

  return (
    <section id="how" className="section how-section">
      <div className="wrap">
        <div className="section-head" data-reveal="up">
          <span className="section-marker">How it works</span>
          <h2 className="h-section" data-words>
            Four steps from <span className="accent">unknown</span> to recruited.
          </h2>
        </div>

        <div className="how-grid" data-stagger="up">
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
  );
};

/* ==============================================================
   FEATURE GRID. 6 cards
   ============================================================== */
const FeatureGrid = () => {
  const features = [
    { icon: 'video',    title: 'Highlight Video Rater', body: 'AI scores your tape on technique, decision-making, and athleticism. and tells you the clips to cut.', tag: 'AI' },
    { icon: 'track',    title: 'Outreach Tracker',      body: 'Every email, every open, every reply. One timeline per coach, automatic.', tag: 'CRM' },
    { icon: 'follow',   title: 'Follow-up Assistant',   body: 'AI nudges you exactly when to follow up. not too eager, not forgotten.', tag: 'AI' },
    { icon: 'camp',     title: 'ID Camps',              body: 'Find ID camps where the coaches you\'re emailing will actually be on the touchline.', tag: 'EVENTS' },
    { icon: 'timeline', title: 'Recruitment Timeline',  body: 'A monthly playbook tuned to your class year and division target.', tag: 'PLAN' },
    { icon: 'profile',  title: 'Public Player Profile', body: 'A shareable link with stats, video, transcripts, and a coach quote. built for the inbox.', tag: 'SHARE' },
  ];

  return (
    <section className="section feature-grid-section">
      <div className="wrap">
        <div className="section-head" data-reveal="up">
          <span className="section-marker">Built into the platform</span>
          <h2 className="h-section" data-words>
            Every tool a recruit needs. <span className="accent">none</span> of the busywork.
          </h2>
        </div>

        <div className="feature-grid" data-stagger="up">
          {features.map((f, i) => (
            <article className="feature-card" key={i}>
              <div className="feature-icon"><Icon name={f.icon} size={22} stroke="var(--gold)" /></div>
              <span className="chip chip-ghost feature-tag">{f.tag}</span>
              <h3 className="h-card feature-title">{f.title}</h3>
              <p className="feature-body">{f.body}</p>
              <div className="feature-arrow">
                <Icon name="arrow" size={16} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ==============================================================
   DIVISIONS. D1 D2 D3 NAIA JUCO
   ============================================================== */
const Divisions = () => {
  const divs = [
    { code: 'D1',   programs: 207, scholarships: 'Full athletic',    color: 'gold',    desc: 'Top of the pyramid. Athletic scholarships, big stages.' },
    { code: 'D2',   programs: 215, scholarships: 'Partial athletic', color: 'crimson', desc: 'Hidden value. Strong soccer, real scholarship money.' },
    { code: 'D3',   programs: 415, scholarships: 'Academic aid',     color: 'pitch',   desc: 'Best academics in college soccer. Aid is academic, not athletic.' },
    { code: 'NAIA', programs: 192, scholarships: 'Athletic',         color: 'gold',    desc: 'Smaller schools, real funding, faster recruiting cycles.' },
    { code: 'JUCO', programs: 175, scholarships: 'Athletic', color: 'crimson', desc: 'Two-year springboard. Game time fast, transfer pipelines proven.' },
  ];

  return (
    <section className="section divisions-section">
      <div className="wrap">
        <div className="div-grid">
          <div className="div-copy" data-reveal="left">
            <span className="section-marker">Built for every division</span>
            <h2 className="h-section" data-words>
              98.8% coverage.<br/>
              Every <span className="accent">level</span> of the game.
            </h2>
            <p className="lede">
              KickrIQ doesn't push you toward D1 because the website does. We rank by fit , 
              and most great college soccer careers happen below the D1 line.
            </p>
            <div className="div-stat-big">
              <span className="serif div-stat-num">98.8%</span>
              <span className="div-stat-lbl">D1–NAIA program coverage. JUCO and emerging programs added monthly.</span>
            </div>
          </div>

          <div className="div-cards" data-stagger="up">
            {divs.map((d, i) => (
              <div className={`div-card div-${d.color}`} key={i}>
                <div className="div-code serif">{d.code}</div>
                <div className="div-info">
                  <div className="div-meta mono">
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
  );
};

/* ==============================================================
   PARENTS CALLOUT
   ============================================================== */
const Parents = () => (
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
            The Family tier gives parents a quiet dashboard. every email sent, every coach
            response, every visit booked. No nagging. No surprises. The whole recruiting
            cycle, finally on one page.
          </p>
          <div className="parents-ctas">
            <a href="#" className="btn btn-primary">
              See the Family tier
              <Icon name="arrow" size={16} />
            </a>
            <a href="/for-parents" className="btn btn-link">How it works for parents →</a>
          </div>
        </div>

        <div className="parents-visual">
          <div className="parents-mock">
            <div className="parents-mock-head">
              <div>
                <div className="parents-mock-eyebrow mono">FAMILY DASHBOARD · MARCH</div>
                <div className="parents-mock-title serif">Jordan's recruiting · this week</div>
              </div>
              <span className="chip">QUIET MODE</span>
            </div>
            <div className="parents-rows">
              <div className="parents-row">
                <span className="parents-dot dot-on" />
                <div className="parents-row-body">
                  <div className="parents-row-t">Coach Mendez · Stanford</div>
                  <div className="parents-row-s mono">REPLIED · TUE 4:12pm</div>
                </div>
                <span className="chip chip-pitch">REPLY</span>
              </div>
              <div className="parents-row">
                <span className="parents-dot dot-on" />
                <div className="parents-row-body">
                  <div className="parents-row-t">Coach Patel · UNC Chapel Hill</div>
                  <div className="parents-row-s mono">OPENED 3× · WED 9:02am</div>
                </div>
                <span className="chip">OPENED</span>
              </div>
              <div className="parents-row">
                <span className="parents-dot dot-on" />
                <div className="parents-row-body">
                  <div className="parents-row-t">ID Camp · Wake Forest</div>
                  <div className="parents-row-s mono">BOOKED · APR 12</div>
                </div>
                <span className="chip chip-crimson">CAMP</span>
              </div>
            </div>
            <div className="parents-summary mono">
              7 emails sent · 4 opened · 2 replies · 1 visit booked
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

window.HowItWorks = HowItWorks;
window.FeatureGrid = FeatureGrid;
window.Divisions = Divisions;
window.Parents = Parents;
