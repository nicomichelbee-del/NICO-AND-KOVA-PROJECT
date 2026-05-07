# Coach Portal — Design Spec
**Date:** 2026-05-06
**Status:** Draft

## Overview

Turn the existing coach-portal scaffold (`/for-coaches` + `/for-coaches/dashboard`) into a fully usable product for college coaches. Today it lets coaches claim a program, set roster needs, and see anonymized inbound athletes. After this work it will: surface real athlete identities (with consent), let coaches reply via their Gmail, notify them when athletes reach out, AI-score each athlete's fit, support coach-side filtering, and host a Pro-tier waitlist for premium features. Free coaches keep meaningful capability; Pro features are gated with a waitlist banner (matches the athlete-side Pro waitlist pattern).

---

## Current state (what already exists)

- DB: `claimed_programs` table with RLS (`supabase/migrations/005_coach_portal.sql`)
- API: `server/routes/coach.ts` exposes `search`, `claim`, `me`, `needs (PATCH)`, `inbound`
- Pages: `client/src/pages/ForCoaches.tsx` (magic-link sign-in), `client/src/pages/CoachDashboard.tsx` (claim + roster needs editor + public notes + anonymized inbound table)
- Routes wired in `client/src/App.tsx`
- Reusable infra: Gmail OAuth + send (`server/routes/gmail.ts`), `/api/ai` service layer, Supabase Auth, Resend (TBD — see Open Questions), `outreach_contacts` table

## Goals

1. Coaches see real athlete identities for athletes who emailed them via KickrIQ (with consent recorded at send time).
2. Coaches can reply inside the portal using their own Gmail.
3. Coaches get notified when a new athlete reaches out.
4. AI fit-scores rank inbound athletes against the coach's stated needs (Pro).
5. Coaches can filter/sort the inbound feed.
6. Roster needs and program branding are richer (squad size, GPA min, ID-camp dates, logo, pitch).
7. Verification is harder to spoof but doesn't block legitimate coaches.
8. Pro features are gated with a waitlist (no payments yet).

## Non-goals

- No paid coach tier in this round — waitlist only.
- No automated roster-page scraping for verification (out of scope; manual admin review is sufficient).
- No bulk-import of past inbound athletes from outside KickrIQ.
- No mobile-native coach app (the responsive web dashboard is enough).
- No coach-side athlete CRM beyond status + reply history.

---

## Architecture

```
ATHLETE SIDE                          COACH SIDE
────────────                          ──────────
Emails page                           ForCoaches (sign in)
  └─ "Send" click                       └─ Magic-link auth
       └─ records consent                    └─ ProtectedCoachRoute
            └─ writes to                          └─ CoachDashboard
                outreach_contacts                       ├─ ClaimFlow (existing)
                + coach_inbound_consents                ├─ ProgramHeader
                                                        ├─ RosterNeedsEditor (extended)
PublicProfile (/players/:slug)                          ├─ BrandingEditor (new)
   └─ visible to claiming coach                         ├─ InboundFeed (real identities)
                                                        │     ├─ FilterBar
                                                        │     ├─ AthleteCard (per row)
                                                        │     │     ├─ FitScore (Pro)
                                                        │     │     └─ ReplyComposer (Gmail)
                                                        │     └─ ProWaitlistBanner
                                                        ├─ NotificationPrefs
                                                        └─ ProWaitlistBanner

NOTIFICATIONS                          ADMIN
─────────────                          ─────
On new outreach_contacts insert        /admin/coach-reviews
  └─ check claimed_programs                └─ pending claims queue
       └─ Resend daily digest +                └─ approve / reject
          per-event email if enabled           └─ flagged programs (athlete reports)
```

### Why this shape
- Reuse: don't replace the working scaffold; extend tables and routes in place.
- Server-mediated reads keep RLS simple — coaches never query athlete tables directly.
- Gmail OAuth already works on the athlete side; the coach side is the same flow with a different `purpose` flag.
- `/api/ai` enforces tier limits in one place (already established convention from CLAUDE.md).

---

## Phase 1 — Identity, replies, notifications (the unblockers)

