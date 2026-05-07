# KickrIQ Pitch Deck Outline
*12 slides. Built to read in 5 minutes or pitch in 10.*

---

## Slide 1 — Title

> **KickrIQ**
> The smartest way to get recruited.
>
> AI college soccer recruitment counselor.
> Live at kickriq.com since May 5, 2026.
>
> Nico Bee + Kova [last name]

**Visual:** Stadium hero shot, gold KickrIQ wordmark.

---

## Slide 2 — The Problem

> **High-school soccer players are paying $1,200 to $6,000 a year for help getting recruited. They're getting templates that coaches recognize and ignore.**

Three pain points:
1. Athletes don't know which programs realistically fit them across 1,500+ college options
2. Cold emails to coaches get deleted because they read like spam
3. Highlight videos are the single biggest filter, and most are objectively bad

**Visual:** Three side-by-side phones showing a generic NCSA email, a fit-mismatch list of schools, and a poorly-edited highlight reel.

---

## Slide 3 — The Solution

> **An AI counselor that does the work, in the athlete's pocket, for free.**

- Builds the recruiting profile
- Matches across 771 college programs (D1 to JUCO)
- Drafts coach emails that get replies
- Rates highlight videos with computer vision
- Tracks every reply, follow-up, visit, and offer

All from one app, all from one founder team, all from one Supabase backend.

**Visual:** App walkthrough as four phone mocks: Profile → Matches → Email → Tracker.

---

## Slide 4 — Why Now

Three forces converging in 2026:

1. **Claude-class AI** is finally good enough to draft outreach a college coach can't distinguish from a real human
2. **Vision models** can analyze a 4-minute highlight reel for technical skill and decision-making in seconds
3. **NCAA rule changes** (NIL, expanded transfer portal, post-2021 contact rules) have made the recruiting process more chaotic and more individualized than ever

The recruiting market has tripled in complexity. Legacy tools haven't changed.

---

## Slide 5 — Market

**US college soccer recruiting services market.**

- ~450,000 high-school soccer players in the US
- ~30,000 college roster spots filled per year (D1 to JUCO)
- Ratio: ~15 athletes competing for every spot
- Average household spend on recruiting services: $500 to $3,000

Total addressable market: roughly **$300M to $1.2B annually** in US soccer alone, before international expansion (Canada, UK, Mexico).

---

## Slide 6 — Competitive Landscape

| Competitor | Pricing | Their weakness |
|---|---|---|
| NCSA Sports | $1,200 to $6,000 a year, sales-call gated | Coaches blacklist their templates |
| SportsRecruits | $99/mo or $399/yr | No AI. Club-locked distribution |
| FieldLevel | $10 to $49/mo | Soccer is much thinner than baseball |
| CaptainU | $22.50 to $39.95/mo | Top complaint is cancellation friction |

**KickrIQ undercuts all four on price, beats all four on AI, and beats all four on transparency.**

---

## Slide 7 — Our Moat

Five things competitors don't have:

1. **Own-Gmail outreach.** Emails send from the athlete's address. Coaches reply to a real person.
2. **AI Highlight Video Rater.** Claude Vision on 24-frame composites. No competitor offers this.
3. **Soccer-only depth.** Position-specific, division-tuned advice vs. generic 20-sport tools.
4. **Roster Intelligence.** We forecast which programs will have open spots at the athlete's position 1 to 2 years out.
5. **Self-serve transparent pricing.** $0 to $29 published on the page. No sales calls.

---

## Slide 8 — What's Built

| Asset | Number |
|---|---|
| Live React pages | 27 |
| API endpoints | 30+ |
| Supabase tables (with RLS) | 10 |
| College programs in database | 771 |
| Coach records (men's + women's) | 1,542 |
| College Scorecard academic coverage | 98.8% |
| Commits in launch week | ~115 |
| Monthly operating cost | $20 to $50 |

**It's not a deck. It's a live product.** Open kickriq.com on your phone right now.

---

## Slide 9 — Business Model

| Tier | Price | Status |
|---|---|---|
| Free | $0 | Live. Profile, matcher, public profile, 3 emails. |
| Pro | $19/mo | Waitlist. Unlimited emails, Gmail tracker, video rater, follow-ups. |
| Family | $29/mo | Waitlist. Pro + parent dashboard. |

Stripe is wired in code. **Switching from waitlist to live billing is one feature flag.**

Future revenue layers: club/HS team licensing ($299/yr/team), coach portal premium tier, programmatic SEO referrals.

---

## Slide 10 — Traction & Compliance

- **Live in production** at kickriq.com since May 5, 2026
- **COPPA-compliant from day one.** Under-13 blocked. 13 to 17 requires parental consent.
- **Security:** Real auth on every route, RLS on every table, per-user and per-IP rate limits.
- **Auto-deploy:** Push to `main`, Vercel and Render redeploy in parallel.
- **115 commits in the 8 days before launch.**

---

## Slide 11 — 90-Day Roadmap

| Effort | Item | Why |
|---|---|---|
| S | AI reply analyzer + auto-draft response | Pure moat extension |
| S | Programmatic SEO for "Open Spots Live" | 1,500+ pages, organic acquisition |
| S/M | NCAA Eligibility workflow + transcript vault | Closes NCSA's biggest moat |
| M | KickrIQ Player Rating public badge | Viral when athletes share |
| L | Coach portal expansion | Network effect, canonical roster truth |
| L | iOS and Android apps | Daily-engagement use case |

---

## Slide 12 — The Ask

> **What we have.** A live, in-production, free-to-use AI recruiting product with proprietary data, real users in pipeline, and one feature flag between free and revenue.
>
> **What we need.** Distribution.
>
> **What we're asking for.** Intros to club directors, soccer media, and parent communities. Beta testers. And if it makes sense, a check.

**Contact:** infokickriq@gmail.com
**Live product:** kickriq.com
