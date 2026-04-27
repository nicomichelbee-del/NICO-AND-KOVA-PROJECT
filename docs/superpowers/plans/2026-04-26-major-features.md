# Major Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 feature groups to the AI Soccer College Counselor: Google OAuth, ECNL/MLS NEXT schedule picker, coach response tracker tab, video leaderboard, ID camp finder + emailer, and roster intelligence.

**Architecture:** All new AI features follow the existing pattern: React page → `client/src/lib/api.ts` → `POST /api/ai/<route>` in `server/routes/ai.ts` → Claude. New types go in `client/src/types/index.ts`. LocalStorage is used for persistence (Supabase migration is Phase 2). Two new dashboard pages and one public `/leaderboard` route are added.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, React Router v6, Express, Anthropic SDK (`claude-sonnet-4-20250514`), Supabase Auth

---

## File Map

**Modified:**
- `client/src/types/index.ts` — add `CoachResponse`, `IdCamp`, `CampCoach`, `LeaderboardEntry`, `RosterProgram`, `PositionNeed`
- `client/src/lib/api.ts` — add `rateResponse`, `findCamps`, `generateCampEmails`, `getRosterIntel`
- `server/routes/ai.ts` — add `/rate-response`, `/find-camps`, `/camp-emails`, `/roster-intel` endpoints
- `client/src/App.tsx` — add `/dashboard/camps`, `/dashboard/roster`, `/leaderboard` routes
- `client/src/components/layout/Sidebar.tsx` — add ID Camps and Roster Intel nav items
- `client/src/pages/Login.tsx` — add Google OAuth button
- `client/src/pages/Signup.tsx` — add Google OAuth button
- `client/src/pages/dashboard/FollowUp.tsx` — add schedule picker section
- `client/src/pages/dashboard/Tracker.tsx` — add Coach Responses tab
- `client/src/pages/dashboard/VideoRater.tsx` — add Leaderboard tab

**Created:**
- `client/src/pages/dashboard/Camps.tsx` — ID Camp Finder + Coach Emailer
- `client/src/pages/dashboard/RosterIntel.tsx` — Roster Intelligence
- `client/src/pages/Leaderboard.tsx` — Public leaderboard page

---

## Task 1: Add New Types

**Files:**
- Modify: `client/src/types/index.ts`

- [ ] **Step 1: Add new types to the end of the types file**

```typescript
// Append to client/src/types/index.ts

export interface CoachResponse {
  id: string
  school: string
  coachName: string
  date: string
  rating: 'hot' | 'warm' | 'cold' | 'not_interested'
  confidence: number
  signals: string[]
  nextAction: string
  rawText?: string
}

export interface CampCoach {
  name: string
  title: string
}

export interface IdCamp {
  id: string
  school: string
  division: Division
  campName: string
  date: string
  location: string
  cost: string
  url: string
  coaches: CampCoach[]
}

export interface LeaderboardEntry {
  id: string
  athleteName: string
  position: string
  clubTeam: string
  gradYear: number
  divisionGoal: Division
  score: number
  videoUrl: string
  ratedAt: string
}

export interface RosterProgram {
  school: string
  conference: string
  division: Division
  seniorsLeaving: { position: string; count: number }[]
  predictedNeed: { position: string; level: 'High' | 'Medium' | 'Low' }[]
  coachName: string
}

export interface PositionNeed {
  position: string
  demand: 'High' | 'Medium' | 'Low'
  schoolCount: number
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/types/index.ts
git commit -m "feat: add new types for all major features"
```

---

## Task 2: Add API Client Functions

**Files:**
- Modify: `client/src/lib/api.ts`

- [ ] **Step 1: Add new imports and functions**

Replace the entire contents of `client/src/lib/api.ts` with:

```typescript
import type { AthleteProfile, Division, School, VideoRating, CoachResponse, IdCamp, LeaderboardEntry, RosterProgram, PositionNeed } from '../types'

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error((err as { error: string }).error ?? 'Request failed')
  }
  return res.json()
}

export function generateEmail(profile: AthleteProfile, school: string, division: Division, coachName: string) {
  return post<{ subject: string; body: string }>('/api/ai/email', { profile, school, division, coachName })
}

export function matchSchools(profile: AthleteProfile) {
  return post<{ schools: School[] }>('/api/ai/schools', { profile })
}

export function rateVideo(videoUrl: string, profile: AthleteProfile) {
  return post<VideoRating>('/api/ai/video', { videoUrl, profile })
}

export function generateFollowUp(profile: AthleteProfile, context: string, type: 'followup' | 'thankyou' | 'answer') {
  return post<{ body: string }>('/api/ai/followup', { profile, context, type })
}

export function rateResponse(school: string, coachName: string, text: string) {
  return post<CoachResponse>('/api/ai/rate-response', { school, coachName, text })
}

export function findCamps(profile: AthleteProfile, schools: School[]) {
  return post<{ camps: IdCamp[] }>('/api/ai/find-camps', { profile, schools })
}

export function generateCampEmails(profile: AthleteProfile, camp: IdCamp, coaches: CampCoach[]) {
  return post<{ emails: { coachName: string; subject: string; body: string }[] }>('/api/ai/camp-emails', { profile, camp, coaches })
}

export function getRosterIntel(gender: 'mens' | 'womens', division: Division | 'all', athletePosition: string) {
  return post<{ programs: RosterProgram[]; positionSummary: PositionNeed[] }>('/api/ai/roster-intel', { gender, division, athletePosition })
}
```

Note: add `import type { CampCoach } from '../types'` to the import line above (already included in the IdCamp import chain).

- [ ] **Step 2: Fix the import — CampCoach is already imported via the types list, verify it compiles**

The import line already includes `CampCoach` in the destructured list. No further action needed.

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/api.ts
git commit -m "feat: add api client functions for new features"
```

---

## Task 3: Add Server AI Endpoints

**Files:**
- Modify: `server/routes/ai.ts`

- [ ] **Step 1: Add four new endpoints before `export default router`**

Insert the following before the final `export default router` line in `server/routes/ai.ts`:

```typescript
router.post('/rate-response', async (req, res) => {
  try {
    const { school, coachName, text } = req.body as { school: string; coachName: string; text: string }
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `${PERSONA}\n\nAnalyze this coach reply and rate their interest level in the athlete.\n\nSchool: ${school}\nCoach: ${coachName}\nReply:\n${text}\n\nRespond with JSON: { "rating": "hot|warm|cold|not_interested", "confidence": 85, "signals": ["invited to visit", "asked for film"], "nextAction": "Schedule a campus visit — they want to meet you in person." }\n\nRating guide: hot=very interested (visit invite, scholarship mention, follow-up questions), warm=interested but cautious (generic positive reply, asked one question), cold=polite decline or noncommittal, not_interested=explicit no or no response after multiple contacts.`,
      }],
    })
    const text2 = (message.content[0] as { text: string }).text
    const json = JSON.parse(text2.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
    res.json({ ...json, id: crypto.randomUUID(), school, coachName, date: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/find-camps', async (req, res) => {
  try {
    const { profile, schools } = req.body as { profile: import('../../client/src/types/index').AthleteProfile; schools: import('../../client/src/types/index').School[] }
    const schoolList = schools.map((s: import('../../client/src/types/index').School) => `${s.name} (${s.division})`).join(', ')
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `${PERSONA}\n\nFind ID camps for a ${profile.position} (Class ${profile.gradYear}, ${profile.targetDivision} target) at these schools: ${schoolList}.\n\nReturn 6-10 camps across these schools plus 2-3 major open ID camps in the region. Include real or highly realistic camp details.\n\nRespond with JSON: { "camps": [{ "id": "uuid", "school": "...", "division": "D1", "campName": "...", "date": "June 14-16, 2026", "location": "City, ST", "cost": "$250", "url": "https://...", "coaches": [{ "name": "Coach Smith", "title": "Head Coach" }, { "name": "Coach Lee", "title": "Assistant Coach" }] }] }`,
      }],
    })
    const text = (message.content[0] as { text: string }).text
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{"camps":[]}')
    res.json(json)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/camp-emails', async (req, res) => {
  try {
    const { profile, camp, coaches } = req.body as {
      profile: import('../../client/src/types/index').AthleteProfile
      camp: import('../../client/src/types/index').IdCamp
      coaches: import('../../client/src/types/index').CampCoach[]
    }
    const coachList = coaches.map((c: import('../../client/src/types/index').CampCoach) => `${c.name} (${c.title})`).join('; ')
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `${PERSONA}\n\nWrite personalized ID camp outreach emails from the athlete to each coach listed.\n\nAthlete: ${profile.name}, ${profile.position}, Class of ${profile.gradYear}, ${profile.clubTeam} (${profile.clubLeague}), ${profile.goals}G/${profile.assists}A, GPA ${profile.gpa}, Highlight: ${profile.highlightUrl}\n\nCamp: ${camp.campName} at ${camp.school} on ${camp.date} in ${camp.location}\n\nCoaches: ${coachList}\n\nFor each coach, write a concise email (under 200 words) that mentions: attending their specific camp on the date, athlete stats, highlight link, why their program, and a clear ask to connect at the camp. Personalize the title in the greeting.\n\nRespond with JSON: { "emails": [{ "coachName": "...", "subject": "...", "body": "..." }] }`,
      }],
    })
    const text = (message.content[0] as { text: string }).text
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{"emails":[]}')
    res.json(json)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

