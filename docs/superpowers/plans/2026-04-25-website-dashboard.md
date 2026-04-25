# SoccerRecruit AI — Website & Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full React + TypeScript website with a landing page (Option 3 Elite Navy aesthetic) and a complete dashboard covering all 6 core features.

**Architecture:** Vite + React + TypeScript frontend in `client/`, Express API server in `server/` (proxied via Vite), Supabase for auth/DB, Claude API behind `/api/ai`. All AI calls go through `server/routes/ai.ts` — never from components directly.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS v3, React Router v6, Supabase JS v2, @anthropic-ai/sdk, Stripe JS, Playfair Display + Inter fonts, concurrently for dev.

---

## File Map

```
client/
  index.html
  src/
    main.tsx                        # React entry
    App.tsx                         # Router setup
    index.css                       # Global styles + CSS vars (Option 3 tokens)
    components/
      ui/
        Button.tsx                  # Primary/outline/ghost variants
        Badge.tsx                   # Gold/green/muted variants
        Card.tsx                    # Dark card with gold border
        Input.tsx                   # Styled input
        Textarea.tsx                # Styled textarea
      layout/
        Nav.tsx                     # Landing page nav
        Sidebar.tsx                 # Dashboard sidebar with all routes
        DashboardLayout.tsx         # Sidebar + main content wrapper
    pages/
      Landing.tsx                   # Full landing page (Option 3)
      Login.tsx                     # Auth login
      Signup.tsx                    # Auth signup
      dashboard/
        Overview.tsx                # Home stats + recent activity
        Profile.tsx                 # Athlete profile builder form
        Schools.tsx                 # School matcher results
        Emails.tsx                  # Coach email generator
        Tracker.tsx                 # Outreach tracker table
        FollowUp.tsx                # Follow-up assistant
        VideoRater.tsx              # Highlight video rater
    lib/
      supabase.ts                   # Supabase client singleton
      api.ts                        # fetch wrappers for /api/*
    types/
      index.ts                      # Shared types (AthleteProfile, School, Email, etc.)

server/
  index.ts                          # Express app + /api/ai route mount
  routes/
    ai.ts                           # All Claude API calls

package.json                        # Root workspace (client + server scripts)
vite.config.ts                      # Proxy /api → localhost:3001
tailwind.config.ts                  # Option 3 theme tokens
tsconfig.json
```

---

## Task 1: Initialize project

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.ts`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `tsconfig.json`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "soccerrecruit-ai",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev:client\" \"npm run dev:server\"",
    "dev:client": "vite",
    "dev:server": "tsx watch server/index.ts",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.37.0",
    "@stripe/stripe-js": "^4.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "concurrently": "^9.0.0",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "tsx": "^4.16.2",
    "typescript": "^5.5.4",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create vite.config.ts**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist',
  },
})
```