This is what makes the portal actually useful. Ship this first; Phases 2–3 can come later.

### 1.1 Athlete identity in inbound feed

**DB** — new table:
```sql
create table coach_inbound_consents (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references auth.users(id) on delete cascade,
  coach_email   text not null,                 -- normalized lowercase
  school_id     text not null,
  outreach_id   uuid references outreach_contacts(id) on delete set null,
  consent       boolean not null default true, -- always true at send time today
  created_at    timestamptz not null default now(),
  unique (athlete_id, coach_email, school_id)
);
create index on coach_inbound_consents(coach_email);
create index on coach_inbound_consents(athlete_id);
```

**Athlete-side change** — when an athlete sends a coach email through KickrIQ (existing send flow in `server/routes/gmail.ts` or wherever email-send lives), insert a row into `coach_inbound_consents` alongside the existing `outreach_contacts` insert. Add explicit consent text on the email-send screen: *"By sending this, you're sharing your KickrIQ profile with this coach so they can review your fit."*

**API** — `GET /api/coach/inbound` returns enriched athlete data when consent exists:
- name (display name from `athlete_profiles`)
- grad year, position, height, club team
- GPA, intended major
- highlight video URL
- public profile URL (`/players/:slug`)
- last sent message snippet
- thread status (sent / replied / coach-replied)

The response only includes athletes whose `coach_inbound_consents` row matches the claiming coach's email. Server-side join; no RLS changes needed for athletes.

**UI** — `InboundFeed` becomes a card list (not a table) with athlete photo (if any), name, key stats, and a "View full profile" link to the public profile page.

### 1.2 Coach replies via Gmail

**DB** — new table:
```sql
create table coach_messages (
  id              uuid primary key default gen_random_uuid(),
  coach_user_id   uuid not null references auth.users(id) on delete cascade,
  athlete_id      uuid not null references auth.users(id) on delete cascade,
  outreach_id     uuid references outreach_contacts(id) on delete set null,
  direction       text not null check (direction in ('inbound','outbound')),
  gmail_msg_id    text,                          -- Gmail message id when sent
  subject         text not null default '',
  body            text not null,
  sent_at         timestamptz not null default now()
);
create index on coach_messages(coach_user_id, athlete_id, sent_at desc);
```

**Gmail OAuth reuse** — extend the existing `server/routes/gmail.ts` to support a `purpose=coach` flag at connect time. Store the coach's tokens in the existing `user_gmail_tokens` table (the user_id IS the coach's Supabase user id, so no schema change).

**API** — three new endpoints:
- `POST /api/coach/reply/draft` — body `{ inboundId }` → calls `/api/ai/coach-reply-draft`, returns `{ subject, body }` based on the athlete's profile + the coach's program needs.
- `POST /api/coach/reply/send` — body `{ inboundId, subject, body }` → sends via the coach's Gmail, writes a `coach_messages` row + updates `outreach_contacts.status='replied_by_coach'` so the athlete sees the reply on their tracker.
- `GET /api/coach/thread/:athleteId` — full message history for one athlete↔coach thread.

**UI** — each `AthleteCard` has a "Reply" button → opens `ReplyComposer` modal with AI-drafted reply, editable, then "Send via Gmail." First-time coach replies prompt the Gmail OAuth connect flow.

**AI prompt** — coach-reply drafts should be:
- Warm, not corporate (coach-to-recruit tone is informal)
- Reference one specific thing about the athlete (position, school, video)
- End with a clear next step (camp invite, phone call, request more video)
- 80–120 words

### 1.3 Notifications

**Approach** — Resend transactional email. If Resend isn't already configured in the project, add it; cheap and well-supported. (Open Question — confirm.)

**DB** — extend `claimed_programs`:
```sql
alter table claimed_programs
  add column notify_per_inbound  boolean not null default false,
  add column notify_daily_digest boolean not null default true,
  add column last_digest_sent_at timestamptz;
```

**Triggers**:
- New `outreach_contacts` insert with a matching claimed program → enqueue per-event notification (if `notify_per_inbound`).
- Daily cron (Render free tier — schedule via `node-cron` or a simple GitHub Action calling a server endpoint) at 8am ET → batch digest of any new inbounds since `last_digest_sent_at`.

