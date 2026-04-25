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
