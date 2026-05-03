-- 004_athlete_profiles.sql

do $$ begin
  create type position_code as enum ('GK','CB','FB','DM','CM','AM','W','ST');
exception when duplicate_object then null; end $$;
do $$ begin
  create type preferred_foot as enum ('left','right','both');
exception when duplicate_object then null; end $$;
do $$ begin
  create type profile_visibility as enum ('public','recruiters_only','private');
exception when duplicate_object then null; end $$;
do $$ begin
  create type division_target as enum ('NCAA_D1','NCAA_D2','NCAA_D3','NAIA','NJCAA','PRO');
exception when duplicate_object then null; end $$;
do $$ begin
  create type media_kind as enum ('highlight_video','match_film','photo','press_mention');
exception when duplicate_object then null; end $$;

create table if not exists athlete_profiles (
  user_id                            uuid primary key references auth.users(id) on delete cascade,
  slug                               text unique,
  profile_completed                  boolean not null default false,
  profile_completed_at               timestamptz,
  profile_strength_score             int not null default 0 check (profile_strength_score between 0 and 100),
  profile_visibility                 profile_visibility not null default 'recruiters_only',
  full_name                          text,
  date_of_birth                      date,
  gender                             text check (gender in ('mens','womens','non_binary','prefer_not_to_say')),
  nationality                        text,
  country_of_residence               text,
  city                               text,
  state                              text,
  profile_photo_url                  text,
  primary_position                   position_code,
  secondary_position                 position_code,
  preferred_foot                     preferred_foot,
  jersey_number                      int check (jersey_number is null or jersey_number between 0 and 99),
  current_club                       text,
  current_league_or_division         text,
  years_playing_competitive_soccer   int check (years_playing_competitive_soccer is null or years_playing_competitive_soccer between 0 and 30),
  coach_name                         text,
  coach_email                        text,
  coach_phone                        text,
  high_school_name                   text,
  graduation_year                    int check (graduation_year is null or graduation_year between 2020 and 2040),
  gpa                                numeric(3,2) check (gpa is null or (gpa >= 0 and gpa <= 5)),
  sat_or_act_score                   text,
  intended_major                     text,
  ncaa_eligibility_id                text,
  height_cm                          numeric(5,1) check (height_cm is null or (height_cm > 0 and height_cm < 260)),
  weight_kg                          numeric(5,1) check (weight_kg is null or (weight_kg > 0 and weight_kg < 250)),
  desired_division_levels            division_target[] not null default '{}',
  regions_of_interest                text[] not null default '{}',
  academic_priority_vs_athletic      int check (academic_priority_vs_athletic is null or academic_priority_vs_athletic between 0 and 100),
  forty_yard_dash_seconds            numeric(5,2),
  ten_yard_sprint_seconds            numeric(5,2),
  vertical_jump_inches               numeric(5,2),
  broad_jump_inches                  numeric(5,2),
  beep_test_level                    numeric(4,1),
  mile_time_seconds                  int,
  max_vo2                            numeric(5,2),
  games_played                       int,
  goals                              int,
  assists                            int,
  clean_sheets                       int,
  minutes_played                     int,
  yellow_cards                       int,
  red_cards                          int,
  honors_and_awards                  text[] not null default '{}',
  showcase_appearances               text[] not null default '{}',
  national_team_experience           text[] not null default '{}',
  olympic_development_program        boolean not null default false,
  olympic_development_program_details text,
  highlight_video_url                text,
  additional_coach_references        jsonb not null default '[]'::jsonb,
  created_at                         timestamptz not null default now(),
  updated_at                         timestamptz not null default now(),
  constraint athlete_profiles_complete_required_fields check (
    not profile_completed or (
      full_name is not null and length(btrim(full_name)) > 0
      and date_of_birth is not null and gender is not null
      and nationality is not null and length(btrim(nationality)) > 0
      and country_of_residence is not null and length(btrim(country_of_residence)) > 0
      and city is not null and length(btrim(city)) > 0
      and state is not null and length(btrim(state)) > 0
      and profile_photo_url is not null and length(btrim(profile_photo_url)) > 0
      and primary_position is not null and preferred_foot is not null and jersey_number is not null
      and current_club is not null and length(btrim(current_club)) > 0
      and current_league_or_division is not null and length(btrim(current_league_or_division)) > 0
      and years_playing_competitive_soccer is not null
      and coach_name is not null and length(btrim(coach_name)) > 0
      and coach_email is not null and length(btrim(coach_email)) > 0
      and coach_phone is not null and length(btrim(coach_phone)) > 0
      and high_school_name is not null and length(btrim(high_school_name)) > 0
      and graduation_year is not null and gpa is not null
      and sat_or_act_score is not null and length(btrim(sat_or_act_score)) > 0
      and intended_major is not null and length(btrim(intended_major)) > 0
      and ncaa_eligibility_id is not null and length(btrim(ncaa_eligibility_id)) > 0
      and height_cm is not null and weight_kg is not null
      and array_length(desired_division_levels, 1) >= 1
      and array_length(regions_of_interest, 1) >= 1
      and academic_priority_vs_athletic is not null
    )
  )
);

create index if not exists athlete_profiles_slug_idx on athlete_profiles(slug) where slug is not null;
create index if not exists athlete_profiles_completed_idx on athlete_profiles(profile_completed) where profile_completed = true;
create index if not exists athlete_profiles_visibility_idx on athlete_profiles(profile_visibility);
create index if not exists athlete_profiles_grad_year_idx on athlete_profiles(graduation_year) where graduation_year is not null;
create index if not exists athlete_profiles_primary_position_idx on athlete_profiles(primary_position) where primary_position is not null;

create or replace function touch_athlete_profiles_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists athlete_profiles_touch_updated_at on athlete_profiles;
create trigger athlete_profiles_touch_updated_at
  before update on athlete_profiles
  for each row execute function touch_athlete_profiles_updated_at();

create table if not exists profile_media (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         media_kind not null,
  url          text not null check (length(btrim(url)) > 0),
  title        text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists profile_media_user_id_idx on profile_media(user_id);
create index if not exists profile_media_user_kind_idx on profile_media(user_id, kind);

alter table athlete_profiles enable row level security;
alter table profile_media enable row level security;

create policy "Athletes manage own profile"
  on athlete_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Public can read public profiles"
  on athlete_profiles for select using (profile_visibility = 'public' and profile_completed = true);
create policy "Authenticated users can read recruiter-visible profiles"
  on athlete_profiles for select using (
    auth.role() = 'authenticated' and profile_completed = true
    and profile_visibility in ('public','recruiters_only')
  );
create policy "Athletes manage own media"
  on profile_media for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Public can read media on public profiles"
  on profile_media for select using (
    exists (
      select 1 from athlete_profiles p
      where p.user_id = profile_media.user_id and p.profile_completed = true
        and (p.profile_visibility = 'public'
          or (auth.role() = 'authenticated' and p.profile_visibility = 'recruiters_only'))
    )
  );