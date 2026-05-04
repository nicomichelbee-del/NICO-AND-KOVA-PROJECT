/* ==============================================================
   KickrIQ Dashboard — main React tree.
   Recreates the screenshot with heavy redesign of the "Today"
   module + ghost preview + stat-card variants exposed as Tweaks.
   ============================================================== */

const DAvatar = ({ initials = 'NM' }) => (
  <button className="dash-avatar" aria-label="Account">{initials}</button>
);

/* ------------------------------------------------------------
   Sidebar icons — inline SVGs, single-color via currentColor
   ------------------------------------------------------------ */
const DashIcon = ({ name, size = 18 }) => {
  const map = {
    overview: <g><rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/></g>,
    profile: <g><circle cx="12" cy="8.5" r="3.6"/><path d="M5 21c1-4.2 4.1-6.2 7-6.2s6 2 7 6.2"/></g>,
    timeline: <g><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/><path d="M7.6 12H10.4M13.6 12H16.4"/></g>,
    matches: <g><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16M7.5 6.5l9 11M16.5 6.5l-9 11"/></g>,
    mail: <g><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 6.5l8.5 6 8.5-6"/></g>,
    track: <g><path d="M4 18l5-5 4 4 7-9"/><path d="M14 8h6v6"/></g>,
    follow: <g><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3.5 2"/></g>,
    video: <g><rect x="3" y="6" width="14" height="12" rx="2"/><path d="M17 10l4-2v8l-4-2z"/></g>,
    camp: <g><path d="M12 3l9 16H3z"/><path d="M9 19l3-6 3 6"/></g>,
    bell: <g><path d="M6 16h12l-1.5-2V11a4.5 4.5 0 0 0-9 0v3z"/><path d="M10 19a2 2 0 0 0 4 0"/></g>,
    search: <g><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></g>,
    plus: <g><path d="M12 5v14M5 12h14"/></g>,
    arrow: <g><path d="M5 12h14M13 6l6 6-6 6"/></g>,
    signout: <g><path d="M16 17l5-5-5-5M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></g>,
    chat: <g><path d="M21 12.5C21 17.7 16.97 22 12 22c-1.3 0-2.5-.3-3.6-.8L3 22l1.2-4.7C3.43 15.95 3 14.27 3 12.5 3 7.3 7.03 3 12 3s9 4.3 9 9.5z"/></g>,
    flag: <g><path d="M5 21V4M5 14V4h11l-2 4 2 4H5"/></g>,
    star: <g><path d="M12 3l2.6 5.3 5.9.85-4.3 4.2 1 5.85L12 16.4l-5.2 2.8 1-5.85L3.5 9.15 9.4 8.3z"/></g>,
    schools: <g><path d="M3 10l9-5 9 5-9 5z"/><path d="M5 11.5V18l7 3 7-3v-6.5"/></g>,
    pen: <g><path d="M14 4l6 6-11 11H3v-6z"/><path d="M14 4l3-3 6 6-3 3"/></g>,
  };
  return (
    <svg className="dash-nav-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {map[name] || null}
    </svg>
  );
};

/* ------------------------------------------------------------
   Sidebar
   ------------------------------------------------------------ */