router.post('/roster-intel', async (req, res) => {
  try {
    const { gender, division, athletePosition } = req.body as { gender: 'mens' | 'womens'; division: string; athletePosition: string }
    const divFilter = division === 'all' ? 'across D1, D2, D3, NAIA' : division
    const genderLabel = gender === 'mens' ? "Men's" : "Women's"
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `${PERSONA}\n\nAnalyze ${genderLabel} college soccer roster needs for ${divFilter} programs. Focus on seniors graduating this spring and which positions will have openings.\n\nAthlete's position of interest: ${athletePosition}\n\nReturn 15 programs with the most significant roster needs. For each, list which positions seniors are leaving and predicted recruitment need level. Also return a position-level summary showing overall demand.\n\nRespond with JSON:\n{\n  "programs": [\n    {\n      "school": "UNC Chapel Hill",\n      "conference": "ACC",\n      "division": "D1",\n      "seniorsLeaving": [{ "position": "Striker", "count": 2 }, { "position": "Center Back", "count": 1 }],\n      "predictedNeed": [{ "position": "Striker", "level": "High" }, { "position": "Center Back", "level": "Medium" }],\n      "coachName": "Anson Dorrance"\n    }\n  ],\n  "positionSummary": [\n    { "position": "Striker", "demand": "High", "schoolCount": 12 },\n    { "position": "Goalkeeper", "demand": "Medium", "schoolCount": 8 }\n  ]\n}`,
      }],
    })
    const text = (message.content[0] as { text: string }).text
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{"programs":[],"positionSummary":[]}')
    res.json(json)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})
```

- [ ] **Step 2: Add `crypto` import at top of server/routes/ai.ts if not present**

Node 18+ has `crypto` globally — no import needed.

- [ ] **Step 3: Commit**

```bash
git add server/routes/ai.ts
git commit -m "feat: add rate-response, find-camps, camp-emails, roster-intel API endpoints"
```

---

## Task 4: Google OAuth on Login and Signup

**Files:**
- Modify: `client/src/pages/Login.tsx`
- Modify: `client/src/pages/Signup.tsx`

- [ ] **Step 1: Update Login.tsx — add Google OAuth button above form**

Replace entire `client/src/pages/Login.tsx` with:

```typescript
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else navigate('/dashboard')
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2 font-serif text-lg font-bold text-[#f1f5f9] mb-10 no-underline">
          <div className="w-8 h-8 bg-[#eab308] rounded flex items-center justify-center text-sm">⚽</div>
          SoccerRecruit
        </Link>
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(234,179,8,0.15)] rounded-2xl p-8">
          <h1 className="font-serif text-2xl font-bold text-[#f1f5f9] mb-1">Welcome back</h1>
          <p className="text-sm text-[#64748b] mb-6">Sign in to your account</p>

          {error && (
            <div className="mb-5 p-3 bg-red-900/20 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
          )}

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 mb-5 bg-white hover:bg-gray-100 text-gray-800 font-semibold text-sm rounded-xl border border-gray-200 transition-all disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[rgba(255,255,255,0.07)]" />
            <span className="text-xs text-[#64748b]">or</span>
            <div className="flex-1 h-px bg-[rgba(255,255,255,0.07)]" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <p className="text-sm text-[#64748b] text-center mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#eab308] hover:underline">Sign up free</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update Signup.tsx — same Google OAuth button pattern**

Replace entire `client/src/pages/Signup.tsx` with:

```typescript
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    if (error) { setError(error.message); setLoading(false) }
    else navigate('/dashboard')
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2 font-serif text-lg font-bold text-[#f1f5f9] mb-10 no-underline">
          <div className="w-8 h-8 bg-[#eab308] rounded flex items-center justify-center text-sm">⚽</div>
          SoccerRecruit
        </Link>
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(234,179,8,0.15)] rounded-2xl p-8">
          <h1 className="font-serif text-2xl font-bold text-[#f1f5f9] mb-1">Start for free</h1>
          <p className="text-sm text-[#64748b] mb-6">No credit card required</p>

          {error && (
            <div className="mb-5 p-3 bg-red-900/20 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
          )}

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 mb-5 bg-white hover:bg-gray-100 text-gray-800 font-semibold text-sm rounded-xl border border-gray-200 transition-all disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[rgba(255,255,255,0.07)]" />
            <span className="text-xs text-[#64748b]">or</span>
            <div className="flex-1 h-px bg-[rgba(255,255,255,0.07)]" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Full name" type="text" placeholder="Alex Johnson" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? 'Creating account...' : 'Create Free Account'}
            </Button>
          </form>
          <p className="text-xs text-[#64748b] text-center mt-4">By signing up you agree to our Terms of Service.</p>
          <p className="text-sm text-[#64748b] text-center mt-3">
            Already have an account?{' '}
            <Link to="/login" className="text-[#eab308] hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Login.tsx client/src/pages/Signup.tsx
git commit -m "feat: add Google OAuth sign-in to login and signup pages"
```

---

## Task 5: ECNL / MLS NEXT Schedule Picker in Follow-up Assistant

**Files:**
- Modify: `client/src/pages/dashboard/FollowUp.tsx`

- [ ] **Step 1: Replace FollowUp.tsx with schedule-picker version**