- [ ] **Step 4: Create tailwind.config.ts**

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./client/index.html', './client/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#07090f',
          surface: '#0c1118',
          card: '#0f1729',
        },
        gold: {
          DEFAULT: '#eab308',
          dim: '#ca8a04',
          pale: 'rgba(234,179,8,0.1)',
        },
        border: 'rgba(255,255,255,0.07)',
        muted: '#64748b',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gold-grid': `linear-gradient(rgba(234,179,8,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(234,179,8,0.04) 1px, transparent 1px)`,
      },
      backgroundSize: {
        grid: '60px 60px',
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 5: Create postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 6: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@/*": ["client/src/*"] }
  },
  "include": ["client/src", "server"]
}
```

- [ ] **Step 7: Create client/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SoccerRecruit AI</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700;1,800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create client/src/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 9: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Vite + React + TS project with Option 3 theme config"
```

---

## Task 2: Global CSS and design tokens

**Files:**
- Create: `client/src/index.css`

- [ ] **Step 1: Create global stylesheet**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #07090f;
  --bg-surface: #0c1118;
  --navy: #0f1729;
  --card: rgba(255, 255, 255, 0.03);
  --card-border: rgba(234, 179, 8, 0.15);
  --gold: #eab308;
  --gold-dim: #ca8a04;
  --gold-pale: rgba(234, 179, 8, 0.1);
  --text: #f1f5f9;
  --muted: #64748b;
  --border: rgba(255, 255, 255, 0.07);
}

* {
  box-sizing: border-box;
}

body {
  background-color: var(--bg);
  color: var(--text);
  font-family: 'Inter', system-ui, sans-serif;
  margin: 0;
  -webkit-font-smoothing: antialiased;
}

@layer utilities {
  .font-serif { font-family: 'Playfair Display', Georgia, serif; }
  .text-gold { color: var(--gold); }
  .text-muted { color: var(--muted); }
  .bg-card { background: var(--card); }
  .border-card { border-color: var(--card-border); }
  .bg-gold-pale { background: var(--gold-pale); }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
}

/* Gold grid background utility */
.bg-gold-grid {
  background-image:
    linear-gradient(rgba(234, 179, 8, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(234, 179, 8, 0.04) 1px, transparent 1px);
  background-size: 60px 60px;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/index.css
git commit -m "feat: add Option 3 global CSS design tokens"
```

---

## Task 3: Base UI components

**Files:**
- Create: `client/src/components/ui/Button.tsx`
- Create: `client/src/components/ui/Badge.tsx`
- Create: `client/src/components/ui/Card.tsx`
- Create: `client/src/components/ui/Input.tsx`
- Create: `client/src/components/ui/Textarea.tsx`

- [ ] **Step 1: Create Button.tsx**

```tsx
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const variants = {
  gold: 'bg-[#eab308] text-black font-bold hover:bg-[#f0c010] hover:shadow-[0_4px_32px_rgba(234,179,8,0.25)] transition-all',
  outline: 'border border-[rgba(234,179,8,0.3)] text-[#f1f5f9] hover:border-[#eab308] hover:text-[#eab308] transition-all',
  ghost: 'text-[#64748b] hover:text-[#f1f5f9] transition-colors',
}

const sizes = {
  sm: 'px-4 py-2 text-sm rounded-md',
  md: 'px-6 py-3 text-sm rounded-lg',
  lg: 'px-8 py-4 text-base rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'gold', size = 'md', className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
```

- [ ] **Step 2: Create Badge.tsx**

```tsx
interface BadgeProps {
  children: React.ReactNode
  variant?: 'gold' | 'green' | 'muted' | 'blue'
  className?: string
}

const variants = {
  gold: 'bg-[rgba(234,179,8,0.1)] text-[#eab308] border border-[rgba(234,179,8,0.2)]',
  green: 'bg-[rgba(74,222,128,0.1)] text-[#4ade80] border border-[rgba(74,222,128,0.2)]',
  muted: 'bg-[rgba(255,255,255,0.05)] text-[#64748b] border border-[rgba(255,255,255,0.07)]',
  blue: 'bg-[rgba(59,130,246,0.1)] text-[#60a5fa] border border-[rgba(59,130,246,0.2)]',
}

export function Badge({ children, variant = 'gold', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold tracking-wide ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
```

- [ ] **Step 3: Create Card.tsx**

```tsx
interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`bg-[rgba(255,255,255,0.03)] border border-[rgba(234,179,8,0.15)] rounded-2xl ${hover ? 'transition-all hover:border-[rgba(234,179,8,0.3)] hover:bg-[rgba(234,179,8,0.04)]' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Create Input.tsx**

```tsx
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[#f1f5f9]">{label}</label>}
      <input
        ref={ref}
        className={`w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-2.5 text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#eab308] focus:ring-1 focus:ring-[rgba(234,179,8,0.3)] transition-colors ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  ),
)
Input.displayName = 'Input'
```

- [ ] **Step 5: Create Textarea.tsx**

```tsx
import { TextareaHTMLAttributes, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[#f1f5f9]">{label}</label>}
      <textarea
        ref={ref}
        className={`w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-2.5 text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#eab308] focus:ring-1 focus:ring-[rgba(234,179,8,0.3)] transition-colors resize-none ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  ),
)
Textarea.displayName = 'Textarea'
```

- [ ] **Step 6: Commit**

```bash
git add client/src/components/
git commit -m "feat: add Button, Badge, Card, Input, Textarea base components"
```

---

## Task 4: Shared types

**Files:**
- Create: `client/src/types/index.ts`

- [ ] **Step 1: Create types/index.ts**

```ts
export type Division = 'D1' | 'D2' | 'D3' | 'NAIA' | 'JUCO'

export interface AthleteProfile {
  id?: string
  userId?: string
  name: string
  gradYear: number
  position: string
  clubTeam: string
  clubLeague: string
  gpa: number
  satAct?: string
  goals: number
  assists: number
  season: string
  intendedMajor: string
  highlightUrl: string
  targetDivision: Division
  locationPreference: string
  sizePreference: 'small' | 'medium' | 'large' | 'any'
}

export interface School {
  id: string
  name: string
  division: Division
  location: string
  enrollment: number
  conferece: string
  coachName?: string
  coachEmail?: string
  category: 'reach' | 'target' | 'safety'
  matchScore: number
  notes?: string
}

export interface CoachEmail {
  id: string
  school: string
  division: Division
  coachName: string
  coachEmail: string
  subject: string
  body: string
  status: 'draft' | 'sent' | 'responded' | 'not_interested'
  sentAt?: string
  respondedAt?: string
  createdAt: string
}

export interface VideoRating {
  score: number
  summary: string
  openingClip: string
  clipVariety: string
  videoLength: string
  production: string
  statOverlay: string
  positionSkills: string
  improvements: string[]
}

export type SubscriptionTier = 'free' | 'pro' | 'family'

export interface User {
  id: string
  email: string
  tier: SubscriptionTier
  emailsUsed: number
  schoolMatchesUsed: number
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/types/
git commit -m "feat: add shared TypeScript types"
```

---

## Task 5: Supabase client + API helpers

**Files:**
- Create: `client/src/lib/supabase.ts`
- Create: `client/src/lib/api.ts`

- [ ] **Step 1: Create client/src/lib/supabase.ts**

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 2: Create client/src/lib/api.ts**

```ts
import type { AthleteProfile, Division } from '../types'

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error ?? 'Request failed')
  }
  return res.json()
}

export function generateEmail(profile: AthleteProfile, school: string, division: Division, coachName: string) {
  return post<{ subject: string; body: string }>('/api/ai/email', { profile, school, division, coachName })
}

export function matchSchools(profile: AthleteProfile) {
  return post<{ schools: import('../types').School[] }>('/api/ai/schools', { profile })
}

export function rateVideo(videoUrl: string, profile: AthleteProfile) {
  return post<import('../types').VideoRating>('/api/ai/video', { videoUrl, profile })
}

export function generateFollowUp(profile: AthleteProfile, context: string, type: 'followup' | 'thankyou' | 'answer') {
  return post<{ body: string }>('/api/ai/followup', { profile, context, type })
}
```

- [ ] **Step 3: Create .env file**

```bash
cat > .env << 'EOF'
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_key
STRIPE_SECRET_KEY=your_stripe_secret
EOF
```

- [ ] **Step 4: Add .env to .gitignore**

```bash
echo ".env" >> .gitignore
echo "dist/" >> .gitignore
echo "node_modules/" >> .gitignore
```

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/ .gitignore
git commit -m "feat: add Supabase client and API helper functions"
```

---

## Task 6: Express API server

**Files:**
- Create: `server/index.ts`
- Create: `server/routes/ai.ts`

- [ ] **Step 1: Create server/routes/ai.ts**

```ts
import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import type { AthleteProfile, Division } from '../client/src/types/index'

const router = Router()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = 'claude-sonnet-4-20250514'

const PERSONA = `You are a college soccer recruitment counselor with 15+ years of experience.
Tone: encouraging, direct, and soccer-specific. Never generic. Tailor everything to soccer positions, stats, and recruiting culture.`

router.post('/email', async (req, res) => {
  const { profile, school, division, coachName } = req.body as {
    profile: AthleteProfile
    school: string
    division: Division
    coachName: string
  }

  const divisionTone =
    division === 'D1'
      ? 'professional, concise, and stat-heavy. Club team matters more than high school.'
      : division === 'D2' || division === 'D3'
      ? 'warm and emphasizing both athletic and academic fit.'
      : 'emphasizing immediate playing time potential and roster fit.'

  const prompt = `${PERSONA}

Write a cold outreach email from the athlete below to ${coachName} at ${school} (${division}).
Tone: ${divisionTone}

Athlete Profile:
- Name: ${profile.name}
- Graduation Year: ${profile.gradYear}
- Position: ${profile.position}
- Club Team: ${profile.clubTeam} (${profile.clubLeague})
- Stats: ${profile.goals} goals, ${profile.assists} assists (${profile.season} season)
- GPA: ${profile.gpa}
- Intended Major: ${profile.intendedMajor}
- Highlight Video: ${profile.highlightUrl}

The email MUST include: graduation year, position, club team and league, key stats, GPA and intended major, highlight video link, why this specific school/program, and a clear ask (campus visit, ID camp, or phone call).

Respond with JSON: { "subject": "...", "body": "..." }`

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (message.content[0] as { text: string }).text
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
  res.json(json)
})

router.post('/schools', async (req, res) => {
  const { profile } = req.body as { profile: AthleteProfile }

  const prompt = `${PERSONA}

Generate a list of 12 college soccer programs for this athlete — 4 reach, 5 target, 3 safety — based on their stats and target division (${profile.targetDivision}).

Athlete: ${profile.position}, GPA ${profile.gpa}, ${profile.goals}G/${profile.assists}A, Club: ${profile.clubTeam}, Division goal: ${profile.targetDivision}, Location: ${profile.locationPreference}, Size: ${profile.sizePreference}.

Respond with JSON: { "schools": [{ "id": "uuid", "name": "...", "division": "D1|D2|D3|NAIA|JUCO", "location": "City, ST", "enrollment": 15000, "conferece": "...", "coachName": "...", "coachEmail": "coach@school.edu", "category": "reach|target|safety", "matchScore": 87, "notes": "one sentence on fit" }] }`

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (message.content[0] as { text: string }).text
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{"schools":[]}')
  res.json(json)
})

router.post('/video', async (req, res) => {
  const { videoUrl, profile } = req.body as { videoUrl: string; profile: AthleteProfile }

  const prompt = `${PERSONA}

Rate this athlete's highlight video for college soccer recruiting. Target division: ${profile.targetDivision}.
Video URL: ${videoUrl}
Athlete: ${profile.position}, ${profile.gradYear} grad, ${profile.clubTeam}

Note: You cannot actually watch the video. Provide general best-practice feedback for a ${profile.position} targeting ${profile.targetDivision}.

Respond with JSON:
{
  "score": 7,
  "summary": "...",
  "openingClip": "feedback on first 30 seconds",
  "clipVariety": "feedback on variety of clips",
  "videoLength": "feedback on length (ideal 3-5 min)",
  "production": "feedback on title cards, music, pacing",
  "statOverlay": "feedback on name/position/GPA overlay",
  "positionSkills": "position-specific skill feedback",
  "improvements": ["actionable improvement 1", "actionable improvement 2", "actionable improvement 3"]
}`

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (message.content[0] as { text: string }).text
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
  res.json(json)
})

router.post('/followup', async (req, res) => {
  const { profile, context, type } = req.body as {
    profile: AthleteProfile
    context: string
    type: 'followup' | 'thankyou' | 'answer'
  }

  const typeInstruction =
    type === 'followup'
      ? 'a follow-up email to a coach who has not responded in 2 weeks'
      : type === 'thankyou'
      ? 'a thank-you email after a campus visit or call'
      : 'a response to a coach question or inquiry'

  const prompt = `${PERSONA}

Write ${typeInstruction} for this athlete targeting ${profile.targetDivision}.
Athlete: ${profile.name}, ${profile.position}, Class of ${profile.gradYear}, ${profile.clubTeam}.
Context: ${context}

Respond with JSON: { "body": "..." }`

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (message.content[0] as { text: string }).text
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
  res.json(json)
})

export default router
```

- [ ] **Step 2: Create server/index.ts**

```ts
import express from 'express'
import cors from 'cors'
import aiRouter from './routes/ai'

const app = express()
const PORT = 3001

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())
app.use('/api/ai', aiRouter)

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
```

- [ ] **Step 3: Commit**

```bash
git add server/
git commit -m "feat: add Express API server with Claude AI routes for email, schools, video, followup"
```

---

## Task 7: App router and auth context

**Files:**
- Create: `client/src/App.tsx`
- Create: `client/src/context/AuthContext.tsx`

- [ ] **Step 1: Create client/src/context/AuthContext.tsx**

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface AuthContextType {
  user: SupabaseUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signOut: () => supabase.auth.signOut() }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
```

- [ ] **Step 2: Create client/src/App.tsx**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { Overview } from './pages/dashboard/Overview'
import { Profile } from './pages/dashboard/Profile'
import { Schools } from './pages/dashboard/Schools'
import { Emails } from './pages/dashboard/Emails'
import { Tracker } from './pages/dashboard/Tracker'
import { FollowUp } from './pages/dashboard/FollowUp'
import { VideoRater } from './pages/dashboard/VideoRater'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-[#07090f] flex items-center justify-center"><div className="text-[#eab308] text-sm">Loading...</div></div>
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
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/App.tsx client/src/context/
git commit -m "feat: add React Router setup and auth context"
```

---

## Task 8: Landing page

**Files:**
- Create: `client/src/components/layout/Nav.tsx`
- Create: `client/src/pages/Landing.tsx`

- [ ] **Step 1: Create Nav.tsx**

```tsx
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'

export function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-16 py-5 bg-[rgba(7,9,15,0.9)] backdrop-blur-lg border-b border-[rgba(255,255,255,0.07)]">
      <Link to="/" className="flex items-center gap-2.5 font-serif text-xl font-bold text-[#f1f5f9]">
        <div className="w-8 h-8 bg-[#eab308] rounded-md flex items-center justify-center text-sm">⚽</div>
        SoccerRecruit
      </Link>
      <ul className="hidden md:flex gap-9 list-none">
        {['Features', 'How It Works', 'Pricing', 'For Parents'].map((item) => (
          <li key={item}>
            <a href={`#${item.toLowerCase().replace(/ /g, '-')}`} className="text-sm font-medium text-[#64748b] hover:text-[#f1f5f9] transition-colors no-underline">
              {item}
            </a>
          </li>
        ))}
      </ul>
      <Link to="/signup">
        <Button variant="outline" size="sm">Get Started</Button>
      </Link>
    </nav>
  )
}
```

- [ ] **Step 2: Create Landing.tsx (hero + features + pricing + CTA + footer)**

```tsx
import { Link } from 'react-router-dom'
import { Nav } from '../components/layout/Nav'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'

