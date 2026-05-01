-- supabase/migrations/002_schools_and_coaches.sql
-- Reference tables for college soccer programs and their head coaches.
-- These are populated by the seed script (server/scripts/seedSchools.ts)
-- and are publicly readable; only service-role inserts/updates are allowed.

-- ── schools ────────────────────────────────────────────────────────────────

create table if not exists schools (
  id                text primary key,
  name              text not null,
  division          text not null
    check (division in ('D1','D2','D3','NAIA','JUCO')),
  conference        text not null default '',
  location          text not null default '',
  region            text not null default '',
  enrollment        integer,
  size              text
    check (size in ('small','medium','large')),
  gpa_min           numeric,
  gpa_avg           numeric,
  goals_forward_avg integer,
  goals_mid_avg     integer,
  program_strength  integer
    check (program_strength between 1 and 10),
  scholarships      boolean not null default false,
  notes             text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists schools_division_idx on schools(division);
create index if not exists schools_region_idx   on schools(region);

alter table schools enable row level security;

create policy "Public read schools"
  on schools for select
  using (true);

-- ── coaches ────────────────────────────────────────────────────────────────

create table if not exists coaches (
  id          uuid primary key default gen_random_uuid(),
  school_id   text not null references schools(id) on delete cascade,
  gender      text not null check (gender in ('mens','womens')),
  name        text not null default '',
  title       text not null default '',
  email       text not null default '',
  source_url  text not null default '',
  scraped_at  timestamptz,
  -- success  = name + email from scrape
  -- partial  = name only, no email
  -- failed   = scrape found nothing
  -- ai-inferred = filled by Claude batch lookup (unverified)
  -- unknown  = not yet attempted
  status      text not null default 'unknown'
    check (status in ('success','partial','failed','ai-inferred','unknown')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (school_id, gender)
);

create index if not exists coaches_school_id_idx on coaches(school_id);
create index if not exists coaches_email_idx     on coaches(email) where email <> '';
create index if not exists coaches_status_idx    on coaches(status);

alter table coaches enable row level security;

create policy "Public read coaches"
  on coaches for select
  using (true);
