-- supabase/migrations/001_outreach_tables.sql

create table if not exists outreach_contacts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  coach_name   text not null default '',
  school_name  text not null default '',
  coach_email  text not null default '',
  position     text,
  division     text not null default 'D1',
  gmail_thread_id text,
  interest_rating text not null default 'pending'
    check (interest_rating in ('hot','warm','cold','not_interested','pending')),
  last_reply_at timestamptz,
  last_reply_snippet text,
  status       text not null default 'contacted'
    check (status in ('contacted','replied','scheduled_visit','committed','no_response')),
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists outreach_contacts_user_id_idx on outreach_contacts(user_id);
create index if not exists outreach_contacts_coach_email_idx on outreach_contacts(coach_email);

alter table outreach_contacts enable row level security;
create policy "Users manage own contacts"
  on outreach_contacts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists sent_emails (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  contact_id       uuid references outreach_contacts(id) on delete set null,
  gmail_thread_id  text,
  gmail_message_id text,
  subject          text not null default '',
  body             text not null default '',
  sent_at          timestamptz not null default now(),
  email_type       text not null default 'initial_outreach'
    check (email_type in ('initial_outreach','followup','thank_you','camp_inquiry'))
);

create index if not exists sent_emails_user_id_idx on sent_emails(user_id);
create index if not exists sent_emails_contact_id_idx on sent_emails(contact_id);

alter table sent_emails enable row level security;
create policy "Users manage own sent emails"
  on sent_emails for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