const features = [
  { num: '01', title: 'Athlete Profile Builder', desc: 'Position, stats, GPA, club team, and highlight link — the foundation everything else is built on.', tier: 'FREE' },
  { num: '02', title: 'School Matcher', desc: 'Reach, target, and safety schools ranked by fit — based on your real stats, not generic rankings.', tier: 'FREE' },
  { num: '03', title: 'Coach Email Generator', desc: 'AI writes personalized cold outreach for each division. D1 = stat-heavy. D3 = academic fit. NAIA = playing time.', tier: 'FREE · 3 EMAILS' },
  { num: '04', title: 'Outreach Tracker', desc: 'Track every contact, response, and next step. Never let a warm lead go cold.', tier: 'PRO' },
  { num: '05', title: 'Follow-up Assistant', desc: 'AI drafts follow-ups, thank-you notes, and answers to coach questions — always the right tone.', tier: 'PRO' },
  { num: '06', title: 'Highlight Video Rater', desc: 'Submit your YouTube or Hudl URL. Get a 1–10 score and specific, actionable improvement points.', tier: 'PRO' },
]

const plans = [
  {
    tier: 'Free',
    price: '0',
    period: 'Forever free',
    features: ['Athlete profile builder', '5 school matches', '3 coach emails', 'Division guidance'],
    cta: 'Get Started',
    featured: false,
  },
  {
    tier: 'Pro',
    price: '19',
    period: 'per month · cancel anytime',
    features: ['Everything in Free', 'Unlimited coach emails', 'Outreach tracker dashboard', 'Follow-up assistant', 'Highlight video rater'],
    cta: 'Start Pro',
    featured: true,
  },
  {
    tier: 'Family',
    price: '29',
    period: 'per month · cancel anytime',
    features: ['Everything in Pro', 'Parent dashboard view', 'Shared recruiting timeline', 'Progress notifications'],
    cta: 'Start Family',
    featured: false,
  },
]

