# Handoff: KickrIQ Marketing Website

## Overview

KickrIQ is an AI college soccer recruiting counselor for high-school athletes. The product matches athletes to fit-right programs, helps them email coaches, and tracks every response across D1, D2, D3, NAIA, and JUCO.

This handoff covers the **public marketing homepage** and the **brand logo pack** — not the in-product dashboard.

The site's job is to convert recruits (and their parents) from "I'm scrolling Instagram at 11pm wondering if I'll get an offer" → "I just signed up for KickrIQ Free."

## About the Design Files

The files in `design-files/` are **design references created in HTML** — a high-fidelity prototype showing intended look, layout, copy, and interaction. They are **not** production code to lift directly. Babel-in-the-browser, inline JSX, and unpinned external font CDNs are fine for prototyping but not for production.

Your task: **recreate this design in the target codebase's environment** (Next.js / React / Astro / whatever the team uses) following the codebase's existing patterns, build pipeline, font-loading strategy, and component conventions. If no codebase exists yet, **Next.js 14+ (App Router) + Tailwind CSS** is the recommended starting point — the design uses no exotic primitives that wouldn't translate cleanly.

## Fidelity

**High-fidelity (hifi).** All colors, typography, spacing, copy, and interaction states are final. Recreate pixel-perfectly. Where the prototype uses inline JSX components broken into multiple `components-*.jsx` files for prototype convenience, restructure into idiomatic components in your framework.

## Folder Contents

```
design_handoff_kickriq_website/
├── README.md                       ← this file
├── design-files/                   ← the HTML prototype + sources
│   ├── KickrIQ Homepage.html       ← the homepage (open in browser to preview)
│   ├── Logo Pack.html              ← logo gallery (preview only)
│   ├── components-*.jsx            ← React components (prototype-style, inline JSX)
│   ├── main.jsx                    ← root render entry
│   ├── motion.js                   ← scroll-reveal IntersectionObserver utility
│   ├── styles.css                  ← design tokens + global styles
│   ├── styles-sections.css         ← section-specific styles
│   ├── styles-logo.css             ← logo CSS
│   ├── styles-motion.css           ← reveal animation utilities
│   ├── video-roster.mp4            ← roster section background loop
│   ├── video-cta.mp4               ← bottom CTA background loop
│   └── assets/
│       ├── hero-stadium.mp4        ← hero background loop
│       └── cta-tunnel.mp4          ← (alternate CTA loop, unused)
└── logo-pack/                      ← production-ready PNG exports
    ├── kickriq-wordmark.png        ← transparent
    ├── kickriq-wordmark-dark.png   ← on cocoa #221913
    ├── kickriq-wordmark-cream.png  ← on cream #f6efde
    ├── kickriq-icon.png            ← transparent
    ├── kickriq-icon-dark.png       ← on cocoa
    └── kickriq-icon-cream.png      ← on cream
```

## Copywriting Rules (CRITICAL)

These are **hard rules** the designer-of-record set. If marketing wants to change them later, fine, but the implementer should not "improve" copy unilaterally.

- **No em dashes anywhere.** All em dashes were intentionally swept from this design. Use periods, commas, or rephrase. If you see one in the source, treat it as a bug.
- **Don't say "AI" gratuitously.** When AI is mentioned, it should describe a specific behavior (e.g. "AI scores your tape on technique") not be a vague label.
- **No doom statistics.** Earlier copy referenced "five figures in missed scholarships" — that was rejected. Lead with what KickrIQ *does*, not what's at stake if you don't use it.
- **Tone:** direct, slightly cheeky, recruit-shaped. Talk to the athlete first, parent second.
- **No oversell.** "Guaranteed scholarship" or similar claims are banned.

## Design Tokens

All tokens are defined in `design-files/styles.css` under `:root`. The full source is the canonical reference; the table below is a digest.

### Colors

