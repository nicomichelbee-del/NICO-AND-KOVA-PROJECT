# Major Features Design — AI Soccer College Counselor
**Date:** 2026-04-26

## Overview

Seven feature groups added to the existing React + Supabase + Express + Claude AI app. All AI calls route through `/api/ai`. Frontend uses localStorage for persistence during Phase 1 (no live Supabase configured yet).

---

## Feature 1: Google OAuth Sign-In

**Placement:** Login.tsx, Signup.tsx
**Approach:** Supabase `signInWithOAuth({ provider: 'google' })`. Adds a "Continue with Google" button above the email/password form with a visual divider. Phase 2 adds a "Connect Gmail" button in user settings to request Gmail API read scope for inbox integration.

**Data:** No new data model — Supabase handles OAuth session.

---

## Feature 2: ECNL / MLS NEXT Schedule Picker

**Placement:** New section in FollowUp.tsx above the context textarea
**Approach:** Hybrid — pre-loaded chip list of major annual events + free-text custom event input. Selected events are concatenated into the follow-up prompt context so the AI naturally weaves schedule mentions into the email.

**Pre-loaded events:**
- ECNL Playoffs (June)
- ECNL National Championship (July)
- MLS NEXT Fest (June)
- MLS NEXT Fall Showcase (September)
- MLS NEXT 2 Spring Showcase (April)
- MLS NEXT 2 Summer Showcase (July)
- ECNL Boys Playoffs (June)
- ECNL Boys National Championship (July)

**Data:** No persistence needed — ephemeral form state.

---

## Feature 3: Coach Response Tracker Tab

**Placement:** New "Coach Responses" tab in Tracker.tsx alongside existing "Contacts" tab
**Approach:** Two input modes toggled by radio:
1. **Full paste** — athlete pastes the coach's reply; AI reads and rates it
2. **Quick form** — school name, coach name, checkboxes (Did they respond? Invite to visit? Asked questions? Mentioned scholarship?)

**Interest ratings:** 🔥 Hot / ☀️ Warm / ❄️ Cold / ⛔ Not Interested

**AI output per response:** rating label, confidence %, key signals extracted (e.g., "mentioned campus visit", "asked for highlight video"), recommended next action.

**New API endpoint:** `POST /api/ai/rate-response` → `{ rating, confidence, signals, nextAction }`

**Data:** localStorage `coachResponses[]` — `{ id, school, coach, date, rating, confidence, signals, nextAction, rawText? }`

---

## Feature 4: Video Leaderboard

**Placement:**
- Tab "Leaderboard 🏆" in VideoRater.tsx (dashboard, logged-in users)
- Public page `/leaderboard` — no login required, shareable URL

**Approach:** When rating a video, athlete sees opt-in checkbox "Add my video to the public leaderboard (your name, position, club, and video link will be visible)." Top 10 videos sorted by score, displayed with rank badge, athlete name (or "Anonymous"), position, club, division goal, score, and clickable video link.

**Data:** localStorage `videoLeaderboard[]` — `{ id, athleteName, position, club, gradYear, divisionGoal, score, videoUrl, optedIn, ratedAt }`

---

## Feature 5: ID Camp Finder + Coach Emailer

**Placement:** New dashboard page `/dashboard/camps` with sidebar entry "ID Camps ⛺"
**Approach:**
1. **Camp Finder** — AI searches its knowledge of ID camps at schools in the athlete's matched list (reach/target/safety). Returns camps with: name, school, date, location, cost, URL, attending coaches list.
2. **Coach Emailer** — Athlete selects a camp, sees the coach list, selects all or individual coaches, and clicks "Generate Emails." App batch-generates personalized cold outreach emails for each coach using the athlete's profile + camp context ("I'll be attending your ID camp on [date] at [location]").
3. Emails shown in expandable cards — athlete copies individually or reviews all.

**New API endpoints:**
- `POST /api/ai/find-camps` → `{ camps: Camp[] }` (input: `{ profile, schools }`)
- `POST /api/ai/camp-emails` → `{ emails: { coachName, subject, body }[] }` (input: `{ profile, camp, coaches }`)

**Camp type:** `{ id, school, division, campName, date, location, cost, url, coaches: { name, title }[] }`

---

## Feature 6: Roster Intelligence

**Placement:** New dashboard page `/dashboard/roster` with sidebar entry "Roster Intel 📊"

**Approach:** AI analyzes graduating seniors across college soccer programs and predicts recruitment needs by position and division. Athlete selects gender (Men's / Women's) and division. AI returns a ranked list of programs with highest positional need, plus a position-level summary ("D2 Women's needs: Strikers (High), Center Backs (High), Goalkeepers (Medium)").

**Sections:**
- Gender toggle: Men's / Women's
- Division filter: All / D1 / D2 / D3 / NAIA / JUCO
- Results table: School, Conference, Graduating Seniors (count + positions), Predicted Need (High/Med/Low per position)
- Summary insight card: top 3 positions with highest demand in selected division
- "Email This Coach" shortcut per row — launches email generator pre-filled with that school

**New API endpoint:** `POST /api/ai/roster-intel` → `{ programs: Program[], positionSummary: PositionNeed[] }` (input: `{ gender, division, athletePosition }`)

**Program type:** `{ school, conference, division, seniorsLeaving: { position, count }[], predictedNeed: { position, level }[], coachName, coachEmail? }`

---

## Architecture Notes

- All new AI endpoints follow the existing pattern in `server/routes/ai.ts`
- Frontend API calls added to `client/src/lib/api.ts`
- New pages created in `client/src/pages/dashboard/`
- Routes added in `client/src/App.tsx`
- Sidebar updated in `client/src/components/layout/Sidebar.tsx`
- LocalStorage keys: `coachResponses`, `videoLeaderboard`, `idCamps`, `rosterIntel`
- Phase 2: migrate localStorage to Supabase tables when credentials are live
