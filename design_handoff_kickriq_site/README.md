# Handoff: KickrIQ Marketing Site

## Overview
This bundle contains the new KickrIQ marketing site — a homepage and About page — designed to replace the existing site. The product is an AI-powered college soccer recruiting tool: athletes get matched with college programs, draft personalized coach emails, and track every response.

## About the Design Files
The files in this bundle are **design references created in HTML** — high-fidelity prototypes showing intended look, copy, and behavior. They are not production code to ship as-is.

The task is to **recreate these designs in the target codebase's existing environment** (Next.js, Astro, Remix, etc.), using its established patterns, component conventions, and routing. If the project does not yet have a frontend stack, **Next.js 14 with the App Router** is the recommended choice — it cleanly maps to the multi-page structure and supports the `<video>` backgrounds, font loading, and static image assets used here.

The HTML files use React + Babel loaded inline via `<script>` tags for fast iteration; production code should compile JSX ahead of time and avoid the inline Babel transformer.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, copy, and interactions. Recreate pixel-perfectly; do not substitute the design system.

## Routes
| Path | File | Purpose |
|---|---|---|
| `/` | `KickrIQ Homepage.html` | Marketing homepage. Hero, feature grid, roster intelligence spotlight, how-it-works, pricing, parents block, final CTA, footer. |
| `/about` | `About.html` | Founders' story. Masthead, "the why" prose, stats strip, six principles, six-event timeline, two-founder team grid, pullquote, CTA. |

The current homepage links to `About.html`; in production this should be `/about`. Update the navbar's `About us` link in `components-hero.jsx` (line ~58) and all `KickrIQ Homepage.html` references in `About.html` to use clean route paths (`/`, `/about`).

## Design Tokens

All tokens live in `styles.css` under `:root`. Lift these directly into your CSS variables, Tailwind theme, or design-token system.

### Colors
| Token | Value | Use |
|---|---|---|
| `--bg-0` | `#221913` | Page base (warm cocoa) |
| `--bg-1` | `#2a1f17` | Section base |
| `--bg-2` | `#34271c` | Surface raised |
| `--bg-3` | `#422f21` | Surface hover / inner card |
| `--bg-warm` | `#2c2014` | Warmest atmospheric (timeline section) |
| `--fg-0` | `#f6efde` | Primary text (warm off-white) |
| `--fg-1` | `#e0d4ba` | Secondary text |
| `--fg-2` | `#b0a182` | Muted / eyebrow |
| `--fg-3` | `#7d7058` | Hint |
| `--line-1` | `rgba(246, 220, 168, 0.09)` | Subtle border |
| `--line-2` | `rgba(246, 220, 168, 0.16)` | Border |
| `--line-3` | `rgba(246, 220, 168, 0.24)` | Strong border |
| `--gold` | `#f0b65a` | Primary accent (gameday gold) |
| `--gold-2` | `#e0982e` | Gold mid |
| `--gold-3` | `#c47a16` | Gold deep |
| `--pitch` | `#2f7d4f` | Secondary accent (pitch green) |
| `--pitch-2` | `#4ea36e` | |
| `--crimson` | `#c94545` | Tertiary accent |
| `--crimson-2` | `#e35a5a` | Live dot |

### Typography
Three families, loaded from Google Fonts:
- **Serif (display + editorial):** `Fraunces` — variable axes `opsz` 9–144, `wght` 300–700, `SOFT` 0–100, `WONK` 0–1. Italic + WONK is used for the gold accent words.
- **Sans (body + UI):** `Geist` — 300/400/500/600/700.
- **Mono (eyebrows, tags, micro labels):** `Geist Mono` — 400/500.

Type scale (from `styles.css`):
- `.h-display` — Fraunces 400, `clamp(44px, 8.4vw, 116px)`, line-height 0.94, letter-spacing -0.035em
- `.h-section` — Fraunces 400, `clamp(34px, 5.2vw, 68px)`, line-height 1.0, letter-spacing -0.028em
- `.h-card` — Fraunces 500, `clamp(22px, 2.4vw, 28px)`, line-height 1.1
- `.lede` — Geist 400, `clamp(16px, 1.5vw, 19px)`, line-height 1.55
- `.eyebrow` / `.section-marker` / mono labels — Geist Mono 500, 11–11.5px, `letter-spacing: 0.18em`, uppercase, gold

