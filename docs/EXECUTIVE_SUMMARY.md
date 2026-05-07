# KickrIQ
### Executive Summary
*Live in production at [kickriq.com](https://kickriq.com) since May 5, 2026*

---

## In one paragraph

KickrIQ is an AI college soccer recruitment counselor that does the work athletes used to pay $1,200 to $6,000 a year for. It builds the recruiting profile, matches across 771 college programs, drafts coach emails that get replies, rates highlight videos with computer vision, and tracks the entire pipeline from first contact to commitment. Two founders (Nico and Kova). No outside capital. ~$50 a month to operate. Free for every user at launch, with paid tiers held behind a waitlist while we validate demand.

---

## What it does

Six capabilities, all shipping today:

| | Feature | What it does |
|---|---|---|
| 1 | **Profile Builder** | 40+ structured fields feeding every downstream feature. Profile-strength score nudges completion. |
| 2 | **School Matcher** | Ranks 771 programs across D1, D2, D3, NAIA, JUCO on dual axes: athletic fit (program strength, roster turnover, position demand) and academic fit (College Scorecard data, 98.8% coverage). |
| 3 | **Coach Email Generator** | Claude drafts personalized cold outreach with division-specific tone. D1 stat-heavy, D3 fit-led, NAIA playing-time-led. |
| 4 | **Outreach Tracker + Gmail** | OAuth into the athlete's own Gmail. Sends from their address (deliverability moat). Auto-syncs replies. AI auto-rates each coach response hot, warm, or cold. |
| 5 | **Highlight Video Rater** | Athlete pastes a YouTube or Hudl link. Puppeteer extracts 24 keyframes. Claude Vision returns a 1 to 10 rating with position-specific, division-calibrated feedback. |
| 6 | **Roster Intelligence** | Pre-scraped roster data forecasts which programs will open spots at the athlete's position 1 to 2 years out. No competitor surfaces this. |

Plus a Coach Portal (head coaches claim their program), a Camps & Showcases finder with community ratings, recruiting Timeline, AI Follow-up Assistant, and a Q&A chat.

---

## Why it wins

The market is owned by four legacy players. Each has a structural weakness we exploit.

| Competitor | Pricing | Weakness |
|---|---|---|
| **NCSA Sports** | $1,200 to $6,000 a year, sales-call gated | Coaches recognize NCSA template emails on sight and ignore them |
| **SportsRecruits** | $99 a month or $399 a year | No AI. Most features paywalled. Club-locked distribution |
| **FieldLevel** | $10 to $49 a month | Soccer is much thinner than baseball |
| **CaptainU** | $22.50 to $39.95 a month | Cancellation friction is the top user complaint |

**Our five differentiators:**

1. **Email deliverability moat.** Outreach sends from the athlete's own Gmail, not a flagged template farm.
2. **AI Highlight Video Rater.** No competitor offers this. Universal pain point.
3. **Soccer-only depth.** Division-tuned tone, position-specific advice, soccer-native stats vs. generic 20-sport tools.
4. **Roster Intelligence.** Proactive open-spot forecasting vs. reactive coach databases.
5. **Transparent self-serve pricing.** $0 to $29 published on the page vs. competitor sales-call gates.

---

## What's built

**Codebase:** ~6,500 LoC across 27 React pages and 6 API route modules.

**Proprietary data assets (~2.7 MB cached, scraped, AI-enriched):**

| Asset | Coverage |
|---|---|
| Schools | **771 college soccer programs** (D1, D2, D3, NAIA, JUCO) |
| Coaches | **1,542 records** (men's + women's) built via 5-stage pipeline: Puppeteer → Claude+web-search → email pattern inference → SMTP/domain validation |
| Academics | **98.8% College Scorecard coverage** (747/756 schools) for GPA bands, SAT/ACT, admit rates |
| Roster snapshots | Active monthly cron, powering the open-spots signal |
| ID Camps | Curated catalog with community ratings and reviews |

**Engineering decisions worth flagging:**

- **Single AI gateway.** Every Claude call routes through `/api/ai`. Tier gating, usage limits, and prompt updates live in one place.
- **Cost-controlled scrapers.** Budget tracker plus Haiku-to-Sonnet escalation plus free-source first-pass (Wikipedia, NCAA, Scorecard) keeps full enrichment runs under $20.
- **Confidence-tagged data.** Every coach record carries a status (`success`, `web-verified`, `email-inferred`, `failed`) so the UI never shows low-confidence data as if it were verified.
- **Vision-based video analysis.** 24-frame grid composites let Claude Vision rate technical skill and decision-making, not just clip count.

---

## Stack

React 18 + TypeScript + Vite + Tailwind on the client. Express + TypeScript on the server. Supabase (Postgres, Auth, RLS). Anthropic Claude (text and vision, `claude-sonnet-4-20250514`). Gmail API via Google OAuth. Puppeteer + Firecrawl for scraping. PostHog + Vercel Analytics for measurement. Stripe wired in dependencies but not in routes (intentional). Hosted free across Vercel, Render, Cloudflare, and Supabase. Total monthly burn: $20 to $50, all of it Anthropic API.

---

## Business model

| Tier | Price | Includes | Status |
|---|---|---|---|
| **Free** | $0 | 3 coach emails, 5 school matches, full profile, school matcher, public profile | **Live** |
| **Pro** | $19/mo | Unlimited emails, Outreach Tracker + Gmail, Follow-up Assistant, Video Rater | **Waitlist** (1-use preview, then prompt) |
| **Family** | $29/mo | Pro + parent dashboard, multi-athlete | **Waitlist** |

Stripe is integrated but flag-gated. Switching from waitlist to live billing is one feature flag.

---

## Operations and traction

- **Live in production** at kickriq.com since May 5, 2026.
- **Auto-deploy.** Push to `main`, Vercel and Render redeploy in parallel. No release ceremony.
- **COPPA-compliant from day one.** Under-13 blocked at the gate. Ages 13 to 17 require parental email and explicit consent at signup, with a backfill flow for existing accounts.
- **Security posture.** Real auth on every authenticated route, per-user rate limits (30 rpm authenticated, 8 rpm for video), per-IP limits on the public waitlist endpoint, RLS on every Supabase table.
- **Velocity.** ~115 commits in 8 days (April 28 to May 6). Entire launch sprint went from "school matcher rebuild" to "live on kickriq.com" in a single calendar week.

---

## 90-day roadmap

Ranked by ROI, drawn from the competitor gap analysis:

1. **AI reply analyzer + auto-draft response.** Small effort, pure moat extension.
2. **Programmatic SEO for "Open Spots Live."** Small effort. 1,500+ position-by-school pages for organic acquisition.
3. **NCAA Eligibility Center workflow + transcript vault.** Small to medium. Closes NCSA's biggest moat.
4. **KickrIQ Player Rating (1 to 100) public badge.** Medium. Closes the TopDrawerSoccer star-rating gap. Viral when athletes share.
5. **Coach-side portal expansion.** Large. Foundation already shipped. Coaches keep their roster current, KickrIQ becomes the canonical truth source.
6. **Native iOS and Android apps.** Large. Recruiting is a daily-engagement use case.
7. **Club and HS team licensing tier ($299/yr/team).** Medium. Distribution channel that subsidizes individual Pro.

---

## Honest gaps

- **Revenue not yet live.** Stripe wired, not switched on. Waitlist-to-paid conversion is unproven. One feature flag away.
- **Render free tier sleeps after 15 min idle.** Invisible at launch traffic. $7/mo upgrade fixes it.
- **No native mobile apps.** Mobile-first PWA mitigates short-term, not long-term.
- **Coach portal has no users yet.** Built and operational, network effect unproven.
- **~400 to 700 coach records carry inferred (not verified) emails.** Status tagging means the UI never lies about confidence, but the deliverability headline depends on continued scrape refreshes.
- **US-only.** International expansion (Canada, UK) is feasible on the same data model. Not yet built.

---

## Bottom line

A fully-shipped, in-production, COPPA-compliant, two-founder, $50-a-month-burn product that does what NCSA charges $6,000 for, with three differentiators no competitor has matched: own-Gmail outreach, Claude Vision video rating, and roster-spot forecasting.

The product is real. The data moat is built. The compliance posture is clean. The 90-day roadmap is ranked and the highest-ROI items are small-effort moat extensions on top of infrastructure that already exists.

The only remaining question is distribution. The entire competitive set has handed us the opening to win it.
