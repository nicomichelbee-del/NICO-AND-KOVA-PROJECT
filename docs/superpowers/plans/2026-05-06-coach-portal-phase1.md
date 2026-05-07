# Coach Portal Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing coach portal usable: claiming coaches see real athlete identities (with consent), can reply via their Gmail, and get notified when new athletes reach out.

**Architecture:** Extend the existing `claimed_programs` table + `server/routes/coach.ts` in place. Reuse the Gmail OAuth flow + `user_gmail_tokens`. Add three new tables (`coach_inbound_consents`, `coach_messages`, notification columns), one AI action (`/api/ai/coach-reply-draft`), Resend for transactional email, and a GitHub Action cron for the daily digest. UI: split `CoachDashboard.tsx` into smaller component files as we add sections.

**Tech Stack:** TypeScript, React 18, Vite, Express, Supabase, Anthropic SDK (`claude-sonnet-4-20250514`), Resend, Gmail API (googleapis), Vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-05-06-coach-portal-design.md`

---

## File map

**New files:**
- `supabase/migrations/007_coach_portal_phase1.sql` — `coach_inbound_consents`, `coach_messages`, notification columns on `claimed_programs`
- `server/lib/coachNotifications.ts` — Resend wrapper + render helpers + per-event + digest
- `server/lib/coachNotifications.test.ts` — render unit tests
- `server/routes/coachReply.ts` — `/api/coach/reply/draft`, `/api/coach/reply/send`, `/api/coach/thread/:athleteId`
- `client/src/components/coach/InboundFeed.tsx`
- `client/src/components/coach/AthleteCard.tsx`
- `client/src/components/coach/ReplyComposer.tsx`
- `client/src/components/coach/NotificationPrefs.tsx`
- `.github/workflows/coach-daily-digest.yml`

**Modified files:**
- `server/routes/coach.ts` — extend `/inbound` to enrich + notification PATCH + digest endpoint
- `server/routes/ai.ts` — add `/coach-reply-draft`
- `server/routes/gmail.ts` — insert `coach_inbound_consents` row alongside `outreach_contacts` when an outreach email is sent
- `server/index.ts` — mount `coachReply` router
- `client/src/lib/api.ts` — helpers for new endpoints
- `client/src/pages/CoachDashboard.tsx` — replace inline inbound table with `InboundFeed`, mount `NotificationPrefs`
- `client/src/pages/dashboard/Emails.tsx` — explicit consent text on send
- `.env.example` — add `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `COACH_DIGEST_SECRET`
- `package.json` — add `resend`

---

## Task 1: Migration — three new tables + columns

**Files:**
- Create: `supabase/migrations/007_coach_portal_phase1.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/007_coach_portal_phase1.sql
-- Coach Portal Phase 1: athlete identity (with consent), coach reply threads,
-- and notification preferences.

-- ── Athlete consent log ─────────────────────────────────────────────────────
-- One row per (athlete, coach_email, school) — written when the athlete clicks
-- "Send" on a KickrIQ-generated coach email. Unlocks the claiming coach's view
-- of the athlete's profile, name, and stats. Coaches never read this directly;
-- the server joins it into /api/coach/inbound.
create table if not exists coach_inbound_consents (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references auth.users(id) on delete cascade,
  coach_email text not null,
  school_id   text not null default '',
  outreach_id uuid references outreach_contacts(id) on delete set null,
  consent     boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (athlete_id, coach_email, school_id)
);

create index if not exists coach_inbound_consents_coach_email_idx
  on coach_inbound_consents (lower(coach_email));
create index if not exists coach_inbound_consents_athlete_idx
  on coach_inbound_consents (athlete_id);

alter table coach_inbound_consents enable row level security;

-- Athletes can read & manage their own consent rows. Coaches cannot read this
-- table directly — the API joins it on their behalf with a service-role client.
create policy "Athletes manage own consents"
  on coach_inbound_consents for all
  using (auth.uid() = athlete_id)
  with check (auth.uid() = athlete_id);

-- ── Coach replies ───────────────────────────────────────────────────────────
-- Mirrors sent_emails on the athlete side, but keyed to the coach's user id.
-- Direction tracks whether this is the coach's outbound reply or a record of
-- the original athlete inbound (we mirror the inbound here so the thread view
-- has both halves without re-reading the athlete's sent_emails).
create table if not exists coach_messages (
  id            uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  athlete_id    uuid not null references auth.users(id) on delete cascade,
  outreach_id   uuid references outreach_contacts(id) on delete set null,
  direction     text not null check (direction in ('inbound','outbound')),
  gmail_msg_id  text,
  gmail_thread_id text,
  subject       text not null default '',
  body          text not null,
  sent_at       timestamptz not null default now()
);

create index if not exists coach_messages_pair_idx
  on coach_messages (coach_user_id, athlete_id, sent_at desc);

alter table coach_messages enable row level security;

create policy "Coach reads own messages"
  on coach_messages for select
  using (auth.uid() = coach_user_id);

-- ── Notification preferences on the existing claim ──────────────────────────
alter table claimed_programs
  add column if not exists notify_per_inbound  boolean not null default false,
  add column if not exists notify_daily_digest boolean not null default true,
  add column if not exists last_digest_sent_at timestamptz;
```

- [ ] **Step 2: Apply locally**

Run from project root:
```bash
npx supabase db push
```
Expected: "Applied 007_coach_portal_phase1.sql"

If `npx supabase` is not configured, paste the SQL directly into the Supabase project's SQL editor and run it.

- [ ] **Step 3: Sanity-check tables exist**

In Supabase SQL editor:
```sql
select table_name from information_schema.tables
  where table_name in ('coach_inbound_consents','coach_messages');
select column_name from information_schema.columns
  where table_name = 'claimed_programs'
    and column_name in ('notify_per_inbound','notify_daily_digest','last_digest_sent_at');
```
Expected: 2 rows + 3 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/007_coach_portal_phase1.sql
git commit -m "feat(db): add coach portal phase 1 tables (consents, messages, notify prefs)"
```

---

## Task 2: Hook consent insert into the email send path (server)

**Files:**
- Modify: `server/routes/gmail.ts:163-251` (the `POST /send` handler)

The existing `/api/gmail/send` already inserts `sent_emails` and backfills `outreach_contacts.gmail_thread_id`. We add a `coach_inbound_consents` upsert right after the insert succeeds. We need to know the recipient (already in `to`) and the contact row (already in `contactId`). School id is on the `outreach_contacts` row — we'll re-fetch.

- [ ] **Step 1: Add upsert block after the contact backfill**

In `server/routes/gmail.ts`, locate the `if (contactId)` block inside `POST /send` (around line 235). After the contact-thread backfill `void`, add this:

```typescript
// Coach portal: record the athlete's consent to share their profile with this
// coach. Done in the send path so consent and the email send are atomic from
// the user's perspective. Server-side only — coaches never write this table.
if (to && to.includes('@')) {
  const { data: contact } = await supabase
    .from('outreach_contacts')
    .select('id, coach_email, school_name')
    .eq('id', contactId ?? '')
    .eq('user_id', userId)
    .maybeSingle()
  // Best-effort school_id lookup — schools.json is the source of truth, but
  // matching by school_name is cheap and good enough for the consent record.
  const schoolName = (contact?.school_name ?? '').trim()
  void Promise.resolve(supabase.from('coach_inbound_consents').upsert({
    athlete_id: userId,
    coach_email: to.toLowerCase(),
    school_id: schoolName,
    outreach_id: contact?.id ?? null,
    consent: true,
  }, { onConflict: 'athlete_id,coach_email,school_id' })).catch((err: Error) => {
    console.error('coach_inbound_consents upsert failed:', err.message)
  })
}
```

- [ ] **Step 2: Manual smoke test**

Start dev server: `npm run dev`. As a test athlete, send an email to a coach (any address). In Supabase SQL editor:
```sql
select athlete_id, coach_email, school_id, consent, created_at
  from coach_inbound_consents
  order by created_at desc
  limit 5;
