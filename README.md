# KickrIQ

AI-powered college recruitment counselor for high school soccer players. Builds athlete profiles, matches to schools, generates coach outreach emails, rates highlight videos.

**Stack:** React + TypeScript (Vite) · Node/Express · Supabase · Anthropic Claude · Stripe

---

## Run it locally (10 minutes)

You don't need access to anyone else's keys — set up your own free accounts and you'll be running in under 10 minutes.

### 1. Prerequisites

- **Node.js 20+** — https://nodejs.org/
- **Git** — https://git-scm.com/

### 2. Clone and install

```bash
git clone https://github.com/nicomichelbee-del/NICO-AND-KOVA-PROJECT.git kickriq
cd kickriq
npm install
```

### 3. Create your own free accounts

You need two services. Both are free.

**Supabase** (database + auth) — https://supabase.com
1. Sign up → "New project"
2. Name it anything, pick any region, set a DB password
3. Once it spins up, go to **Settings → API** and copy:
   - `Project URL` → goes into `VITE_SUPABASE_URL`
   - `anon public key` → goes into `VITE_SUPABASE_ANON_KEY`
   - `service_role key` (under "Reveal") → goes into `SUPABASE_SERVICE_KEY`

**Anthropic** (the AI) — https://console.anthropic.com
1. Sign up → you get $5 free credit (plenty for testing)
2. **API Keys** → Create Key → copy it
3. Goes into `ANTHROPIC_API_KEY`

### 4. Set up the env file

```bash
cp .env.example .env
```

Open `.env` in your editor and paste in the four keys you just copied. Leave the rest as-is for now (Stripe + Google OAuth are optional — those features just won't work, but everything else will).

### 5. Set up the Supabase database schema

In your Supabase dashboard → **SQL Editor** → run each migration file in order:

```
supabase/migrations/001_outreach_tables.sql
supabase/migrations/002_schools_and_coaches.sql
supabase/migrations/003_camp_ratings_comments.sql
supabase/migrations/004_athlete_profiles.sql
supabase/migrations/005_coach_portal.sql
```

Open each file, copy contents, paste into SQL Editor, click Run. Do them in numeric order — later migrations depend on earlier ones.

### 6. Run it

```bash
npm run dev
```

That starts both the frontend (port 5173) and the API server (port 3001).

Open **http://localhost:5173** in your browser.

---

## What's running

- **Frontend** — Vite dev server at `localhost:5173` (hot reload)
- **API** — Express server at `localhost:3001` (handles AI, Supabase, Stripe, Gmail)
- All Claude API calls go through `/api/ai` so usage limits + tier gating happen server-side

---

## Common issues

- **"Please complete your athlete profile first" everywhere** — your profile didn't save. Check Supabase dashboard → Table Editor → `athlete_profiles` to see if the row exists.
- **Email confirmation link expired on signup** — turn off "Confirm email" in Supabase → Authentication → Providers → Email.
- **Empty schools page** — the schools data lives in `server/data/schools.json` (committed to the repo, so this should "just work"). If empty, run `npm run dev:server` and check console for load errors.

---

## Optional: Stripe + Gmail

These are for production features (paid tiers + Gmail-connected outreach tracker). Skip both for local dev — the app gracefully falls back when their keys are blank.

If you want them later:
- **Stripe:** sign up at https://stripe.com, use **test keys** (`sk_test_...`), put in `STRIPE_SECRET_KEY`
- **Gmail OAuth:** create OAuth credentials in Google Cloud Console, set redirect to `http://localhost:3001/api/gmail/callback`
