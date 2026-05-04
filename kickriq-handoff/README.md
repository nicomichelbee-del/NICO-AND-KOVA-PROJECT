# KickrIQ Homepage — source handoff

Single React + Babel page. Open `index.html` to view, or feed individual files to your AI tooling.

## Files
- `index.html` — thin shell that loads everything
- `styles.css` — design tokens (colors, type, radius, shadow, container vars)
- `styles-logo.css` — brand logo
- `styles-sections.css` — per-section styling (hero, features, roster, how it works, divisions, parents, pricing, footer)
- `styles-motion.css` — reveal/scroll animations
- `styles-tweaks.css` — in-page tweaks panel (toggle off in production)
- `main.jsx` — React entry; renders the component tree into `#app`
- `motion.js` — IntersectionObserver-based reveal driver (looks for `[data-reveal]`)
- `components-logo.jsx` — brand mark + wordmark
- `components-hero.jsx` — nav + hero section
- `components-features.jsx` — feature grid + Roster Intelligence spotlight
- `components-mid.jsx` — How it works + Divisions
- `components-end.jsx` — Parents + Pricing + Final CTA + Footer
- `tweaks-panel.jsx` / `tweaks.jsx` — design-time tweaks UI (safe to delete for prod)

## Notes for porting to a real React/Next.js project
1. Each `components-*.jsx` file declares several components and ends with an `Object.assign(window, { ... })` line that publishes them globally. Replace with proper `export` statements when you migrate.
2. `main.jsx` mounts via `ReactDOM.createRoot(document.getElementById('app'))` — swap for your framework's mount.
3. Reveal animations: elements with `data-reveal="rise|fade|words"` are picked up by `motion.js`. Port to your motion lib (Framer Motion / GSAP) if preferred.
4. Two videos (`video-cta.mp4`, `video-roster.mp4`) are referenced but not bundled here — swap with your own footage or hosted URLs.
5. CSS uses custom properties from `styles.css` (`--gold`, `--bg-0`, `--serif`, etc.) — keep those intact.
6. Fonts: Fraunces (display serif), Geist (sans), Geist Mono. Loaded via Google Fonts link.

## What to ask Claude Code
> Read every file in this folder. Port the homepage into our existing Next.js project as a single `<Homepage />` route. Keep the design tokens from `styles.css` as CSS variables in our globals. Replace `window.…` exports with proper ES module exports. Convert `data-reveal` motion to Framer Motion.