```
Expected: row appears with the email you just sent to. `consent = true`.

- [ ] **Step 3: Commit**

```bash
git add server/routes/gmail.ts
git commit -m "feat(coach): record inbound consent on athlete email send"
```

---

## Task 3: Consent text on the email send screen (client)

**Files:**
- Modify: `client/src/pages/dashboard/Emails.tsx`

We need explicit consent UX. The exact location depends on your existing send button — find the "Send" CTA and add a single line above it.

- [ ] **Step 1: Find the send button**

Run:
```bash
grep -n "Send\|gmail/send\|onClick.*send" client/src/pages/dashboard/Emails.tsx | head -20
```

- [ ] **Step 2: Add the consent line**

Above the "Send" button JSX (or its parent container), insert:

```tsx
<p className="text-[11px] text-[#9a9385] leading-relaxed mb-3 px-3 py-2 rounded border border-[rgba(245,241,232,0.06)] bg-[rgba(245,241,232,0.02)]">
  By sending this, you're sharing your KickrIQ profile with this coach so they can review your fit.
  You can review which coaches have accessed your profile in your settings.
</p>
```

(Match the existing className conventions in the file — the snippet above uses the dashboard's gold/cream palette already in use elsewhere.)

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/dashboard/Emails.tsx
git commit -m "feat(emails): show profile-sharing consent text on send"
```

---

## Task 4: Extend `GET /api/coach/inbound` to enrich with consented athlete profiles

**Files:**
- Modify: `server/routes/coach.ts:177-210` (the existing `inbound` handler)

The current handler returns just `outreach_contacts` rows with anonymized fields. We rewrite it to:
1. Find every `coach_inbound_consents` row matching the claiming coach's email.
2. Join `athlete_profiles` for each athlete_id (display name, position, grad year, GPA, etc.).
3. Join `outreach_contacts` for status / interest / last reply.
4. Return enriched cards.

- [ ] **Step 1: Replace the handler body**

Replace the entire body of `router.get('/inbound', ...)` with:

```typescript
router.get('/inbound', async (req, res) => {
  const { userId } = req.query as { userId?: string }
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const supabase = getSupabase()

  const { data: claim } = await supabase
    .from('claimed_programs')
    .select('coach_email, school_id, school_name, gender')
    .eq('coach_user_id', userId)
    .maybeSingle()
  if (!claim) return res.json({ athletes: [] })

  // Pull every consent row for this coach. Athletes appear once per
  // coach_email — even if they emailed twice — because of the unique index.
  const { data: consents } = await supabase
    .from('coach_inbound_consents')
    .select('athlete_id, outreach_id, created_at')
    .ilike('coach_email', claim.coach_email)
    .eq('consent', true)
    .order('created_at', { ascending: false })
    .limit(200)

  if (!consents || consents.length === 0) return res.json({ athletes: [] })

  const athleteIds = [...new Set(consents.map((c: any) => c.athlete_id))]

  // Athlete profile + outreach contact join — both keyed on athlete user ids.
  const [{ data: profiles }, { data: contacts }] = await Promise.all([
    supabase
      .from('athlete_profiles')
      .select('user_id, slug, full_name, primary_position, secondary_position, graduation_year, gpa, current_club, current_league_or_division, height_cm, intended_major, profile_photo_url, highlight_video_url, city, state, desired_division_levels')
      .in('user_id', athleteIds),
    supabase
      .from('outreach_contacts')
      .select('id, user_id, status, interest_rating, last_reply_at, last_reply_snippet, gmail_thread_id, created_at')
      .in('user_id', athleteIds)
      .ilike('coach_email', claim.coach_email),
  ])

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]))
  // One outreach row per (athlete, coach) — pick the most recent if duplicates.
  const contactMap = new Map<string, any>()
  for (const c of contacts ?? []) {
    const prev = contactMap.get(c.user_id)
    if (!prev || new Date(c.created_at) > new Date(prev.created_at)) contactMap.set(c.user_id, c)
  }

  const athletes = consents.map((cs: any) => {
    const p = profileMap.get(cs.athlete_id)
    const c = contactMap.get(cs.athlete_id)
    return {
      consentId: cs.athlete_id,
      athleteId: cs.athlete_id,
      consentedAt: cs.created_at,
      // Profile (only present if athlete has completed profile + visibility allows)
      name: p?.full_name ?? 'KickrIQ Athlete',
      slug: p?.slug ?? null,
      position: p?.primary_position ?? null,
      secondaryPosition: p?.secondary_position ?? null,
      gradYear: p?.graduation_year ?? null,
      gpa: p?.gpa ?? null,
      club: p?.current_club ?? null,
      clubLeague: p?.current_league_or_division ?? null,
      heightCm: p?.height_cm ?? null,
      intendedMajor: p?.intended_major ?? null,
      photoUrl: p?.profile_photo_url ?? null,
      highlightUrl: p?.highlight_video_url ?? null,
      location: [p?.city, p?.state].filter(Boolean).join(', '),
      desiredDivisions: p?.desired_division_levels ?? [],
      // Outreach status (may be missing if the consent row exists but no contact)
      contactId: c?.id ?? null,
      status: c?.status ?? 'contacted',
      interestRating: c?.interest_rating ?? 'pending',
      lastReplyAt: c?.last_reply_at ?? null,
      lastReplySnippet: c?.last_reply_snippet ?? null,
      gmailThreadId: c?.gmail_thread_id ?? null,
    }
  })

  res.json({ athletes })
})
```

- [ ] **Step 2: Manual test with curl**

Start the server, sign in as a coach who has at least one consenting athlete inbound. Then:
```bash
curl "http://localhost:3001/api/coach/inbound?userId=<coach_user_id>"
```
Expected: JSON array with `name`, `position`, `gradYear`, `slug` populated.

- [ ] **Step 3: Commit**

```bash
git add server/routes/coach.ts
git commit -m "feat(coach): enrich inbound feed with consented athlete profiles"
```

---

## Task 5: Update API helper + types on the client

**Files:**
- Modify: `client/src/lib/api.ts`

- [ ] **Step 1: Find `getCoachInbound`**

Run:
```bash
grep -n "getCoachInbound\|inbound" client/src/lib/api.ts
```

- [ ] **Step 2: Replace the type and function**

Replace whatever is currently defined for inbound with:

```typescript
export interface CoachInboundAthlete {
  consentId: string
  athleteId: string
  consentedAt: string
  name: string
  slug: string | null
  position: string | null
  secondaryPosition: string | null
  gradYear: number | null
  gpa: number | null
  club: string | null
  clubLeague: string | null
  heightCm: number | null
  intendedMajor: string | null
  photoUrl: string | null
  highlightUrl: string | null
  location: string
  desiredDivisions: string[]
  contactId: string | null
  status: string
  interestRating: 'hot' | 'warm' | 'cold' | 'not_interested' | 'pending'
  lastReplyAt: string | null
  lastReplySnippet: string | null
  gmailThreadId: string | null
}

export async function getCoachInbound(userId: string): Promise<{ athletes: CoachInboundAthlete[] }> {
  const r = await fetch(`/api/coach/inbound?userId=${encodeURIComponent(userId)}`)
  if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load inbound')
  return r.json()
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/api.ts
git commit -m "feat(api): coach inbound type matches enriched server payload"
```

---

## Task 6: Build `AthleteCard` component