| Token | Hex | Use |
|---|---|---|
| `--bg-0` | `#221913` | Page base — warm cocoa |
| `--bg-1` | `#2a1f17` | Section base |
| `--bg-2` | `#34271c` | Surface raised (cards) |
| `--bg-3` | `#422f21` | Surface hover / inner card |
| `--bg-warm` | `#2c2014` | Warmest atmospheric |
| `--fg-0` | `#f6efde` | Primary text (cream) |
| `--fg-1` | `#e0d4ba` | Secondary text |
| `--fg-2` | `#b0a182` | Muted / eyebrow |
| `--fg-3` | `#7d7058` | Hint |
| `--gold` | `#f0b65a` | Primary accent — gameday gold |
| `--gold-2` | `#e0982e` | Accent darker |
| `--gold-3` | `#c47a16` | Accent darkest |
| `--gold-soft` | `rgba(240, 182, 90, 0.14)` | Highlight backgrounds |
| `--gold-halo` | `rgba(240, 182, 90, 0.45)` | Glow / shadow |
| `--line-1` | `rgba(246, 220, 168, 0.09)` | Hairline border |
| `--line-2` | `rgba(246, 220, 168, 0.16)` | Standard border |
| `--line-3` | `rgba(246, 220, 168, 0.24)` | Emphasized border |

The palette is **warm cocoa + amber, never cool grey**. Substituting `#000` for `--bg-0` or `#fff` for `--fg-0` will kill the brand. Match the warmth.

### Typography

| Token | Stack | Use |
|---|---|---|
| `--serif` | `'Fraunces', 'Source Serif Pro', Georgia, serif` | Display headlines, accent words |
| `--sans` | `'Geist', 'IBM Plex Sans', -apple-system, ...` | Body, UI |
| `--mono` | `'Geist Mono', 'JetBrains Mono', ui-monospace, ...` | Eyebrows, labels, stat captions |

Fraunces is loaded with variable axes — the prototype uses `font-variation-settings: "SOFT" 100, "WONK" 1, "opsz" 144` on accent italics for the chunky display look. Preserve those axis settings when rendering accent words.

A condensed italic (`Saira Condensed`, weight 900 italic) is used **only inside the wordmark logo** — see `styles-logo.css`. Don't propagate it elsewhere.

Replace the prototype's Google Fonts `<link>` import with your codebase's font-loading strategy (e.g. `next/font` for Next.js).

### Spacing & Radius

| Token | Value |
|---|---|
| `--r-sm` | `8px` |
| `--r-md` | `14px` |
| `--r-lg` | `20px` |
| `--r-xl` | `28px` |

Wrap width: `.wrap` is `max-width: 1240px; margin: 0 auto; padding: 0 28px` (see `styles.css`).

### Shadows

Defined in `styles.css` as `--shadow-sm`, `--shadow-md`, `--shadow-lg` — soft, warm-tinted shadows. Lift values directly from the source.

## Page Structure (top → bottom)

The homepage is one long scroll. Section IDs match the nav anchor links.

1. **Sticky nav** (`.nav`) — wordmark left, links (Features / Roster Intelligence / How / Pricing / For Parents / About us) center, "Sign in" + "Try free" right. Goes glassy/blurred on scroll. Note: "About us", not "About".
2. **Hero** (`#hero`) — full-bleed `hero-stadium.mp4` autoplaying loop with a heavy top-left dark wash and corner vignette. Two pieces of rotating copy:
   - **Kicker** (small serif line above headline): *"AI that puts in the work to get you **recruited / noticed / seen / signed.**"* — last word rotates every 3.4s.
   - **H1**: *"The **smartest / quickest / sharpest / boldest** way to get recruited."* — accent word rotates every 3.4s, **offset by 1.7s** from the kicker so they never swap simultaneously.
   - **Lede**: *"Your personal recruiting coach. Match with the right college programs, email the right coaches, and track every response."*
   - Two CTAs ("Try free" primary, "See it in action" ghost) + 3 trust stats.
