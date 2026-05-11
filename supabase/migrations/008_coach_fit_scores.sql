-- supabase/migrations/008_coach_fit_scores.sql
-- Coach Portal Phase 2 — AI fit-score cache.
--
-- A claimed coach can request an AI assessment of how well an inbound athlete
-- fits their program's current needs. The assessment is deterministic for a
-- given (athlete profile, coach needs) pair, so we cache it and only recompute
-- when either side actually changes. Cache key is (coach_user_id, athlete_id),
-- and we store hashes of the inputs so a stale row is detected on read and
-- a fresh AI call is triggered.
--
-- Charged to Anthropic credits per recompute (~$0.002 per call at Sonnet 4
-- pricing for the prompt shape we use), so caching is non-negotiable for
-- coaches scrolling a feed of dozens of athletes.

create table if not exists coach_fit_scores (
  id              uuid primary key default gen_random_uuid(),
  coach_user_id   uuid not null references auth.users(id) on delete cascade,
  athlete_id      uuid not null references auth.users(id) on delete cascade,
  -- Score is a 1-10 integer; the AI returns a decimal which we round at write.
  -- Range guard so an off-rubric AI response can't surface as a bad UI badge.
  score           integer not null check (score between 1 and 10),
  one_line        text not null,             -- 1-sentence verdict for the card
  strengths       jsonb not null default '[]'::jsonb,  -- 2-4 bullet strings
  concerns        jsonb not null default '[]'::jsonb,  -- 1-3 bullet strings
  -- Hashes of the input shape — when either changes, the cached row is stale.
  -- athlete_hash covers profile fields the fit prompt actually reads (gpa,
  -- position, grad year, goals/assists, video rating). needs_hash covers the
  -- coach's roster needs + notes. The route recomputes if either differs.
  athlete_hash    text not null,
  needs_hash      text not null,
  created_at      timestamptz not null default now(),
  unique (coach_user_id, athlete_id)
);

create index if not exists coach_fit_scores_coach_idx
  on coach_fit_scores (coach_user_id, created_at desc);

alter table coach_fit_scores enable row level security;

-- A coach can only read fit scores they generated. No client-side writes;
-- the server (using the service key) is the only writer.
create policy "Coach reads own fit scores"
  on coach_fit_scores for select
  using (auth.uid() = coach_user_id);