export function Landing() {
  return (
    <div className="min-h-screen bg-[#07090f]">
      <Nav />

      {/* Hero */}
      <section className="relative flex items-center justify-center overflow-hidden px-16 pt-40 pb-24">
        <div className="absolute inset-0 bg-gold-grid opacity-60" style={{ maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%)' }} />
        <div className="absolute w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(234,179,8,0.08)_0%,transparent_65%)] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="relative text-center max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-9">
            <div className="w-8 h-px bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[3px] uppercase text-[#eab308]">AI-Powered College Soccer Recruitment</span>
            <div className="w-8 h-px bg-[#eab308]" />
          </div>
          <h1 className="font-serif text-7xl font-black leading-[1.0] tracking-[-3px] text-[#f1f5f9] mb-7">
            The <em className="text-[#eab308] not-italic">smartest</em> way to<br />get recruited
          </h1>
          <p className="text-lg text-[#64748b] leading-[1.8] max-w-xl mx-auto mb-14">
            An AI counselor with 15+ years of D1–NAIA soccer knowledge. Build your profile, match your schools, and land in coaches' inboxes.
          </p>
          <div className="flex gap-4 justify-center items-center">
            <Link to="/signup"><Button size="lg">Start for Free</Button></Link>
            <Button variant="ghost" size="lg" className="flex items-center gap-2">See how it works →</Button>
          </div>
          <div className="flex gap-12 justify-center mt-16 pt-12 border-t border-[rgba(255,255,255,0.07)]">
            {[['1,200+', 'Athletes recruited'], ['3×', 'More coach responses'], ['D1–NAIA', 'All divisions covered']].map(([num, label]) => (
              <div key={label} className="text-center">
                <div className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">{num.includes('+') || num.includes('×') ? <>{num.slice(0,-1)}<span className="text-[#eab308]">{num.slice(-1)}</span></> : <>{num.split('–')[0]}<span className="text-[#eab308]">–</span>{num.split('–')[1]}</>}</div>
                <div className="text-sm text-[#64748b] mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <div className="bg-[#0f1729] border-y border-[rgba(255,255,255,0.07)]">
        <div className="flex items-center px-16 py-4 gap-0 overflow-x-auto scrollbar-hide">
          {features.map((f, i) => (
            <div key={f.num} className={`flex items-center gap-3 px-10 whitespace-nowrap ${i < features.length - 1 ? 'border-r border-[rgba(255,255,255,0.07)]' : ''}`}>
              <span className="text-base">{['🏟️','🎯','✉️','📊','💬','🎬'][i]}</span>
              <span className="text-sm font-medium text-[#f1f5f9]">{f.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Features grid */}
      <section className="py-24 bg-[#0c1118]" id="features">
        <div className="max-w-6xl mx-auto px-16">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[3px] uppercase text-[#eab308]">Features</span>
          </div>
          <h2 className="font-serif text-5xl font-black tracking-[-1.5px] text-[#f1f5f9] mb-4 leading-[1.1]">Everything in one place</h2>
          <p className="text-base text-[#64748b] max-w-md leading-[1.75] mb-14">Six tools built on 15+ years of soccer recruiting knowledge.</p>
          <div className="grid grid-cols-3 gap-0.5 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.05)] rounded-2xl overflow-hidden">
            {features.map((f) => (
              <div key={f.num} className="bg-[#0c1118] p-8 hover:bg-[rgba(234,179,8,0.04)] transition-colors">
                <div className="text-xs font-bold tracking-widest text-[#eab308] opacity-60 mb-5 font-serif">{f.num}</div>
                <div className="text-base font-bold text-[#f1f5f9] mb-2">{f.title}</div>
                <p className="text-sm text-[#64748b] leading-[1.7]">{f.desc}</p>
                <Badge variant="gold" className="mt-4">{f.tier}</Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-16" id="pricing">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[3px] uppercase text-[#eab308]">Pricing</span>
          </div>
          <h2 className="font-serif text-5xl font-black tracking-[-1.5px] text-[#f1f5f9] mb-3 leading-[1.1]">Straightforward pricing</h2>
          <p className="text-base text-[#64748b] max-w-sm leading-[1.75] mb-14">Start free. No credit card required.</p>
          <div className="grid grid-cols-3 gap-5">
            {plans.map((plan) => (
              <div key={plan.tier} className={`relative rounded-2xl p-9 border transition-colors ${plan.featured ? 'border-[#eab308] bg-[linear-gradient(145deg,rgba(234,179,8,0.06),rgba(7,9,15,0.9))]' : 'border-[rgba(234,179,8,0.15)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(234,179,8,0.3)]'}`}>
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#eab308] text-black text-[10px] font-black px-4 py-1 rounded">MOST POPULAR</div>
                )}
                <div className={`text-xs font-bold tracking-[2px] uppercase mb-4 ${plan.featured ? 'text-[#eab308]' : 'text-[#64748b]'}`}>{plan.tier}</div>
                <div className="font-serif text-5xl font-black text-[#f1f5f9] tracking-[-2px] leading-none mb-1.5">
                  <sup className="text-2xl font-bold font-sans align-super">$</sup>{plan.price}
                </div>
                <div className="text-xs text-[#64748b] mb-7">{plan.period}</div>
                <ul className="flex flex-col gap-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm text-[#f1f5f9] flex items-center gap-2.5">
                      <span className="text-[#eab308] font-bold">—</span> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/signup">
                  <Button variant={plan.featured ? 'gold' : 'outline'} className="w-full">{plan.cta}</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-32 px-16 text-center bg-[#0f1729] border-t border-[rgba(255,255,255,0.07)] overflow-hidden">
        <div className="absolute inset-0 bg-gold-grid opacity-40" style={{ maskImage: 'radial-gradient(ellipse 70% 70% at 50% 100%, black 0%, transparent 100%)' }} />
        <div className="relative">
          <h2 className="font-serif text-6xl font-black tracking-[-2px] text-[#f1f5f9] leading-[1.05] mb-5">
            Your offer is out there.<br />Go <em className="text-[#eab308] not-italic">find it.</em>
          </h2>
          <p className="text-lg text-[#64748b] mb-12">D1 coaches make most offers sophomore and junior year. The clock is running.</p>
          <Link to="/signup"><Button size="lg">Create Your Free Profile</Button></Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-16 py-9 border-t border-[rgba(255,255,255,0.07)] flex items-center justify-between">
        <div className="flex items-center gap-2.5 font-serif text-base font-bold text-[#64748b]">
          <div className="w-7 h-7 bg-[#eab308] rounded flex items-center justify-center text-xs">⚽</div>
          SoccerRecruit
        </div>
        <div className="text-xs text-[#64748b]">© 2025 SoccerRecruit AI. All rights reserved.</div>
      </footer>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Landing.tsx client/src/components/layout/Nav.tsx
git commit -m "feat: add landing page with hero, features, pricing, CTA sections"
```

---

## Task 9: Auth pages

**Files:**
- Create: `client/src/pages/Login.tsx`
- Create: `client/src/pages/Signup.tsx`

- [ ] **Step 1: Create Login.tsx**

```tsx
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2 font-serif text-lg font-bold text-[#f1f5f9] mb-10">
          <div className="w-8 h-8 bg-[#eab308] rounded flex items-center justify-center text-sm">⚽</div>
          SoccerRecruit
        </Link>
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(234,179,8,0.15)] rounded-2xl p-8">
          <h1 className="font-serif text-2xl font-bold text-[#f1f5f9] mb-1">Welcome back</h1>
          <p className="text-sm text-[#64748b] mb-8">Sign in to your account</p>
          {error && <div className="mb-5 p-3 bg-red-900/20 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" disabled={loading} className="w-full mt-2">{loading ? 'Signing in...' : 'Sign In'}</Button>
          </form>
          <p className="text-sm text-[#64748b] text-center mt-6">
            Don't have an account? <Link to="/signup" className="text-[#eab308] hover:underline">Sign up free</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create Signup.tsx**

```tsx
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

  return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2 font-serif text-lg font-bold text-[#f1f5f9] mb-10">
          <div className="w-8 h-8 bg-[#eab308] rounded flex items-center justify-center text-sm">⚽</div>
          SoccerRecruit
        </Link>
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(234,179,8,0.15)] rounded-2xl p-8">
          <h1 className="font-serif text-2xl font-bold text-[#f1f5f9] mb-1">Start for free</h1>
          <p className="text-sm text-[#64748b] mb-8">No credit card required</p>
          {error && <div className="mb-5 p-3 bg-red-900/20 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Full name" type="text" placeholder="Alex Johnson" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <Button type="submit" disabled={loading} className="w-full mt-2">{loading ? 'Creating account...' : 'Create Free Account'}</Button>
          </form>
          <p className="text-xs text-[#64748b] text-center mt-4">By signing up you agree to our Terms of Service.</p>
          <p className="text-sm text-[#64748b] text-center mt-4">
            Already have an account? <Link to="/login" className="text-[#eab308] hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/
git commit -m "feat: add Login and Signup auth pages"
```

---

## Task 10: Dashboard layout and sidebar

**Files:**
- Create: `client/src/components/layout/Sidebar.tsx`
- Create: `client/src/components/layout/DashboardLayout.tsx`

- [ ] **Step 1: Create Sidebar.tsx**

```tsx
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
      {/* Logo */}
      <div className="px-6 py-6 border-b border-[rgba(255,255,255,0.07)]">
        <div className="flex items-center gap-2.5 font-serif text-lg font-bold text-[#f1f5f9]">
          <div className="w-7 h-7 bg-[#eab308] rounded flex items-center justify-center text-xs">⚽</div>
          SoccerRecruit
        </div>
      </div>

      {/* Nav */}
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

      {/* User + signout */}
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

- [ ] **Step 2: Create DashboardLayout.tsx**

```tsx
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-[#07090f] flex">
      <Sidebar />
      <main className="flex-1 ml-60 min-h-screen overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/layout/
git commit -m "feat: add dashboard sidebar and layout with all nav routes"
```

---

## Task 11: Dashboard overview page

**Files:**
- Create: `client/src/pages/dashboard/Overview.tsx`

- [ ] **Step 1: Create Overview.tsx**

```tsx
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'

const quickActions = [
  { to: '/dashboard/profile', icon: '👤', title: 'Complete your profile', desc: 'Add your stats, GPA, and club info', badge: 'Start here' },
  { to: '/dashboard/schools', icon: '🎯', title: 'Find your schools', desc: 'Get AI-matched reach, target & safety schools', badge: '5 free' },
  { to: '/dashboard/emails', icon: '✉️', title: 'Email a coach', desc: 'Generate your first personalized outreach', badge: '3 free' },
]

const recentActivity = [
  { icon: '✉️', text: 'Coach email generated for Wake Forest University', time: '2h ago', badge: 'Draft' },
  { icon: '🎯', text: '12 school matches found based on your profile', time: '1d ago', badge: 'New' },
  { icon: '👤', text: 'Athlete profile updated', time: '2d ago', badge: 'Done' },
]

export function Overview() {
  const { user } = useAuth()
  const name = user?.user_metadata?.full_name?.split(' ')[0] ?? 'Athlete'

  return (
    <div className="px-10 py-10 max-w-5xl">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Dashboard</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Good morning, {name}</h1>
        <p className="text-[#64748b] mt-2">Your recruiting journey starts here.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {[
          { label: 'School Matches', value: '0', max: '5', color: 'text-[#eab308]' },
          { label: 'Emails Generated', value: '0', max: '3', color: 'text-[#eab308]' },
          { label: 'Coaches Contacted', value: '0', max: '—', color: 'text-[#4ade80]' },
          { label: 'Responses', value: '0', max: '—', color: 'text-[#60a5fa]' },
        ].map(({ label, value, max, color }) => (
          <Card key={label} className="p-5">
            <div className={`font-serif text-3xl font-black ${color} tracking-[-1px]`}>{value}</div>
            <div className="text-xs text-[#64748b] mt-1">{label}</div>
            {max !== '—' && <div className="text-xs text-[rgba(255,255,255,0.2)] mt-0.5">of {max} free</div>}
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mb-10">
        <h2 className="font-serif text-xl font-bold text-[#f1f5f9] mb-5">Get started</h2>
        <div className="grid grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to} className="no-underline">
              <Card hover className="p-6 h-full flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{action.icon}</span>
                  <Badge variant="gold">{action.badge}</Badge>
                </div>
                <div>
                  <div className="text-sm font-bold text-[#f1f5f9] mb-1">{action.title}</div>
                  <div className="text-xs text-[#64748b] leading-relaxed">{action.desc}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="mb-10">
        <h2 className="font-serif text-xl font-bold text-[#f1f5f9] mb-5">Recent activity</h2>
        <Card className="divide-y divide-[rgba(255,255,255,0.05)]">
          {recentActivity.map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <span className="text-lg">{item.icon}</span>
              <div className="flex-1 text-sm text-[#f1f5f9]">{item.text}</div>
              <span className="text-xs text-[#64748b]">{item.time}</span>
              <Badge variant="muted">{item.badge}</Badge>
            </div>
          ))}
        </Card>
      </div>

      {/* Upgrade banner */}
      <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(234,179,8,0.08),rgba(15,23,41,0.9))] border border-[rgba(234,179,8,0.2)] p-6 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-[#eab308] mb-1">Upgrade to Pro — $19/mo</div>
          <div className="text-xs text-[#64748b]">Unlimited emails, outreach tracker, video rater, and follow-up assistant</div>
        </div>
        <Button size="sm">Upgrade Now</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/dashboard/Overview.tsx
git commit -m "feat: add dashboard overview page with stats, quick actions, and activity"
```

---

## Task 12: Athlete Profile Builder page

**Files:**
- Create: `client/src/pages/dashboard/Profile.tsx`

- [ ] **Step 1: Create Profile.tsx**

```tsx
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import type { AthleteProfile, Division } from '../../types'

const POSITIONS = ['Goalkeeper', 'Center Back', 'Right Back', 'Left Back', 'Defensive Mid', 'Central Mid', 'Attacking Mid', 'Right Wing', 'Left Wing', 'Striker']
const DIVISIONS: Division[] = ['D1', 'D2', 'D3', 'NAIA', 'JUCO']

const defaultProfile: AthleteProfile = {
  name: '', gradYear: 2026, position: '', clubTeam: '', clubLeague: '',
  gpa: 0, satAct: '', goals: 0, assists: 0, season: '2024-25',
  intendedMajor: '', highlightUrl: '', targetDivision: 'D2',
  locationPreference: 'any', sizePreference: 'any',
}

export function Profile() {
  const [profile, setProfile] = useState<AthleteProfile>(defaultProfile)
  const [saved, setSaved] = useState(false)

  function update(field: keyof AthleteProfile, value: string | number) {
    setProfile((p) => ({ ...p, [field]: value }))
    setSaved(false)
  }

  function handleSave() {
    localStorage.setItem('athleteProfile', JSON.stringify(profile))
    setSaved(true)
  }

  return (
    <div className="px-10 py-10 max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Profile</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Athlete Profile</h1>
        <p className="text-[#64748b] mt-2 text-sm">This profile powers your school matches and coach emails.</p>
      </div>

      <div className="flex flex-col gap-8">
        {/* Personal */}
        <section>
          <h2 className="text-sm font-bold text-[#f1f5f9] tracking-wide uppercase mb-4 pb-3 border-b border-[rgba(255,255,255,0.07)]">Personal Info</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Full name" value={profile.name} onChange={(e) => update('name', e.target.value)} placeholder="Alex Johnson" />
            <Input label="Graduation year" type="number" value={profile.gradYear} onChange={(e) => update('gradYear', parseInt(e.target.value))} placeholder="2026" />
          </div>
        </section>

        {/* Soccer */}
        <section>
          <h2 className="text-sm font-bold text-[#f1f5f9] tracking-wide uppercase mb-4 pb-3 border-b border-[rgba(255,255,255,0.07)]">Soccer</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#f1f5f9]">Position</label>
              <select
                value={profile.position}
                onChange={(e) => update('position', e.target.value)}
                className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-2.5 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#eab308]"
              >
                <option value="">Select position</option>
                {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <Input label="Season (e.g. 2024-25)" value={profile.season} onChange={(e) => update('season', e.target.value)} placeholder="2024-25" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Goals" type="number" value={profile.goals} onChange={(e) => update('goals', parseInt(e.target.value) || 0)} placeholder="12" />
            <Input label="Assists" type="number" value={profile.assists} onChange={(e) => update('assists', parseInt(e.target.value) || 0)} placeholder="8" />
            <Input label="Highlight video URL" value={profile.highlightUrl} onChange={(e) => update('highlightUrl', e.target.value)} placeholder="youtube.com/..." />
          </div>
        </section>

        {/* Club */}
        <section>
          <h2 className="text-sm font-bold text-[#f1f5f9] tracking-wide uppercase mb-4 pb-3 border-b border-[rgba(255,255,255,0.07)]">Club Team</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Club team name" value={profile.clubTeam} onChange={(e) => update('clubTeam', e.target.value)} placeholder="FC Dallas Academy" />
            <Input label="Club league" value={profile.clubLeague} onChange={(e) => update('clubLeague', e.target.value)} placeholder="ECNL, MLS Next, USYS..." />
          </div>
        </section>

        {/* Academic */}
        <section>
          <h2 className="text-sm font-bold text-[#f1f5f9] tracking-wide uppercase mb-4 pb-3 border-b border-[rgba(255,255,255,0.07)]">Academics</h2>
          <div className="grid grid-cols-3 gap-4">
            <Input label="GPA (unweighted)" type="number" step="0.01" min="0" max="4" value={profile.gpa} onChange={(e) => update('gpa', parseFloat(e.target.value) || 0)} placeholder="3.7" />
            <Input label="SAT / ACT score" value={profile.satAct ?? ''} onChange={(e) => update('satAct', e.target.value)} placeholder="1280 / 29" />
            <Input label="Intended major" value={profile.intendedMajor} onChange={(e) => update('intendedMajor', e.target.value)} placeholder="Business" />
          </div>
        </section>

        {/* Recruiting goals */}
        <section>
          <h2 className="text-sm font-bold text-[#f1f5f9] tracking-wide uppercase mb-4 pb-3 border-b border-[rgba(255,255,255,0.07)]">Recruiting Goals</h2>
          <div className="mb-4">
            <label className="text-sm font-medium text-[#f1f5f9] block mb-2">Target division</label>
            <div className="flex gap-2 flex-wrap">
              {DIVISIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => update('targetDivision', d)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                    profile.targetDivision === d
                      ? 'bg-[#eab308] text-black border-[#eab308]'
                      : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Location preference" value={profile.locationPreference} onChange={(e) => update('locationPreference', e.target.value)} placeholder="Southeast, Texas, any..." />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#f1f5f9]">School size preference</label>
              <select
                value={profile.sizePreference}
                onChange={(e) => update('sizePreference', e.target.value as AthleteProfile['sizePreference'])}
                className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-2.5 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#eab308]"
              >
                <option value="any">Any size</option>
                <option value="small">Small (&lt;5k)</option>
                <option value="medium">Medium (5k–15k)</option>
                <option value="large">Large (&gt;15k)</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-4">
          <Button onClick={handleSave}>Save Profile</Button>
          {saved && <Badge variant="green">✓ Saved</Badge>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/dashboard/Profile.tsx
git commit -m "feat: add athlete profile builder page"
```

---

## Task 13: School Matcher page

**Files:**
- Create: `client/src/pages/dashboard/Schools.tsx`

- [ ] **Step 1: Create Schools.tsx**

```tsx
import { useState } from 'react'
import { matchSchools } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import type { AthleteProfile, School } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

const categoryColor: Record<School['category'], 'blue' | 'gold' | 'green'> = {
  reach: 'blue', target: 'gold', safety: 'green'
}

export function Schools() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | School['category']>('all')

  async function handleMatch() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    setError(''); setLoading(true)
    try {
      const { schools } = await matchSchools(profile)
      setSchools(schools)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to match schools')
    } finally { setLoading(false) }
  }

  const filtered = filter === 'all' ? schools : schools.filter((s) => s.category === filter)

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">School Matcher</span>
          </div>
          <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Your School Matches</h1>
          <p className="text-[#64748b] mt-2 text-sm">AI-matched reach, target, and safety schools based on your profile.</p>
        </div>
        <Button onClick={handleMatch} disabled={loading}>{loading ? 'Matching...' : schools.length ? 'Rematch' : 'Find My Schools'}</Button>
      </div>

      {error && <div className="mb-6 p-4 bg-red-900/20 border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>}

      {schools.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {(['reach', 'target', 'safety'] as const).map((cat) => {
              const count = schools.filter((s) => s.category === cat).length
              return (
                <Card key={cat} className="p-5 flex items-center gap-4">
                  <Badge variant={categoryColor[cat]}>{cat.toUpperCase()}</Badge>
                  <span className="font-serif text-2xl font-black text-[#f1f5f9]">{count}</span>
                  <span className="text-xs text-[#64748b]">schools</span>
                </Card>
              )
            })}
          </div>

          {/* Filter */}
          <div className="flex gap-2 mb-6">
            {(['all', 'reach', 'target', 'safety'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${filter === f ? 'bg-[#eab308] text-black border-[#eab308]' : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'}`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* School list */}
          <div className="flex flex-col gap-3">
            {filtered.map((school) => (
              <Card key={school.id} hover className="p-5 flex items-center gap-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-[#f1f5f9] text-sm">{school.name}</span>
                    <Badge variant={categoryColor[school.category]}>{school.category}</Badge>
                    <Badge variant="muted">{school.division}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#64748b]">
                    <span>📍 {school.location}</span>
                    <span>👥 {school.enrollment.toLocaleString()} students</span>
                    {school.conferece && <span>🏆 {school.conferece}</span>}
                  </div>
                  {school.notes && <p className="text-xs text-[#64748b] mt-2 italic">{school.notes}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-serif text-2xl font-black text-[#eab308]">{school.matchScore}</div>
                  <div className="text-xs text-[#64748b]">match score</div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {!loading && schools.length === 0 && !error && (
        <Card className="p-16 text-center">
          <div className="text-4xl mb-4">🎯</div>
          <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Find your schools</div>
          <p className="text-sm text-[#64748b] mb-6 max-w-xs mx-auto">Complete your athlete profile, then click "Find My Schools" to get AI-matched reach, target, and safety programs.</p>
          <Button onClick={handleMatch} disabled={loading}>Find My Schools</Button>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/dashboard/Schools.tsx
git commit -m "feat: add school matcher page with AI integration"
```

---

## Task 14: Coach Email Generator page

**Files:**
- Create: `client/src/pages/dashboard/Emails.tsx`

- [ ] **Step 1: Create Emails.tsx**

```tsx
import { useState } from 'react'
import { generateEmail } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { Division, CoachEmail } from '../../types'

function getProfile() {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

const DIVISIONS: Division[] = ['D1', 'D2', 'D3', 'NAIA', 'JUCO']

export function Emails() {
  const [school, setSchool] = useState('')
  const [division, setDivision] = useState<Division>('D2')
  const [coachName, setCoachName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState<{ subject: string; body: string } | null>(null)
  const [emails, setEmails] = useState<CoachEmail[]>([])
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    if (!school || !coachName) { setError('Please fill in school name and coach name.'); return }
    setError(''); setLoading(true)
    try {
      const result = await generateEmail(profile, school, division, coachName)
      setGenerated(result)
      const newEmail: CoachEmail = {
        id: crypto.randomUUID(), school, division, coachName, coachEmail: '',
        subject: result.subject, body: result.body, status: 'draft',
        createdAt: new Date().toISOString(),
      }
      setEmails((prev) => [newEmail, ...prev])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate email')
    } finally { setLoading(false) }
  }

  async function copyToClipboard() {
    if (!generated) return
    await navigator.clipboard.writeText(`Subject: ${generated.subject}\n\n${generated.body}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Coach Emails</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Email Generator</h1>
        <p className="text-[#64748b] mt-2 text-sm">Personalized cold outreach written for each division and program.</p>
      </div>

      <div className="grid grid-cols-5 gap-8">
        {/* Form */}
        <div className="col-span-2">
          <Card className="p-6 flex flex-col gap-4">
            <Input label="School / University" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Wake Forest University" />
            <Input label="Coach name" value={coachName} onChange={(e) => setCoachName(e.target.value)} placeholder="Coach Smith" />
            <div>
              <label className="text-sm font-medium text-[#f1f5f9] block mb-2">Division</label>
              <div className="flex flex-wrap gap-2">
                {DIVISIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDivision(d)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${division === d ? 'bg-[#eab308] text-black border-[#eab308]' : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button onClick={handleGenerate} disabled={loading} className="w-full mt-2">
              {loading ? 'Generating...' : 'Generate Email'}
            </Button>
            <p className="text-xs text-[#64748b] text-center">3 free emails included</p>
          </Card>
        </div>

        {/* Output */}
        <div className="col-span-3">
          {generated ? (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-5">
                <Badge variant="green">✓ Generated</Badge>
                <Button variant="outline" size="sm" onClick={copyToClipboard}>{copied ? '✓ Copied' : 'Copy email'}</Button>
              </div>
              <div className="mb-4">
                <div className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-1.5">Subject</div>
                <div className="text-sm font-medium text-[#f1f5f9] bg-[rgba(255,255,255,0.04)] px-3 py-2 rounded-lg">{generated.subject}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-1.5">Body</div>
                <pre className="text-sm text-[#f1f5f9] whitespace-pre-wrap font-sans leading-relaxed bg-[rgba(255,255,255,0.04)] px-4 py-3 rounded-lg max-h-96 overflow-y-auto">{generated.body}</pre>
              </div>
            </Card>
          ) : (
            <Card className="p-16 text-center h-full flex flex-col items-center justify-center">
              <div className="text-4xl mb-4">✉️</div>
              <div className="font-serif text-lg font-bold text-[#f1f5f9] mb-2">Ready to send</div>
              <p className="text-sm text-[#64748b] max-w-xs">Fill in the school and coach details, then generate a personalized email.</p>
            </Card>
          )}
        </div>
      </div>

      {/* Email history */}
      {emails.length > 0 && (
        <div className="mt-10">
          <h2 className="font-serif text-xl font-bold text-[#f1f5f9] mb-5">Email history</h2>
          <div className="flex flex-col gap-3">
            {emails.map((email) => (
              <Card key={email.id} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-[#f1f5f9]">{email.school}</span>
                    <Badge variant="muted">{email.division}</Badge>
                    <Badge variant="muted">{email.status}</Badge>
                  </div>
                  <div className="text-xs text-[#64748b]">To: {email.coachName} · {new Date(email.createdAt).toLocaleDateString()}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/dashboard/Emails.tsx
git commit -m "feat: add coach email generator page with AI and history"
```

---

## Task 15: Outreach Tracker page

**Files:**
- Create: `client/src/pages/dashboard/Tracker.tsx`

- [ ] **Step 1: Create Tracker.tsx**

```tsx
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import type { CoachEmail } from '../../types'

const DEMO_CONTACTS: CoachEmail[] = [
  { id: '1', school: 'Wake Forest University', division: 'D1', coachName: 'Coach Hamilton', coachEmail: 'hamilton@wfu.edu', subject: 'Class of 2026 Striker — ECNL', body: '', status: 'responded', sentAt: '2025-04-10', respondedAt: '2025-04-14', createdAt: '2025-04-09' },
  { id: '2', school: 'Elon University', division: 'D1', coachName: 'Coach Rivera', coachEmail: '', subject: 'Class of 2026 Forward Interest', body: '', status: 'sent', sentAt: '2025-04-15', createdAt: '2025-04-14' },
  { id: '3', school: 'High Point University', division: 'D1', coachName: 'Coach Chen', coachEmail: '', subject: 'Prospective Student-Athlete Inquiry', body: '', status: 'draft', createdAt: '2025-04-18' },
]

const statusColor: Record<CoachEmail['status'], 'green' | 'gold' | 'muted' | 'blue'> = {
  responded: 'green', sent: 'blue', draft: 'muted', not_interested: 'muted'
}

export function Tracker() {
  const [contacts, setContacts] = useState<CoachEmail[]>(DEMO_CONTACTS)
  const [filter, setFilter] = useState<CoachEmail['status'] | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newSchool, setNewSchool] = useState('')
  const [newCoach, setNewCoach] = useState('')

  function addContact() {
    if (!newSchool) return
    const contact: CoachEmail = {
      id: crypto.randomUUID(), school: newSchool, division: 'D1',
      coachName: newCoach, coachEmail: '', subject: '', body: '',
      status: 'draft', createdAt: new Date().toISOString(),
    }
    setContacts((prev) => [contact, ...prev])
    setNewSchool(''); setNewCoach(''); setShowAdd(false)
  }

  function updateStatus(id: string, status: CoachEmail['status']) {
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c))
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
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Outreach</span>
          </div>
          <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Outreach Tracker</h1>
          <p className="text-[#64748b] mt-2 text-sm">Track every contact, response, and follow-up in one place.</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>+ Add Contact</Button>
      </div>

      {/* Add contact */}
      {showAdd && (
        <Card className="p-5 mb-6 flex items-end gap-4">
          <Input label="School" value={newSchool} onChange={(e) => setNewSchool(e.target.value)} placeholder="University name" className="flex-1" />
          <Input label="Coach name" value={newCoach} onChange={(e) => setNewCoach(e.target.value)} placeholder="Coach name" className="flex-1" />
          <Button onClick={addContact}>Add</Button>
        </Card>
      )}

      {/* Stats */}
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

      {/* Filter */}
      <div className="flex gap-2 mb-5">
        {(['all', 'draft', 'sent', 'responded'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${filter === f ? 'bg-[#eab308] text-black border-[#eab308]' : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.07)]">
                {['School', 'Coach', 'Division', 'Status', 'Sent', 'Response', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="px-5 py-4 font-medium text-[#f1f5f9]">{c.school}</td>
                  <td className="px-5 py-4 text-[#64748b]">{c.coachName}</td>
                  <td className="px-5 py-4"><Badge variant="muted">{c.division}</Badge></td>
                  <td className="px-5 py-4"><Badge variant={statusColor[c.status]}>{c.status}</Badge></td>
                  <td className="px-5 py-4 text-[#64748b] text-xs">{c.sentAt ? new Date(c.sentAt).toLocaleDateString() : '—'}</td>
                  <td className="px-5 py-4 text-[#64748b] text-xs">{c.respondedAt ? new Date(c.respondedAt).toLocaleDateString() : '—'}</td>
                  <td className="px-5 py-4">
                    <select
                      value={c.status}
                      onChange={(e) => updateStatus(c.id, e.target.value as CoachEmail['status'])}
                      className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded text-xs text-[#64748b] px-2 py-1 focus:outline-none focus:border-[#eab308]"
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
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/dashboard/Tracker.tsx
git commit -m "feat: add outreach tracker page with status management"
```

---

## Task 16: Follow-up Assistant page

**Files:**
- Create: `client/src/pages/dashboard/FollowUp.tsx`

- [ ] **Step 1: Create FollowUp.tsx**

```tsx
import { useState } from 'react'
import { generateFollowUp } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Textarea'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'

function getProfile() {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

const EMAIL_TYPES = [
  { value: 'followup', label: '2-Week Follow-up', desc: "Coach hasn't responded after 2 weeks" },
  { value: 'thankyou', label: 'Thank You Note', desc: 'After a campus visit or phone call' },
  { value: 'answer', label: 'Answer Coach Question', desc: "Respond to a coach's inquiry" },
] as const

export function FollowUp() {
  const [type, setType] = useState<'followup' | 'thankyou' | 'answer'>('followup')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    setError(''); setLoading(true)
    try {
      const { body } = await generateFollowUp(profile, context, type)
      setResult(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate email')
    } finally { setLoading(false) }
  }

  async function copy() {
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
      <div className="grid grid-cols-3 gap-3 mb-8">
        {EMAIL_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`p-4 rounded-xl border text-left transition-all ${type === t.value ? 'border-[#eab308] bg-[rgba(234,179,8,0.06)]' : 'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(234,179,8,0.3)]'}`}
          >
            <div className={`text-sm font-bold mb-1 ${type === t.value ? 'text-[#eab308]' : 'text-[#f1f5f9]'}`}>{t.label}</div>
            <div className="text-xs text-[#64748b]">{t.desc}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <Textarea
            label="Context (optional)"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={
              type === 'followup' ? "e.g. Emailed Coach Smith at UNC Charlotte 2 weeks ago about striker position..."
              : type === 'thankyou' ? "e.g. Just visited Notre Dame, met with Coach Williams, toured facilities..."
              : "e.g. Coach asked about my academic interests and whether I'm visiting other schools..."
            }
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
                <Button variant="outline" size="sm" onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</Button>
              </div>
              <pre className="text-sm text-[#f1f5f9] whitespace-pre-wrap font-sans leading-relaxed flex-1 overflow-y-auto">{result}</pre>
            </Card>
          ) : (
            <Card className="p-12 h-full flex flex-col items-center justify-center text-center">
              <div className="text-3xl mb-3">💬</div>
              <div className="font-serif text-base font-bold text-[#f1f5f9] mb-1">Your email appears here</div>
              <p className="text-xs text-[#64748b]">Choose a type and click generate</p>
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
git commit -m "feat: add follow-up assistant page with AI email generation"
```

---

## Task 17: Highlight Video Rater page

**Files:**
- Create: `client/src/pages/dashboard/VideoRater.tsx`

- [ ] **Step 1: Create VideoRater.tsx**

```tsx
import { useState } from 'react'
import { rateVideo } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { VideoRating } from '../../types'

function getProfile() {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

function ScoreRing({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const color = score >= 8 ? '#4ade80' : score >= 6 ? '#eab308' : '#f87171'
  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${2 * Math.PI * 42 * pct / 100} ${2 * Math.PI * 42}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <div className="font-serif text-3xl font-black" style={{ color }}>{score}</div>
        <div className="text-xs text-[#64748b]">/ 10</div>
      </div>
    </div>
  )
}

export function VideoRater() {
  const [videoUrl, setVideoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rating, setRating] = useState<VideoRating | null>(null)

  async function handleRate() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    if (!videoUrl) { setError('Please enter a video URL.'); return }
    setError(''); setLoading(true)
    try {
      const result = await rateVideo(videoUrl, profile)
      setRating(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rate video')
    } finally { setLoading(false) }
  }

  const criteria = rating ? [
    { label: 'Opening clip (first 30s)', value: rating.openingClip },
    { label: 'Clip variety', value: rating.clipVariety },
    { label: 'Video length', value: rating.videoLength },
    { label: 'Production quality', value: rating.production },
    { label: 'Stat overlay', value: rating.statOverlay },
    { label: 'Position-specific skills', value: rating.positionSkills },
  ] : []

  return (
    <div className="px-10 py-10 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Video Rater</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Highlight Video Rater</h1>
        <p className="text-[#64748b] mt-2 text-sm">Get an honest 1–10 rating and specific, actionable feedback on your highlight video.</p>
        <Badge variant="gold" className="mt-3">Pro feature</Badge>
      </div>

      {/* Input */}
      <Card className="p-6 mb-8">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Input
              label="YouTube or Hudl video URL"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>
          <Button onClick={handleRate} disabled={loading}>{loading ? 'Analyzing...' : 'Rate My Video'}</Button>
        </div>
        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      </Card>

      {rating && (
        <div className="flex flex-col gap-6">
          {/* Score + summary */}
          <Card className="p-6 flex items-start gap-8">
            <ScoreRing score={rating.score} />
            <div className="flex-1">
              <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Overall Assessment</div>
              <p className="text-sm text-[#64748b] leading-relaxed">{rating.summary}</p>
            </div>
          </Card>

          {/* Criteria breakdown */}
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

          {/* Improvements */}
          {rating.improvements.length > 0 && (
            <div>
              <h2 className="font-serif text-xl font-bold text-[#f1f5f9] mb-4">Priority Improvements</h2>
              <div className="flex flex-col gap-3">
                {rating.improvements.map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-[rgba(234,179,8,0.04)] border border-[rgba(234,179,8,0.15)] rounded-xl">
                    <span className="font-serif text-lg font-black text-[#eab308] opacity-50 leading-none mt-0.5">{i + 1}</span>
                    <p className="text-sm text-[#f1f5f9] leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !rating && !error && (
        <Card className="p-16 text-center">
          <div className="text-4xl mb-4">🎬</div>
          <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Submit your video</div>
          <p className="text-sm text-[#64748b] max-w-xs mx-auto">Paste your YouTube or Hudl link above. AI analyzes opening clips, variety, length, production, and position-specific skills.</p>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/dashboard/VideoRater.tsx
git commit -m "feat: add highlight video rater page with animated score ring"
```

---

## Task 18: Verify and run dev server

- [ ] **Step 1: Verify all files exist**

Run:
```bash
find client/src -name "*.tsx" | sort
```
Expected output: all tsx files listed — App, main, Landing, Login, Signup, Overview, Profile, Schools, Emails, Tracker, FollowUp, VideoRater, plus all components.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```
Expected: Vite dev server at `http://localhost:5173`, Express server at `http://localhost:3001`. No TypeScript errors.

- [ ] **Step 3: Open and visually verify**

Navigate to `http://localhost:5173` and verify:
- Landing page renders with gold/navy Option 3 aesthetic
- `/login` shows auth form
- `/signup` shows auth form
- `/dashboard` redirects to `/login` if not authenticated

- [ ] **Step 4: Take screenshot of landing page**

```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu --screenshot="mockups/screenshots/final-landing.png" --window-size=1440,900 "http://localhost:5173"
```

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete SoccerRecruit AI website and dashboard"
```