**API**:
- `PATCH /api/coach/notifications` — body `{ perInbound?, dailyDigest? }`
- `POST /api/coach/notifications/send-digest` — internal, called by cron, requires shared secret

**UI** — `NotificationPrefs` card on the dashboard with two toggles.

---

## Phase 2 — Filters, AI fit-scoring, richer roster needs

### 2.1 Filters/search on inbound feed

**No DB changes** — all client-side filter UI over the existing inbound list (capped at 100 today; raise to 500 for paginated views).

**Free filters**: position, grad year.
**Pro filters** (gated with waitlist): GPA range, division-fit, video-rating ≥ X, has-replied, sort by AI fit score.

**UI** — `FilterBar` above `InboundFeed` with chip-style toggles. Pro-only filters show a small lock icon and trigger the Pro Waitlist modal on click.

### 2.2 AI fit-score (Pro)

**API** — `POST /api/coach/inbound/:id/fit` (Pro-gated) → returns `{ score: 1–10, oneLine: string, strengths: string[], concerns: string[] }`.

**Server-side caching** — fit scores are deterministic given (athlete_profile_hash, coach_needs_hash). Cache in a small `coach_fit_scores` table keyed by `(athlete_id, coach_user_id)` with hashes; recompute only if either side's hash changes. This keeps API spend bounded.

```sql
create table coach_fit_scores (
  id              uuid primary key default gen_random_uuid(),
  coach_user_id   uuid not null references auth.users(id) on delete cascade,
  athlete_id      uuid not null references auth.users(id) on delete cascade,
  athlete_hash    text not null,
  needs_hash      text not null,
  score           int not null,
  one_line        text not null,
  strengths       text[],
  concerns        text[],
  computed_at     timestamptz not null default now(),
  unique (coach_user_id, athlete_id)
);
```

**Pro gating** — `enforceCoachTier('pro')` middleware checks the coach's row in `coach_pro_subscriptions` (table doesn't exist yet — for now this always returns false and the route returns a "Pro waitlist" message).

**UI** — `FitScore` widget on each `AthleteCard`: rating ring + one-liner. For Free coaches, it shows blurred-out with a "Join Pro Waitlist to unlock" overlay.

### 2.3 Richer roster needs

**DB** — extend `claimed_programs`:
```sql
alter table claimed_programs
  add column roster_size              int,
  add column gpa_min                  numeric(3,2),
  add column id_camp_dates            jsonb default '[]'::jsonb,  -- [{date, url, description}]
  add column class_breakdown          jsonb,                       -- {fr:n, so:n, jr:n, sr:n}
  add column tryout_url               text;
```

**API** — `PATCH /api/coach/needs` extended to accept these new fields.

**UI** — extend the `RosterNeedsEditor` card with sub-sections: Squad info (size + class breakdown), Academic floor (GPA min), ID camps (dynamic list of date+url+description rows), Tryout link.

**Public surface** — these fields render on Open Spots and the athlete's School Match detail panel.

---

## Phase 3 — Branding, verification, polish

### 3.1 Coach branding

**DB** — extend `claimed_programs`:
```sql
alter table claimed_programs
  add column logo_url       text,
  add column pitch          text,                  -- 200-word public bio
  add column highlight_url  text,                  -- coach's highlight video URL
  add column head_coach_photo_url text,
  add column twitter_handle text,
  add column instagram_handle text;
```

**Storage** — Supabase Storage bucket `coach-uploads` (private bucket, public read for `logo_url` and `head_coach_photo_url` paths only).

**API** — `POST /api/coach/branding/upload` (multipart, server-mediated upload to Storage), `PATCH /api/coach/branding` for the text fields.

**UI** — `BrandingEditor` card with file upload for logo + photo, textareas for pitch, inputs for video URL and socials. Live preview of how it'll look on Open Spots.

### 3.2 Verification hardening

**DB** — add to `claimed_programs`:
```sql
alter table claimed_programs
  add column verification_status text not null default 'verified'
    check (verification_status in ('verified','pending_review','rejected'));
```