const Sidebar = ({ active = 'overview', onNav }) => {
  const items = [
    { id: 'overview', label: 'Overview', icon: 'overview' },
    { id: 'profile', label: 'My Profile', icon: 'profile' },
    { id: 'timeline', label: 'Timeline', icon: 'timeline' },
    { id: 'matches', label: 'School Matches', icon: 'schools' },
    { id: 'emails', label: 'Coach Emails', icon: 'mail' },
    { id: 'tracker', label: 'Outreach Tracker', icon: 'track', pro: true },
    { id: 'followup', label: 'Follow-up Assistant', icon: 'follow', pro: true },
    { id: 'video', label: 'Video Rater', icon: 'video', pro: true },
    { id: 'camps', label: 'ID Camps', icon: 'camp' },
  ];
  return (
    <aside className="dash-sidebar">
      <div className="dash-brand">
        <KickrIQLogo height={28} />
        <span className="dash-brand-tag">Recruiting · Counselor</span>
      </div>

      <span className="dash-section-label">Navigate</span>
      <nav className="dash-nav" aria-label="Main">
        {items.map(it => (
          <a
            key={it.id}
            href={`#${it.id}`}
            className={`dash-nav-item ${active === it.id ? 'is-active' : ''}`}
            onClick={(e) => { e.preventDefault(); onNav?.(it.id); }}
          >
            <DashIcon name={it.icon} />
            <span className="dash-nav-label">{it.label}</span>
            {it.pro && <span className="dash-pro-badge">Pro</span>}
          </a>
        ))}
      </nav>

      <div className="dash-side-footer">
        <div className="dash-signed-in">
          <span className="dash-signed-in-label">Signed in</span>
          <span className="dash-signed-in-email">nicomichelbee@gmail.com</span>
        </div>
        <span className="dash-plan-row">
          <span className="dash-plan-dot" />
          Free plan
        </span>
        <button className="dash-signout" type="button">
          <DashIcon name="signout" size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
};

/* ------------------------------------------------------------
   Top bar (eyebrow + greeting + meta)
   ------------------------------------------------------------ */
const formatToday = () => {
  const d = new Date();
  const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${day}, ${mon} ${d.getDate()}`;
};

const greetingFor = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good evening';
};

const TopBar = ({ name = 'Nicolas' }) => (
  <div className="dash-top">
    <div>
      <span className="dash-eyebrow">
        <span className="dash-eyebrow-dot" />
        Dashboard · {formatToday()}
      </span>
      <h1 className="dash-greet">
        {greetingFor()}, <span className="accent">{name}</span>.
      </h1>
      <p className="dash-greet-sub">
        Your recruiting day, on one page. Where you stand, what's next, and what's still waiting on you.
      </p>
    </div>
    <div className="dash-top-meta">
      <button className="dash-icon-btn" aria-label="Search">
        <DashIcon name="search" size={16} />
      </button>
      <button className="dash-icon-btn" aria-label="Notifications">
        <DashIcon name="bell" size={16} />
        <span className="badge-pip" />
      </button>
      <DAvatar initials="NM" />
    </div>
  </div>
);

/* ------------------------------------------------------------
   Stat cards — supports 4 variants via `variant` prop:
   numerical | progress | gauge | sparkline
   ------------------------------------------------------------ */
const Sparkline = ({ data = [], color = 'var(--gold)' }) => {
  if (data.length < 2) return null;
  const w = 120, h = 28, pad = 1;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = (max - min) || 1;
  const step = (w - pad * 2) / (data.length - 1);
  const points = data.map((v, i) => [pad + i * step, h - pad - ((v - min) / range) * (h - pad * 2)]);
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length-1][0].toFixed(1)} ${h} L ${points[0][0].toFixed(1)} ${h} Z`;
  return (
    <svg className="stat-sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="area" d={areaPath} />
      <path className="line" d={linePath} stroke={color} />
    </svg>
  );
};

const StatCard = ({ label, value, total, meta, color, variant = 'numerical', spark = [] }) => {
  const numClass = `stat-num${color ? ` stat-num--${color}` : ''}`;
  const pct = total ? Math.min(100, (value / total) * 100) : 0;

  return (
    <div className="stat-card">
      {variant === 'gauge' ? (
        <div className="stat-gauge" style={{ '--pct': pct }}>
          <span className="stat-gauge-text">{value}</span>
        </div>
      ) : (
        <span className={numClass}>
          {value}
          {total && variant === 'numerical' && (
            <span className="stat-num-of">/ {total}</span>
          )}
        </span>
      )}

      <span className="stat-label">{label}</span>

      {variant === 'numerical' && meta && (
        <span className="stat-meta">{meta}</span>
      )}
      {variant === 'progress' && (
        <>
          <span className="stat-meta">{value} of {total}</span>
          <div className="stat-progress">
            <div className="stat-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
      {variant === 'gauge' && (
        <span className="stat-meta">{Math.round(pct)}% used</span>
      )}
      {variant === 'sparkline' && (
        <>
          <span className="stat-meta">Last 7 days</span>
          <Sparkline data={spark} color={
            color === 'green' ? '#6fbf73' :
            color === 'coral' ? '#d97564' :
            'var(--gold)'
          } />
        </>
      )}
    </div>
  );
};

const StatRow = ({ variant = 'numerical' }) => (
  <div className="dash-stats">
    <StatCard
      label="School Matches"
      value={3}
      total={5}
      meta="of 5 free"
      color="gold"
      variant={variant}
      spark={[0, 0, 1, 1, 2, 3, 3]}
    />
    <StatCard
      label="Emails Generated"
      value={1}
      total={3}
      meta="of 3 free"
      color="gold"
      variant={variant}
      spark={[0, 0, 0, 1, 1, 1, 1]}
    />
    <StatCard
      label="Coaches Contacted"
      value={1}
      total={5}
      meta="across all divisions"
      color="green"
      variant={variant}
      spark={[0, 0, 0, 0, 1, 1, 1]}
    />
    <StatCard
      label="Responses"
      value={0}
      total={1}
      meta="opens · replies · visits"
      color="coral"
      variant={variant}
      spark={[0, 0, 0, 0, 0, 0, 0]}
    />
  </div>
);

/* ------------------------------------------------------------
   "Today" — heavy redesign
   - Progress strip (X of N steps complete + first-response deadline)
   - Active task card (now task w/ ghost preview of school chips)
   - Up next (2 cards)
   ------------------------------------------------------------ */
const TodayBlock = () => {
  const stepsTotal = 7;
  const stepsDone = 3;
  const pct = (stepsDone / stepsTotal) * 100;

  return (
    <section>
      <div className="dash-section-head">
        <span className="dash-section-eye"><span className="dash-section-eye-dot" />Today's plan</span>
        <h2 className="dash-section-h">
          One <span className="accent">focused</span> hour beats a busy week.
        </h2>
      </div>

      <div className="today-block">
        {/* Progress strip */}
        <div className="today-progress-card">
          <div className="today-progress-num">
            {stepsDone}<span> / {stepsTotal}</span>
          </div>
          <div>
            <p className="today-progress-label">Recruiting setup — {Math.round(pct)}% complete</p>
            <div className="today-progress-track">
              <div className="today-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="today-progress-deadline">
            <span className="today-progress-deadline-label">First reply window</span>
            <span className="today-progress-deadline-val">14 days</span>
          </div>
        </div>

        {/* Active task */}
        <article className="task-active" aria-labelledby="task-active-h">
          <div className="task-active-body">
            <div className="task-tag-row">
              <span className="task-tag task-tag--now">Now</span>
              <span className="task-step">Step 04 of 07</span>
            </div>
            <h3 id="task-active-h" className="task-h">
              Pick the <span className="accent">12 schools</span> you'll email this week.
            </h3>
            <p className="task-desc">
              We've matched you with 47 programs across D1, D2, D3, NAIA, and JUCO. Lock in a target list of 12 — a healthy mix of reach, target, and safety. Coaches notice focus.
            </p>
            <div className="task-meta-row">
              <span>~ 12 min</span>
              <span className="dot">·</span>
              <span>Unlocks Coach Emails</span>
              <span className="dot">·</span>
              <span>Save & continue later</span>
            </div>
            <div className="task-actions">
              <a href="#matches" className="btn btn-primary">
                Open School Matches
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </a>
              <button type="button" className="task-skip">Skip for today</button>
            </div>
          </div>

          <aside className="task-active-aside">
            <span className="task-aside-label">Top matches today</span>
            <div className="school-chips">
              <div className="school-chip">
                <span className="school-chip-mark" />
                Cal Poly SLO
                <span className="school-chip-tag match-strong">94% fit</span>
              </div>
              <div className="school-chip">
                <span className="school-chip-mark" />
                Loyola Marymount
                <span className="school-chip-tag match-strong">91% fit</span>
              </div>
              <div className="school-chip">
                <span className="school-chip-mark" />
                Pomona-Pitzer
                <span className="school-chip-tag match-mid">82% fit</span>
              </div>
              <div className="school-chip">
                <span className="school-chip-mark" />
                Chapman
                <span className="school-chip-tag match-mid">78% fit</span>
              </div>
            </div>
            <span className="task-aside-foot">+ 43 more matched</span>
          </aside>
        </article>

        {/* Up next */}
        <div className="task-upnext">
          <a href="#emails" className="task-card">
            <div className="task-card-head">
              <span>Step 05 · Up next</span>
              <span>~ 8 min</span>
            </div>
            <h4 className="task-card-h">Generate your first coach email.</h4>
            <p className="task-card-desc">
              We'll draft a personalized intro based on each coach's program — you approve before we send.
            </p>
            <div className="task-card-foot">
              <span className="task-card-time">3 free remaining</span>
              <span className="task-card-arrow">Start <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
            </div>
          </a>
          <a href="#video" className="task-card">
            <div className="task-card-head">
              <span>Step 06 · Up next</span>
              <span>~ 5 min</span>
            </div>
            <h4 className="task-card-h">Upload a 60-second highlight clip.</h4>
            <p className="task-card-desc">
              Coaches open profiles with video 4× more often. We'll rate yours and suggest cuts.
            </p>
            <div className="task-card-foot">
              <span className="task-card-time">Pro only</span>
              <span className="task-card-arrow">Preview <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------
   Activity stream + side cards
   ------------------------------------------------------------ */
const Activity = () => (
  <div className="activity">
    <div className="activity-head">
      <span>Recent activity</span>
      <a className="activity-head-link" href="#timeline">View timeline →</a>
    </div>
    <ul className="activity-list">
      <li className="activity-row">
        <span className="activity-icon"><DashIcon name="schools" size={14} /></span>
        <div>
          <div className="activity-title">5 free school matches loaded</div>
          <div className="activity-sub">Cal Poly SLO, Loyola Marymount, Pomona-Pitzer +2</div>
        </div>
        <span className="activity-time">12m ago</span>
      </li>
      <li className="activity-row">
        <span className="activity-icon"><DashIcon name="profile" size={14} /></span>
        <div>
          <div className="activity-title">Profile basics complete</div>
          <div className="activity-sub">Position, GPA, club team verified</div>
        </div>
        <span className="activity-time">1h ago</span>
      </li>
      <li className="activity-row">
        <span className="activity-icon"><DashIcon name="star" size={14} /></span>
        <div>
          <div className="activity-title">Account created</div>
          <div className="activity-sub">Welcome to KickrIQ — 3 free emails on the house</div>
        </div>
        <span className="activity-time">Today</span>
      </li>
    </ul>
  </div>
);

const Deadlines = () => (
  <div className="side-card">
    <span className="side-card-eye">Upcoming</span>
    <h3 className="side-card-h">Deadlines & camps</h3>
    <ul className="deadline-list">
      <li className="deadline-row">
        <span className="deadline-date">May<small>09</small></span>
        <div>
          <div className="deadline-title">UCLA ID Camp registration</div>
          <div className="deadline-sub">Closes 11:59 PM PT</div>
        </div>
        <span className="deadline-pill urgent">6 days</span>
      </li>
      <li className="deadline-row">
        <span className="deadline-date">May<small>18</small></span>
        <div>
          <div className="deadline-title">First contact window — D1</div>
          <div className="deadline-sub">NCAA quiet period ends</div>
        </div>
        <span className="deadline-pill soft">15 days</span>
      </li>
      <li className="deadline-row">
        <span className="deadline-date">Jun<small>01</small></span>
        <div>
          <div className="deadline-title">Cal Poly SLO summer prospect day</div>
          <div className="deadline-sub">San Luis Obispo, CA</div>
        </div>
        <span className="deadline-pill soft">29 days</span>
      </li>
    </ul>
  </div>
);

/* ------------------------------------------------------------
   Chat FAB
   ------------------------------------------------------------ */
const ChatFab = () => (
  <div className="chat-fab">
    <span className="chat-tooltip">Ask your counselor</span>
    <button className="chat-btn" aria-label="Open chat">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.5C21 17.7 16.97 22 12 22c-1.3 0-2.5-.3-3.6-.8L3 22l1.2-4.7C3.43 15.95 3 14.27 3 12.5 3 7.3 7.03 3 12 3s9 4.3 9 9.5z"/>
      </svg>
      <span className="chat-pip" />
    </button>
  </div>
);

/* ------------------------------------------------------------
   Tweaks (stat-card variant only, per user pick)
   ------------------------------------------------------------ */
const DASH_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "statVariant": "numerical"
}/*EDITMODE-END*/;

const DashTweaks = ({ tweaks, setTweak }) => {
  if (!window.TweaksPanel) return null;
  const { TweaksPanel, TweakSection, TweakRadio } = window;
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Stat cards">
        <TweakRadio
          label="Style"
          value={tweaks.statVariant}
          options={[
            { value: 'numerical', label: 'Numbers' },
            { value: 'progress', label: 'Progress' },
            { value: 'gauge', label: 'Gauge' },
            { value: 'sparkline', label: 'Sparkline' },
          ]}
          onChange={(v) => setTweak('statVariant', v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
};

/* ------------------------------------------------------------
   App shell
   ------------------------------------------------------------ */
const DashApp = () => {
  const [active, setActive] = React.useState('overview');
  const [tweaks, setTweaks] = window.useTweaks
    ? window.useTweaks(DASH_TWEAK_DEFAULTS)
    : [DASH_TWEAK_DEFAULTS, () => {}];
  const setTweak = (k, v) =>
    typeof k === 'object' ? setTweaks(k) : setTweaks({ [k]: v });

  const { AmbientBg, CoachTicker, KineticStats, OnTheClock, UpNextStack, HeatMap, SectionHead } = window;

  return (
    <div className="dash-app">
      {AmbientBg && <AmbientBg />}
      <Sidebar active={active} onNav={setActive} />
      <main className="dash-main">
        <TopBar name="Nicolas" />
        {CoachTicker && <CoachTicker />}
        {KineticStats && <KineticStats />}
        {SectionHead && (
          <SectionHead eyebrow="Today's plan" delay={580}>
            One <span className="accent">focused</span> hour beats a busy week.
          </SectionHead>
        )}
        {OnTheClock && <OnTheClock />}
        <div className="upnext-row">
          {UpNextStack && <UpNextStack />}
          {HeatMap && <HeatMap />}
        </div>
        <div className="dash-split">
          <Activity />
          <Deadlines />
        </div>
      </main>
      <ChatFab />
      <DashTweaks tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
};

window.DashApp = DashApp;
