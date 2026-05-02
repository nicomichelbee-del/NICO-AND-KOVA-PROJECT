-- supabase/migrations/003_camp_ratings_comments.sql
-- User ratings and comments for ID camps and showcase events.
-- camp_id is opaque text — covers both idCamps.json and idEvents.json entries.

create table if not exists camp_ratings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  camp_id     text not null,
  rating      int  not null check (rating between 1 and 5),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, camp_id)
);

create index if not exists camp_ratings_camp_id_idx on camp_ratings(camp_id);
create index if not exists camp_ratings_user_id_idx on camp_ratings(user_id);

alter table camp_ratings enable row level security;

create policy "Anyone can read camp ratings"
  on camp_ratings for select
  using (true);

create policy "Users insert own camp ratings"
  on camp_ratings for insert
  with check (auth.uid() = user_id);

create policy "Users update own camp ratings"
  on camp_ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own camp ratings"
  on camp_ratings for delete
  using (auth.uid() = user_id);

create table if not exists camp_comments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  camp_id       text not null,
  display_name  text not null default 'Anonymous',
  body          text not null check (length(body) between 1 and 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists camp_comments_camp_id_idx on camp_comments(camp_id);
create index if not exists camp_comments_user_id_idx on camp_comments(user_id);
create index if not exists camp_comments_created_at_idx on camp_comments(created_at desc);

alter table camp_comments enable row level security;

create policy "Anyone can read camp comments"
  on camp_comments for select
  using (true);

create policy "Users insert own camp comments"
  on camp_comments for insert
  with check (auth.uid() = user_id);

create policy "Users update own camp comments"
  on camp_comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own camp comments"
  on camp_comments for delete
  using (auth.uid() = user_id);
