# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AI-powered college recruitment counselor for high school soccer players. Helps athletes navigate the full recruitment process: building profiles, matching to schools, generating coach outreach emails, and tracking responses.

## Tech Stack

- **Frontend:** React + TypeScript, mobile-first
- **Backend/DB:** Supabase
- **Payments:** Stripe
- **AI:** Claude API (`claude-sonnet-4-20250514`)

## Architecture

All AI calls are routed through a single `/api/ai` service layer — never call the Claude API directly from components or other API routes.

Component-based React architecture. Keep UI simple and clean — primary users are teenagers on phones.

## Pricing Tiers

- **Free:** 3 coach emails, 5 school matches
- **Pro ($19/mo):** Unlimited emails + outreach tracker
- **Family ($29/mo):** Pro + parent dashboard view

Enforce limits in the `/api/ai` layer using Supabase to track usage per user.

## Core Features

1. **Athlete Profile Builder** — position, GPA, stats, grad year, location/size preferences, division goal (D1/D2/D3/NAIA)
2. **School Matcher** — reach/target/safety schools based on stats and preferences
3. **Coach Email Generator** — personalized cold outreach based on athlete profile
4. **Outreach Tracker** — dashboard tracking contacts, responses, follow-ups
5. **Follow-up Assistant** — follow-up emails, thank-you notes, responses to coach questions
6. **Highlight Video Rater** — athlete submits their highlight video URL; AI analyzes and rates the video, then gives specific, actionable feedback on what to add, cut, or improve to maximize recruiting appeal

## AI Persona

The AI acts as a college soccer recruitment counselor with 15+ years of experience. Tone: encouraging, direct, soccer-specific. Audience is athletes AND parents.

- Always tailor advice to soccer (positions, stats, tryout culture) — never generic
- D1 coach emails: professional, concise, stat-heavy
- D2/D3 coach emails: warmer, emphasize academic fit
- NAIA/JUCO coach emails: emphasize immediate playing time potential

## Coach Email Requirements

Every generated coach email must include:
- Graduation year and position
- Club team name and league (club > high school for D1)
- Key stats (goals, assists, season)
- GPA and intended major
- Highlight video link
- Why that specific school/program
- Clear ask (campus visit, ID camp, or phone call)

## Highlight Video Rater Requirements

When rating a highlight video, the AI should:
- Accept a YouTube/Hudl/other video URL from the athlete
- Rate the video overall (1–10) with a brief summary of strengths
- Give specific, actionable improvement points covering:
  - Opening clip quality (first 30 seconds matter most to coaches)
  - Clip variety (goals, assists, defensive plays, 1v1s, set pieces)
  - Video length (ideal: 3–5 minutes)
  - Production quality (title card, music, pacing)
  - Stat/info overlay presence (name, grad year, position, club, GPA)
  - Whether the video showcases position-specific skills coaches look for
- Tailor feedback to the target division (D1 coaches want elite skill clips; D3 coaches care more about fit and versatility)
- Tone: encouraging but honest — don't sugarcoat weak videos
- This feature is Pro/Family tier only (not Free)

## Soccer Domain Knowledge

- Division hierarchy: D1 > D2 > D3 > NAIA > JUCO
- D1 recruiting timeline: most offers happen sophomore/junior year
- D1/D2 athletes must register with the NCAA Eligibility Center
- Key stats: goals, assists, position, club team, tournament experience, GPA, SAT/ACT
You have gstack installed — Garry Tan's Claude Code skill pack. Here's how to use it:

## gstack Sprint Workflow
Always follow this order: Think → Plan → Build → Review → Test → Ship → Reflect

## When to use which skill

**Starting something new:**
- /office-hours — START HERE for any new feature or product idea. Six forcing questions that reframe your approach before writing code. Run this before anything else.
- /autoplan — runs CEO + design + eng review automatically in one command. Use when you want a fully reviewed plan without running each step manually.

**Planning (before code):**
- /plan-ceo-review — challenge scope, find the simpler version, stress-test the idea
- /plan-eng-review — lock architecture, data flow, edge cases, test matrix
- /plan-design-review — rate design dimensions 0-10, catch AI slop, interactive one-question-at-a-time
- /plan-devex-review — use if building APIs, CLIs, SDKs, or developer-facing tools

**Building:**
- /design-consultation — build a design system from scratch with DESIGN.md
- /design-shotgun — generate 4-6 visual variants side by side, iterate with feedback until you love one
- /design-html — turn an approved mockup into production-ready HTML/CSS (zero deps, dynamic layout)

**Reviewing (after code is written):**
- /review — find bugs that pass CI but blow up in production. Auto-fixes obvious ones.
- /investigate — systematic root-cause debugging. No fixes without investigation first.
- /design-review — same audit as plan-design-review but then fixes what it finds
- /devex-review — live DX audit, tests your actual onboarding flow (for dev tools)
- /cso — OWASP Top 10 + STRIDE security audit. Use before any production deploy.
- /codex — get an independent second opinion from OpenAI Codex (different model, same diff)

**Testing:**
- /qa <url> — open a real browser, click through flows, find + fix bugs, generate regression tests
- /qa-only <url> — same as /qa but report only, no code changes

**Shipping:**
- /ship — sync main, run tests, audit coverage, push branch, open PR. Bootstraps test framework if none exists.
- /land-and-deploy — merge PR, wait for CI + deploy, verify production health
- /canary — post-deploy monitoring loop, watches for errors and regressions

**Utilities:**
- /browse — give yourself a real Chromium browser for any web task
- /careful — warn before destructive commands (rm -rf, DROP TABLE, force-push)
- /freeze — lock edits to one directory while debugging
- /guard — /careful + /freeze combined. Use for production work.
- /retro — weekly retrospective, per-person breakdowns, shipping streaks
- /learn — manage what gstack learned across sessions
- /document-release — update all docs to match what just shipped
- /gstack-upgrade — upgrade gstack to latest

## Key rules
- Never start coding without running /office-hours or /autoplan first on new features
- Always run /review before /ship
- Always run /qa on a staging URL before /land-and-deploy
- Use /careful or /guard any time you're touching production
- /ship auto-runs /document-release — docs stay current automatically
- Use /browse for all web browsing. Never use mcp__claude-in-chrome__* tools.

## Review routing cheat sheet
| Building for...           | Before code          | After shipping   |
|---------------------------|----------------------|------------------|
| End users (UI/web/mobile) | /plan-design-review  | /design-review   |
| Developers (API/CLI/SDK)  | /plan-devex-review   | /devex-review    |
| Architecture/perf/tests   | /plan-eng-review     | /review          |
| All of the above          | /autoplan            | —                |
