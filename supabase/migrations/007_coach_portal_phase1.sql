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