Plus a new table:
```sql
create table coach_admin_reviews (
  id                  uuid primary key default gen_random_uuid(),
  claimed_program_id  uuid references claimed_programs(id) on delete cascade,
  reason              text not null,           -- 'domain_only_match','name_mismatch','athlete_flagged'
  details             text,
  status              text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewer_user_id    uuid references auth.users(id) on delete set null,
  reviewer_notes      text,
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz
);
```

**Claim flow logic update** in `POST /api/coach/claim`:
- Exact email match to listed `coachEmail` → `verification_status='verified'`, no review row.
- Domain-only match → `verification_status='pending_review'`, insert `coach_admin_reviews` row with `reason='domain_only_match'`. Coach sees a "claim pending — usually approved within 24h" banner.
- If listed coach name doesn't reasonably match the inputted user name (Levenshtein > threshold) → also flag.

**Athlete flagging** — every claimed program has a small "Report wrong coach" link on its public Open Spots card. One click → POST `/api/coach/flag` → inserts a `coach_admin_reviews` row with `reason='athlete_flagged'`.

**Admin page** — new `/admin/coach-reviews` route, gated by hardcoded admin email check (yours: `nicomichelbee@gmail.com` and `infokickriq@gmail.com` per memory). Lists pending review rows with approve/reject buttons.

### 3.3 Polish & testing

- Playwright smoke test of full coach flow: claim → set needs → see inbound → reply → notification.
- Mobile responsive pass on the dashboard.
- Empty/loading/error states across all new components.
- Bug-fix sweep on the existing dashboard (status badges, table styling on mobile).

---

## Pro-tier waitlist

Matches the athlete-side Pro waitlist pattern (per project memory).

**DB**:
```sql
create table coach_pro_waitlist (
  id              uuid primary key default gen_random_uuid(),
  coach_user_id   uuid not null references auth.users(id) on delete cascade unique,
  features_wanted text[] not null default '{}',   -- 'fit_scoring','advanced_filters','bulk_reply','unlimited_inbound'
  notes           text,
  created_at      timestamptz not null default now()
);
```

**Pro features (locked behind waitlist)**:
- AI fit-scoring (Phase 2.2)
- Advanced filters: GPA range, division-fit, video-rating, has-replied (Phase 2.1)
- Unlimited inbound athletes/month (free tier capped at 50)
- Bulk reply templates (deferred, not built in this round but listed as a Pro waitlist option)

**Free tier (always available)**:
- Claim program, set basic roster needs, branding (Phase 3.1)
- See real identities of inbound athletes (Phase 1.1) — capped at 50/month
- Reply via Gmail (Phase 1.2)
- Daily digest + per-event notifications (Phase 1.3)
- Basic filters: position, grad year (Phase 2.1 free subset)

**UI** — `ProWaitlistBanner` component shown on locked features. Click → modal with checkboxes for which features they want, notes textarea, submit. Identical UX to athlete side.

**API** — `POST /api/coach/pro-waitlist`, `GET /api/coach/pro-waitlist/me`.

---

## Privacy posture

