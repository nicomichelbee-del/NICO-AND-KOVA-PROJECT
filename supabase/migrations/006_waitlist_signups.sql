-- 006_waitlist_signups.sql
--
-- Captures Pro/Family waitlist signups while billing is on hold.
-- The /api/public/waitlist endpoint upserts on email, so re-signups
-- update the row instead of creating duplicates.

create table if not exists waitlist_signups (
  email        text primary key,
  feature      text not null default 'general',
  tier         text not null default 'pro'
    check (tier in ('pro','family','general')),
  source       text not null default '',
  user_agent   text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists waitlist_signups_created_at_idx on waitlist_signups(created_at desc);
create index if not exists waitlist_signups_feature_idx on waitlist_signups(feature);
create index if not exists waitlist_signups_tier_idx on waitlist_signups(tier);

alter table waitlist_signups enable row level security;

-- Anonymous visitors POST through the server (service-role key), so no
-- public insert policy is needed. Owner reads happen via Supabase dashboard
-- which bypasses RLS for the project owner.