3. **On-the-clock task card** — hero-adjacent panel with a countdown ring, school chips that stagger-reveal, and a "Send all" CTA. The product's signature visual.
4. **Three pillar features** (`#features`) — three cards in a row: Match, Outreach, Track. Each has an icon, headline, paragraph, and a small inline UI vignette.
5. **Roster Intelligence** (`#roster`) — full-bleed muted video loop (`video-roster.mp4`) behind a content card explaining how KickrIQ scrapes public roster data to find programs losing your position next year.
6. **Recruiting heat-map** — 7-day grid showing send/open/reply density. Decorative + reassuring.
7. **Animated kinetic stats** — count-up numbers, sparkline draw on enter viewport, subtle pulse.
8. **How it works** (`#how`) — three numbered steps with serif numerals (01 / 02 / 03).
9. **Testimonials / proof** — short quote cards.
10. **Pricing** (`#pricing`) — three tiers: **Free**, **Pro $19/mo**, **Family $29/mo**. Pro is the highlighted tier (amber border, "Most popular" badge). Family includes Pro + parent-shaped value (read-only parent view, weekly progress email, shared deadlines/visit calendar, single bill, separate parent logins). The ladder is intentionally Free → $19 → $29 — keep that price pacing.
    - Section sub-headline: *"Pro is **nineteen dollars a month.** Less than one ID camp lunch."* (price word in italic gold serif).
11. **FAQ** — accordion list.
12. **Final CTA** (`.final-cta`) — **light-mode** cream paper section with a warm amber bloom and dark text. Background loop video (`video-cta.mp4`) plays underneath at low opacity. This is the only inverted section — keep it inverted; the contrast is part of the design.
13. **Footer** — links + brand mark.

## Interactions & Behavior

- **Scroll-reveal**: most sections fade + lift in via `IntersectionObserver` (see `motion.js` and `.reveal-*` utility classes in `styles-motion.css`). Triggered once, threshold ~0.15. Reproduce with whichever animation lib your codebase uses (Framer Motion, CSS-only, etc.) but match the timing curve and stagger.
- **Hero rotators** (kicker + H1):
  - Each rotator is a `<span>` with a `key` set to the index, so React remounts it on swap and re-runs the entrance animation.
  - **Animation**: `translateY(0.28em → 0)` + `opacity 0 → 1` over **520ms**, cubic-bezier `(.22, .61, .36, 1)`. **No blur** — earlier versions used `filter: blur(3px)`, removed because it felt jagged.
  - **Timing**: kicker swaps every 3400ms; H1 swaps every 3400ms but with a 1700ms initial delay so the two are 180° out of phase. Important — they should *never* swap at the same moment.
  - **Stable width**: each rotator has a tight `min-width` (3.6em for hero, 5.4em for kicker — sized to the longest word in its set) so the surrounding text doesn't reflow on swap.
  - Disable both rotations under `prefers-reduced-motion: reduce`.
- **Hero video parallax**: video translates slightly slower than scroll for depth. Disable when `prefers-reduced-motion: reduce`.
- **Stat count-up**: numbers animate from 0 to target when the stats row enters viewport. ~1.4s, easeOutExpo.
- **Sparkline draw**: SVG path uses `stroke-dashoffset` from full length → 0 on enter.
- **Nav**: transparent at top, gains background blur + hairline border once `scrollY > 12`.
- **CTA buttons**: see `.btn-primary`, `.btn-ghost`, `.btn-link` in `styles.css` for hover/active states. Primary is amber pill, ghost is glassy outline, link is underlined-on-hover.
- **Pricing card**: highlighted tier has `--gold` border + `--gold-soft` interior glow + an upward 4px translate on hover.

All interactions respect `prefers-reduced-motion: reduce` — videos pause, parallax disables, count-up snaps to final value, rotators freeze on first word.

## Responsive

The prototype is desktop-first. For mobile (< 760px):

- Nav links collapse to a hamburger.
- Hero headline drops one font-size step; CTA stack vertical.
- Three-pillar features stack to 1 column.
- Pricing tiers stack to 1 column.
- Heat-map grid wraps or scales down.
- Stats row goes 2-up then 1-up.

