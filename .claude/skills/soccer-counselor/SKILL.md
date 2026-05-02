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

---

## Skills to Reach For — Full Reference

### Planning & Architecture
| Task | Skill |
|---|---|
| New feature — brainstorm options before building | `superpowers:brainstorm` |
| New feature — write a structured implementation plan | `superpowers:write-plan` |
| New feature — execute an existing plan step by step | `superpowers:execute-plan` |
| Large feature — full SPARC spec → architect → code cycle | `sparc-methodology` |
| Large feature — write the SPARC spec doc | `sparc-spec` |
| Large feature — SPARC implementation phase | `sparc-implement` |
| Large feature — SPARC refinement/polish | `sparc-refine` |
| Complex multi-agent task orchestration | `agent-queen-coordinator` |
| Whole-project autonomous swarm | `hive-mind` or `hive-mind-advanced` |
| Task broken into subtasks with agent delegation | `agent-orchestrator-task` |
| ADR (Architecture Decision Record) | `adr-create` |

### Frontend / UI
| Task | Skill |
|---|---|
| Mobile-first UI design, layout, Tailwind polish | `frontend-design:frontend-design` |
| UI quality + visual polish pass | `impeccable` |
| Animations, micro-interactions, transitions | `emil-design-eng` |
| Component/page design in canvas | `canvas-design` |
| Brand colors, typography, design tokens | `brand-guidelines` |
| Theme system (dark/light/custom) | `theme-factory` |
| Onboarding flow conversion optimization | `onboarding-cro` |
| Signup/registration flow CRO | `signup-flow-cro` |
| Upgrade-to-Pro paywall CRO | `paywall-upgrade-cro` |
| Form UX and conversion | `form-cro` |
| Landing page CRO | `page-cro` |
| Pop-up/modal CRO | `popup-cro` |

### AI & Claude API
| Task | Skill |
|---|---|
| Claude API optimization — prompt caching, batching, model selection | `claude-api` |
| Build embeddings for school/athlete matching | `embeddings` |
| Vector search for school recommendations | `vector-search` |
| Semantic cluster analysis (school grouping) | `vector-cluster` |
| Knowledge graph for recruiter relationships | `kg-extract` |

### Backend & Data
| Task | Skill |
|---|---|
| Supabase migration design | `migrate-create` |
| Validate a Supabase migration before running | `migrate-validate` |
| Background/scheduled tasks (email reminders, follow-up nudges) | `cron-schedule` or `schedule` |
| Scrape college program pages for school data | Exa MCP + `browser-scrape` |
| Web scraping with Firecrawl | Firecrawl MCP |
| Parse PDFs (NCAA guides, school brochures) | `pdf` |
| Export data to Excel/CSV | `xlsx` |

### Payments & Growth
| Task | Skill |
|---|---|
| Stripe integration, pricing tiers, webhooks | `agent-payments` |
| Pricing strategy for Pro/Family tiers | `pricing-strategy` |
| A/B test setup for pricing or onboarding | `ab-test-setup` |
| Referral program for athlete word-of-mouth | `referral-program` |
| Analytics event tracking (Mixpanel/Segment/PostHog) | `analytics-tracking` |
| Churn prevention — detect at-risk users | `churn-prevention` |

### Marketing & SEO
| Task | Skill |
|---|---|
| SEO audit for landing/marketing pages | `seo-audit` |
| Programmatic SEO (school pages, division pages) | `programmatic-seo` |
| Content strategy for recruit/parent blog | `content-strategy` |
| Social media content for recruiting tips | `social-content` |
| Cold email sequences (parent outreach, coach partnerships) | `cold-email` |
| Launch strategy for new features | `launch-strategy` |
| Ad creative for Facebook/Instagram | `ad-creative` |

### Quality & Security
| Task | Skill |
|---|---|
| Code review after completing a feature | `simplify` or `superpowers:requesting-code-review` |
| Verify implementation before marking done | `superpowers:verification-before-completion` |
| Security audit — auth, payments, RLS policies, data | `security-audit` or `security-review` |
| Security scan — OWASP, injection, XSS | `security-scan` |
| Find test coverage gaps | `test-gaps` |
| TDD workflow for new features | `superpowers:test-driven-development` or `tdd-workflow` |
| Systematic debugging | `superpowers:systematic-debugging` |
| Dependency vulnerabilities | `dependency-check` |

### DevOps & GitHub
| Task | Skill |
|---|---|
| Create/manage GitHub PRs | `agent-github-pr-manager` |
| GitHub automation (labels, workflows, CI) | `github-automation` |
| CI/CD pipeline | `agent-ops-cicd-github` |
| Release management | `agent-release-manager` |
| Performance profiling | `agent-performance-optimizer` or `performance-analysis` |

### Documents & Exports
| Task | Skill |
|---|---|
| Generate recruiting guide PDF for athletes | `pdf` |
| Build recruiting tracker spreadsheet export | `xlsx` |
| Create presentation/pitch deck | `pptx` |
| API documentation | `agent-docs-api-openapi` |
