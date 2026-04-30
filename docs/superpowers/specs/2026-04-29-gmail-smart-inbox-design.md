# Gmail Smart Inbox — Design Spec
**Date:** 2026-04-29  
**Status:** Approved

## Overview

Extend the Outreach Tracker into a command center by connecting each contact row to its Gmail thread. Athletes see coach replies inline, get AI interest ratings, read full conversation history, and generate AI replies — all without leaving the app. Gmail connects once via OAuth; the app handles everything else silently.

---

## Architecture

```
Gmail (OAuth) ──► server/routes/gmail.ts ──► Supabase DB
                         │                        │
                         ▼                        ▼
                   /api/gmail/threads      outreach_contacts
                   /api/gmail/thread/:id   sent_emails
                         │
                         ▼
              React OutreachTracker page
                  ├── Gmail connect banner (if not connected)
                  ├── Contact row (coach + school + interest badge + last reply snippet)
                  │       └── Expand → full thread view
                  │                ├── All messages chronologically
                  │                ├── AI interest rating (hot/warm/cold)
                  │                └── "Generate Reply" → pre-fills Follow-Up Assistant
                  └── "Untracked coach replies" section
                          └── Emails from unknown senders flagged as potential coaches
```

### Already built (wire up only)
- Gmail OAuth connect flow (`/api/gmail/auth` + `/callback`)
- Token storage in Supabase `user_gmail_tokens`
- `/api/gmail/send` endpoint
- AI interest rating (`/api/ai/rate-response`)
- AI follow-up generation (`/api/ai/followup`)

### New work required
- 3 new Gmail API endpoints
- 2 new Supabase tables
- Smart coach detection heuristic
- Expanded outreach tracker UI

---

## Data Model

### `outreach_contacts`
One row per coach the athlete has contacted.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK → auth.users | |
| coach_name | text | |
| school_name | text | |
| coach_email | text | |
| position | text | "Head Coach", "Assistant Coach" |
| division | text | D1/D2/D3/NAIA/JUCO |
| gmail_thread_id | text | Bridge to Gmail thread |
| interest_rating | text | hot/warm/cold/not_interested/pending |
| last_reply_at | timestamptz | |
| last_reply_snippet | text | First 150 chars of latest coach reply |
| status | text | contacted/replied/scheduled_visit/committed/no_response |
| notes | text | |
| created_at | timestamptz | |

### `sent_emails`
One row per email sent through the app.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK → auth.users | |
| contact_id | uuid FK → outreach_contacts | |
| gmail_thread_id | text | |
| gmail_message_id | text | Returned by Gmail API after send |
| subject | text | |
| body | text | |
| sent_at | timestamptz | |
| email_type | text | initial_outreach/followup/thank_you/camp_inquiry |

**Key design decisions:**
- `gmail_thread_id` on `outreach_contacts` is the bridge between tracker and Gmail — one thread = one coach conversation
- `interest_rating` starts as `pending`, updated by AI whenever a new reply arrives
- `sent_emails` provides full audit trail and history to feed into AI when generating replies

---

## API Endpoints

### New endpoints (added to `server/routes/gmail.ts`)

**`GET /api/gmail/threads?userId=<uid>`**
- Fetches all Gmail threads for the authenticated user
- Cross-references `outreach_contacts.coach_email` to tag tracked threads
- For untracked threads, applies coach detection heuristic (see below)
- Returns:
  - `tracked`: contacts with `last_reply_snippet`, `last_reply_at`, `interest_rating`
  - `untracked`: potential coach emails not yet in tracker

**`GET /api/gmail/thread/:threadId?userId=<uid>`**
- Fetches full message history for a single Gmail thread
- Decodes base64 Gmail message bodies
- Returns messages in chronological order: `{ sender, timestamp, body, isFromCoach }`

**`POST /api/gmail/rate-and-log`**
- Accepts `{ userId, threadId, contactId, latestCoachMessage }`
- Calls `/api/ai/rate-response` with the coach message
- Writes `interest_rating` back to `outreach_contacts`
- Returns `{ rating, reasoning }`

