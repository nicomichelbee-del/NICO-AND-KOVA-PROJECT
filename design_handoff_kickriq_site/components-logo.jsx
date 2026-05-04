/* ==============================================================
   KickrIQ Wordmark. HTML/CSS based for crisp text rendering.
   "Kickr" in fg, "iQ" in gold, with a pentagon dot replacing
   the i's tittle. Sized via the --logo-h CSS var.
   ============================================================== */
const KickrIQLogo = ({ className = '', height = 32 }) => (
  <span
    className={`kickriq-logo ${className}`}
    style={{ '--logo-h': `${height}px` }}
    aria-label="KickrIQ"
    role="img"
  >
    <span className="klogo-kickr">Kickr</span>
    <span className="klogo-iq">
      <span className="klogo-i">i</span>
      <span className="klogo-q">Q</span>
    </span>
  </span>
);

/* Icon-only "K" mark. favicons, app icons */
const KickrIQIcon = ({ size = 32, className = '' }) => (
  <span
    className={`kickriq-icon ${className}`}
    style={{ width: size, height: size, fontSize: size }}
    aria-label="KickrIQ"
    role="img"
  >
    <span className="kicon-tile">
      <span className="kicon-k">K</span>
      <span className="kicon-pent" aria-hidden="true" />
    </span>
  </span>
);

window.KickrIQLogo = KickrIQLogo;
window.KickrIQIcon = KickrIQIcon;