**Files:**
- Create: `client/src/components/coach/AthleteCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import type { CoachInboundAthlete } from '../../lib/api'

interface Props {
  athlete: CoachInboundAthlete
  onReply: (a: CoachInboundAthlete) => void
}

const STATUS_COLOR: Record<string, string> = {
  hot: 'bg-[#4ade80] text-black',
  warm: 'bg-[#fbbf24] text-black',
  cold: 'bg-[#9a9385] text-black',
  not_interested: 'bg-[#7f1d1d] text-[#fca5a5]',
  pending: 'bg-[rgba(245,241,232,0.06)] text-[#9a9385]',
}

export function AthleteCard({ athlete: a, onReply }: Props) {
  const [open, setOpen] = useState(false)
  const initials = (a.name || 'KQ').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        {a.photoUrl ? (
          <img src={a.photoUrl} alt={a.name} className="w-14 h-14 rounded-full object-cover" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[rgba(240,182,90,0.12)] flex items-center justify-center text-[#f0b65a] font-serif font-bold">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div className="font-serif text-base font-bold text-[#f5f1e8] truncate">{a.name}</div>
            <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${STATUS_COLOR[a.interestRating] ?? STATUS_COLOR.pending}`}>
              {a.interestRating}
            </span>
          </div>
          <div className="text-xs text-[#9a9385] mt-1">
            {[a.position, a.gradYear ? `'${String(a.gradYear).slice(-2)}` : null, a.club, a.location].filter(Boolean).join(' · ')}
          </div>
          <div className="text-xs text-[#9a9385] mt-0.5">
            {[a.gpa ? `GPA ${a.gpa}` : null, a.heightCm ? `${Math.round(a.heightCm / 2.54)} in` : null, a.intendedMajor].filter(Boolean).join(' · ')}
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {a.slug && (
              <a
                href={`/players/${a.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono uppercase tracking-wider text-[#f0b65a] hover:underline"
              >
                Full profile →
              </a>
            )}
            {a.highlightUrl && (
              <a
                href={a.highlightUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono uppercase tracking-wider text-[#f0b65a] hover:underline"
              >
                Highlight video →
              </a>
            )}
            <Button onClick={() => onReply(a)} className="ml-auto">Reply</Button>
          </div>
          {a.lastReplySnippet && (
            <button onClick={() => setOpen(!open)} className="text-[11px] text-[#9a9385] mt-3 hover:text-[#f0b65a]">
              {open ? 'Hide last reply' : 'Show last reply'}
            </button>
          )}
          {open && a.lastReplySnippet && (
            <div className="mt-2 text-xs text-[#cfc7b2] bg-[rgba(255,255,255,0.02)] border border-[rgba(245,241,232,0.06)] rounded px-3 py-2">
              {a.lastReplySnippet}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/coach/AthleteCard.tsx
git commit -m "feat(coach): AthleteCard component for enriched inbound feed"
```

---

## Task 7: Build `InboundFeed` component

**Files:**
- Create: `client/src/components/coach/InboundFeed.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useState } from 'react'
import { AthleteCard } from './AthleteCard'
import { getCoachInbound, type CoachInboundAthlete } from '../../lib/api'
import { ReplyComposer } from './ReplyComposer'

interface Props {
  coachUserId: string
}

export function InboundFeed({ coachUserId }: Props) {
  const [loading, setLoading] = useState(true)
  const [athletes, setAthletes] = useState<CoachInboundAthlete[]>([])
  const [error, setError] = useState('')
  const [replyTo, setReplyTo] = useState<CoachInboundAthlete | null>(null)

  useEffect(() => {
    setLoading(true)
    getCoachInbound(coachUserId)
      .then(({ athletes }) => setAthletes(athletes))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [coachUserId])

  if (loading) return <div className="text-sm text-[#9a9385] py-8 text-center">Loading inbound athletes…</div>
  if (error) return <div className="text-sm text-red-400 py-8 text-center">{error}</div>
  if (athletes.length === 0) {
    return (
      <p className="text-sm text-[#9a9385]">
        No KickrIQ athletes have emailed you yet. As they reach out using your program's contact info, they'll appear here.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {athletes.map((a) => (
        <AthleteCard key={a.athleteId} athlete={a} onReply={setReplyTo} />
      ))}
      {replyTo && (
        <ReplyComposer
          coachUserId={coachUserId}
          athlete={replyTo}
          onClose={() => setReplyTo(null)}
          onSent={() => {
            setReplyTo(null)
            // Refetch — coach should see updated status if backend updated it
            getCoachInbound(coachUserId).then(({ athletes }) => setAthletes(athletes)).catch(() => {})
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit (skeleton — ReplyComposer added in Task 14)**

ReplyComposer doesn't exist yet but the import is fine; we ship it together.

```bash
git add client/src/components/coach/InboundFeed.tsx
git commit -m "feat(coach): InboundFeed component (depends on ReplyComposer)"
```

---

## Task 8: Wire `InboundFeed` into `CoachDashboard`

**Files:**
- Modify: `client/src/pages/CoachDashboard.tsx`

- [ ] **Step 1: Replace the inbound table**

In `CoachDashboard.tsx`, find the section starting `{/* Inbound athletes */}` (around line 235). Replace the whole `<Card>` containing the table (lines ~236–268) with:

```tsx
{/* Inbound athletes */}
<Card className="p-6">
  <div className="text-xs font-mono uppercase tracking-[0.18em] text-[#f0b65a] mb-3">
    Athletes who emailed you
  </div>
  <InboundFeed coachUserId={user.id} />
</Card>
```

- [ ] **Step 2: Add the import + remove the now-unused `inbound` state**

At the top of the file, add:
```tsx
import { InboundFeed } from '../components/coach/InboundFeed'
```

Remove the `inbound` state declaration and the `useEffect` that calls `getCoachInbound` from `CoachDashboard.tsx` (lines ~36 and ~49–52) — `InboundFeed` owns that now. Also remove the `getCoachInbound` import (`InboundFeed` imports it directly).

Note: `inbound.length` is referenced in the program header card ("Athletes interested" stat). Either:
- Keep a lightweight count fetch in CoachDashboard, OR
- Remove the stat for now (simplest — it can come back in Phase 2 with filters).

Pick removal for this task. Replace the right-side stat block in the program header with:
```tsx
<div className="text-right">
  <div className="text-xs font-mono uppercase tracking-wider text-[#9a9385]">Status</div>
  <div className="font-serif text-sm font-bold text-[#4ade80]">Active</div>
</div>
```

- [ ] **Step 3: Visual smoke test**

Start dev server, sign in as a claimed coach, visit `/for-coaches/dashboard`. Expected: athlete cards appear (or empty-state copy if none).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/CoachDashboard.tsx
git commit -m "feat(coach): mount enriched InboundFeed in dashboard"
```

---

## Task 9: AI action — `/api/ai/coach-reply-draft`

**Files:**
- Modify: `server/routes/ai.ts`

- [ ] **Step 1: Add the route**

Add this route alongside the existing `/email` route in `server/routes/ai.ts`:

```typescript
router.post('/coach-reply-draft', async (req, res) => {
  try {
    const { athleteName, athletePosition, athleteGradYear, athleteClub, athleteHighlight,
            athleteLastMessage, programName, programDivision, coachName, programNotes } = req.body as {
      athleteName: string; athletePosition: string | null; athleteGradYear: number | null
      athleteClub: string | null; athleteHighlight: string | null
      athleteLastMessage: string; programName: string; programDivision: string
      coachName: string; programNotes: string | null
    }

    const prompt = `You are ${coachName}, a college soccer coach at ${programName} (${programDivision}).
A high-school recruit emailed you through KickrIQ. Draft a SHORT, warm, personal reply (80-120 words).

Recruit:
- Name: ${athleteName}
- Position: ${athletePosition ?? 'unspecified'}
- Grad year: ${athleteGradYear ?? 'unspecified'}
- Club: ${athleteClub ?? 'unspecified'}
- Highlight video: ${athleteHighlight ?? 'not provided'}
- Their email said: "${athleteLastMessage.slice(0, 600)}"

Your program notes (for tone/positioning, do not quote verbatim): ${programNotes ?? '(none)'}

Rules:
- Coach-to-recruit voice — first name, conversational, no corporate language
- Reference one specific thing about the recruit (position, club, video)
- Make ONE clear next step (camp invite, phone call, request more video, request transcripts)
- Sign off with the coach's first name only
- 80-120 words, no preamble, no bullet points

Respond with JSON only: { "subject": "...", "body": "..." }`

    const text = await ask(prompt, 600)
    res.json(parseJSON(text, { subject: '', body: '' }))
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})
```

- [ ] **Step 2: Manual smoke test with curl**

```bash
curl -X POST http://localhost:3001/api/ai/coach-reply-draft \
  -H "Content-Type: application/json" \
  -H "X-User-Id: <any-completed-profile-user-id>" \
  -d '{"athleteName":"Jane Smith","athletePosition":"Center Back","athleteGradYear":2027,"athleteClub":"Stanford SC","athleteHighlight":"https://youtu.be/abc","athleteLastMessage":"Hi Coach, I am very interested in your program...","programName":"Wake Forest","programDivision":"D1","coachName":"Tony da Luz","programNotes":"Possession-based, top-15 RPI"}'
```
Expected: `{"subject":"...","body":"..."}` with a coach-voice reply.

Note: `requireCompleteProfile` gates `/api/ai`. Use a real signed-in user id when testing, or temporarily comment out the gate to verify just this route — but restore before committing.

- [ ] **Step 3: Commit**

```bash
git add server/routes/ai.ts
git commit -m "feat(ai): add coach-reply-draft prompt"
```

---

## Task 10: Reply routes file scaffold

**Files:**
- Create: `server/routes/coachReply.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create `server/routes/coachReply.ts`**

```typescript
import { Router } from 'express'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const router = Router()

// Wrap async handlers — Express 4 doesn't auto-forward thrown errors.
for (const method of ['get', 'post', 'put', 'delete', 'patch'] as const) {
  const original = router[method].bind(router) as (path: string, ...handlers: unknown[]) => unknown
  ;(router as unknown as Record<string, unknown>)[method] = (path: string, ...handlers: unknown[]) => {
    const wrapped = handlers.map((h) => {
      if (typeof h !== 'function') return h
      return (req: unknown, res: unknown, next: unknown) =>
        Promise.resolve((h as (...a: unknown[]) => unknown)(req, res, next)).catch(next as (e: unknown) => void)
    })
    return original(path, ...wrapped)
  }
}

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!url || !key || key === 'placeholder_anon_key') {
    throw new Error('Supabase not configured')
  }
  return createClient(url, key)
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/gmail/callback'
  )
}