```typescript
import { useState } from 'react'
import { generateFollowUp } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Textarea'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import type { AthleteProfile } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

const EMAIL_TYPES = [
  { value: 'followup' as const, label: '2-Week Follow-up', desc: "Coach hasn't responded after 2 weeks" },
  { value: 'thankyou' as const, label: 'Thank You Note', desc: 'After a campus visit or phone call' },
  { value: 'answer' as const, label: 'Answer Coach Question', desc: "Respond to a coach's inquiry" },
]

const PLACEHOLDERS: Record<string, string> = {
  followup: "e.g. Emailed Coach Smith at UNC Charlotte 2 weeks ago about the striker position. Haven't heard back.",
  thankyou: 'e.g. Just visited Notre Dame, met with Coach Williams, toured the facilities and training center.',
  answer: "e.g. Coach asked about my academic interests and whether I'm visiting other schools this fall.",
}

const PRESET_EVENTS = [
  { id: 'ecnl-playoffs', label: 'ECNL Girls Playoffs', date: 'June 2026' },
  { id: 'ecnl-nationals', label: 'ECNL Girls Nationals', date: 'July 2026' },
  { id: 'ecnl-boys-playoffs', label: 'ECNL Boys Playoffs', date: 'June 2026' },
  { id: 'ecnl-boys-nationals', label: 'ECNL Boys Nationals', date: 'July 2026' },
  { id: 'mls-next-fest', label: 'MLS NEXT Fest', date: 'June 2026' },
  { id: 'mls-next-fall', label: 'MLS NEXT Fall Showcase', date: 'September 2026' },
  { id: 'mls-next2-spring', label: 'MLS NEXT 2 Spring Showcase', date: 'April 2026' },
  { id: 'mls-next2-summer', label: 'MLS NEXT 2 Summer Showcase', date: 'July 2026' },
]

export function FollowUp() {
  const [type, setType] = useState<'followup' | 'thankyou' | 'answer'>('followup')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [customEvent, setCustomEvent] = useState('')

  function toggleEvent(id: string) {
    setSelectedEvents((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id])
  }

  function buildScheduleContext() {
    const presetLabels = PRESET_EVENTS.filter((e) => selectedEvents.includes(e.id)).map((e) => `${e.label} (${e.date})`)
    const all = customEvent.trim() ? [...presetLabels, customEvent.trim()] : presetLabels
    if (all.length === 0) return ''
    return `\n\nUpcoming schedule: ${all.join(', ')}.`
  }

  async function handleGenerate() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    setError(''); setLoading(true)
    try {
      const fullContext = context + buildScheduleContext()
      const { body } = await generateFollowUp(profile, fullContext, type)
      setResult(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate email')
    } finally { setLoading(false) }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="px-10 py-10 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Follow-up Assistant</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Follow-up Assistant</h1>
        <p className="text-[#64748b] mt-2 text-sm">Never stall a recruiting conversation. Always know exactly what to send next.</p>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {EMAIL_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => { setType(t.value); setResult('') }}
            className={`p-4 rounded-xl border text-left transition-all ${
              type === t.value
                ? 'border-[#eab308] bg-[rgba(234,179,8,0.06)]'
                : 'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(234,179,8,0.3)]'
            }`}
          >
            <div className={`text-sm font-bold mb-1 ${type === t.value ? 'text-[#eab308]' : 'text-[#f1f5f9]'}`}>{t.label}</div>
            <div className="text-xs text-[#64748b]">{t.desc}</div>
          </button>
        ))}
      </div>

      {/* Schedule Picker */}
      <Card className="p-5 mb-6">
        <div className="text-xs font-semibold text-[#eab308] uppercase tracking-wider mb-3">📅 My Upcoming Schedule (optional)</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESET_EVENTS.map((event) => (
            <button
              key={event.id}
              onClick={() => toggleEvent(event.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                selectedEvents.includes(event.id)
                  ? 'bg-[rgba(234,179,8,0.1)] border-[#eab308] text-[#eab308]'
                  : 'bg-transparent border-[rgba(255,255,255,0.1)] text-[#64748b] hover:border-[rgba(234,179,8,0.4)] hover:text-[#f1f5f9]'
              }`}
            >
              {selectedEvents.includes(event.id) ? '✓ ' : ''}{event.label}
              <span className="ml-1 opacity-60">({event.date})</span>
            </button>
          ))}
        </div>
        <Input
          placeholder="+ Custom event (e.g. Regional Showcase in Dallas, May 2026)"
          value={customEvent}
          onChange={(e) => setCustomEvent(e.target.value)}
        />
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <Textarea
            label="Context (optional but recommended)"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={PLACEHOLDERS[type]}
            rows={6}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Email'}
          </Button>
        </div>

        <div>
          {result ? (
            <Card className="p-5 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <Badge variant="green">✓ Ready to send</Badge>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? '✓ Copied' : 'Copy'}
                </Button>
              </div>
              <pre className="text-sm text-[#f1f5f9] whitespace-pre-wrap font-sans leading-relaxed flex-1 overflow-y-auto scrollbar-hide">
                {result}
              </pre>
            </Card>
          ) : (
            <Card className="p-12 h-full flex flex-col items-center justify-center text-center">
              <div className="text-3xl mb-3">💬</div>
              <div className="font-serif text-base font-bold text-[#f1f5f9] mb-1">Your email appears here</div>
              <p className="text-xs text-[#64748b]">Choose a type, pick your events, and click Generate</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/dashboard/FollowUp.tsx
git commit -m "feat: add ECNL/MLS NEXT schedule picker to follow-up assistant"
```

---

## Task 6: Coach Response Tracker Tab

**Files:**
- Modify: `client/src/pages/dashboard/Tracker.tsx`

- [ ] **Step 1: Replace Tracker.tsx with tabbed version including Coach Responses**

```typescript
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { rateResponse } from '../../lib/api'
import type { CoachEmail, CoachResponse } from '../../types'

const DEMO: CoachEmail[] = [
  { id: '1', school: 'Wake Forest University', division: 'D1', coachName: 'Coach Hamilton', coachEmail: 'hamilton@wfu.edu', subject: 'Class of 2026 Striker — ECNL', body: '', status: 'responded', sentAt: '2025-04-10', respondedAt: '2025-04-14', createdAt: '2025-04-09' },
  { id: '2', school: 'Elon University', division: 'D1', coachName: 'Coach Rivera', coachEmail: '', subject: 'Class of 2026 Forward Interest', body: '', status: 'sent', sentAt: '2025-04-15', createdAt: '2025-04-14' },
  { id: '3', school: 'High Point University', division: 'D1', coachName: 'Coach Chen', coachEmail: '', subject: 'Prospective Student-Athlete Inquiry', body: '', status: 'draft', createdAt: '2025-04-18' },
  { id: '4', school: 'Appalachian State', division: 'D1', coachName: 'Coach Williams', coachEmail: '', subject: 'Class of 2026 Midfielder', body: '', status: 'sent', sentAt: '2025-04-20', createdAt: '2025-04-19' },
]

const statusColor: Record<CoachEmail['status'], 'green' | 'gold' | 'muted' | 'blue'> = {
  responded: 'green', sent: 'blue', draft: 'muted', not_interested: 'muted',
}

const ratingConfig = {
  hot: { label: '🔥 Hot', color: 'text-[#4ade80]', bg: 'bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)]' },
  warm: { label: '☀️ Warm', color: 'text-[#fbbf24]', bg: 'bg-[rgba(251,191,36,0.1)] border-[rgba(251,191,36,0.2)]' },
  cold: { label: '❄️ Cold', color: 'text-[#60a5fa]', bg: 'bg-[rgba(96,165,250,0.1)] border-[rgba(96,165,250,0.2)]' },
  not_interested: { label: '⛔ Not Interested', color: 'text-[#64748b]', bg: 'bg-[rgba(100,116,139,0.1)] border-[rgba(100,116,139,0.2)]' },
}

function loadResponses(): CoachResponse[] {
  try { return JSON.parse(localStorage.getItem('coachResponses') ?? '[]') } catch { return [] }
}
function saveResponses(r: CoachResponse[]) {
  localStorage.setItem('coachResponses', JSON.stringify(r))
}

export function Tracker() {
  const [tab, setTab] = useState<'contacts' | 'responses'>('contacts')
  const [contacts, setContacts] = useState<CoachEmail[]>(DEMO)
  const [filter, setFilter] = useState<CoachEmail['status'] | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newSchool, setNewSchool] = useState('')
  const [newCoach, setNewCoach] = useState('')

  // Responses tab state
  const [responses, setResponses] = useState<CoachResponse[]>(loadResponses)
  const [inputMode, setInputMode] = useState<'paste' | 'quick'>('paste')
  const [resSchool, setResSchool] = useState('')
  const [resCoach, setResCoach] = useState('')
  const [resText, setResText] = useState('')
  const [quickVisit, setQuickVisit] = useState(false)
  const [quickQuestions, setQuickQuestions] = useState(false)
  const [quickScholarship, setQuickScholarship] = useState(false)
  const [ratingLoading, setRatingLoading] = useState(false)
  const [ratingError, setRatingError] = useState('')

  function addContact() {
    if (!newSchool) return
    setContacts((prev) => [{
      id: crypto.randomUUID(), school: newSchool, division: 'D1',
      coachName: newCoach, coachEmail: '', subject: '', body: '',
      status: 'draft', createdAt: new Date().toISOString(),
    }, ...prev])
    setNewSchool(''); setNewCoach(''); setShowAdd(false)
  }

  function updateStatus(id: string, status: CoachEmail['status']) {
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c))
  }

  async function handleRateResponse() {
    if (!resSchool || !resCoach) { setRatingError('Please enter school and coach name.'); return }
    const text = inputMode === 'paste' ? resText
      : `Coach responded. ${quickVisit ? 'Invited to visit campus.' : ''} ${quickQuestions ? 'Asked follow-up questions.' : ''} ${quickScholarship ? 'Mentioned scholarship possibility.' : ''}`
    if (!text.trim()) { setRatingError('Please provide some context about the response.'); return }
    setRatingError(''); setRatingLoading(true)
    try {
      const result = await rateResponse(resSchool, resCoach, text)
      const entry: CoachResponse = { ...result, rawText: inputMode === 'paste' ? resText : undefined }
      const updated = [entry, ...responses]
      setResponses(updated)
      saveResponses(updated)
      setResSchool(''); setResCoach(''); setResText('')
      setQuickVisit(false); setQuickQuestions(false); setQuickScholarship(false)
    } catch (e) {
      setRatingError(e instanceof Error ? e.message : 'Failed to rate response')
    } finally { setRatingLoading(false) }
  }

  const filtered = filter === 'all' ? contacts : contacts.filter((c) => c.status === filter)
  const counts = {
    all: contacts.length,
    draft: contacts.filter((c) => c.status === 'draft').length,
    sent: contacts.filter((c) => c.status === 'sent').length,
    responded: contacts.filter((c) => c.status === 'responded').length,
  }

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Outreach</span>
          </div>
          <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Outreach Tracker</h1>
          <p className="text-[#64748b] mt-2 text-sm">Track every contact, response, and follow-up in one place.</p>
        </div>
        {tab === 'contacts' && <Button onClick={() => setShowAdd(!showAdd)}>+ Add Contact</Button>}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[rgba(255,255,255,0.07)] mb-8">
        {[{ id: 'contacts', label: 'Contacts' }, { id: 'responses', label: 'Coach Responses' }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'contacts' | 'responses')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? 'border-[#eab308] text-[#eab308]'
                : 'border-transparent text-[#64748b] hover:text-[#f1f5f9]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'contacts' && (
        <>
          {showAdd && (
            <Card className="p-5 mb-6 flex items-end gap-4 flex-wrap">
              <div className="flex-1 min-w-40">
                <Input label="School" value={newSchool} onChange={(e) => setNewSchool(e.target.value)} placeholder="University name" />
              </div>
              <div className="flex-1 min-w-40">
                <Input label="Coach name" value={newCoach} onChange={(e) => setNewCoach(e.target.value)} placeholder="Coach name" />
              </div>
              <Button onClick={addContact}>Add</Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            </Card>
          )}

          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total', value: counts.all, color: 'text-[#f1f5f9]' },
              { label: 'Drafted', value: counts.draft, color: 'text-[#64748b]' },
              { label: 'Sent', value: counts.sent, color: 'text-[#60a5fa]' },
              { label: 'Responded', value: counts.responded, color: 'text-[#4ade80]' },
            ].map(({ label, value, color }) => (
              <Card key={label} className="p-4 text-center">
                <div className={`font-serif text-3xl font-black ${color}`}>{value}</div>
                <div className="text-xs text-[#64748b] mt-0.5">{label}</div>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 mb-5">
            {(['all', 'draft', 'sent', 'responded'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${
                  filter === f
                    ? 'bg-[#eab308] text-black border-[#eab308]'
                    : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                }`}
              >
                {f} {f !== 'all' ? `(${counts[f as keyof typeof counts]})` : ''}
              </button>
            ))}
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.07)]">
                    {['School', 'Coach', 'Div', 'Status', 'Sent', 'Response', 'Update'].map((h) => (
                      <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="px-5 py-4 font-medium text-[#f1f5f9] whitespace-nowrap">{c.school}</td>
                      <td className="px-5 py-4 text-[#64748b] whitespace-nowrap">{c.coachName}</td>
                      <td className="px-5 py-4"><Badge variant="muted">{c.division}</Badge></td>
                      <td className="px-5 py-4"><Badge variant={statusColor[c.status]}>{c.status}</Badge></td>
                      <td className="px-5 py-4 text-[#64748b] text-xs whitespace-nowrap">{c.sentAt ? new Date(c.sentAt).toLocaleDateString() : '—'}</td>
                      <td className="px-5 py-4 text-[#64748b] text-xs whitespace-nowrap">{c.respondedAt ? new Date(c.respondedAt).toLocaleDateString() : '—'}</td>
                      <td className="px-5 py-4">
                        <select
                          value={c.status}
                          onChange={(e) => updateStatus(c.id, e.target.value as CoachEmail['status'])}
                          className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded text-xs text-[#64748b] px-2 py-1.5 focus:outline-none focus:border-[#eab308]"
                        >
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="responded">Responded</option>
                          <option value="not_interested">Not Interested</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === 'responses' && (
        <div className="flex flex-col gap-6">
          {/* Input card */}
          <Card className="p-6">
            <div className="text-sm font-bold text-[#f1f5f9] mb-4">Log a Coach Response</div>
            <div className="flex gap-3 mb-5">
              {[{ id: 'paste', label: 'Paste Full Reply' }, { id: 'quick', label: 'Quick Form' }].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setInputMode(m.id as 'paste' | 'quick')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    inputMode === m.id
                      ? 'bg-[#eab308] text-black border-[#eab308]'
                      : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="School" value={resSchool} onChange={(e) => setResSchool(e.target.value)} placeholder="University name" />
              <Input label="Coach name" value={resCoach} onChange={(e) => setResCoach(e.target.value)} placeholder="Coach name" />
            </div>
            {inputMode === 'paste' ? (
              <Textarea
                label="Coach's reply (paste the full email text)"
                value={resText}
                onChange={(e) => setResText(e.target.value)}
                placeholder="Paste the coach's email reply here..."
                rows={5}
              />
            ) : (
              <div className="flex flex-col gap-3 p-4 bg-[rgba(255,255,255,0.02)] rounded-xl border border-[rgba(255,255,255,0.07)]">
                <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">What happened in their reply?</div>
                {[
                  { id: 'visit', label: 'Invited me for a campus visit', checked: quickVisit, set: setQuickVisit },
                  { id: 'questions', label: 'Asked follow-up questions about me', checked: quickQuestions, set: setQuickQuestions },
                  { id: 'scholarship', label: 'Mentioned scholarship possibilities', checked: quickScholarship, set: setQuickScholarship },
                ].map((item) => (
                  <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.set(e.target.checked)}
                      className="w-4 h-4 accent-[#eab308]"
                    />
                    <span className="text-sm text-[#f1f5f9]">{item.label}</span>
                  </label>
                ))}
              </div>
            )}
            {ratingError && <p className="text-xs text-red-400 mt-3">{ratingError}</p>}
            <Button onClick={handleRateResponse} disabled={ratingLoading} className="mt-4">
              {ratingLoading ? 'Analyzing...' : 'Rate Interest Level'}
            </Button>
          </Card>

          {/* Logged responses */}
          {responses.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-3xl mb-3">📬</div>
              <div className="font-serif text-base font-bold text-[#f1f5f9] mb-1">No responses logged yet</div>
              <p className="text-xs text-[#64748b]">When coaches reply, log them here and the AI will rate their interest level.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {responses.map((r) => {
                const cfg = ratingConfig[r.rating]
                return (
                  <Card key={r.id} className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="font-medium text-[#f1f5f9]">{r.school}</div>
                        <div className="text-xs text-[#64748b]">{r.coachName} · {new Date(r.date).toLocaleDateString()}</div>
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg border text-sm font-bold whitespace-nowrap ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                        <span className="ml-2 text-xs font-normal opacity-70">{r.confidence}% confident</span>
                      </div>
                    </div>
                    {r.signals.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {r.signals.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded text-xs text-[#64748b]">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="p-3 bg-[rgba(234,179,8,0.04)] border border-[rgba(234,179,8,0.15)] rounded-lg">
                      <span className="text-xs font-semibold text-[#eab308]">Next Step: </span>
                      <span className="text-xs text-[#f1f5f9]">{r.nextAction}</span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/dashboard/Tracker.tsx
git commit -m "feat: add coach responses tab with AI interest rating to outreach tracker"
```

---

## Task 7: Video Leaderboard Tab + Public Leaderboard Page

**Files:**
- Modify: `client/src/pages/dashboard/VideoRater.tsx`
- Create: `client/src/pages/Leaderboard.tsx`

- [ ] **Step 1: Replace VideoRater.tsx with tabbed version**

```typescript
import { useState } from 'react'
import { rateVideo } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { AthleteProfile, VideoRating, LeaderboardEntry } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

function loadLeaderboard(): LeaderboardEntry[] {
  try { return JSON.parse(localStorage.getItem('videoLeaderboard') ?? '[]') } catch { return [] }
}
function saveLeaderboard(entries: LeaderboardEntry[]) {
  localStorage.setItem('videoLeaderboard', JSON.stringify(entries))
}

function ScoreRing({ score }: { score: number }) {
  const r = 42
  const circ = 2 * Math.PI * r
  const filled = (score / 10) * circ
  const color = score >= 8 ? '#4ade80' : score >= 6 ? '#eab308' : '#f87171'
  return (
    <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="text-center z-10">
        <div className="font-serif text-3xl font-black leading-none" style={{ color }}>{score}</div>
        <div className="text-xs text-[#64748b]">/ 10</div>
      </div>
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? 'text-[#4ade80] bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)]'
    : score >= 6 ? 'text-[#eab308] bg-[rgba(234,179,8,0.1)] border-[rgba(234,179,8,0.2)]'
    : 'text-[#f87171] bg-[rgba(248,113,113,0.1)] border-[rgba(248,113,113,0.2)]'
  return (
    <span className={`px-2.5 py-1 rounded-lg border text-sm font-black ${color}`}>{score.toFixed(1)}</span>
  )
}

export function VideoRater() {
  const [tab, setTab] = useState<'rate' | 'leaderboard'>('rate')
  const [videoUrl, setVideoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rating, setRating] = useState<VideoRating | null>(null)
  const [optIn, setOptIn] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(loadLeaderboard)

  async function handleRate() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    if (!videoUrl) { setError('Please enter a video URL.'); return }
    setError(''); setLoading(true)
    try {
      const result = await rateVideo(videoUrl, profile)
      setRating(result)
      if (optIn && profile) {
        const entry: LeaderboardEntry = {
          id: crypto.randomUUID(),
          athleteName: profile.name,
          position: profile.position,
          clubTeam: profile.clubTeam,
          gradYear: profile.gradYear,
          divisionGoal: profile.targetDivision,
          score: result.score,
          videoUrl,
          ratedAt: new Date().toISOString(),
        }
        const updated = [...leaderboard, entry].sort((a, b) => b.score - a.score).slice(0, 10)
        setLeaderboard(updated)
        saveLeaderboard(updated)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rate video')
    } finally { setLoading(false) }
  }

  const criteria = rating ? [
    { label: 'Opening clip (first 30s)', value: rating.openingClip },
    { label: 'Clip variety', value: rating.clipVariety },
    { label: 'Video length', value: rating.videoLength },
    { label: 'Production quality', value: rating.production },
    { label: 'Stat / info overlay', value: rating.statOverlay },
    { label: 'Position-specific skills', value: rating.positionSkills },
  ] : []

  const rankMedal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`

  return (
    <div className="px-10 py-10 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Video Rater</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Highlight Video Rater</h1>
        <p className="text-[#64748b] mt-2 text-sm">Get an honest 1–10 rating and specific, actionable feedback on your highlight video.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[rgba(255,255,255,0.07)] mb-8">
        {[{ id: 'rate', label: 'Rate My Video' }, { id: 'leaderboard', label: '🏆 Leaderboard' }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'rate' | 'leaderboard')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? 'border-[#eab308] text-[#eab308]'
                : 'border-transparent text-[#64748b] hover:text-[#f1f5f9]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rate' && (
        <>
          <Card className="p-6 mb-8">
            <Badge variant="gold" className="mb-4">Pro feature</Badge>
            <div className="flex gap-4 items-end flex-wrap mb-4">
              <div className="flex-1 min-w-64">
                <Input
                  label="YouTube or Hudl video URL"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
              <Button onClick={handleRate} disabled={loading}>
                {loading ? 'Analyzing...' : 'Rate My Video'}
              </Button>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="w-4 h-4 accent-[#eab308]" />
              <span className="text-xs text-[#64748b]">Add my video to the public leaderboard (name, position, club, and video link will be visible)</span>
            </label>
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
          </Card>

          {rating && (
            <div className="flex flex-col gap-6">
              <Card className="p-6 flex items-start gap-8 flex-wrap">
                <ScoreRing score={rating.score} />
                <div className="flex-1 min-w-48">
                  <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Overall Assessment</div>
                  <p className="text-sm text-[#64748b] leading-relaxed">{rating.summary}</p>
                </div>
              </Card>
              <div>
                <h2 className="font-serif text-xl font-bold text-[#f1f5f9] mb-4">Detailed Feedback</h2>
                <div className="grid grid-cols-2 gap-3">
                  {criteria.map(({ label, value }) => (
                    <Card key={label} className="p-4">
                      <div className="text-xs font-semibold text-[#eab308] uppercase tracking-wider mb-2">{label}</div>
                      <p className="text-sm text-[#64748b] leading-relaxed">{value}</p>
                    </Card>
                  ))}
                </div>
              </div>
              {rating.improvements.length > 0 && (
                <div>
                  <h2 className="font-serif text-xl font-bold text-[#f1f5f9] mb-4">Priority Improvements</h2>
                  <div className="flex flex-col gap-3">
                    {rating.improvements.map((item, i) => (
                      <div key={i} className="flex items-start gap-4 p-4 bg-[rgba(234,179,8,0.04)] border border-[rgba(234,179,8,0.15)] rounded-xl">
                        <span className="font-serif text-lg font-black text-[#eab308] opacity-50 leading-none mt-0.5 flex-shrink-0">{i + 1}</span>
                        <p className="text-sm text-[#f1f5f9] leading-relaxed">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && !rating && (
            <Card className="p-16 text-center">
              <div className="text-4xl mb-4">🎬</div>
              <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Submit your video</div>
              <p className="text-sm text-[#64748b] max-w-xs mx-auto">
                Paste your YouTube or Hudl link above. AI analyzes opening clips, variety, length, production, and position-specific skills.
              </p>
            </Card>
          )}
        </>
      )}

      {tab === 'leaderboard' && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="font-serif text-xl font-bold text-[#f1f5f9]">Top 10 Highlight Videos</div>
              <p className="text-xs text-[#64748b] mt-0.5">Publicly visible · Opt-in only · <a href="/leaderboard" target="_blank" className="text-[#eab308] hover:underline">Share public link ↗</a></p>
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <Card className="p-16 text-center">
              <div className="text-4xl mb-4">🏆</div>
              <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">No videos on the leaderboard yet</div>
              <p className="text-sm text-[#64748b] max-w-xs mx-auto">Rate your video and check "Add to leaderboard" to appear here.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {leaderboard.map((entry, i) => (
                <Card key={entry.id} className={`p-5 flex items-center gap-5 ${i < 3 ? 'border-[rgba(234,179,8,0.2)]' : ''}`}>
                  <div className="text-2xl w-10 text-center flex-shrink-0">{rankMedal(i)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[#f1f5f9]">{entry.athleteName}</div>
                    <div className="text-xs text-[#64748b]">{entry.position} · {entry.clubTeam} · Class {entry.gradYear} · {entry.divisionGoal} Goal</div>
                  </div>
                  <ScoreBadge score={entry.score} />
                  <a
                    href={entry.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.2)] rounded-lg text-xs text-[#60a5fa] hover:bg-[rgba(59,130,246,0.2)] transition-colors no-underline"
                  >
                    ▶ Watch
                  </a>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create public Leaderboard.tsx page**

Create `client/src/pages/Leaderboard.tsx`:

```typescript
import { Link } from 'react-router-dom'
import type { LeaderboardEntry } from '../types'

function loadLeaderboard(): LeaderboardEntry[] {
  try { return JSON.parse(localStorage.getItem('videoLeaderboard') ?? '[]') } catch { return [] }
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? 'text-[#4ade80] bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)]'
    : score >= 6 ? 'text-[#eab308] bg-[rgba(234,179,8,0.1)] border-[rgba(234,179,8,0.2)]'
    : 'text-[#f87171] bg-[rgba(248,113,113,0.1)] border-[rgba(248,113,113,0.2)]'
  return (
    <span className={`px-3 py-1.5 rounded-lg border text-base font-black ${color}`}>{score.toFixed(1)}</span>
  )
}

export function Leaderboard() {
  const entries = loadLeaderboard()
  const rankMedal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`

  return (
    <div className="min-h-screen bg-[#07090f] px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="flex items-center justify-center gap-2 font-serif text-lg font-bold text-[#f1f5f9] mb-12 no-underline">
          <div className="w-8 h-8 bg-[#eab308] rounded flex items-center justify-center text-sm">⚽</div>
          SoccerRecruit
        </Link>

        <div className="text-center mb-12">
          <div className="text-5xl mb-4">🏆</div>
          <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px] mb-2">Top Highlight Videos</h1>
          <p className="text-[#64748b] text-sm">The highest-rated soccer recruitment highlight videos on SoccerRecruit</p>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-3xl mb-3">📭</div>
            <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">No videos yet</div>
            <p className="text-sm text-[#64748b] mb-6">Be the first to submit your highlight video.</p>
            <Link to="/signup" className="inline-block px-6 py-2.5 bg-[#eab308] text-black font-semibold text-sm rounded-xl no-underline hover:bg-[#ca9a06] transition-colors">
              Get Started Free
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className={`p-5 rounded-2xl border flex items-center gap-5 ${
                  i === 0 ? 'bg-[rgba(234,179,8,0.06)] border-[rgba(234,179,8,0.25)]'
                  : i < 3 ? 'bg-[rgba(255,255,255,0.03)] border-[rgba(234,179,8,0.12)]'
                  : 'bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.07)]'
                }`}
              >
                <div className="text-3xl w-12 text-center flex-shrink-0">{rankMedal(i)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#f1f5f9] text-base">{entry.athleteName}</div>
                  <div className="text-xs text-[#64748b] mt-0.5">
                    {entry.position} · {entry.clubTeam} · Class of {entry.gradYear} · {entry.divisionGoal} Goal
                  </div>
                </div>
                <ScoreBadge score={entry.score} />
                <a
                  href={entry.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.25)] rounded-xl text-sm text-[#60a5fa] font-semibold hover:bg-[rgba(59,130,246,0.2)] transition-colors no-underline"
                >
                  ▶ Watch
                </a>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-[#64748b] mt-12">
          Want your video here?{' '}
          <Link to="/signup" className="text-[#eab308] hover:underline">Create a free account</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/dashboard/VideoRater.tsx client/src/pages/Leaderboard.tsx
git commit -m "feat: add video leaderboard tab and public leaderboard page"
```

---

## Task 8: ID Camp Finder + Coach Emailer Page

**Files:**
- Create: `client/src/pages/dashboard/Camps.tsx`

- [ ] **Step 1: Create Camps.tsx**

```typescript
import { useState } from 'react'
import { findCamps, generateCampEmails } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { AthleteProfile, IdCamp, School } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}
function getSchools(): School[] {
  try { return JSON.parse(localStorage.getItem('matchedSchools') ?? '[]') } catch { return [] }
}

type GeneratedEmail = { coachName: string; subject: string; body: string }

export function Camps() {
  const [camps, setCamps] = useState<IdCamp[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedCamp, setSelectedCamp] = useState<IdCamp | null>(null)
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([])
  const [emailLoading, setEmailLoading] = useState(false)
  const [emails, setEmails] = useState<GeneratedEmail[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null)

  async function handleFindCamps() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    setError(''); setLoading(true); setCamps([]); setSelectedCamp(null); setEmails([])
    try {
      const schools = getSchools()
      const { camps: found } = await findCamps(profile, schools)
      setCamps(found)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to find camps')
    } finally { setLoading(false) }
  }

  function toggleCoach(name: string) {
    setSelectedCoaches((prev) => prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name])
  }

  function selectCamp(camp: IdCamp) {
    setSelectedCamp(camp)
    setSelectedCoaches(camp.coaches.map((c) => c.name))
    setEmails([])
  }

  async function handleGenerateEmails() {
    const profile = getProfile()
    if (!profile || !selectedCamp) return
    const coachObjs = selectedCamp.coaches.filter((c) => selectedCoaches.includes(c.name))
    setEmailLoading(true)
    try {
      const { emails: generated } = await generateCampEmails(profile, selectedCamp, coachObjs)
      setEmails(generated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate emails')
    } finally { setEmailLoading(false) }
  }

  async function copyEmail(idx: number, text: string) {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000)
  }

  const divisionColor: Record<string, string> = {
    D1: 'text-[#f87171]', D2: 'text-[#fbbf24]', D3: 'text-[#4ade80]',
    NAIA: 'text-[#60a5fa]', JUCO: 'text-[#a78bfa]',
  }

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">ID Camps</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">ID Camp Finder</h1>
        <p className="text-[#64748b] mt-2 text-sm">Find ID camps at your target schools and email every coach in one click.</p>
      </div>

      <Card className="p-6 mb-8">
        <p className="text-sm text-[#64748b] mb-4">We'll find ID camps at the schools in your matched list plus top open events for your division and position.</p>
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <Button onClick={handleFindCamps} disabled={loading}>
          {loading ? 'Searching camps...' : '⛺ Find My ID Camps'}
        </Button>
      </Card>

      {camps.length > 0 && (
        <div className="grid grid-cols-2 gap-6">
          {/* Camp list */}
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">{camps.length} Camps Found</div>
            <div className="flex flex-col gap-3">
              {camps.map((camp) => (
                <button
                  key={camp.id}
                  onClick={() => selectCamp(camp)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    selectedCamp?.id === camp.id
                      ? 'border-[#eab308] bg-[rgba(234,179,8,0.06)]'
                      : 'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(234,179,8,0.3)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="font-medium text-[#f1f5f9] text-sm leading-snug">{camp.campName}</div>
                    <span className={`text-xs font-bold flex-shrink-0 ${divisionColor[camp.division] ?? 'text-[#64748b]'}`}>{camp.division}</span>
                  </div>
                  <div className="text-xs text-[#eab308] font-medium mb-1">{camp.school}</div>
                  <div className="text-xs text-[#64748b]">📅 {camp.date}</div>
                  <div className="text-xs text-[#64748b]">📍 {camp.location}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-[#64748b]">💰 {camp.cost}</span>
                    <span className="text-xs text-[#64748b]">{camp.coaches.length} coach{camp.coaches.length !== 1 ? 'es' : ''}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Camp detail / email panel */}
          <div>
            {selectedCamp ? (
              <div className="flex flex-col gap-4">
                <Card className="p-5">
                  <div className="font-serif text-lg font-bold text-[#f1f5f9] mb-1">{selectedCamp.campName}</div>
                  <div className="text-xs text-[#eab308] mb-3">{selectedCamp.school}</div>
                  <div className="flex flex-col gap-1.5 mb-4 text-xs text-[#64748b]">
                    <div>📅 {selectedCamp.date} · 📍 {selectedCamp.location} · 💰 {selectedCamp.cost}</div>
                    {selectedCamp.url && (
                      <a href={selectedCamp.url} target="_blank" rel="noopener noreferrer" className="text-[#60a5fa] hover:underline">
                        🔗 Camp registration page
                      </a>
                    )}
                  </div>

                  <div className="text-xs font-semibold text-[#f1f5f9] uppercase tracking-wider mb-2">Attending Coaches</div>
                  <div className="flex flex-col gap-2 mb-4">
                    {selectedCamp.coaches.map((coach) => (
                      <label key={coach.name} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedCoaches.includes(coach.name)}
                          onChange={() => toggleCoach(coach.name)}
                          className="w-4 h-4 accent-[#eab308]"
                        />
                        <div>
                          <div className="text-sm text-[#f1f5f9]">{coach.name}</div>
                          <div className="text-xs text-[#64748b]">{coach.title}</div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex gap-2 mb-2 flex-wrap">
                    <button onClick={() => setSelectedCoaches(selectedCamp.coaches.map((c) => c.name))}
                      className="text-xs text-[#eab308] hover:underline">Select all</button>
                    <span className="text-xs text-[#64748b]">·</span>
                    <button onClick={() => setSelectedCoaches([])}
                      className="text-xs text-[#64748b] hover:text-[#f1f5f9]">Deselect all</button>
                  </div>

                  <Button
                    onClick={handleGenerateEmails}
                    disabled={emailLoading || selectedCoaches.length === 0}
                    className="w-full"
                  >
                    {emailLoading ? 'Generating...' : `✉️ Generate ${selectedCoaches.length} Email${selectedCoaches.length !== 1 ? 's' : ''}`}
                  </Button>
                </Card>

                {/* Generated emails */}
                {emails.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">{emails.length} Emails Ready</div>
                    {emails.map((email, idx) => (
                      <Card key={idx} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-sm font-medium text-[#f1f5f9]">{email.coachName}</div>
                            <div className="text-xs text-[#64748b]">{email.subject}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setExpandedEmail(expandedEmail === idx ? null : idx)}
                              className="text-xs text-[#64748b] hover:text-[#f1f5f9] px-2 py-1 border border-[rgba(255,255,255,0.1)] rounded"
                            >
                              {expandedEmail === idx ? 'Hide' : 'View'}
                            </button>
                            <button
                              onClick={() => copyEmail(idx, `Subject: ${email.subject}\n\n${email.body}`)}
                              className="text-xs text-[#eab308] hover:text-[#ca9a06] px-2 py-1 border border-[rgba(234,179,8,0.3)] rounded"
                            >
                              {copiedIdx === idx ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                        {expandedEmail === idx && (
                          <pre className="text-xs text-[#64748b] whitespace-pre-wrap font-sans leading-relaxed mt-3 pt-3 border-t border-[rgba(255,255,255,0.07)]">
                            {email.body}
                          </pre>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Card className="p-12 h-full flex flex-col items-center justify-center text-center">
                <div className="text-3xl mb-3">⛺</div>
                <div className="font-serif text-base font-bold text-[#f1f5f9] mb-1">Select a camp</div>
                <p className="text-xs text-[#64748b]">Click any camp to see coaches and generate outreach emails</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {!loading && camps.length === 0 && (
        <Card className="p-16 text-center">
          <div className="text-4xl mb-4">⛺</div>
          <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Find your next ID camp</div>
          <p className="text-sm text-[#64748b] max-w-sm mx-auto">
            Click the button above and we'll find ID camps at your matched schools plus top events for your division and position.
          </p>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/dashboard/Camps.tsx
git commit -m "feat: add ID camp finder and coach emailer page"
```

---

## Task 9: Roster Intelligence Page

**Files:**
- Create: `client/src/pages/dashboard/RosterIntel.tsx`

- [ ] **Step 1: Create RosterIntel.tsx**

```typescript
import { useState } from 'react'
import { getRosterIntel } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { Division, RosterProgram, PositionNeed, AthleteProfile } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

const demandColor = {
  High: 'text-[#4ade80] bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)]',
  Medium: 'text-[#fbbf24] bg-[rgba(251,191,36,0.1)] border-[rgba(251,191,36,0.2)]',
  Low: 'text-[#64748b] bg-[rgba(100,116,139,0.1)] border-[rgba(100,116,139,0.2)]',
}

export function RosterIntel() {
  const profile = getProfile()
  const [gender, setGender] = useState<'mens' | 'womens'>('womens')
  const [division, setDivision] = useState<Division | 'all'>('all')
  const [programs, setPrograms] = useState<RosterProgram[]>([])
  const [positionSummary, setPositionSummary] = useState<PositionNeed[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  async function handleSearch() {
    setError(''); setLoading(true); setPrograms([]); setPositionSummary([])
    try {
      const athletePosition = profile?.position ?? 'Forward'
      const { programs: found, positionSummary: summary } = await getRosterIntel(gender, division, athletePosition)
      setPrograms(found)
      setPositionSummary(summary)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roster data')
    } finally { setLoading(false) }
  }

  const divisions: (Division | 'all')[] = ['all', 'D1', 'D2', 'D3', 'NAIA', 'JUCO']

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Roster Intel</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Roster Intelligence</h1>
        <p className="text-[#64748b] mt-2 text-sm">Find programs losing seniors and predict which positions they need to recruit this cycle.</p>
      </div>

      {/* Filters */}
      <Card className="p-6 mb-8">
        <div className="flex flex-wrap gap-6 mb-5">
          {/* Gender toggle */}
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Gender</div>
            <div className="flex gap-2">
              {[{ id: 'womens', label: "Women's" }, { id: 'mens', label: "Men's" }].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGender(g.id as 'mens' | 'womens')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                    gender === g.id
                      ? 'bg-[#eab308] text-black border-[#eab308]'
                      : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Division filter */}
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Division</div>
            <div className="flex flex-wrap gap-2">
              {divisions.map((d) => (
                <button
                  key={d}
                  onClick={() => setDivision(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
                    division === d
                      ? 'bg-[#eab308] text-black border-[#eab308]'
                      : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? 'Analyzing rosters...' : '📊 Analyze Roster Needs'}
        </Button>
      </Card>

      {/* Position summary */}
      {positionSummary.length > 0 && (
        <div className="mb-8">
          <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">Position Demand Summary</div>
          <div className="flex flex-wrap gap-3">
            {positionSummary.map((p) => (
              <div key={p.position} className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${demandColor[p.demand]}`}>
                <span className="font-semibold text-sm">{p.position}</span>
                <span className="text-xs opacity-70">{p.demand} · {p.schoolCount} programs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Programs table */}
      {programs.length > 0 && (
        <Card>
          <div className="p-4 border-b border-[rgba(255,255,255,0.07)]">
            <div className="text-sm font-semibold text-[#f1f5f9]">{programs.length} Programs with Roster Openings</div>
            <div className="text-xs text-[#64748b] mt-0.5">Click a row to see detailed position needs</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.07)]">
                  {['School', 'Conference', 'Div', 'Leaving Seniors', 'Key Needs', 'Coach'].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {programs.map((prog) => (
                  <>
                    <tr
                      key={prog.school}
                      onClick={() => setExpandedRow(expandedRow === prog.school ? null : prog.school)}
                      className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4 font-medium text-[#f1f5f9] whitespace-nowrap">{prog.school}</td>
                      <td className="px-5 py-4 text-[#64748b] text-xs whitespace-nowrap">{prog.conference}</td>
                      <td className="px-5 py-4"><Badge variant="muted">{prog.division}</Badge></td>
                      <td className="px-5 py-4 text-[#64748b] text-xs">
                        {prog.seniorsLeaving.map((s) => `${s.count} ${s.position}`).join(', ')}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {prog.predictedNeed.filter((n) => n.level === 'High').slice(0, 2).map((n) => (
                            <span key={n.position} className={`px-2 py-0.5 rounded text-xs border ${demandColor.High}`}>{n.position}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[#64748b] text-xs whitespace-nowrap">{prog.coachName}</td>
                    </tr>
                    {expandedRow === prog.school && (
                      <tr className="border-b border-[rgba(255,255,255,0.04)] bg-[rgba(234,179,8,0.02)]">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">All Predicted Needs</div>
                          <div className="flex flex-wrap gap-2">
                            {prog.predictedNeed.map((n) => (
                              <span key={n.position} className={`px-3 py-1 rounded-lg border text-xs font-medium ${demandColor[n.level]}`}>
                                {n.position}: {n.level}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && programs.length === 0 && (
        <Card className="p-16 text-center">
          <div className="text-4xl mb-4">📊</div>
          <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Roster Intelligence</div>
          <p className="text-sm text-[#64748b] max-w-sm mx-auto">
            Select a gender and division, then click Analyze. We'll find programs with graduating seniors and predict their recruitment needs by position.
          </p>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/dashboard/RosterIntel.tsx
git commit -m "feat: add roster intelligence page with position need predictions"
```

---

## Task 10: Wire Up Routes, Sidebar, and App

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Update App.tsx with new routes**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { Leaderboard } from './pages/Leaderboard'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { Overview } from './pages/dashboard/Overview'
import { Profile } from './pages/dashboard/Profile'
import { Schools } from './pages/dashboard/Schools'
import { Emails } from './pages/dashboard/Emails'
import { Tracker } from './pages/dashboard/Tracker'
import { FollowUp } from './pages/dashboard/FollowUp'
import { VideoRater } from './pages/dashboard/VideoRater'
import { Camps } from './pages/dashboard/Camps'
import { RosterIntel } from './pages/dashboard/RosterIntel'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
      <div className="text-[#eab308] text-sm font-medium">Loading...</div>
    </div>
  )
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path="profile" element={<Profile />} />
            <Route path="schools" element={<Schools />} />
            <Route path="emails" element={<Emails />} />
            <Route path="tracker" element={<Tracker />} />
            <Route path="followup" element={<FollowUp />} />
            <Route path="video" element={<VideoRater />} />
            <Route path="camps" element={<Camps />} />
            <Route path="roster" element={<RosterIntel />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

- [ ] **Step 2: Update Sidebar.tsx with new nav items**

```typescript
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: '⊞', end: true },
  { to: '/dashboard/profile', label: 'My Profile', icon: '👤', end: false },
  { to: '/dashboard/schools', label: 'School Matches', icon: '🎯', end: false },
  { to: '/dashboard/emails', label: 'Coach Emails', icon: '✉️', end: false },
  { to: '/dashboard/tracker', label: 'Outreach Tracker', icon: '📊', end: false },
  { to: '/dashboard/followup', label: 'Follow-up Assistant', icon: '💬', end: false },
  { to: '/dashboard/video', label: 'Video Rater', icon: '🎬', end: false },
  { to: '/dashboard/camps', label: 'ID Camps', icon: '⛺', end: false },
  { to: '/dashboard/roster', label: 'Roster Intel', icon: '🔍', end: false },
]

export function Sidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-[#0c1118] border-r border-[rgba(255,255,255,0.07)] flex flex-col z-40">
      <div className="px-6 py-6 border-b border-[rgba(255,255,255,0.07)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#eab308] rounded flex items-center justify-center text-xs">⚽</div>
          <span className="font-serif text-lg font-bold text-[#f1f5f9]">SoccerRecruit</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline ${
                isActive
                  ? 'bg-[rgba(234,179,8,0.1)] text-[#eab308] border border-[rgba(234,179,8,0.2)]'
                  : 'text-[#64748b] hover:text-[#f1f5f9] hover:bg-[rgba(255,255,255,0.04)]'
              }`
            }
          >
            <span className="text-base w-5 text-center">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-[rgba(255,255,255,0.07)]">
        <div className="px-3 py-2 mb-1">
          <div className="text-xs font-medium text-[#f1f5f9] truncate">{user?.email}</div>
          <div className="text-xs text-[#64748b] mt-0.5">Free plan</div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#64748b] hover:text-[#f1f5f9] hover:bg-[rgba(255,255,255,0.04)] transition-colors text-left"
        >
          <span className="text-base w-5 text-center">→</span>
          Sign out
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/App.tsx client/src/components/layout/Sidebar.tsx
git commit -m "feat: wire up new routes and sidebar for ID camps, roster intel, and public leaderboard"
```

---

## Task 11: Fix matchedSchools localStorage in Schools page

The `Camps` page reads `matchedSchools` from localStorage. Ensure the Schools page saves matched results there.

**Files:**
- Modify: `client/src/pages/dashboard/Schools.tsx`

- [ ] **Step 1: Find where Schools.tsx stores results and add localStorage save**

Read `client/src/pages/dashboard/Schools.tsx` and find where matched schools are set. Add:

```typescript
localStorage.setItem('matchedSchools', JSON.stringify(schools))
```
immediately after the line that calls `setSchools(schools)` (or equivalent).

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/dashboard/Schools.tsx
git commit -m "feat: persist matched schools to localStorage for ID camp finder"
```
