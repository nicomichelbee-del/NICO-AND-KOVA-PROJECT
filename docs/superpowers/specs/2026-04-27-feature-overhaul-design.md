# Feature Overhaul Design — 2026-04-27

## Scope

Five existing features are being overhauled for accuracy, usability, and automation:

1. School Matches — realistic algorithmic scoring
2. Coach Email Generator — auto-find coach
3. ID Camps — division/school picker + multi-school events
4. Outreach Tracker — Gmail OAuth integration
5. Roster Intel — static database, zero AI hallucination

---

## 1. School Matches

### Problem
Claude assigns match scores without enforcement constraints. A 2.9 GPA athlete can receive 95% match with UCLA because the AI has no guardrails.

### Solution
Replace AI school selection and scoring with:
- A static JSON file at `server/data/schools.json` containing ~80 real programs
- A deterministic scoring algorithm in `server/lib/schoolMatcher.ts`
- Claude is used only to generate the `notes` field (why reach/target/safety), not to pick schools or assign scores

### Static School Data Shape
```ts
interface SchoolRecord {
  id: string
  name: string
  division: 'D1' | 'D2' | 'D3' | 'NAIA' | 'JUCO'
  conference: string
  location: string           // "City, ST"
  region: string             // "Southeast" | "Northeast" | "Midwest" | "West" | "Southwest"
  enrollment: number
  size: 'small' | 'medium' | 'large'  // <5k, 5k-15k, >15k
  mensCoach: string
  mensCoachEmail: string
  womensCoach: string
  womensCoachEmail: string
  gpaMin: number             // minimum typical GPA for admitted athletes
  gpaAvg: number             // average GPA for admitted athletes
  goalsForwardAvg: number    // typical season goals for a starter forward
  goalsMidAvg: number        // typical season goals for a starter midfielder
  programStrength: number    // 1-10 internal ranking for reach/target/safety baseline
}
```

### Scoring Algorithm (`server/lib/schoolMatcher.ts`)
Inputs: `AthleteProfile`, array of `SchoolRecord`

Score components (0–100 each, weighted):
| Factor | Weight | Logic |
|--------|--------|-------|
| GPA alignment | 40% | Ratio of athlete GPA to school gpaAvg, capped 0–100 |
| Stats alignment | 30% | Athlete goals vs position average for that school's division |
| Division fit | 20% | Athlete's `targetDivision` matches school's division = 100, one step away = 60, two steps = 20 |
| Size/location pref | 10% | Enrollment size match + region match |

Category thresholds (applied after scoring):
- `reach`: score < 55
- `target`: score 55–79
- `safety`: score ≥ 80

Return 25 schools: distribute so at least 4 reach, at least 8 safety, rest target. Sort by score descending within each category.

### API Change
`POST /api/ai/schools` no longer calls Claude for school selection. It runs the matcher, then makes a single Claude call per school to generate the `notes` string only (batched as one prompt returning JSON array of note strings).

### UI Change
Schools.tsx: no changes needed to layout. Increase displayed count from 15 → 25. Fix typo `conferece` → `conference` in type and UI.

---

## 2. Coach Email Generator

### Problem
User must manually type the coach name. Friction prevents use.

### New Flow
1. User enters school name + selects division + selects Men's / Women's
2. Clicks **"Find Coach"** button
3. Backend calls Claude: `POST /api/ai/find-coach` → returns `{ coachName, coachEmail, confidence: 'high'|'low' }`
4. Form auto-fills coach name and email fields
5. Low-confidence results show a yellow warning: "Couldn't verify — double-check before sending"
6. User confirms/edits, then clicks **"Generate Email"**

### New Endpoint
`POST /api/ai/find-coach`
- Input: `{ school: string, division: Division, gender: 'mens' | 'womens' }`
- Claude prompt instructs: return only if confident, flag uncertainty, never fabricate if unsure
- Output: `{ coachName: string, coachEmail: string, confidence: 'high' | 'low' }`

### UI Changes (`Emails.tsx`)
- Add `gender` toggle: Men's / Women's
- Remove required `coachName` from initial form — it becomes auto-filled
- Add "Find Coach" button with loading state
- Show coach info card with confidence indicator before generating email
- Coach name + email fields remain editable after auto-fill

---

## 3. ID Camps

### Problem
Only auto-finds camps from matched schools. No manual school selection. No awareness of large multi-school events.

### New UI Layout

**Tab 1: School ID Camps**
- Left panel: Division selector (D1/D2/D3/NAIA/JUCO) + school search input with autocomplete from `schools.json` + "Add" button → builds a list of up to 8 target schools
- "Find Camps" button calls existing `/api/ai/find-camps` with the custom school list
- Right panel: unchanged camp detail + email generation flow

**Tab 2: Major ID Events**
- Static curated list in `server/data/idEvents.json`
- Filtered by selected division
- Each event shows: name, date range, location, typical coach attendance count, cost range, registration URL
- Events include: NSCAA Convention ID, Jefferson Cup, Disney Soccer Showcase, TopDrawerSoccer events, Nike/adidas regional showcases, conference-run ID events
- No AI involved — purely static data rendered from JSON

### Static Event Data Shape
```ts
interface IdEvent {
  id: string
  name: string
  organizer: string
  divisions: Division[]
  gender: 'mens' | 'womens' | 'both'
  dateRange: string           // "June 14–16, 2026"
  location: string
  coachAttendance: string     // "50–100 coaches"
  costRange: string           // "$150–$300"
  url: string
  notes: string               // "Largest D1 showcase on the East Coast"
}
```