### Spacing & radius
- Containers: `--max-w: 1240px`, `--gutter: clamp(20px, 4vw, 40px)`
- Radii: `--r-sm: 6px`, `--r-md: 10px`, `--r-lg: 16px`, `--r-xl: 24px`
- Section padding: `clamp(80px, 11vw, 140px) 0` (default), tight variant `clamp(60px, 8vw, 100px) 0`

### Shadows
- `--shadow-sm: 0 1px 2px rgba(0,0,0,0.4)`
- `--shadow-md: 0 8px 24px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.3)`
- `--shadow-lg: 0 24px 60px rgba(0,0,0,0.5), 0 8px 18px rgba(0,0,0,0.35)`
- `--shadow-glow: 0 0 0 1px rgba(240,182,90,0.35), 0 12px 40px rgba(240,182,90,0.25)`

## Homepage Structure (`KickrIQ Homepage.html`)

Top to bottom, mounted by `App` in `components-end.jsx`:

1. **Navbar** (`components-hero.jsx` → `Navbar`) — fixed, glass blur, pill-shaped link group. Links: Features, Roster Intelligence, How it works, Pricing, For Parents, About us. Right side: "Sign in" text link + gold "Start Free" pill button.
2. **Hero** (`components-hero.jsx` → `Hero`) — full-bleed `assets/hero-stadium.mp4` background at 0.75x playback, warm radial veil. Editorial italic kicker rotates through "recruited / noticed / seen / signed", H1 rotates through "smartest / quickest / sharpest / boldest". Two CTAs (gold primary + ghost). Trust strip: "2,500+ programs · 98.8% D1–NAIA coverage · Free to start". Optional broadcast-style ticker is gated behind `window.__kickrTweaks?.showTicker`.
3. **ThreeUp** (`components-features.jsx`) — three-column intro tiles.
4. **RosterSpotlight** (`components-features.jsx`) — feature spotlight using `assets/video-roster.mp4` (note: the source file lives at the root as `video-roster.mp4`; if missing in this bundle, regenerate or omit).
5. **CinematicBand** (`components-mid.jsx`) — full-width visual band.
6. **HowItWorks** (`components-mid.jsx`) — numbered steps.
7. **FeatureGrid** (`components-features.jsx`) — primary feature grid (icons + cards).
8. **Divisions** (`components-mid.jsx`) — D1 / D2 / D3 / NAIA / JUCO coverage block.
9. **Parents** (`components-mid.jsx`) — parent-focused section anchored at `#parents`.
10. **Pricing** (`components-end.jsx`) — three tiers: Free ($0), Pro ($19/mo, featured), Family ($29/mo).
11. **FinalCTA** (`components-end.jsx`) — full-bleed `assets/cta-tunnel.mp4` background, big serif headline, two CTAs.
12. **Footer** (`components-end.jsx`) — brand block + four columns (Product, For, Divisions, Company) + bottom bar.

### Tweaks panel
`tweaks-panel.jsx` + `tweaks.jsx` implement a floating "Tweaks" panel that lets a user toggle small variations live (e.g. the broadcast ticker, copy variants). This is a design tool, not a production feature — **do not ship the Tweaks panel**. Strip the `<window.KickrTweaks />` mount and the `tweaks*.jsx` script tags from production.

## About Page Structure (`About.html`)

Self-contained — defines its own `App` inline at the bottom of the file. Reuses `components-logo.jsx` (for `KickrIQLogo`) and `components-hero.jsx` (for the `Icon` component only — the about page declares its own Navbar). Top to bottom:

1. **AboutNav** — same visual chrome as homepage navbar, but links back to homepage anchors. "About us" link is highlighted gold.
2. **Masthead** — eyebrow rule + "About · Vol. 01 · Filed from the sideline". Two-column grid: H1 ("Built by two players who just went through it") on the left, italic deck quote + byline (Founded · 2026 · Bay Area, CA / Founders / Stage) on the right.
3. **TheWhy** — sticky "The why" marker on the left, three-paragraph editorial prose on the right with a Fraunces gold drop-cap on the first paragraph. Tells the founder story.
4. **StatsStrip** — four-cell strip with thin dividers: 2,500+ programs · 98.8% D1–NAIA coverage · 11× avg response lift · $0 to start. Each cell has a gold serif numeral, mono label, and a one-line foot.
5. **Principles** — six numbered principles in a 3-column grid (Athletes first, No pay-to-play, Private by default, Honest about AI, Cheaper than one camp, Coach time is sacred).
6. **Timeline** — six events on a vertical gold rail with glowing dots:
   - SOPH YR — The first spreadsheet.
   - SOPH–JR YR — The unanswered emails.
   - WINTER 2025 — Two commits, one realization.
   - JAN 2026 — First prototype.
   - FEB 2026 — KickrIQ becomes a product.
   - NOW — You're reading this.
