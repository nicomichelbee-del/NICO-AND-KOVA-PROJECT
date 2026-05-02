---
name: soccer-counselor
description: Use when working on any feature of the AI Soccer College Counselor app — athlete profiles, school matching, coach email generation, outreach tracking, highlight video rating, Stripe payments, Supabase auth/data, or the React frontend. Also use when making AI prompt decisions, enforcing tier limits, or designing mobile-first UI for teen athletes.
---

# AI Soccer College Counselor — Project Skill

## Stack & Architecture

- **Frontend:** React + TypeScript, Vite, Tailwind — mobile-first (primary users are teens on phones)
- **Backend/DB:** Supabase (auth + Postgres + realtime)
- **AI:** Claude API via `/api/ai` — ALL AI calls route through this single service layer, never directly from components or other routes
- **Payments:** Stripe
- **Search/Scraping:** Exa MCP (`mcp.exa.ai/mcp`) + Firecrawl MCP + `@mendable/firecrawl-js` SDK

## Pricing Tiers — Enforce in `/api/ai`

| Tier | Price | Limits |
|---|---|---|
| Free | $0 | 3 coach emails, 5 school matches |
| Pro | $19/mo | Unlimited emails + outreach tracker + highlight video rater |
| Family | $29/mo | Pro + parent dashboard view |

Track usage per user in Supabase. Gate Pro/Family features at the `/api/ai` layer.

## Core Features

1. **Athlete Profile Builder** — position, GPA, stats, grad year, location/size prefs, division goal (D1/D2/D3/NAIA)
2. **School Matcher** — reach/target/safety schools based on stats + prefs
3. **Coach Email Generator** — personalized cold outreach
4. **Outreach Tracker** — contacts, responses, follow-ups dashboard
5. **Follow-up Assistant** — follow-up emails, thank-you notes, coach Q&A responses
6. **Highlight Video Rater** — Pro/Family only; accepts YouTube/Hudl URL, rates 1–10, gives actionable feedback

## AI Persona & Tone

Acts as a college soccer recruitment counselor with 15+ years experience.
- Encouraging, direct, soccer-specific — never generic
- Audience: athletes AND parents
- D1 emails: professional, concise, stat-heavy
- D2/D3 emails: warmer, emphasize academic fit
- NAIA/JUCO emails: emphasize immediate playing time potential
- Model: `claude-sonnet-4-20250514`

## Coach Email — Required Fields

Every generated email must include:
- Graduation year + position
- Club team name and league (club > high school for D1)
- Key stats (goals, assists, season)
- GPA + intended major
- Highlight video link
- Why that specific school/program
- Clear ask: campus visit, ID camp, or phone call

## Highlight Video Rater — Required Output

- Overall rating (1–10) + strengths summary
- Opening clip quality (first 30 sec matter most)
- Clip variety (goals, assists, defensive plays, 1v1s, set pieces)
- Video length (ideal: 3–5 min)
- Production quality (title card, music, pacing)
- Stat/info overlay (name, grad year, position, club, GPA)
- Position-specific skills coaches look for
- Tailored to target division
- Tone: encouraging but honest

## Soccer Domain Rules

- Division hierarchy: D1 > D2 > D3 > NAIA > JUCO
- D1 recruiting timeline: most offers sophomore/junior year
- D1/D2 athletes must register with NCAA Eligibility Center
- Key stats: goals, assists, position, club team, tournament experience, GPA, SAT/ACT

## Key Skills to Reach For

| Task | Skill |
|---|---|
| UI design / polish / mobile layout | `$impeccable` |
| Animations / micro-interactions | `$emil-design-eng` |
| New feature planning | `$agent-planner` or `$sparc-methodology` |
| Security audit (auth, payments, data) | `$security-audit` |
| Test coverage gaps | `$test-gaps` |
| Scraping college program pages | Exa MCP + Firecrawl MCP |
| GitHub PRs / releases | `$agent-github-pr-manager` |
| Performance issues | `$agent-performance-optimizer` |
| Background scheduled tasks | `$cron-schedule` |
