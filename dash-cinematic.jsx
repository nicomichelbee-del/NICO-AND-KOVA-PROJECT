/* ==============================================================
   KickrIQ Dashboard — CINEMATIC components.
   Replaces hero modules: ambient bg, ticker, on-the-clock task,
   kinetic stats, recruiting heatmap.
   ============================================================== */

/* ---------- Ambient background layer ---------- */
const AmbientBg = () => (
  <div className="dash-ambient" aria-hidden="true">
    <div className="grain" />
  </div>
);

/* ---------- Reveal-on-load helper ---------- */
const Reveal = ({ delay = 0, children, as: Tag = 'div', className = '', style = {}, ...rest }) => {
  // Pure CSS keyframe with per-instance delay — works even when iframe is
  // backgrounded (CSS animations don't depend on RAF the way transitions on
  // class-toggles do).
  return (
    <Tag
      className={`cine-reveal ${className}`}
      style={{ animationDelay: `${delay}ms`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
};

/* ---------- Live coach activity ticker ---------- */
const TICKER_ITEMS = [
  { who: 'Coach Murray',    verb: 'opened',     what: 'your profile',                when: '3m ago' },
  { who: 'Cal Poly SLO',    verb: 'matched',    what: 'with you · 94% fit',          when: '12m ago' },
  { who: 'Coach Velasquez', verb: 'replied to', what: 'your intro email',            when: '38m ago' },
  { who: 'Loyola Marymount',verb: 'viewed',     what: 'your highlight reel · 2x',    when: '1h ago' },
  { who: 'Coach Brennan',   verb: 'added',      what: 'you to a watch list',         when: '2h ago' },
  { who: 'Pomona-Pitzer',   verb: 'invited',    what: 'you to a prospect day',       when: '4h ago' },
  { who: 'Coach Doyle',     verb: 'replied to', what: 'your intro email',            when: '6h ago' },
  { who: 'Chapman',         verb: 'viewed',     what: 'your transcript',             when: '8h ago' },
];

const CoachTicker = () => {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS]; // duplicate for seamless loop
  return (
    <Reveal className="coach-ticker" delay={120}>
      <span className="coach-ticker-tag">
        <span className="coach-ticker-pulse" />
        Live
      </span>
      <div className="coach-ticker-rail">
        <div className="coach-ticker-track">
          {items.map((it, i) => (
            <span className="coach-ticker-item" key={i}>
              <span className="who">{it.who}</span>
              <span className="verb">{it.verb}</span>
              <span>{it.what}</span>
              <span className="when">{it.when}</span>
            </span>
          ))}
        </div>
      </div>
    </Reveal>
  );
};

/* ---------- Count-up number ---------- */
/* Animates if the page is visible. If the iframe is backgrounded (RAF
   throttled), shows the final value via a setTimeout fallback so it never
   gets stuck at 0. */
const useCountUp = (target, { duration = 1100, delay = 0 } = {}) => {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    let raf, start, fallback;
    const startTimer = setTimeout(() => {
      // Fallback: if RAF hasn't progressed in 200ms past delay, snap to target.
      fallback = setTimeout(() => setVal(target), 200);
      const step = (ts) => {
        if (start === undefined) start = ts;
        const p = Math.min(1, (ts - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(target * eased));
        if (p < 1) raf = requestAnimationFrame(step);
        else clearTimeout(fallback);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(fallback);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);
  return val;
};

/* ---------- Sparkline (cinematic) ---------- */
const KSpark = ({ data, color = '#f0b65a', delay = 0 }) => {
  if (!data || data.length < 2) return null;
  const w = 200, h = 30, pad = 2;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = (max - min) || 1;
  const step = (w - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => [pad + i * step, h - pad - ((v - min) / range) * (h - pad * 2)]);
  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length-1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  const last = pts[pts.length - 1];
  const gradId = `ksg-${color.replace('#','')}`;
  return (
    <svg className="kstat-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ '--draw-delay': `${delay}ms` }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="area" d={areaPath} fill={`url(#${gradId})`} />
      <path className="line" d={linePath} stroke={color} />
      <circle className="dot" cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  );
};

/* ---------- Kinetic stat tile ---------- */
const KStat = ({ label, value, total, color, spark, trend, foot, accent, delay = 0, zeroPulse }) => {
  const counted = useCountUp(value, { delay: delay + 120, duration: 900 });
  return (
    <Reveal className={`kstat ${accent ? 'kstat--accent' : ''}`} delay={delay}>
      <div className="kstat-head">
        <span className="kstat-label">{label}</span>
        {trend && (
          <span className={`kstat-trend ${trend.kind === 'flat' ? 'is-flat' : ''} ${trend.kind === 'zero' ? 'is-zero' : ''}`}>
            {trend.symbol} {trend.text}
          </span>
        )}
      </div>
      <div>
        <span className={`kstat-num kstat-num--${color}`}>{counted}</span>
        {total !== undefined && <span className="kstat-of">/ {total}</span>}
      </div>
      {zeroPulse ? (
        <div className="kstat-pulse">
          <span className="kstat-pulse-dot" />
          Awaiting first reply
        </div>
      ) : (
        spark && <KSpark data={spark} color={
          color === 'green' ? '#7fb685' :
          color === 'coral' ? '#d97564' :
          '#f0b65a'
        } delay={delay + 280} />
      )}
      {foot && <div className="kstat-foot">{foot}</div>}
    </Reveal>
  );
};

const KineticStats = () => (
  <div className="kstats">
    <KStat
      label="School matches"
      value={3} total={5} color="gold" accent
      spark={[0, 0, 1, 1, 2, 3, 3]}
      trend={{ symbol: '↑', text: '+2 this week' }}
      foot="Of 5 free"
      delay={200}
    />
    <KStat
      label="Emails generated"
      value={1} total={3} color="gold"
      spark={[0, 0, 0, 1, 1, 1, 1]}
      trend={{ symbol: '↑', text: '+1 today' }}
      foot="Of 3 free"
      delay={300}
    />
    <KStat
      label="Coaches contacted"
      value={1} total={5} color="green"
      spark={[0, 0, 0, 0, 1, 1, 1]}
      trend={{ symbol: '↑', text: 'first contact' }}
      foot="Across all divisions"
      delay={400}
    />
    <KStat
      label="Responses"
      value={0} total={1} color="coral"
      trend={{ symbol: '○', text: 'waiting', kind: 'zero' }}
      foot="Opens · Replies · Visits"
      zeroPulse
      delay={500}
    />
  </div>
);

/* ---------- Countdown ring (visualizes 14-day window) ---------- */
const CountdownRing = ({ daysLeft = 14, daysTotal = 14 }) => {
  const r = 86;
  const c = 2 * Math.PI * r;
  const pct = daysLeft / daysTotal;
  const offset = c * (1 - pct);
  // Tick marks every day
  const ticks = Array.from({ length: daysTotal }, (_, i) => {
    const angle = (i / daysTotal) * Math.PI * 2 - Math.PI / 2;
    const r1 = r + 9, r2 = r + 14;
    const x1 = 100 + Math.cos(angle) * r1;
    const y1 = 100 + Math.sin(angle) * r1;
    const x2 = 100 + Math.cos(angle) * r2;
    const y2 = 100 + Math.sin(angle) * r2;
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="ring-tick" />;
  });
  return (
    <div className="otc-clock" aria-label={`${daysLeft} days remaining`}>
      <svg viewBox="0 0 200 200">
        <g style={{ transform: 'rotate(90deg)', transformOrigin: '100px 100px' }}>{ticks}</g>
        <circle cx="100" cy="100" r={r} className="ring-bg" />
        <circle
          cx="100" cy="100" r={r}
          className="ring-fg"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="otc-clock-center">
        <span className="otc-clock-num">{daysLeft}</span>
        <span className="otc-clock-unit">Days</span>
        <span className="otc-clock-sub">First reply window</span>
      </div>
    </div>
  );
};

/* ---------- On-the-clock hero task ---------- */
const OnTheClock = () => {
  const chips = [
    { name: 'Cal Poly SLO',     div: 'D1 · Big West',    fit: '94%', cls: '' },
    { name: 'Loyola Marymount', div: 'D1 · WCC',         fit: '91%', cls: '' },
    { name: 'Pomona-Pitzer',    div: 'D3 · SCIAC',       fit: '82%', cls: 'is-mid' },
    { name: 'Chapman',          div: 'D3 · SCIAC',       fit: '78%', cls: 'is-mid' },
  ];
  return (
    <Reveal as="article" className="otc" delay={650} aria-labelledby="otc-h">
      <div className="otc-grid">
        <div>
          <div className="otc-tag-row">
            <span className="otc-tag">On the clock</span>
            <span className="otc-step">Step 04 of 07 · Recruiting setup</span>
          </div>
          <h2 id="otc-h" className="otc-h">
            Pick the <span className="accent">12 schools</span> you'll email this week.
          </h2>
          <p className="otc-desc">
            We've matched you with 47 programs across D1, D2, D3, NAIA, and JUCO. Lock in a target list of 12 — a healthy mix of reach, target, and safety. Coaches notice focus.
          </p>
          <div className="otc-meta">
            <span>~ 12 min</span>
            <span className="dot">·</span>
            <span className="strong">Unlocks coach emails</span>
            <span className="dot">·</span>
            <span>Save & continue later</span>
          </div>
          <div className="otc-actions">
            <a href="#matches" className="btn btn-primary">
              Open School Matches
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </a>
            <button type="button" className="otc-skip">Skip for today</button>
          </div>
        </div>
        <CountdownRing daysLeft={14} daysTotal={14} />
      </div>

      <div className="otc-chips">
        <div className="otc-chips-head">
          <span className="otc-chips-label">Your top matches today</span>
          <a href="#matches" className="otc-chips-link">All 47 →</a>
        </div>
        <div className="otc-chips-row">
          {chips.map((c, i) => (
            <div className="otc-chip" key={c.name} style={{ '--chip-delay': `${950 + i * 110}ms` }}>
              <span className="otc-chip-name">{c.name}</span>
              <span className="otc-chip-meta">
                <span>{c.div}</span>
                <span className={`otc-chip-fit ${c.cls}`}>{c.fit}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
};

/* ---------- Up next stack ---------- */
const UpNextStack = () => (
  <Reveal className="upnext-stack" delay={780}>
    <a href="#emails" className="upnext-card">
      <div className="upnext-head">
        <span>Step 05 · Up next</span>
        <span>~ 8 min</span>
      </div>
      <h4 className="upnext-h">Generate your first coach email.</h4>
      <p className="upnext-desc">
        We'll draft a personalized intro based on each coach's program — you approve before we send.
      </p>
      <div className="upnext-foot">
        <span className="upnext-tag">3 free remaining</span>
        <span className="upnext-arrow">
          Start
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </span>
      </div>
    </a>
    <a href="#video" className="upnext-card">
      <div className="upnext-head">
        <span>Step 06 · Up next</span>
        <span>~ 5 min</span>
      </div>
      <h4 className="upnext-h">Upload a 60-second highlight clip.</h4>
      <p className="upnext-desc">
        Coaches open profiles with video 4× more often. We'll rate yours and suggest cuts.
      </p>
      <div className="upnext-foot">
        <span className="upnext-tag is-pro">Pro only</span>
        <span className="upnext-arrow">
          Preview
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </span>
      </div>
    </a>
  </Reveal>
);

/* ---------- Recruiting heatmap (signature element) ---------- */
const HeatMap = () => {
  // 4 rows × 7 days. Last 3 days are 'future' for some rows.
  // Levels 0-4. Each row represents a metric.
  const rows = [
    { label: 'Profile',  data: [4, 3, 2, 1, 2, 3, 0] },
    { label: 'Matches',  data: [0, 1, 1, 2, 3, 4, 0] },
    { label: 'Emails',   data: [0, 0, 1, 0, 1, 1, 0] },
    { label: 'Replies',  data: [0, 0, 0, 0, 0, 0, 0] },
  ];
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  // Today is Saturday in this mock — last column index 6 is "today"
  let cellIdx = 0;
  return (
    <Reveal className="heatmap" delay={780}>
      <div className="heatmap-head">
        <div>
          <span className="heatmap-eye">This week</span>
          <h3 className="heatmap-h">Recruiting <em style={{ color: 'var(--gold)', fontStyle: 'italic', fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 144' }}>heat</em>.</h3>
          <p className="heatmap-sub">Daily activity across profile, matches, emails, replies.</p>
        </div>
        <div className="heatmap-streak">
          <div className="heatmap-streak-num">3</div>
          <div className="heatmap-streak-label">Day streak</div>
        </div>
      </div>

      <div className="heatmap-grid">
        {rows.map((row) => (
          <React.Fragment key={row.label}>
            <span className="heatmap-row-label">{row.label}</span>
            {row.data.map((lvl, i) => {
              const future = i === 6 && row.label !== 'Profile' ? 0 : 0;
              const delay = (cellIdx++) * 28 + 900;
              return (
                <div
                  key={`${row.label}-${i}`}
                  className="heatmap-cell"
                  data-level={lvl}
                  data-future={future}
                  style={{ '--cell-delay': `${delay}ms` }}
                  title={`${row.label} · ${days[i]} · level ${lvl}`}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div className="heatmap-days">
        <span />
        {days.map((d, i) => <span key={d} style={{ color: i === 6 ? 'var(--gold)' : undefined }}>{d}</span>)}
      </div>

      <div className="heatmap-legend">
        <span>Less</span>
        <span className="heatmap-legend-scale">
          <i /><i /><i /><i /><i />
        </span>
        <span>More</span>
        <span style={{ marginLeft: 'auto', color: 'var(--gold)' }}>● Today</span>
      </div>
    </Reveal>
  );
};

/* ---------- Section header for the hero band ---------- */
const SectionHead = ({ eyebrow, children, delay = 600 }) => (
  <Reveal className="dash-section-head" delay={delay}>
    <span className="dash-section-eye">
      <span className="dash-section-eye-dot" />
      {eyebrow}
    </span>
    <h2 className="dash-section-h">{children}</h2>
  </Reveal>
);

Object.assign(window, {
  AmbientBg, Reveal, CoachTicker, KineticStats, OnTheClock,
  UpNextStack, HeatMap, SectionHead, useCountUp,
});