---

## 4. Outreach Tracker — Gmail OAuth

### Architecture
- `googleapis` npm package on the backend
- Google OAuth 2.0 per-user flow
- Refresh tokens stored in Supabase `user_gmail_tokens` table
- All Gmail API calls happen server-side only (tokens never exposed to frontend)

### OAuth Flow
1. User clicks **"Connect Gmail"** in Tracker
2. Frontend calls `GET /api/gmail/auth?userId=<uid>` → backend returns a Google OAuth URL
3. Frontend opens URL in a popup window
4. Google redirects to `/api/gmail/callback?code=...&state=<userId>`
5. Backend exchanges code for access + refresh tokens, stores in Supabase
6. Popup closes, frontend polls for connection status
7. Tracker UI updates to show "Gmail Connected ✓"

### Supabase Table
```sql
create table user_gmail_tokens (
  user_id uuid references auth.users primary key,
  refresh_token text not null,
  email text not null,
  created_at timestamptz default now()
);
```

### New API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET /api/gmail/auth` | Returns Google OAuth authorization URL |
| `GET /api/gmail/callback` | Handles OAuth redirect, stores token |
| `GET /api/gmail/status` | Returns whether user has connected Gmail |
| `POST /api/gmail/send` | Sends email via Gmail API using stored token |
| `POST /api/gmail/sync` | Searches inbox for replies to tracked coach emails |

### Send Flow
- "Send via Gmail" button appears on contacts with `status: 'draft'`
- Calls `POST /api/gmail/send` with `{ userId, to: coachEmail, subject, body }`
- On success: status → `'sent'`, sentAt → now
- On error: show error toast, status unchanged

### Sync Flow
- "Check for Replies" button in Tracker header
- Calls `POST /api/gmail/sync` with `{ userId, contacts: [...] }`
- Backend searches Gmail for threads where any of the coach emails replied
- Returns list of `{ contactId, replied: boolean, snippet }` 
- Frontend updates matching contacts to `status: 'responded'`, sets `respondedAt`

### Required `.env` Variables
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/gmail/callback
```

### Google Cloud Setup (documented in README)
1. Create project at console.cloud.google.com
2. Enable Gmail API
3. Create OAuth 2.0 credentials (Web application)
4. Add redirect URI: `http://localhost:3001/api/gmail/callback`
5. Add test users (while in development)

---

## 5. Roster Intel — Static Database, Zero AI

### Problem
AI hallucinates specific program details: wrong coaches, fabricated senior counts, incorrect conferences.

### Solution
Remove all AI from this feature. Replace with a static curated database.

### Static Data (`server/data/rosterPrograms.json`)
~150 entries covering major programs across all divisions, split by gender.

```ts
interface RosterProgram {
  id: string
  school: string
  division: Division
  conference: string
  location: string
  gender: 'mens' | 'womens'
  coachName: string
  coachEmail: string
  typicalRecruitingNeeds: {
    position: string        // "Striker" | "Center Back" | etc.
    level: 'High' | 'Medium' | 'Low'
  }[]
  formationStyle: string    // "4-3-3" | "4-4-2" | etc.
  notes: string             // "Historically recruits from ECNL"
}
```

### Recruiting Needs Logic
"Recruiting Needs" is based on typical class size and formation for each program — not on live roster data (which changes weekly and cannot be reliably sourced). Each program has pre-defined `typicalRecruitingNeeds` in the JSON.

### API Change
`POST /api/ai/roster-intel` no longer calls Claude. It:
1. Filters `rosterPrograms.json` by `gender` and `division`
2. If `athletePosition` is provided, sorts results by relevance to that position (matching position in `typicalRecruitingNeeds`)
3. Returns filtered + sorted programs

### UI Changes (`RosterIntel.tsx`)
- Remove the AI loading state (results are instant)
- Rename column "Seniors Leaving" → "Typically Recruiting"
- Add disclaimer banner: "Program data sourced from athletic department records. Recruiting needs reflect typical class patterns, not live roster data."
- Add a "Last verified: Spring 2026" label per program

### Position Summary
Computed client-side from the filtered programs: count how many programs have High/Medium need at each position — no AI required.

---

## File Changes Summary

### New Files
- `server/data/schools.json` — ~80 school records
- `server/data/idEvents.json` — ~30 major ID events
- `server/data/rosterPrograms.json` — ~150 roster program records
- `server/lib/schoolMatcher.ts` — deterministic scoring algorithm
- `server/routes/gmail.ts` — Gmail OAuth + API routes

### Modified Files
- `server/routes/ai.ts` — update `/schools`, `/roster-intel`, add `/find-coach`
- `server/index.ts` — mount Gmail router
- `client/src/lib/api.ts` — add `findCoach`, `gmailAuth`, `gmailSend`, `gmailSync`
- `client/src/pages/dashboard/Schools.tsx` — consume new matcher output
- `client/src/pages/dashboard/Emails.tsx` — add gender toggle + find-coach flow
- `client/src/pages/dashboard/Camps.tsx` — add tabs + school picker + static events
- `client/src/pages/dashboard/Tracker.tsx` — add Gmail connect + send + sync
- `client/src/pages/dashboard/RosterIntel.tsx` — remove AI, render static data
- `client/src/types/index.ts` — add `IdEvent`, update `School`, fix typo
- `.env` — add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `package.json` — add `googleapis` dependency