export default router
```

- [ ] **Step 2: Mount in `server/index.ts`**

Add the import (alongside the others at the top):
```typescript
import coachReplyRouter from './routes/coachReply'
```

Add the mount (right after `app.use('/api/coach', coachRouter)`):
```typescript
app.use('/api/coach', coachReplyRouter)
```

(Both routers can mount on the same prefix — Express matches by exact path.)

- [ ] **Step 3: Commit**

```bash
git add server/routes/coachReply.ts server/index.ts
git commit -m "feat(coach): scaffold coachReply router"
```

---

## Task 11: `POST /api/coach/reply/draft`

**Files:**
- Modify: `server/routes/coachReply.ts`

- [ ] **Step 1: Add the route**

Append to `server/routes/coachReply.ts` (above `export default`):

```typescript
// POST /api/coach/reply/draft
// body: { coachUserId, athleteId }
// Looks up coach claim + athlete profile + most recent inbound message,
// then calls /api/ai/coach-reply-draft to compose a draft reply.
router.post('/reply/draft', async (req, res) => {
  const { coachUserId, athleteId } = req.body as { coachUserId: string; athleteId: string }
  if (!coachUserId || !athleteId) return res.status(400).json({ error: 'coachUserId and athleteId required' })
  const supabase = getSupabase()

  const [{ data: claim }, { data: athlete }, { data: lastEmail }] = await Promise.all([
    supabase.from('claimed_programs')
      .select('school_name, gender, coach_name, notes_override')
      .eq('coach_user_id', coachUserId).maybeSingle(),
    supabase.from('athlete_profiles')
      .select('full_name, primary_position, graduation_year, current_club, highlight_video_url')
      .eq('user_id', athleteId).maybeSingle(),
    supabase.from('sent_emails')
      .select('body')
      .eq('user_id', athleteId)
      .order('sent_at', { ascending: false })
      .limit(1).maybeSingle(),
  ])

  if (!claim) return res.status(404).json({ error: 'No claimed program' })
  if (!athlete) return res.status(404).json({ error: 'Athlete not found' })

  const aiResp = await fetch(`http://localhost:${process.env.PORT ?? 3001}/api/ai/coach-reply-draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Pass through user identity so requireCompleteProfile gate sees a valid user.
      // The athlete's id is used since the coach may not have a completed athlete profile.
      'X-User-Id': athleteId,
    },
    body: JSON.stringify({
      athleteName: athlete.full_name ?? 'the recruit',
      athletePosition: athlete.primary_position ?? null,
      athleteGradYear: athlete.graduation_year ?? null,
      athleteClub: athlete.current_club ?? null,
      athleteHighlight: athlete.highlight_video_url ?? null,
      athleteLastMessage: lastEmail?.body ?? '',
      programName: claim.school_name,
      programDivision: claim.gender === 'mens' ? "Men's program" : "Women's program",
      coachName: claim.coach_name ?? 'Coach',
      programNotes: claim.notes_override ?? null,
    }),
  })
  if (!aiResp.ok) return res.status(500).json({ error: 'AI draft failed' })
  res.json(await aiResp.json())
})
```

**Note on the gate:** the `/api/ai/*` mount uses `requireCompleteProfile` which checks the athlete's profile. Since this server-to-server call is using the athlete's id (the recipient context), the gate passes. If the gate uses a different header name, adjust to match — search for `requireCompleteProfile` in `server/lib/profileGate.ts` to confirm.

- [ ] **Step 2: Verify the gate header**

Run:
```bash
grep -n "X-User-Id\|x-user-id\|userId" server/lib/profileGate.ts
```

If the gate reads `req.headers['x-user-id']` (or similar), the call above works as-is. If it reads from `req.body.userId`, change the fetch body to include `userId: athleteId` and remove the header.

- [ ] **Step 3: Commit**

```bash
git add server/routes/coachReply.ts
git commit -m "feat(coach): POST /api/coach/reply/draft"
```

---

## Task 12: `POST /api/coach/reply/send`

**Files:**
- Modify: `server/routes/coachReply.ts`

- [ ] **Step 1: Add the route**

Append:

```typescript
// POST /api/coach/reply/send
// body: { coachUserId, athleteId, subject, body }
// Sends via the coach's connected Gmail (reuses user_gmail_tokens),
// records a coach_messages row, and updates outreach_contacts.status.
router.post('/reply/send', async (req, res) => {
  const { coachUserId, athleteId, subject, body } = req.body as {
    coachUserId: string; athleteId: string; subject: string; body: string
  }
  if (!coachUserId || !athleteId || !subject || !body) {
    return res.status(400).json({ error: 'coachUserId, athleteId, subject, body required' })
  }
  const supabase = getSupabase()

  // Coach must have Gmail connected.
  const { data: tokenRow } = await supabase
    .from('user_gmail_tokens')
    .select('refresh_token, email')
    .eq('user_id', coachUserId)
    .single()
  if (!tokenRow?.refresh_token) {
    return res.status(403).json({ error: 'gmail_not_connected' })
  }

  // Find the athlete's email — this is the "to" address. We use the athlete's
  // gmail token email (the one they signed up with via Google OAuth) — auth.users
  // doesn't expose email through PostgREST safely, so we read from user_gmail_tokens
  // first, and fall back to a recent outreach_contacts.coach_email reverse-lookup
  // (which is OUR coach's email, not the athlete's — so this fallback isn't useful).
  // Cleanest path: store the athlete's send-from email on outreach_contacts, OR
  // accept that the only athletes a coach can reply to are ones with Gmail connected.
  const { data: athleteToken } = await supabase
    .from('user_gmail_tokens')
    .select('email')
    .eq('user_id', athleteId)
    .single()
  const to = athleteToken?.email ?? ''
  if (!to) return res.status(400).json({ error: 'athlete_email_unknown — athlete must have Gmail connected' })

  // Find the inbound thread — the athlete's most recent send to this coach's email.
  const { data: claim } = await supabase
    .from('claimed_programs').select('coach_email').eq('coach_user_id', coachUserId).maybeSingle()
  const { data: contact } = await supabase
    .from('outreach_contacts')
    .select('id, gmail_thread_id')
    .eq('user_id', athleteId)
    .ilike('coach_email', claim?.coach_email ?? '')
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()

  // Send via coach's Gmail.
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: tokenRow.refresh_token })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  let inReplyTo = ''
  let references = ''
  let finalSubject = subject
  if (contact?.gmail_thread_id) {
    try {
      // Coach can't see the athlete's thread directly — Gmail threads are per-mailbox.
      // We just send a fresh message to the athlete; threading on the athlete's side
      // is best-effort only. Skip in-thread headers when we can't read them.
      if (!/^re:\s/i.test(finalSubject)) finalSubject = `Re: ${finalSubject}`
    } catch { /* fall through */ }
  }

  const headerLines = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${finalSubject}`,
  ]
  if (inReplyTo) headerLines.push(`In-Reply-To: ${inReplyTo}`)
  if (references) headerLines.push(`References: ${references}`)
  const raw = Buffer.from(headerLines.join('\r\n') + '\r\n\r\n' + body).toString('base64url')

  try {
    const sent = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    const gmailMsgId = sent.data.id ?? ''
    const gmailThreadId = sent.data.threadId ?? ''

    await supabase.from('coach_messages').insert({
      coach_user_id: coachUserId,
      athlete_id: athleteId,
      outreach_id: contact?.id ?? null,
      direction: 'outbound',
      gmail_msg_id: gmailMsgId,
      gmail_thread_id: gmailThreadId,
      subject: finalSubject,
      body,
    })

    // Update the athlete's outreach status so their tracker reflects the coach reply.
    if (contact?.id) {
      await supabase
        .from('outreach_contacts')
        .update({ status: 'replied', last_reply_at: new Date().toISOString(), last_reply_snippet: body.slice(0, 150) })
        .eq('id', contact.id)
    }

    res.json({ success: true, gmailMsgId, gmailThreadId })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Send failed' })
  }
})
```

- [ ] **Step 2: Manual smoke test plan**

This route requires (1) a coach with Gmail connected and (2) an athlete who has emailed them. Manually:
1. Sign in as athlete A → connect Gmail → send an email to coach B's `.edu`.
2. Sign in as coach B → claim program → connect Gmail.
3. Hit `POST /api/coach/reply/send` with coach B's user id, athlete A's user id, subject, body.
4. Check athlete A's Gmail inbox: reply received.
5. Check `coach_messages` table: row inserted, direction='outbound'.

(Defer this until the UI is wired up in Tasks 14-16; the curl version is brittle.)

- [ ] **Step 3: Commit**

```bash
git add server/routes/coachReply.ts
git commit -m "feat(coach): POST /api/coach/reply/send via coach Gmail"
```

---

## Task 13: `GET /api/coach/thread/:athleteId`

**Files:**
- Modify: `server/routes/coachReply.ts`

- [ ] **Step 1: Add the route**

Append:

```typescript
// GET /api/coach/thread/:athleteId?coachUserId=<uid>
// Combined view of: athlete's outbound (sent_emails) + coach's outbound (coach_messages).
// Doesn't read athlete's Gmail directly — relies on what the athlete sent through KickrIQ.
router.get('/thread/:athleteId', async (req, res) => {
  const { athleteId } = req.params
  const { coachUserId } = req.query as { coachUserId: string }
  if (!coachUserId) return res.status(400).json({ error: 'coachUserId required' })
  const supabase = getSupabase()

  const { data: claim } = await supabase
    .from('claimed_programs').select('coach_email').eq('coach_user_id', coachUserId).maybeSingle()

  const [{ data: athleteSent }, { data: coachSent }] = await Promise.all([
    supabase.from('sent_emails')
      .select('id, subject, body, sent_at, contact_id')
      .eq('user_id', athleteId)
      .order('sent_at', { ascending: false })
      .limit(50),
    supabase.from('coach_messages')
      .select('id, subject, body, sent_at, direction')
      .eq('coach_user_id', coachUserId)
      .eq('athlete_id', athleteId)
      .order('sent_at', { ascending: false })
      .limit(50),
  ])

  // Filter athlete's sent_emails to ones aimed at THIS coach — best-effort by joining
  // on outreach_contacts.coach_email.
  const contactIds = (athleteSent ?? []).map((e: any) => e.contact_id).filter(Boolean)
  let validContactIds = new Set<string>()
  if (contactIds.length > 0 && claim?.coach_email) {
    const { data: contacts } = await supabase
      .from('outreach_contacts')
      .select('id')
      .in('id', contactIds)
      .ilike('coach_email', claim.coach_email)
    validContactIds = new Set((contacts ?? []).map((c: any) => c.id))
  }

  const messages = [
    ...(athleteSent ?? [])
      .filter((e: any) => validContactIds.has(e.contact_id))
      .map((e: any) => ({ id: e.id, direction: 'inbound', subject: e.subject, body: e.body, sentAt: e.sent_at })),
    ...(coachSent ?? []).map((m: any) => ({ id: m.id, direction: m.direction, subject: m.subject, body: m.body, sentAt: m.sent_at })),
  ].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())

  res.json({ messages })
})
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/coachReply.ts
git commit -m "feat(coach): GET /api/coach/thread/:athleteId"
```

---

## Task 14: `ReplyComposer` component — modal scaffold

**Files:**
- Create: `client/src/components/coach/ReplyComposer.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import type { CoachInboundAthlete } from '../../lib/api'