7. **Team** — two founder cards (Nicolas Bee · Pomona-Pitzer commit, Alexander Kovalenko · Johns Hopkins commit) with 4:5 portrait photos and school tags overlaid bottom-left.
8. **PullQuote** — large serif italic quote attributed to both founders.
9. **AboutCTA** — radial gold halo, "Ready when you are." headline, two CTAs.
10. **AboutFooter** — same as homepage footer but with the "About" link highlighted gold.

## Components & Files

### Logo (`components-logo.jsx`)
- `KickrIQLogo({ height })` — wordmark. "Kickr" in foreground, "iQ" in gold, with a pentagon dot replacing the i's tittle. Sized via `--logo-h` CSS var. Use throughout — navbar (height 32), footer (height 44).
- `KickrIQIcon({ size })` — square "K" mark for favicons / app icons.
- Styles in `styles-logo.css`.

### Icon set (`components-hero.jsx` → `Icon`)
Single `<Icon name="..." size={n} />` component. Stroke-based, viewBox 24, strokeWidth 1.6. Names: target, roster, mail, video, track, follow, camp, timeline, profile, arrow, check, spark, ball, menu, close, play, shield, sparkles. Re-implement as a typed `Icon` component or replace with your icon library — but match the line weight and stroke endpoint style.

### Buttons (`styles.css` → `.btn` / `.btn-primary` / `.btn-ghost`)
- Pill shape (`border-radius: 999px`), 14px/22px padding, 15px Geist 600.
- **Primary:** gold gradient (`#f5c170 → #e0982e`), dark text, animated shine sweep on hover, lifts -2px and gains an amber halo.
- **Ghost:** translucent ivory, blurs the background. On hover gains an ivory border and amber halo.
- `.btn-lg` is the larger variant used in heroes and CTAs.
- The `::before` pseudo-element runs the shine sweep on hover; respect `prefers-reduced-motion`.

### Cards, chips, stats
- `.card` — gradient surface, soft amber radial wash on the top-left, lifts on hover.
- `.chip` — borderless mono caps with a 5px gold dot; variants `.chip-pitch` / `.chip-crimson` / `.chip-ghost`.
- `.stat-num` / `.stat-label` — serif numeral + mono caps label.
- `.section-marker` — mono caps with a glowing gold dot.

### Motion (`motion.js`, `styles-motion.css`)
Light scroll-reveal system using `data-reveal="up|rise"` and `data-stagger="up"` attributes plus `data-words` for word-by-word headline reveals. Re-implement in your stack (Framer Motion, Motion One, or a small IntersectionObserver wrapper). Respect `prefers-reduced-motion: reduce`.

## Assets

### Required
- `assets/hero-stadium.mp4` — homepage hero background (autoplay loop muted, 0.75× playback rate).
- `assets/cta-tunnel.mp4` — final CTA section background.
- `assets/team/nicolas-bee.jpg` — Nicolas's portrait (raw 1290×868; rendered at `aspect-ratio: 4/5` with `object-fit: cover`, faces remain centered).
- `assets/team/alex-kovalenko.jpg` — Alex's portrait (raw 7952×5304; consider downscaling to ~1600px wide for production).

### Referenced but not in this bundle
- `assets/video-roster.mp4` — used by the Roster Intelligence spotlight section. Source it from the design project root or replace with a static image.

## Interactions & Behavior