- **Consent at send time** (per the user's pick — option A): when an athlete clicks "Send" on a coach email, we record consent=true. The send screen shows the explicit text *"By sending this, you're sharing your KickrIQ profile with this coach so they can review your fit."*
- A claiming coach only ever sees athletes who actively emailed them through KickrIQ — never a broader directory.
- An athlete can revoke consent later (future): a "Hide my profile from this coach" link on the tracker. Out of scope for v1 — flag as future work.
- Privacy policy gets a one-paragraph update covering coach-side data sharing.

---

## Verification approach summary

Two-tier:
1. **Auto-verify** — exact `coach_email` match (the listed contact in `rosterPrograms.json`).
2. **Pending review** — domain-only match OR coach-name mismatch (Levenshtein-based). Surfaces in `/admin/coach-reviews` for manual approve/reject.

Plus athlete-driven flagging on every claimed program.

This is a deliberate compromise: high signal cases auto-claim (fast for legit coaches), edge cases get human review (low volume, easy to handle), and the community provides a tripwire.

---

## Files to add or change

**New migrations** (one file, sequenced after the latest):
- `supabase/migrations/007_coach_portal_phase1.sql` — `coach_inbound_consents`, `coach_messages`, notification columns on `claimed_programs`
- `supabase/migrations/008_coach_portal_phase2.sql` — `coach_fit_scores`, extended roster columns
- `supabase/migrations/009_coach_portal_phase3.sql` — branding columns, `verification_status`, `coach_admin_reviews`, `coach_pro_waitlist`

**Server**:
- `server/routes/coach.ts` — extend with reply, notifications, fit-score, branding, admin, waitlist, flagging endpoints (likely split into multiple files as it grows: `coach.ts`, `coach.reply.ts`, `coach.admin.ts`)
- `server/routes/ai.ts` — add `/coach-reply-draft` and `/coach-fit-score` actions
- `server/lib/coachNotifications.ts` (new) — Resend integration + daily digest cron
- `server/scripts/sendCoachDigest.ts` (new) — invoked by cron

**Client**:
- `client/src/pages/CoachDashboard.tsx` — split into smaller components:
  - `client/src/components/coach/InboundFeed.tsx`
  - `client/src/components/coach/AthleteCard.tsx`
  - `client/src/components/coach/ReplyComposer.tsx`
  - `client/src/components/coach/RosterNeedsEditor.tsx`
  - `client/src/components/coach/BrandingEditor.tsx`
  - `client/src/components/coach/FilterBar.tsx`
  - `client/src/components/coach/FitScore.tsx`
  - `client/src/components/coach/NotificationPrefs.tsx`
  - `client/src/components/coach/ProWaitlistBanner.tsx`
- `client/src/pages/admin/CoachReviews.tsx` (new)
- `client/src/lib/api.ts` — new helper functions for each endpoint
- `client/src/pages/dashboard/Emails.tsx` — add consent text on send screen
- `client/src/pages/OpenSpots.tsx` — render branding + extended roster fields; add "Report wrong coach" link

---

## Open questions

1. **Resend vs other email infra** — does the project already have a transactional email provider configured? Need to confirm before Phase 1.3. Fallback: SendGrid free tier or Supabase Edge Function with a free SMTP.
2. **Cron host** — Render free sleeps after 15 min idle. The daily digest needs reliable scheduling; either pin a paid Render plan, use a GitHub Action cron hitting a public endpoint with a shared secret, or use Supabase Edge Functions + pg_cron. **Decision needed before Phase 1.3 build.** Recommended: GitHub Action cron — free, reliable, simple.
3. **Inbound cap for free tier** — 50/month seems reasonable but is unvalidated. Worth A/B-ing later.
4. **Mobile dashboard** — coaches likely use desktop. Confirm that mobile responsiveness is "good enough" rather than first-class for v1.
5. **Bulk reply templates** — listed as a future Pro feature; not designed here. Will need its own spec when built.

---

## Success criteria

Phase 1 ships when:
- A coach can sign in, claim a program, and see real names + profile links for athletes who emailed them (with consent recorded).
- A coach can click "Reply", get an AI-drafted email, edit it, and send via their connected Gmail.
- A coach receives a daily digest email when athletes have reached out.
- All flows have empty/loading/error states.
- Playwright smoke test passes end-to-end.

Phase 2 ships when:
- Filters work (free + Pro split with waitlist banners on locked filters).
- Pro coaches see fit scores; Free coaches see locked overlay → waitlist modal.
- Extended roster fields (squad size, GPA min, ID camps, class breakdown) are editable and surface on Open Spots.

Phase 3 ships when:
- Coaches can upload a logo + photo, set a pitch, link a highlight video.
- Pending claims route through `/admin/coach-reviews`; you can approve/reject with two clicks.
- Athletes can report a wrong coach; the report shows up in admin.
- Test sweep done; mobile pass done.

---

## Out-of-scope follow-ups (capture for later)

- Athlete revokes consent / hides profile from a specific coach
- Bulk reply templates
- Coach-side analytics dashboard (response rates, where recruits come from)
- Automated roster-page scraping for verification
- Coach-to-coach handoff when a head coach changes mid-season
- Stripe billing on Pro tier (waitlist → paid)