Use the same tokens and `clamp()` patterns visible in `styles.css` (e.g. `font-size: clamp(48px, 7vw, 96px)`).

## Logos & Brand Assets

The `logo-pack/` folder has 6 production PNGs:

- **Wordmark** (`kickriq-wordmark[-dark|-cream].png`) — for navigation, footers, marketing surfaces. Cream "Kickr" + amber "iQ", italic, with a pentagon dot replacing the i's tittle. Default height in nav: 28–32px.
- **Icon** (`kickriq-icon[-dark|-cream].png`) — for favicon, app icons, social avatars. A rounded cocoa tile with a chunky cream "K" and an amber pentagon in the bottom-right.

All PNGs are exported at 3x density — safe to scale down. For sub-32px sizes (favicons), regenerate at the target size from the source CSS in `styles-logo.css` rather than scaling these PNGs down.

The icon's amber pentagon is a recurring brand motif — it appears as a tittle on the "i" in the wordmark and as a chip dot in nav. Treat the pentagon as a brand element, not decoration.

## Videos

- `assets/hero-stadium.mp4` — hero loop. Atmospheric stadium / pitch B-roll, dark, slow.
- `video-roster.mp4` — roster section loop, more abstract.
- `video-cta.mp4` — final CTA loop, bright/cream-toned.
- `assets/cta-tunnel.mp4` — alternate, unused.

All videos: `autoplay muted loop playsinline`, `preload="metadata"`. Compress further for production (these are pre-optimized but not aggressively); offer WebM alongside MP4 for Chrome/Firefox.

## State / Data

The marketing site is **fully static** — no backend, no auth, no data fetching. The "live" elements (heat-map, count-ups) are hardcoded mock data inside the components. When wiring to real data later:

- **Heat-map** → fetch aggregated send/reply counts.
- **Stats** ("3,200+ athletes", etc.) → fetch from a counters endpoint, fall back to last-known.

The "Try free" and "Sign in" CTAs need to point at the auth routes the product team owns — placeholder hrefs are `#`.

## Files in the Prototype (cross-reference)

| File | Role |
|---|---|
| `KickrIQ Homepage.html` | Root document. Loads fonts, CSS, React, components, `main.jsx`, `motion.js`. |
| `main.jsx` | Mounts the React app to `#app`. |
| `components-hero.jsx` | Nav, Hero (with rotators), On-the-clock task card. |
| `components-features.jsx` | Three-pillar Features section, Roster spotlight, Cinematic band. |
| `components-mid.jsx` | How it works, Feature grid, Divisions, Family/parents, Heat-map, Kinetic stats. |
| `components-end.jsx` | Pricing, FAQ, Final CTA, Footer. |
| `components-logo.jsx` | `<KickrIQLogo>` and `<KickrIQIcon>` React components — recreate in your framework. |
| `motion.js` | IntersectionObserver scroll-reveal, count-up, sparkline draw. |
| `styles.css` | Design tokens + global element/utility styles + rotator animations. |
| `styles-sections.css` | Per-section visual specifics (hero wash, heat-map grid, etc.). |
| `styles-motion.css` | `.reveal-up`, `.reveal-fade`, stagger delay utilities. |
| `styles-logo.css` | Wordmark and icon CSS. |

## Open Questions for the Implementer

- **Auth routes**: Where do the "Try free" and "Sign in" CTAs go? (Need from product team.)
- **About page**: The nav links to `About.html`, which is in-progress and not bundled here. Build is open.
- **Newsletter**: There's no newsletter signup in the design — confirm this is intentional.
- **Analytics**: Wire up whatever the team uses (Plausible, PostHog, GA4) — there's no analytics in the prototype.
- **CMS**: If pricing tiers or testimonials need to be editable by non-engineers, swap the hardcoded JSX for a CMS-fed source. Otherwise leave inline.

---

Built in design conversation with Claude. Questions on intent / specific decisions → check back with the designer.