- **Navbar** — fixed; transparent glass at top, opaque cocoa after `scrollY > 30`, height shrinks 76px → 64px.
- **Hero rotators** — kicker word cycles every 3.4s; H1 word cycles every 3.4s offset by 1.7s so they never swap simultaneously. Each swap fades + translates from below 0.45em with a 600ms cubic-bezier(.2,.8,.2,1) curve.
- **Hero video** — `playbackRate = 0.75`, autoplay/loop/muted/playsinline. Always muted (browser autoplay policy).
- **Buttons** — 700ms shine sweep on hover (skip if reduced motion), -2px lift, +3.5% scale, amber halo.
- **Pricing card** — featured tier (`Pro`) shows a "MOST POPULAR" ribbon and uses the primary button; others use ghost.
- **Timeline rail** — gold dots are `position: absolute` on each `.tl-date`'s right edge; the connecting line is the timeline's `::before`.
- **Reduced motion** — all rotations, sweeps, and lifts must be disabled when `prefers-reduced-motion: reduce`.

## Responsive

- `@media (max-width: 760px)` hides any element with `.hide-mobile` and reveals `.show-mobile`. The navbar swaps to a hamburger drawer at this breakpoint.
- About page collapses the masthead and "the why" grids to single column at `880px`, and the team grid to single column at `560px`.
- Timeline rail shifts left (`left: 90px → 60px`) at `640px`.

## State Management

The site is fully static — no state beyond:
- Navbar `scrolled` flag (scroll listener).
- Hero `kickerIdx` and `heroIdx` (intervals on mount).
- Mobile nav drawer `open` flag.

No data fetching. The pricing tiers, principles, timeline events, and team data are static literals — promote them to a CMS or a `content/` folder if the team plans to edit them without code changes.

## Implementation Notes for Claude Code

1. **Decide the framework first.** If the existing project has one, match it. If not, default to Next.js 14 App Router. Static export (`output: 'export'`) is fine for this site.
2. **Set up the design tokens** as CSS variables in a global stylesheet, or as a Tailwind theme extension. All tokens are listed above.
3. **Load fonts via `next/font`** (or your framework's equivalent). Variable fonts: Fraunces with `opsz`, `wght`, `SOFT`, `WONK` axes; Geist; Geist Mono.
4. **Convert each section into a component.** The HTML prototype uses one big React tree per file; split it: `Navbar`, `Hero`, `FeatureGrid`, `Pricing`, `Footer`, etc.
5. **Replace the inline `Icon` switch** with whatever icon system the codebase uses (Lucide, Heroicons, custom SVG sprite). Keep the 1.6px stroke weight and rounded caps.
6. **Drop the Tweaks panel and `motion.js` ad-hoc reveals** for production. Use Framer Motion or Motion One for reveals. Keep `prefers-reduced-motion` respected throughout.
7. **Strip placeholder data slop** when wiring real numbers. The "11× avg response lift", "12,000+ athletes", and "$3.4M seed" lines are placeholders — confirm or remove with the founders before launch.
8. **Sanity-check copy.** The homepage copy was fully approved; the About page copy reflects the founders' real story but should be proofread once more before going live.

## Files in This Bundle

```
design_handoff_kickriq_site/
├── README.md                          ← this file
├── KickrIQ Homepage.html              ← homepage prototype (entry point)
├── About.html                         ← about page prototype
├── styles.css                         ← design tokens + globals + buttons
├── styles-logo.css                    ← KickrIQ wordmark styles
├── styles-sections.css                ← all section-specific styles
├── styles-motion.css                  ← scroll reveal animations
├── styles-tweaks.css                  ← Tweaks panel (drop in production)
├── components-logo.jsx                ← KickrIQLogo, KickrIQIcon
├── components-hero.jsx                ← Icon, Navbar, Hero
├── components-features.jsx            ← ThreeUp, RosterSpotlight, FeatureGrid
├── components-mid.jsx                 ← CinematicBand, HowItWorks, Divisions, Parents
├── components-end.jsx                 ← Pricing, FinalCTA, Footer, App root
├── tweaks-panel.jsx                   ← Tweaks chrome (drop in production)
├── tweaks.jsx                         ← Tweak definitions (drop in production)
├── main.jsx                           ← React mount
├── motion.js                          ← scroll reveal driver
└── assets/
    ├── hero-stadium.mp4               ← homepage hero background
    ├── cta-tunnel.mp4                 ← final CTA background
    └── team/
        ├── nicolas-bee.jpg            ← founder portrait
        └── alex-kovalenko.jpg         ← founder portrait
```

Open `KickrIQ Homepage.html` and `About.html` in a browser to see the live designs as the source of truth.
