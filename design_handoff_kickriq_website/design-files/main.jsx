/* global React, ReactDOM */

const __mount = () => {
  if (!window.App) { setTimeout(__mount, 30); return; }
  const el = document.getElementById('app');
  if (!el) { setTimeout(__mount, 30); return; }
  const root = ReactDOM.createRoot(el);
  root.render(<window.App />);
};
__mount();