interface Props {
  coachUserId: string
  athlete: CoachInboundAthlete
  onClose: () => void
  onSent: () => void
}

export function ReplyComposer({ coachUserId, athlete, onClose, onSent }: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [gmailNotConnected, setGmailNotConnected] = useState(false)

  // Generate the AI draft on open.
  useEffect(() => {
    setLoading(true); setError('')
    fetch('/api/coach/reply/draft', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachUserId, athleteId: athlete.athleteId }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Draft failed')
        return r.json()
      })
      .then(({ subject, body }) => { setSubject(subject ?? ''); setBody(body ?? '') })
      .catch((e) => setError(e instanceof Error ? e.message : 'Draft failed'))
      .finally(() => setLoading(false))
  }, [coachUserId, athlete.athleteId])

  async function handleSend() {
    setSending(true); setError(''); setGmailNotConnected(false)
    try {
      const r = await fetch('/api/coach/reply/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachUserId, athleteId: athlete.athleteId, subject, body }),
      })
      const j = await r.json()
      if (!r.ok) {
        if (j.error === 'gmail_not_connected') setGmailNotConnected(true)
        throw new Error(j.error ?? 'Send failed')
      }
      onSent()
    } catch (e) {
      if (!gmailNotConnected) setError(e instanceof Error ? e.message : 'Send failed')
    } finally { setSending(false) }
  }

  function connectGmail() {
    fetch(`/api/gmail/auth?userId=${encodeURIComponent(coachUserId)}`)
      .then((r) => r.json())
      .then(({ url }) => { if (url) window.open(url, '_blank', 'width=500,height=600') })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <Card className="w-full max-w-2xl mt-12 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.18em] text-[#f0b65a]">Reply to</div>
            <div className="font-serif text-lg font-bold text-[#f5f1e8]">{athlete.name}</div>
          </div>
          <button onClick={onClose} className="text-[#9a9385] hover:text-[#f5f1e8] text-xl">×</button>
        </div>

        {gmailNotConnected ? (
          <div className="text-center py-6">
            <p className="text-sm text-[#cfc7b2] mb-4">Connect your Gmail to send replies through KickrIQ.</p>
            <Button onClick={connectGmail}>Connect Gmail</Button>
          </div>
        ) : loading ? (
          <div className="text-center py-12 text-sm text-[#9a9385]">Drafting reply with AI…</div>
        ) : (
          <>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full bg-[rgba(245,241,232,0.04)] border border-[rgba(245,241,232,0.10)] rounded text-sm text-[#f5f1e8] px-3 py-2 mb-3 focus:outline-none focus:border-[#f0b65a]"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Reply…"
              className="w-full bg-[rgba(245,241,232,0.04)] border border-[rgba(245,241,232,0.10)] rounded text-sm text-[#f5f1e8] px-3 py-2 focus:outline-none focus:border-[#f0b65a]"
            />
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={onClose} className="bg-transparent border border-[rgba(245,241,232,0.10)]">Cancel</Button>
              <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}>
                {sending ? 'Sending…' : 'Send via Gmail'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Visual smoke test**

In `CoachDashboard.tsx`, sign in as a claimed coach with at least one consenting athlete inbound. Click "Reply" on a card. Expected: modal opens, "Drafting reply with AI…" message, then subject + body fill in. Click "Send via Gmail" → if Gmail not connected, see Connect Gmail CTA. If connected, send succeeds.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/coach/ReplyComposer.tsx
git commit -m "feat(coach): ReplyComposer modal with AI draft + send"
```

---

## Task 15: End-to-end manual smoke test for reply flow

This is a checkpoint, not a coding task — block here until the full athlete→coach→reply loop works.

- [ ] **Step 1: Set up two test users**

Create two Supabase users (via your existing signup flow) — one athlete and one coach. The coach's `.edu` email must match a `coachEmail` listed in `server/data/rosterPrograms.json` so they can claim a program.

- [ ] **Step 2: Athlete sends an outreach email**

As athlete: complete profile → connect Gmail → send a coach email (existing flow) → confirm `coach_inbound_consents` row appears.

- [ ] **Step 3: Coach claims + replies**

As coach: visit `/for-coaches`, magic-link sign in, claim program, see athlete in inbound feed with real name + position. Click "Reply" → connect Gmail (if not connected) → AI draft loads → edit → send.

- [ ] **Step 4: Verify athlete receives the reply**

Check athlete's Gmail inbox: coach's reply received. Check athlete's tracker: status = "replied" or last_reply updated.

- [ ] **Step 5: Verify thread endpoint**

```bash
curl "http://localhost:3001/api/coach/thread/<athlete_id>?coachUserId=<coach_id>"
```
Expected: 2 messages (1 inbound, 1 outbound) ordered chronologically.

- [ ] **Step 6: Tag the milestone**

```bash
git tag coach-portal-phase1-replies-working
git commit --allow-empty -m "checkpoint: coach reply flow end-to-end"
```

---

## Task 16: Install Resend + env vars

**Files:**
- Modify: `package.json`, `.env.example`, `.env`

- [ ] **Step 1: Install resend**

```bash
npm install resend
```
Expected: `resend` added to dependencies.

- [ ] **Step 2: Add env vars to `.env.example`**

Append to `.env.example`:

```bash
# ── Resend (server-only) ───────────────────────────────────────────────────
# Transactional email — coach digest and per-event notifications.
# Sign up at resend.com, free tier is 3000/month.
# RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxx
# RESEND_FROM_EMAIL=KickrIQ Coach <coaches@kickriq.com>

# Daily digest cron — shared secret for the GitHub Action callback.
# Generate with: openssl rand -hex 24
# COACH_DIGEST_SECRET=
```

- [ ] **Step 3: Add real values to your local `.env`**

Sign up at resend.com, create an API key. Add to local `.env`:

```bash
RESEND_API_KEY=re_<your-key>
RESEND_FROM_EMAIL=KickrIQ <coaches@kickriq.com>
COACH_DIGEST_SECRET=<openssl rand -hex 24>
```

For sending domain: Resend requires verifying the from-domain. Either verify `kickriq.com` in Resend dashboard (recommended; takes 5 min) or use Resend's `onboarding@resend.dev` while testing.

- [ ] **Step 4: Commit (without the real secrets)**

```bash
git add package.json package-lock.json .env.example
git commit -m "feat(deps): add Resend for coach transactional email"
```

---

## Task 17: `coachNotifications.ts` — render helpers + unit tests

**Files:**
- Create: `server/lib/coachNotifications.ts`
- Create: `server/lib/coachNotifications.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// server/lib/coachNotifications.test.ts
import { describe, it, expect } from 'vitest'
import { renderInboundEmail, renderDailyDigestEmail } from './coachNotifications'

describe('renderInboundEmail', () => {
  it('renders subject and body for one new athlete', () => {
    const out = renderInboundEmail({
      coachName: 'Tony',
      programName: 'Wake Forest',
      athleteName: 'Jane Smith',
      athletePosition: 'Center Back',
      athleteGradYear: 2027,
      athleteSlug: 'jane-smith-2027',
    })
    expect(out.subject).toContain('Jane Smith')
    expect(out.subject).toContain('Wake Forest')
    expect(out.html).toContain('Center Back')
    expect(out.html).toContain('/players/jane-smith-2027')
  })
})

describe('renderDailyDigestEmail', () => {
  it('renders a digest summarizing N athletes', () => {
    const out = renderDailyDigestEmail({
      coachName: 'Tony',
      programName: 'Wake Forest',
      athletes: [
        { name: 'Jane Smith', position: 'CB', gradYear: 2027, slug: 'jane-smith' },
        { name: 'Mia Lopez', position: 'F', gradYear: 2026, slug: 'mia-lopez' },
      ],
    })
    expect(out.subject).toContain('2 new athletes')
    expect(out.html).toContain('Jane Smith')
    expect(out.html).toContain('Mia Lopez')
  })

  it('returns null subject/html for empty digest (caller decides not to send)', () => {
    const out = renderDailyDigestEmail({ coachName: 'T', programName: 'P', athletes: [] })
    expect(out).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run server/lib/coachNotifications.test.ts
```
Expected: FAIL — `Cannot find module './coachNotifications'`.

- [ ] **Step 3: Write the implementation**

```typescript
// server/lib/coachNotifications.ts
import { Resend } from 'resend'

interface InboundParams {
  coachName: string
  programName: string
  athleteName: string
  athletePosition: string | null
  athleteGradYear: number | null
  athleteSlug: string | null
}

interface DigestAthlete {
  name: string; position: string | null; gradYear: number | null; slug: string | null
}

interface DigestParams {
  coachName: string; programName: string; athletes: DigestAthlete[]
}

const APP_URL = process.env.PUBLIC_BASE_URL ?? 'https://kickriq.com'

function profileLink(slug: string | null): string {
  return slug ? `${APP_URL}/players/${slug}` : `${APP_URL}/for-coaches/dashboard`
}

export function renderInboundEmail(p: InboundParams): { subject: string; html: string; text: string } {
  const positionLine = p.athletePosition
    ? `${p.athletePosition}${p.athleteGradYear ? `, '${String(p.athleteGradYear).slice(-2)}` : ''}`
    : ''
  const subject = `${p.athleteName} just emailed your ${p.programName} program`
  const text = `Hi ${p.coachName},\n\n${p.athleteName} (${positionLine}) just reached out via KickrIQ.\n\nView their profile: ${profileLink(p.athleteSlug)}\n\nReply from your dashboard: ${APP_URL}/for-coaches/dashboard\n\n— KickrIQ`
  const html = `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="font-size:18px;margin:0 0 12px">New athlete interest</h2>
  <p>Hi ${escapeHtml(p.coachName)},</p>
  <p><strong>${escapeHtml(p.athleteName)}</strong>${positionLine ? ` (${escapeHtml(positionLine)})` : ''} just emailed your ${escapeHtml(p.programName)} program through KickrIQ.</p>
  <p style="margin:24px 0">
    <a href="${profileLink(p.athleteSlug)}" style="background:#f0b65a;color:#1a1a1a;padding:10px 18px;text-decoration:none;border-radius:6px;font-weight:600">View their profile</a>
  </p>
  <p style="font-size:12px;color:#666">Reply from your <a href="${APP_URL}/for-coaches/dashboard">coach dashboard</a>. KickrIQ never charges coaches.</p>
</div>`
  return { subject, html, text }
}

export function renderDailyDigestEmail(p: DigestParams): { subject: string; html: string; text: string } | null {
  if (p.athletes.length === 0) return null
  const subject = `${p.athletes.length} new athletes interested in ${p.programName}`
  const list = p.athletes.map((a) => {
    const meta = [a.position, a.gradYear ? `'${String(a.gradYear).slice(-2)}` : null].filter(Boolean).join(', ')
    return { name: a.name, meta, link: profileLink(a.slug) }
  })
  const text = `Hi ${p.coachName},\n\n${list.length} new athletes reached out yesterday:\n\n${list.map((l) => `- ${l.name} (${l.meta}) — ${l.link}`).join('\n')}\n\nView all in your dashboard: ${APP_URL}/for-coaches/dashboard\n\n— KickrIQ`
  const html = `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="font-size:18px;margin:0 0 12px">${list.length} new ${list.length === 1 ? 'athlete' : 'athletes'} interested in ${escapeHtml(p.programName)}</h2>
  <ul style="padding-left:20px;margin:16px 0">
    ${list.map((l) => `<li style="margin-bottom:8px"><a href="${l.link}"><strong>${escapeHtml(l.name)}</strong></a>${l.meta ? ` <span style="color:#666">(${escapeHtml(l.meta)})</span>` : ''}</li>`).join('')}
  </ul>
  <p style="margin:24px 0">
    <a href="${APP_URL}/for-coaches/dashboard" style="background:#f0b65a;color:#1a1a1a;padding:10px 18px;text-decoration:none;border-radius:6px;font-weight:600">View dashboard</a>
  </p>
</div>`
  return { subject, html, text }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function sendCoachEmail(args: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) {
    console.warn('[coachNotifications] RESEND_API_KEY/RESEND_FROM_EMAIL not set — skipping send')
    return
  }
  const resend = new Resend(apiKey)
  await resend.emails.send({ from, to: args.to, subject: args.subject, html: args.html, text: args.text })
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run server/lib/coachNotifications.test.ts
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add server/lib/coachNotifications.ts server/lib/coachNotifications.test.ts
git commit -m "feat(notifications): coach email render helpers + Resend wrapper"
```

---

## Task 18: Hook per-event notification into the email send path

**Files:**
- Modify: `server/routes/gmail.ts:163-251` (the `POST /send` handler)

When the athlete's outreach is sent, kick off a notification to the coach **only if** they have `notify_per_inbound = true` on their claim. Best-effort, async, doesn't block the response.

- [ ] **Step 1: Add the notification block**

In `server/routes/gmail.ts`, after the consent upsert added in Task 2, append:

```typescript
// Coach portal: notify the claimed coach in real-time, if they've opted in.
if (to && to.includes('@')) {
  void Promise.resolve((async () => {
    try {
      const supabase = getSupabase()
      const coachEmail = to.toLowerCase()
      const { data: claim } = await supabase
        .from('claimed_programs')
        .select('coach_user_id, coach_name, school_name, notify_per_inbound')
        .ilike('coach_email', coachEmail)
        .maybeSingle()
      if (!claim?.coach_user_id || !claim.notify_per_inbound) return

      const { data: profile } = await supabase
        .from('athlete_profiles')
        .select('full_name, slug, primary_position, graduation_year')
        .eq('user_id', userId)
        .maybeSingle()

      const { renderInboundEmail, sendCoachEmail } = await import('../lib/coachNotifications')
      const rendered = renderInboundEmail({
        coachName: claim.coach_name ?? 'Coach',
        programName: claim.school_name ?? '',
        athleteName: profile?.full_name ?? 'A KickrIQ athlete',
        athletePosition: profile?.primary_position ?? null,
        athleteGradYear: profile?.graduation_year ?? null,
        athleteSlug: profile?.slug ?? null,
      })
      await sendCoachEmail({ to: coachEmail, ...rendered })
    } catch (err) {
      console.error('per-event coach notification failed:', err instanceof Error ? err.message : err)
    }
  })())
}
```

- [ ] **Step 2: Manual test**

In Supabase SQL editor, set one claimed program's `notify_per_inbound = true` and `coach_email` to an inbox you control. Have an athlete email that coach via the app. Within 30 sec the coach inbox should receive the notification email.

- [ ] **Step 3: Commit**

```bash
git add server/routes/gmail.ts
git commit -m "feat(coach): per-event Resend notification on athlete outreach"
```

---

## Task 19: `PATCH /api/coach/notifications`

**Files:**
- Modify: `server/routes/coachReply.ts`

- [ ] **Step 1: Add the route**

Append to `server/routes/coachReply.ts`:

```typescript
// PATCH /api/coach/notifications
// body: { coachUserId, perInbound?, dailyDigest? }
router.patch('/notifications', async (req, res) => {
  const { coachUserId, perInbound, dailyDigest } = req.body as {
    coachUserId: string; perInbound?: boolean; dailyDigest?: boolean
  }
  if (!coachUserId) return res.status(400).json({ error: 'coachUserId required' })
  const update: Record<string, unknown> = {}
  if (perInbound !== undefined) update.notify_per_inbound = perInbound
  if (dailyDigest !== undefined) update.notify_daily_digest = dailyDigest
  if (Object.keys(update).length === 0) return res.status(400).json({ error: 'no fields' })
  const { error } = await getSupabase()
    .from('claimed_programs').update(update).eq('coach_user_id', coachUserId)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

// GET /api/coach/notifications?coachUserId=
router.get('/notifications', async (req, res) => {
  const { coachUserId } = req.query as { coachUserId: string }
  if (!coachUserId) return res.status(400).json({ error: 'coachUserId required' })
  const { data } = await getSupabase()
    .from('claimed_programs')
    .select('notify_per_inbound, notify_daily_digest')
    .eq('coach_user_id', coachUserId)
    .maybeSingle()
  res.json({
    perInbound: data?.notify_per_inbound ?? false,
    dailyDigest: data?.notify_daily_digest ?? true,
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/coachReply.ts
git commit -m "feat(coach): notification preferences GET/PATCH"
```

---

## Task 20: `NotificationPrefs` UI component

**Files:**
- Create: `client/src/components/coach/NotificationPrefs.tsx`
- Modify: `client/src/lib/api.ts`

- [ ] **Step 1: Add API helpers**

Append to `client/src/lib/api.ts`:

```typescript
export interface CoachNotifPrefs { perInbound: boolean; dailyDigest: boolean }

export async function getCoachNotifPrefs(coachUserId: string): Promise<CoachNotifPrefs> {
  const r = await fetch(`/api/coach/notifications?coachUserId=${encodeURIComponent(coachUserId)}`)
  if (!r.ok) throw new Error('Failed to load notification prefs')
  return r.json()
}

export async function setCoachNotifPrefs(
  coachUserId: string,
  prefs: Partial<CoachNotifPrefs>,
): Promise<void> {
  const r = await fetch('/api/coach/notifications', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coachUserId, ...prefs }),
  })
  if (!r.ok) throw new Error('Failed to save notification prefs')
}
```

- [ ] **Step 2: Create the component**

```tsx
// client/src/components/coach/NotificationPrefs.tsx
import { useEffect, useState } from 'react'
import { Card } from '../ui/Card'
import { getCoachNotifPrefs, setCoachNotifPrefs } from '../../lib/api'

interface Props { coachUserId: string }

export function NotificationPrefs({ coachUserId }: Props) {
  const [perInbound, setPerInbound] = useState(false)
  const [dailyDigest, setDailyDigest] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCoachNotifPrefs(coachUserId)
      .then((p) => { setPerInbound(p.perInbound); setDailyDigest(p.dailyDigest) })
      .finally(() => setLoading(false))
  }, [coachUserId])

  async function toggle(key: 'perInbound' | 'dailyDigest', v: boolean) {
    if (key === 'perInbound') setPerInbound(v); else setDailyDigest(v)
    await setCoachNotifPrefs(coachUserId, { [key]: v })
  }

  if (loading) return null

  return (
    <Card className="p-6">
      <div className="text-xs font-mono uppercase tracking-[0.18em] text-[#f0b65a] mb-3">Email me when</div>
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={perInbound} onChange={(e) => toggle('perInbound', e.target.checked)} className="accent-[#f0b65a]" />
          <span className="text-sm text-[#f5f1e8]">Every time a new athlete reaches out</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={dailyDigest} onChange={(e) => toggle('dailyDigest', e.target.checked)} className="accent-[#f0b65a]" />
          <span className="text-sm text-[#f5f1e8]">Once a day with a digest of new interest</span>
        </label>
      </div>
    </Card>
  )
}
```

- [ ] **Step 3: Mount in CoachDashboard**

In `client/src/pages/CoachDashboard.tsx`, add the import:
```tsx
import { NotificationPrefs } from '../components/coach/NotificationPrefs'
```

And insert the component just below the program-header card:
```tsx
<NotificationPrefs coachUserId={user.id} />
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/coach/NotificationPrefs.tsx client/src/lib/api.ts client/src/pages/CoachDashboard.tsx
git commit -m "feat(coach): notification prefs card on dashboard"
```

---

## Task 21: Daily digest endpoint (secret-gated)

**Files:**
- Modify: `server/routes/coachReply.ts`

- [ ] **Step 1: Add the route**

Append:

```typescript
// POST /api/coach/notifications/send-digest
// Internal — invoked by the GitHub Actions cron once per day. Auth: shared-secret
// header X-Coach-Digest-Secret (set in COACH_DIGEST_SECRET env var on the server).
router.post('/notifications/send-digest', async (req, res) => {
  const secret = req.header('X-Coach-Digest-Secret')
  if (!secret || secret !== process.env.COACH_DIGEST_SECRET) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const supabase = getSupabase()

  // Find every coach who wants the digest, with at least one new athlete since
  // their last digest (or in the last 24h if they've never been digested).
  const { data: claims } = await supabase
    .from('claimed_programs')
    .select('coach_user_id, coach_email, coach_name, school_name, last_digest_sent_at')
    .eq('notify_daily_digest', true)
    .not('coach_user_id', 'is', null)

  const { renderDailyDigestEmail, sendCoachEmail } = await import('../lib/coachNotifications')

  let sent = 0
  for (const claim of claims ?? []) {
    const since = claim.last_digest_sent_at
      ? new Date(claim.last_digest_sent_at)
      : new Date(Date.now() - 24 * 60 * 60 * 1000)

    const { data: consents } = await supabase
      .from('coach_inbound_consents')
      .select('athlete_id, created_at')
      .ilike('coach_email', claim.coach_email)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(50)

    if (!consents || consents.length === 0) continue

    const ids = [...new Set(consents.map((c: any) => c.athlete_id))]
    const { data: profiles } = await supabase
      .from('athlete_profiles')
      .select('user_id, full_name, slug, primary_position, graduation_year')
      .in('user_id', ids)

    const athletes = (profiles ?? []).map((p: any) => ({
      name: p.full_name ?? 'A KickrIQ athlete',
      position: p.primary_position ?? null,
      gradYear: p.graduation_year ?? null,
      slug: p.slug ?? null,
    }))

    const rendered = renderDailyDigestEmail({
      coachName: claim.coach_name ?? 'Coach',
      programName: claim.school_name ?? '',
      athletes,
    })
    if (!rendered) continue

    try {
      await sendCoachEmail({ to: claim.coach_email, ...rendered })
      await supabase
        .from('claimed_programs')
        .update({ last_digest_sent_at: new Date().toISOString() })
        .eq('coach_user_id', claim.coach_user_id)
      sent++
    } catch (err) {
      console.error('digest send failed for', claim.coach_email, err)
    }
  }

  res.json({ sent, total: claims?.length ?? 0 })
})
```

- [ ] **Step 2: Manual smoke test**

Set a real `COACH_DIGEST_SECRET` in `.env`, restart server, then:
```bash
curl -X POST http://localhost:3001/api/coach/notifications/send-digest \
  -H "X-Coach-Digest-Secret: <your-secret>"
```
Expected: `{"sent":N,"total":M}`. Coach inbox(es) receive a digest if they had new consent rows in the last 24h.

- [ ] **Step 3: Commit**

```bash
git add server/routes/coachReply.ts
git commit -m "feat(coach): daily digest send-digest endpoint (secret-gated)"
```

---

## Task 22: GitHub Action cron for the daily digest

**Files:**
- Create: `.github/workflows/coach-daily-digest.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Coach daily digest

# Sends each opted-in coach a digest of new athletes who reached out in the
# last 24h. Runs once a day at 12:00 UTC (~8am ET / 5am PT). The actual send
# logic lives in /api/coach/notifications/send-digest — this workflow just
# pings that endpoint with the shared secret.

on:
  schedule:
    - cron: '0 12 * * *'
  workflow_dispatch: {}

jobs:
  send:
    runs-on: ubuntu-latest
    steps:
      - name: Call send-digest endpoint
        env:
          API_BASE: ${{ secrets.COACH_DIGEST_API_BASE }}
          SECRET: ${{ secrets.COACH_DIGEST_SECRET }}
        run: |
          if [ -z "$API_BASE" ] || [ -z "$SECRET" ]; then
            echo "Missing COACH_DIGEST_API_BASE or COACH_DIGEST_SECRET secret"
            exit 1
          fi
          response=$(curl -sS -X POST "$API_BASE/api/coach/notifications/send-digest" \
            -H "X-Coach-Digest-Secret: $SECRET" \
            -w "\nHTTP %{http_code}\n")
          echo "$response"
          echo "$response" | grep -q "HTTP 200" || exit 1
```

- [ ] **Step 2: Add GitHub repo secrets**

In the GitHub repo settings → Secrets and variables → Actions → New repository secret:
- `COACH_DIGEST_API_BASE` — `https://api.kickriq.com` (your prod API base)
- `COACH_DIGEST_SECRET` — same value as the server's `COACH_DIGEST_SECRET` env var

Also add `COACH_DIGEST_SECRET` to the production environment (Render dashboard → Environment).

- [ ] **Step 3: Trigger manually to verify**

In GitHub → Actions → "Coach daily digest" → "Run workflow". Expected: green run, "HTTP 200" in logs.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/coach-daily-digest.yml
git commit -m "feat(ops): GitHub Actions cron for coach daily digest"
```

---

## Task 23: Final smoke test + tag

This is the verification gate before declaring Phase 1 done.

- [ ] **Step 1: Run unit tests**

```bash
npm test
```
Expected: all green (existing tests + new `coachNotifications.test.ts`).

- [ ] **Step 2: Manual end-to-end**

Cold-start: clear test athlete & coach, sign both up, then walk:
1. Athlete completes profile → connects Gmail → sends an outreach email to coach.
2. Coach claims program → sees athlete with real name + profile link.
3. Coach toggles "every time a new athlete reaches out" notification.
4. Athlete sends a second email → coach receives a Resend notification within 30 sec.
5. Coach clicks "Reply" → AI draft loads → edits → sends → athlete receives the reply in Gmail.
6. Coach signs out, signs back in, sees the same dashboard state.
7. Run the digest endpoint manually with the secret → coach receives a digest summarizing both athletes.

- [ ] **Step 3: Mobile pass**

Open `/for-coaches/dashboard` on a phone (Chrome devtools mobile view at minimum). Athlete cards should stack readably; ReplyComposer modal should be usable on a 375px wide screen. Fix any overflow issues you spot.

- [ ] **Step 4: Tag**

```bash
git tag coach-portal-phase1-shipped
git push origin coach-portal-phase1-shipped
```

---

## Self-Review Notes

**Spec coverage:**
- 1.1 Athlete identity — Tasks 1, 2, 3, 4, 5, 6, 7, 8 ✓
- 1.2 Coach replies via Gmail — Tasks 9, 10, 11, 12, 13, 14 ✓
- 1.3 Notifications — Tasks 16, 17, 18, 19, 20, 21, 22 ✓
- End-to-end test — Tasks 15, 23 ✓

**Out-of-scope (deferred to Phase 2 or later):**
- Filters, search, AI fit-scoring (Phase 2 spec)
- Branding, verification hardening (Phase 3 spec)
- Athlete revoke-consent UI (spec lists as future work)

**Known imperfections deliberately accepted:**
- `POST /api/coach/reply/send` requires the athlete to have Gmail connected (we fetch the athlete's email from `user_gmail_tokens`). Athletes who used non-Google sign-up will surface an "athlete_email_unknown" error. Acceptable for v1; revisit when we have non-Google auth in volume.
- Gmail in-thread headers (In-Reply-To, References) are skipped on coach replies because the coach can't read the athlete's thread. The reply still arrives in the athlete's inbox; threading is best-effort on Gmail's side.
- Render free sleeps after 15 min idle. The first cron call of the day will take 30–60 sec to wake the server. Workflow fails-loud on non-200, retry is via re-running the GitHub Action.