### Existing endpoints (unchanged)
- `GET /api/gmail/auth` + `GET /api/gmail/callback` — OAuth flow
- `GET /api/gmail/status` — connection check
- `POST /api/gmail/send` — email sending (caller also writes to `sent_emails`)

### Coach detection heuristic
An untracked thread is flagged as a potential coach reply if any of:
- Subject contains: "soccer", "recruiting", "recruit", "camp", "roster", "scholarship", "visit", "tryout"
- Sender email domain matches a known school domain (cross-reference `schools.json`)
- Sender email domain ends in `.edu`

---

## UI Components

### Gmail Connect Banner
Shown at top of Outreach Tracker only when Gmail is not connected.
```
┌─────────────────────────────────────────────────────┐
│ Connect Gmail to see coach replies & send emails    │
│                              [Connect Gmail] button │
└─────────────────────────────────────────────────────┘
```
On click: opens existing OAuth popup (`/api/gmail/auth`). Banner disappears once connected.

### Contact Row (enhanced)
```
┌─────────────────────────────────────────────────────┐
│ Coach Maria Santos · Stanford · D1 Goalkeeper Coach │
│ ● HOT  │ Replied 2 days ago                    [▼] │
│ "Thanks for reaching out, we'd love to schedule..." │
└─────────────────────────────────────────────────────┘
```
- Interest badge: color-coded (green=hot, yellow=warm, gray=cold, red=not_interested, blue=pending)
- Last reply snippet shown if Gmail is connected and a reply exists
- `[▼]` expands to thread view

### Thread View Panel
Inline expansion below the contact row.
```
┌─────────────────────────────────────────────────────┐
│  You → Apr 24  "Hi Coach Santos, my name is..."    │
│  Coach → Apr 26  "Thanks for reaching out..."      │
│  You → Apr 27  "Thank you so much! I'd love to..." │
│                                                     │
│  [Generate Reply]   [Mark as Visited]   [Archive]  │
└─────────────────────────────────────────────────────┘
```
- "Generate Reply" pre-fills Follow-Up Assistant: coach name, school, their latest message, full thread history
- "Mark as Visited" updates `status` to `scheduled_visit`
- "Archive" sets `status` to `no_response` and collapses row

### Untracked Coach Replies Section
Bottom of tracker, collapsed by default, expandable.
```
┌─────────────────────────────────────────────────────┐
│ Possible coach replies (not yet in your tracker)    │
│ coach.johnson@unc.edu · "Soccer recruiting inquiry" │
│                              [Add to Tracker] btn   │
└─────────────────────────────────────────────────────┘
```
"Add to Tracker" opens a small form to fill in coach name, school, division, then creates a new `outreach_contacts` row with the `gmail_thread_id` pre-filled.

---

## Data Flow: Sending an Email

1. Athlete generates email via existing AI email generator
2. Clicks "Send" — app calls `POST /api/gmail/send`
3. Gmail API returns `threadId` + `messageId`
4. App writes row to `sent_emails` with those IDs
5. If this is the first email to this coach, creates row in `outreach_contacts` with `gmail_thread_id` and `status=contacted`
6. Tracker row appears immediately

## Data Flow: Checking for Replies

1. Athlete opens Outreach Tracker
2. App calls `GET /api/gmail/threads`
3. Server fetches threads, matches by `coach_email` against `outreach_contacts`
4. For matched threads with new messages: updates `last_reply_snippet`, `last_reply_at` in DB
5. Calls `POST /api/gmail/rate-and-log` for any unrated new replies
6. Returns updated contact list — tracker re-renders with new snippets + ratings

---

## Out of Scope
- Chrome extension
- Real-time push notifications (no webhooks — polling on page load is sufficient)
- Bulk email automation / scheduled send
- Analytics dashboard (open rates, reply rates)
- Non-Gmail providers (Outlook, Yahoo)
