# Gmail Smart Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Outreach Tracker into a Gmail-powered command center where each contact row shows live coach replies, AI interest ratings, and a full expandable thread view with one-click reply generation.

**Architecture:** Three new server endpoints extend `server/routes/gmail.ts` to fetch and decode Gmail threads. Two new Supabase tables (`outreach_contacts`, `sent_emails`) persist data. The Tracker page is refactored into focused sub-components (`ContactRow`, `ThreadView`, `UntrackedSection`) that consume live data instead of hardcoded demo contacts.

**Tech Stack:** Express + googleapis (already installed), Supabase (already configured), React + react-router-dom, vitest for unit tests on server utilities.

---

## File Map

**New files:**
- `supabase/migrations/001_outreach_tables.sql` — DB schema
- `server/lib/gmailUtils.ts` — `isCoachEmail()`, `decodeMessageBody()` pure utilities
- `server/lib/gmailUtils.test.ts` — unit tests for utilities
- `server/lib/aiClient.ts` — shared `ask()` + `rateCoachReply()` extracted from ai.ts
- `client/src/components/tracker/ContactRow.tsx` — single contact row with badge + expand
- `client/src/components/tracker/ThreadView.tsx` — expandable thread message panel
- `client/src/components/tracker/UntrackedSection.tsx` — potential coach replies section

**Modified files:**
- `server/routes/ai.ts` — import `ask` from `../lib/aiClient` instead of defining inline
- `server/routes/gmail.ts` — 5 new endpoints + update `/send` to return threadId
- `client/src/types/index.ts` — add `OutreachContact`, `SentEmail`, `ThreadMessage`
- `client/src/lib/api.ts` — 6 new API client functions
- `client/src/pages/dashboard/Tracker.tsx` — refactored to use DB data + new components
- `client/src/pages/dashboard/FollowUp.tsx` — read prefill from URL search params
- `package.json` — add vitest

---

## Task 1: Supabase Migration — Create outreach_contacts and sent_emails

**Files:**
- Create: `supabase/migrations/001_outreach_tables.sql`

- [ ] **Step 1: Create the migration file**

```sql
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
```

- [ ] **Step 2: Run migration in Supabase**

Open the Supabase dashboard → SQL Editor → paste the file contents → Run.
Verify both tables appear under Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/001_outreach_tables.sql
git commit -m "feat: add outreach_contacts and sent_emails tables"
```

---

## Task 2: Add vitest + TDD for gmailUtils

**Files:**
- Modify: `package.json`
- Create: `server/lib/gmailUtils.ts`
- Create: `server/lib/gmailUtils.test.ts`

- [ ] **Step 1: Install vitest**

```bash
npm install --save-dev vitest
```

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 3: Write failing tests first**

Create `server/lib/gmailUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isCoachEmail, decodeMessageBody } from './gmailUtils'

describe('isCoachEmail', () => {
  it('returns true for .edu sender', () => {
    expect(isCoachEmail('coach@unc.edu', 'Hello')).toBe(true)
  })

  it('returns true when subject contains recruiting keyword', () => {
    expect(isCoachEmail('person@gmail.com', 'Soccer recruiting inquiry')).toBe(true)
  })

  it('returns true for scholarship mention in subject', () => {
    expect(isCoachEmail('staff@example.com', 'Scholarship opportunity for you')).toBe(true)
  })

  it('returns false for unrelated email', () => {
    expect(isCoachEmail('newsletter@amazon.com', 'Your order has shipped')).toBe(false)
  })

  it('is case-insensitive on subject', () => {
    expect(isCoachEmail('person@gmail.com', 'SOCCER CAMP INVITE')).toBe(true)
  })
})

describe('decodeMessageBody', () => {
  it('decodes base64 text/plain part', () => {
    const data = Buffer.from('Hello coach', 'utf-8').toString('base64')
    const payload = {
      parts: [{ mimeType: 'text/plain', body: { data } }],
    }
    expect(decodeMessageBody(payload)).toBe('Hello coach')
  })

  it('decodes top-level body data', () => {
    const data = Buffer.from('Direct body', 'utf-8').toString('base64')
    const payload = { body: { data } }
    expect(decodeMessageBody(payload)).toBe('Direct body')
  })

  it('returns empty string for null payload', () => {
    expect(decodeMessageBody(null)).toBe('')
  })

  it('strips HTML tags when only text/html part exists', () => {
    const data = Buffer.from('<p>Hello</p>', 'utf-8').toString('base64')
    const payload = {
      parts: [{ mimeType: 'text/html', body: { data } }],
    }
    expect(decodeMessageBody(payload)).toBe('Hello')
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './gmailUtils'`

- [ ] **Step 5: Implement gmailUtils.ts**

Create `server/lib/gmailUtils.ts`:

```typescript
const COACH_KEYWORDS = [
  'soccer', 'recruiting', 'recruit', 'camp', 'roster',
  'scholarship', 'visit', 'tryout', 'athletic',
]

export function isCoachEmail(senderEmail: string, subject: string): boolean {
  if (senderEmail.toLowerCase().endsWith('.edu')) return true
  const lower = subject.toLowerCase()
  return COACH_KEYWORDS.some((kw) => lower.includes(kw))
}

export function decodeMessageBody(payload: any): string {
  if (!payload) return ''
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8')
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8')
          .replace(/<[^>]*>/g, '')
      }
    }
  }
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8')
  }
  return ''
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test
```

Expected: all 9 tests PASS

- [ ] **Step 7: Commit**

```bash
git add server/lib/gmailUtils.ts server/lib/gmailUtils.test.ts package.json
git commit -m "feat: add gmail utilities with vitest coverage"
```

---

## Task 3: Extract shared aiClient + update ai.ts

**Files:**
- Create: `server/lib/aiClient.ts`
- Modify: `server/routes/ai.ts`

- [ ] **Step 1: Create server/lib/aiClient.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

const PERSONA = `You are a college soccer recruitment counselor with 15+ years of experience.
Tone: encouraging, direct, and soccer-specific. Never generic. Tailor everything to soccer positions, stats, and recruiting culture.`

export async function ask(prompt: string, maxTokens = 1024): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: maxTokens,
    system: PERSONA,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return block.text
}

export function parseJSON<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : fallback
  } catch {
    return fallback
  }
}

export async function rateCoachReply(
  school: string,
  coachName: string,
  replyText: string,
): Promise<{ rating: string; confidence: number; signals: string[]; nextAction: string }> {
  const text = await ask(
    `Analyze this coach reply and rate their interest level in the athlete.

School: ${school}
Coach: ${coachName}
Reply:
${replyText}

Respond with JSON only: { "rating": "hot|warm|cold|not_interested", "confidence": 85, "signals": ["invited to visit", "asked for film"], "nextAction": "Schedule a campus visit — they want to meet you in person." }

Rating guide: hot=very interested (visit invite, scholarship mention, follow-up questions), warm=interested but cautious (generic positive reply, asked one question), cold=polite decline or noncommittal, not_interested=explicit no.`,
    512,
  )
  return parseJSON(text, { rating: 'cold', confidence: 50, signals: [], nextAction: 'Send a follow-up in two weeks.' })
}
```

- [ ] **Step 2: Update server/routes/ai.ts to import from aiClient**

At the top of `server/routes/ai.ts`, replace:
```typescript
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

const PERSONA = `You are a college soccer recruitment counselor with 15+ years of experience.
Tone: encouraging, direct, and soccer-specific. Never generic. Tailor everything to soccer positions, stats, and recruiting culture.`

async function ask(prompt: string, maxTokens = 1024): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: maxTokens,
    system: PERSONA,
    messages: [{ role: 'user', content: prompt }]
  })
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return block.text
}
```

With:
```typescript
import { ask, parseJSON, rateCoachReply } from '../lib/aiClient'
```

Also find the `parseJSON` function in `ai.ts` (it likely exists there too) and remove it — it now comes from `aiClient`.

Also replace the body of the `/rate-response` handler with:
```typescript
router.post('/rate-response', async (req, res) => {
  try {
    const { school, coachName, text: replyText } = req.body as { school: string; coachName: string; text: string }
    const json = await rateCoachReply(school, coachName, replyText)
    res.json({ ...json, id: crypto.randomUUID(), school, coachName, date: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})
```

- [ ] **Step 3: Verify server still starts**

```bash
npm run dev
```

Expected: server starts on port 3001 with no errors.

- [ ] **Step 4: Commit**

```bash
git add server/lib/aiClient.ts server/routes/ai.ts
git commit -m "refactor: extract shared aiClient from ai.ts"
```

---

## Task 4: Add TypeScript types

**Files:**
- Modify: `client/src/types/index.ts`

- [ ] **Step 1: Append new types to client/src/types/index.ts**

At the end of the file, add:

```typescript
export interface OutreachContact {
  id: string
  userId: string
  coachName: string
  schoolName: string
  coachEmail: string
  position?: string
  division: Division
  gmailThreadId?: string
  interestRating: 'hot' | 'warm' | 'cold' | 'not_interested' | 'pending'
  lastReplyAt?: string
  lastReplySnippet?: string
  status: 'contacted' | 'replied' | 'scheduled_visit' | 'committed' | 'no_response'
  notes?: string
  createdAt: string
}

export interface SentEmail {
  id: string
  userId: string
  contactId: string
  gmailThreadId: string
  gmailMessageId: string
  subject: string
  body: string
  sentAt: string
  emailType: 'initial_outreach' | 'followup' | 'thank_you' | 'camp_inquiry'
}

export interface ThreadMessage {
  id: string
  sender: string
  timestamp: string
  body: string
  isFromCoach: boolean
}

export interface UntrackedThread {
  threadId: string
  senderEmail: string
  senderName: string
  subject: string
  snippet: string
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/types/index.ts
git commit -m "feat: add OutreachContact, SentEmail, ThreadMessage types"
```

---

## Task 5: Update /send endpoint + add contacts CRUD to gmail.ts

**Files:**
- Modify: `server/routes/gmail.ts`

- [ ] **Step 1: Update imports at top of server/routes/gmail.ts**

Add to the existing imports:
```typescript
import { isCoachEmail, decodeMessageBody } from '../lib/gmailUtils'
import { rateCoachReply } from '../lib/aiClient'
```

- [ ] **Step 2: Update the /send endpoint to return threadId + messageId**

Replace the existing `/send` route body with:
```typescript
router.post('/send', async (req, res) => {
  const { userId, to, subject, body, contactId, emailType } = req.body as {
    userId: string; to: string; subject: string; body: string
    contactId?: string; emailType?: string
  }
  const supabase = getSupabase()
  const { data: tokenRow } = await supabase
    .from('user_gmail_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .single()
  if (!tokenRow?.refresh_token) return res.status(403).json({ error: 'Gmail not connected' })
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: tokenRow.refresh_token })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const raw = Buffer.from(
    `To: ${to}\r\nContent-Type: text/plain; charset=utf-8\r\nMIME-Version: 1.0\r\nSubject: ${subject}\r\n\r\n${body}`
  ).toString('base64url')
  try {
    const sent = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    const threadId = sent.data.threadId ?? ''
    const messageId = sent.data.id ?? ''
    // Log to sent_emails
    if (threadId) {
      await supabase.from('sent_emails').insert({
        user_id: userId,
        contact_id: contactId ?? null,
        gmail_thread_id: threadId,
        gmail_message_id: messageId,
        subject,
        body,
        email_type: emailType ?? 'initial_outreach',
      })
    }
    res.json({ success: true, threadId, messageId })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to send' })
  }
})
```

- [ ] **Step 3: Add mapContact helper + GET /api/gmail/contacts endpoint**

The Supabase rows use snake_case but the frontend `OutreachContact` type uses camelCase. Add a mapper at the top of `server/routes/gmail.ts` (after the imports):

```typescript
function mapContact(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    coachName: row.coach_name,
    schoolName: row.school_name,
    coachEmail: row.coach_email,
    position: row.position,
    division: row.division,
    gmailThreadId: row.gmail_thread_id,
    interestRating: row.interest_rating,
    lastReplyAt: row.last_reply_at,
    lastReplySnippet: row.last_reply_snippet,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  }
}
```

After the `/send` route, add:
```typescript
// GET /api/gmail/contacts?userId=<uid>
router.get('/contacts', async (req, res) => {
  const { userId } = req.query as { userId: string }
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const { data, error } = await getSupabase()
    .from('outreach_contacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ contacts: (data ?? []).map(mapContact) })
})
```

- [ ] **Step 4: Add POST /api/gmail/contacts endpoint**

```typescript
// POST /api/gmail/contacts
router.post('/contacts', async (req, res) => {
  const { userId, coachName, schoolName, coachEmail, division, position, gmailThreadId } = req.body as {
    userId: string; coachName: string; schoolName: string; coachEmail: string
    division: string; position?: string; gmailThreadId?: string
  }
  if (!userId || !schoolName) return res.status(400).json({ error: 'userId and schoolName required' })
  const { data, error } = await getSupabase()
    .from('outreach_contacts')
    .insert({
      user_id: userId,
      coach_name: coachName ?? '',
      school_name: schoolName,
      coach_email: coachEmail ?? '',
      division: division ?? 'D1',
      position: position ?? null,
      gmail_thread_id: gmailThreadId ?? null,
    })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ contact: mapContact(data) })
})
```

- [ ] **Step 5: Add PATCH /api/gmail/contacts/:id endpoint**

```typescript
// PATCH /api/gmail/contacts/:id
router.patch('/contacts/:id', async (req, res) => {
  const { id } = req.params
  const { userId, ...updates } = req.body as { userId: string; [key: string]: any }
  if (!userId) return res.status(400).json({ error: 'userId required' })
  // Map camelCase to snake_case for allowed fields
  const allowed: Record<string, string> = {
    status: 'status', interestRating: 'interest_rating', notes: 'notes',
    gmailThreadId: 'gmail_thread_id', lastReplyAt: 'last_reply_at',
    lastReplySnippet: 'last_reply_snippet',
  }
  const patch: Record<string, any> = {}
  for (const [key, col] of Object.entries(allowed)) {
    if (key in updates) patch[col] = updates[key]
  }
  const { data, error } = await getSupabase()
    .from('outreach_contacts')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ contact: mapContact(data) })
})
```

- [ ] **Step 6: Commit**

```bash
git add server/routes/gmail.ts
git commit -m "feat: update /send to return threadId; add contacts CRUD endpoints"
```

---

## Task 6: Add /threads and /thread/:id endpoints

**Files:**
- Modify: `server/routes/gmail.ts`

- [ ] **Step 1: Add GET /api/gmail/threads endpoint**

```typescript
// GET /api/gmail/threads?userId=<uid>
router.get('/threads', async (req, res) => {
  const { userId } = req.query as { userId: string }
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const supabase = getSupabase()
  const { data: tokenRow } = await supabase
    .from('user_gmail_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .single()
  if (!tokenRow?.refresh_token) return res.status(403).json({ error: 'Gmail not connected' })
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: tokenRow.refresh_token })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const { data: contacts } = await supabase
    .from('outreach_contacts')
    .select('*')
    .eq('user_id', userId)

  // Sync reply data for tracked contacts
  const tracked = []
  for (const contact of contacts ?? []) {
    if (!contact.gmail_thread_id) { tracked.push(contact); continue }
    try {
      const thread = await gmail.users.threads.get({
        userId: 'me',
        id: contact.gmail_thread_id,
        format: 'metadata',
        metadataHeaders: ['From', 'Date'],
      })
      const messages = thread.data.messages ?? []
      const lastMsg = messages[messages.length - 1]
      const fromHeader = lastMsg?.payload?.headers?.find((h: any) => h.name === 'From')?.value ?? ''
      const isFromCoach = contact.coach_email && fromHeader.toLowerCase().includes(contact.coach_email.toLowerCase())
      if (isFromCoach) {
        const snippet = (thread.data.snippet ?? '').slice(0, 150)
        const dateHeader = lastMsg?.payload?.headers?.find((h: any) => h.name === 'Date')?.value
        const lastReplyAt = dateHeader ? new Date(dateHeader).toISOString() : null
        await supabase.from('outreach_contacts').update({
          last_reply_snippet: snippet,
          last_reply_at: lastReplyAt,
          status: 'replied',
        }).eq('id', contact.id)
        tracked.push(mapContact({ ...contact, last_reply_snippet: snippet, last_reply_at: lastReplyAt, status: 'replied' }))
      } else {
        tracked.push(mapContact(contact))
      }
    } catch {
      tracked.push(mapContact(contact))
    }
  }

  // Scan inbox for untracked potential coach replies
  const trackedEmails = new Set((contacts ?? []).map((c: any) => c.coach_email?.toLowerCase()).filter(Boolean))
  const untracked: any[] = []
  try {
    const inbox = await gmail.users.threads.list({ userId: 'me', q: 'in:inbox', maxResults: 30 })
    for (const thread of inbox.data.threads ?? []) {
      try {
        const td = await gmail.users.threads.get({
          userId: 'me', id: thread.id!,
          format: 'metadata', metadataHeaders: ['From', 'Subject'],
        })
        const firstMsg = td.data.messages?.[0]
        const fromHeader = firstMsg?.payload?.headers?.find((h: any) => h.name === 'From')?.value ?? ''
        const subject = firstMsg?.payload?.headers?.find((h: any) => h.name === 'Subject')?.value ?? ''
        const emailMatch = fromHeader.match(/<([^>]+)>/) ?? fromHeader.match(/([^\s]+@[^\s]+)/)
        const senderEmail = emailMatch?.[1]?.toLowerCase() ?? ''
        if (!senderEmail || trackedEmails.has(senderEmail)) continue
        if (isCoachEmail(senderEmail, subject)) {
          untracked.push({
            threadId: thread.id,
            senderEmail,
            senderName: fromHeader.replace(/<[^>]+>/, '').trim().replace(/^"|"$/g, ''),
            subject,
            snippet: thread.snippet ?? '',
          })
        }
      } catch { /* skip */ }
    }
  } catch { /* skip untracked scan */ }

  res.json({ tracked, untracked })
})
```

- [ ] **Step 2: Add GET /api/gmail/thread/:threadId endpoint**

```typescript
// GET /api/gmail/thread/:threadId?userId=<uid>
router.get('/thread/:threadId', async (req, res) => {
  const { threadId } = req.params
  const { userId } = req.query as { userId: string }
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const { data: tokenRow } = await getSupabase()
    .from('user_gmail_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .single()
  if (!tokenRow?.refresh_token) return res.status(403).json({ error: 'Gmail not connected' })
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: tokenRow.refresh_token })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  try {
    const thread = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' })
    const messages = (thread.data.messages ?? []).map((msg: any) => {
      const headers = msg.payload?.headers ?? []
      const from = headers.find((h: any) => h.name === 'From')?.value ?? ''
      const date = headers.find((h: any) => h.name === 'Date')?.value ?? ''
      return {
        id: msg.id,
        sender: from,
        timestamp: date ? new Date(date).toISOString() : new Date().toISOString(),
        body: decodeMessageBody(msg.payload),
        isFromCoach: false,
      }
    })
    res.json({ messages })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to fetch thread' })
  }
})
```

- [ ] **Step 3: Add POST /api/gmail/rate-and-log endpoint**

```typescript
// POST /api/gmail/rate-and-log
router.post('/rate-and-log', async (req, res) => {
  const { userId, contactId, latestCoachMessage, coachName, school } = req.body as {
    userId: string; contactId: string; latestCoachMessage: string; coachName: string; school: string
  }
  if (!userId || !contactId) return res.status(400).json({ error: 'userId and contactId required' })
  try {
    const result = await rateCoachReply(school, coachName, latestCoachMessage)
    await getSupabase()
      .from('outreach_contacts')
      .update({ interest_rating: result.rating })
      .eq('id', contactId)
      .eq('user_id', userId)
    res.json({ rating: result.rating, signals: result.signals, nextAction: result.nextAction })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Rating failed' })
  }
})
```

- [ ] **Step 4: Verify server starts and endpoints respond**

```bash
npm run dev
```

In another terminal:
```bash
curl http://localhost:3001/api/gmail/contacts?userId=test
```
Expected: `{"error":"userId required"}` or a 403 (Supabase auth) — not a crash.

- [ ] **Step 5: Commit**

```bash
git add server/routes/gmail.ts
git commit -m "feat: add /threads, /thread/:id, /rate-and-log endpoints"
```

---

## Task 7: New API client functions

**Files:**
- Modify: `client/src/lib/api.ts`

- [ ] **Step 1: Add new functions to client/src/lib/api.ts**

Import the new types at the top — update the existing import line:
```typescript
import type { AthleteProfile, Division, School, SchoolDirectoryEntry, ProgramIntel, VideoRating, CoachResponse, IdCamp, CampCoach, LeaderboardEntry, RosterProgram, PositionNeed, IdEvent, OutreachContact, SentEmail, ThreadMessage, UntrackedThread } from '../types'
```

At the end of the file, before the `export type` line, add:

```typescript
export function getContacts(userId: string) {
  return get<{ contacts: OutreachContact[] }>(`/api/gmail/contacts?userId=${encodeURIComponent(userId)}`)
}

export function createContact(userId: string, data: {
  coachName: string; schoolName: string; coachEmail: string
  division: string; position?: string; gmailThreadId?: string
}) {
  return post<{ contact: OutreachContact }>('/api/gmail/contacts', { userId, ...data })
}

export function updateContact(id: string, userId: string, updates: Partial<OutreachContact>) {
  return post<{ contact: OutreachContact }>(`/api/gmail/contacts/${id}`, { userId, ...updates })
}

export function gmailGetThreads(userId: string) {
  return get<{ tracked: OutreachContact[]; untracked: UntrackedThread[] }>(
    `/api/gmail/threads?userId=${encodeURIComponent(userId)}`
  )
}

export function gmailGetThread(userId: string, threadId: string) {
  return get<{ messages: ThreadMessage[] }>(
    `/api/gmail/thread/${encodeURIComponent(threadId)}?userId=${encodeURIComponent(userId)}`
  )
}

export function gmailRateAndLog(userId: string, contactId: string, latestCoachMessage: string, coachName: string, school: string) {
  return post<{ rating: string; signals: string[]; nextAction: string }>(
    '/api/gmail/rate-and-log',
    { userId, contactId, latestCoachMessage, coachName, school }
  )
}
```

Also update `updateContact` — it should use `fetch` with PATCH, not `post`:
```typescript
export function updateContact(id: string, userId: string, updates: Partial<OutreachContact>) {
  return new Promise<{ contact: OutreachContact }>(async (resolve, reject) => {
    const res = await fetch(`/api/gmail/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...updates }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }))
      return reject(new Error((err as any).error ?? 'Request failed'))
    }
    resolve(res.json())
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/api.ts
git commit -m "feat: add API client functions for contacts and Gmail threads"
```

---

## Task 8: Build ContactRow component

**Files:**
- Create: `client/src/components/tracker/ContactRow.tsx`

- [ ] **Step 1: Create client/src/components/tracker/ContactRow.tsx**

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ThreadView } from './ThreadView'
import type { OutreachContact } from '../../types'

const interestConfig = {
  hot: { label: '🔥 Hot', color: 'text-[#4ade80]', bg: 'bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)]' },
  warm: { label: '☀️ Warm', color: 'text-[#fbbf24]', bg: 'bg-[rgba(251,191,36,0.1)] border-[rgba(251,191,36,0.2)]' },
  cold: { label: '❄️ Cold', color: 'text-[#60a5fa]', bg: 'bg-[rgba(96,165,250,0.1)] border-[rgba(96,165,250,0.2)]' },
  not_interested: { label: '⛔ No', color: 'text-[#64748b]', bg: 'bg-[rgba(100,116,139,0.1)] border-[rgba(100,116,139,0.2)]' },
  pending: { label: '· · ·', color: 'text-[#64748b]', bg: 'bg-[rgba(100,116,139,0.05)] border-[rgba(100,116,139,0.1)]' },
}

const statusColor: Record<OutreachContact['status'], 'green' | 'gold' | 'muted' | 'blue'> = {
  replied: 'green', contacted: 'blue', scheduled_visit: 'gold',
  committed: 'green', no_response: 'muted',
}

interface Props {
  contact: OutreachContact
  userId: string
  gmailConnected: boolean
  onStatusChange: (id: string, status: OutreachContact['status']) => void
  onSendEmail: (contact: OutreachContact) => void
  sendingId: string | null
}

export function ContactRow({ contact, userId, gmailConnected, onStatusChange, onSendEmail, sendingId }: Props) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const cfg = interestConfig[contact.interestRating]

  function handleGenerateReply(coachMessage: string) {
    const params = new URLSearchParams({
      type: 'answer',
      coachName: contact.coachName,
      school: contact.schoolName,
      message: coachMessage.slice(0, 500),
    })
    navigate(`/dashboard/followup?${params.toString()}`)
  }

  return (
    <>
      <tr
        className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
        onClick={() => contact.gmailThreadId && setExpanded((e) => !e)}
      >
        <td className="px-5 py-4 font-medium text-[#f1f5f9] whitespace-nowrap">{contact.schoolName}</td>
        <td className="px-5 py-4 text-xs">
          <div className="text-[#64748b]">{contact.coachName}</div>
          {contact.coachEmail && <div className="text-[#475569] text-xs">{contact.coachEmail}</div>}
          {contact.lastReplySnippet && (
            <div className="text-[#475569] text-xs mt-0.5 italic truncate max-w-[200px]">
              "{contact.lastReplySnippet}"
            </div>
          )}
        </td>
        <td className="px-5 py-4"><Badge variant="muted">{contact.division}</Badge></td>
        <td className="px-5 py-4"><Badge variant={statusColor[contact.status]}>{contact.status.replace('_', ' ')}</Badge></td>
        <td className="px-5 py-4">
          {contact.interestRating !== 'pending' || contact.lastReplyAt ? (
            <span className={`px-2 py-1 rounded text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
          ) : (
            <span className="text-xs text-[#475569]">—</span>
          )}
        </td>
        <td className="px-5 py-4 text-[#64748b] text-xs whitespace-nowrap">
          {contact.lastReplyAt ? new Date(contact.lastReplyAt).toLocaleDateString() : '—'}
        </td>
        <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={contact.status}
              onChange={(e) => onStatusChange(contact.id, e.target.value as OutreachContact['status'])}
              className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded text-xs text-[#64748b] px-2 py-1.5 focus:outline-none focus:border-[#eab308]"
            >
              <option value="contacted">Contacted</option>
              <option value="replied">Replied</option>
              <option value="scheduled_visit">Visit Scheduled</option>
              <option value="committed">Committed</option>
              <option value="no_response">No Response</option>
            </select>
            {gmailConnected && contact.coachEmail && (
              <button
                onClick={() => onSendEmail(contact)}
                disabled={sendingId === contact.id}
                className="text-xs text-[#eab308] hover:text-[#ca9a06] px-2 py-1.5 border border-[rgba(234,179,8,0.3)] rounded whitespace-nowrap"
              >
                {sendingId === contact.id ? 'Sending...' : '📧 Send'}
              </button>
            )}
            {contact.gmailThreadId && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-xs text-[#64748b] hover:text-[#f1f5f9] px-2 py-1.5 border border-[rgba(255,255,255,0.1)] rounded"
              >
                {expanded ? '▲ Hide' : '▼ Thread'}
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && contact.gmailThreadId && (
        <tr>
          <td colSpan={7} className="px-0 py-0 bg-[rgba(255,255,255,0.015)]">
            <ThreadView
              userId={userId}
              threadId={contact.gmailThreadId}
              contactId={contact.id}
              coachEmail={contact.coachEmail}
              coachName={contact.coachName}
              school={contact.schoolName}
              onGenerateReply={handleGenerateReply}
              onMarkVisit={() => onStatusChange(contact.id, 'scheduled_visit')}
              onArchive={() => onStatusChange(contact.id, 'no_response')}
            />
          </td>
        </tr>
      )}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/tracker/ContactRow.tsx
git commit -m "feat: add ContactRow component with expandable thread trigger"
```

---

## Task 9: Build ThreadView component

**Files:**
- Create: `client/src/components/tracker/ThreadView.tsx`

- [ ] **Step 1: Create client/src/components/tracker/ThreadView.tsx**

```typescript
import { useEffect, useState } from 'react'
import { gmailGetThread, gmailRateAndLog } from '../../lib/api'
import { Button } from '../ui/Button'
import type { ThreadMessage } from '../../types'

interface Props {
  userId: string
  threadId: string
  contactId: string
  coachEmail: string
  coachName: string
  school: string
  onGenerateReply: (coachMessage: string) => void
  onMarkVisit: () => void
  onArchive: () => void
}

export function ThreadView({ userId, threadId, contactId, coachEmail, coachName, school, onGenerateReply, onMarkVisit, onArchive }: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState<{ rating: string; nextAction: string } | null>(null)
  const [ratingLoading, setRatingLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    gmailGetThread(userId, threadId)
      .then(({ messages: msgs }) => {
        const tagged = msgs.map((m) => ({
          ...m,
          isFromCoach: m.sender.toLowerCase().includes(coachEmail.toLowerCase()),
        }))
        setMessages(tagged)
        // Auto-rate if there's a coach reply
        const lastCoachMsg = [...tagged].reverse().find((m) => m.isFromCoach)
        if (lastCoachMsg) {
          setRatingLoading(true)
          gmailRateAndLog(userId, contactId, lastCoachMsg.body, coachName, school)
            .then((r) => setRating(r))
            .catch(() => {})
            .finally(() => setRatingLoading(false))
        }
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }, [threadId])

  const lastCoachMessage = [...messages].reverse().find((m) => m.isFromCoach)

  if (loading) {
    return (
      <div className="px-6 py-4 text-xs text-[#64748b]">Loading thread...</div>
    )
  }

  return (
    <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.04)]">
      {rating && (
        <div className="mb-4 p-3 rounded-lg bg-[rgba(234,179,8,0.04)] border border-[rgba(234,179,8,0.15)]">
          <span className="text-xs font-semibold text-[#eab308]">AI Read: </span>
          <span className="text-xs text-[#f1f5f9]">{rating.nextAction}</span>
          {ratingLoading && <span className="text-xs text-[#64748b] ml-2">Analyzing...</span>}
        </div>
      )}
      <div className="flex flex-col gap-3 mb-4 max-h-64 overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg p-3 text-xs ${
              msg.isFromCoach
                ? 'bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] ml-0 mr-12'
                : 'bg-[rgba(234,179,8,0.05)] border border-[rgba(234,179,8,0.1)] ml-12 mr-0'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-semibold text-[#f1f5f9]">
                {msg.isFromCoach ? coachName || msg.sender : 'You'}
              </span>
              <span className="text-[#475569]">
                {new Date(msg.timestamp).toLocaleDateString()}
              </span>
            </div>
            <div className="text-[#94a3b8] whitespace-pre-wrap leading-relaxed">
              {msg.body.slice(0, 600)}{msg.body.length > 600 ? '...' : ''}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-xs text-[#64748b]">No messages found in this thread.</div>
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {lastCoachMessage && (
          <Button size="sm" onClick={() => onGenerateReply(lastCoachMessage.body)}>
            ✍️ Generate Reply
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onMarkVisit}>
          📅 Mark Visit Scheduled
        </Button>
        <Button size="sm" variant="ghost" onClick={onArchive}>
          Archive
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/tracker/ThreadView.tsx
git commit -m "feat: add ThreadView component with auto AI rating"
```

---

## Task 10: Build UntrackedSection component

**Files:**
- Create: `client/src/components/tracker/UntrackedSection.tsx`

- [ ] **Step 1: Create client/src/components/tracker/UntrackedSection.tsx**

```typescript
import { useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { createContact } from '../../lib/api'
import type { UntrackedThread, Division } from '../../types'

interface Props {
  userId: string
  threads: UntrackedThread[]
  onContactAdded: () => void
}

export function UntrackedSection({ userId, threads, onContactAdded }: Props) {
  const [adding, setAdding] = useState<string | null>(null) // threadId being added
  const [coachName, setCoachName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [division, setDivision] = useState<Division>('D1')
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = threads.filter((t) => !dismissed.has(t.threadId))
  if (visible.length === 0) return null

  async function handleAdd(thread: UntrackedThread) {
    if (!schoolName) return
    setLoading(true)
    try {
      await createContact(userId, {
        coachName,
        schoolName,
        coachEmail: thread.senderEmail,
        division,
        gmailThreadId: thread.threadId,
      })
      onContactAdded()
      setAdding(null)
      setCoachName(''); setSchoolName('')
      setDismissed((prev) => new Set([...prev, thread.threadId]))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add contact')
    } finally {
      setLoading(false) }
  }

  return (
    <div className="mt-8">
      <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">
        Possible Coach Replies ({visible.length})
      </div>
      <div className="flex flex-col gap-3">
        {visible.map((thread) => (
          <Card key={thread.threadId} className="p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm text-[#f1f5f9] font-medium">
                  {thread.senderName || thread.senderEmail}
                </div>
                <div className="text-xs text-[#64748b]">{thread.senderEmail}</div>
                <div className="text-xs text-[#475569] mt-0.5 italic">"{thread.subject}"</div>
                {thread.snippet && (
                  <div className="text-xs text-[#475569] mt-1 truncate max-w-[400px]">{thread.snippet}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setAdding(thread.threadId)}>
                  + Add to Tracker
                </Button>
                <button
                  onClick={() => setDismissed((prev) => new Set([...prev, thread.threadId]))}
                  className="text-xs text-[#475569] hover:text-[#64748b]"
                >
                  Dismiss
                </button>
              </div>
            </div>
            {adding === thread.threadId && (
              <div className="mt-4 flex items-end gap-3 flex-wrap border-t border-[rgba(255,255,255,0.07)] pt-4">
                <div className="flex-1 min-w-36">
                  <Input label="School name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="University name" />
                </div>
                <div className="flex-1 min-w-36">
                  <Input label="Coach name" value={coachName} onChange={(e) => setCoachName(e.target.value)} placeholder="Coach name" />
                </div>
                <div>
                  <label className="text-xs text-[#64748b] block mb-1.5">Division</label>
                  <select
                    value={division}
                    onChange={(e) => setDivision(e.target.value as Division)}
                    className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded text-xs text-[#f1f5f9] px-3 py-2 focus:outline-none focus:border-[#eab308]"
                  >
                    {['D1', 'D2', 'D3', 'NAIA', 'JUCO'].map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <Button size="sm" onClick={() => handleAdd(thread)} disabled={loading || !schoolName}>
                  {loading ? 'Adding...' : 'Add'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/tracker/UntrackedSection.tsx
git commit -m "feat: add UntrackedSection component for potential coach replies"
```

---

## Task 11: Refactor Tracker.tsx to use DB data + new components

**Files:**
- Modify: `client/src/pages/dashboard/Tracker.tsx`

- [ ] **Step 1: Replace Tracker.tsx with the refactored version**

Rewrite `client/src/pages/dashboard/Tracker.tsx`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { ContactRow } from '../../components/tracker/ContactRow'
import { UntrackedSection } from '../../components/tracker/UntrackedSection'
import { getContacts, createContact, updateContact, gmailGetThreads, gmailSend, getGmailStatus, rateResponse } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import type { OutreachContact, CoachResponse, UntrackedThread, Division } from '../../types'

const ratingConfig = {
  hot: { label: '🔥 Hot', color: 'text-[#4ade80]', bg: 'bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)]' },
  warm: { label: '☀️ Warm', color: 'text-[#fbbf24]', bg: 'bg-[rgba(251,191,36,0.1)] border-[rgba(251,191,36,0.2)]' },
  cold: { label: '❄️ Cold', color: 'text-[#60a5fa]', bg: 'bg-[rgba(96,165,250,0.1)] border-[rgba(96,165,250,0.2)]' },
  not_interested: { label: '⛔ Not Interested', color: 'text-[#64748b]', bg: 'bg-[rgba(100,116,139,0.1)] border-[rgba(100,116,139,0.2)]' },
}

function loadResponses(): CoachResponse[] {
  try { return JSON.parse(localStorage.getItem('coachResponses') ?? '[]') } catch { return [] }
}
function saveResponses(r: CoachResponse[]) {
  localStorage.setItem('coachResponses', JSON.stringify(r))
}

export function Tracker() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'contacts' | 'responses'>('contacts')
  const [contacts, setContacts] = useState<OutreachContact[]>([])
  const [untrackedThreads, setUntrackedThreads] = useState<UntrackedThread[]>([])
  const [filter, setFilter] = useState<OutreachContact['status'] | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newSchool, setNewSchool] = useState('')
  const [newCoach, setNewCoach] = useState('')
  const [newCoachEmail, setNewCoachEmail] = useState('')
  const [newDivision, setNewDivision] = useState<Division>('D1')
  const [contactsLoading, setContactsLoading] = useState(false)

  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)
  const [gmailLoading, setGmailLoading] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const [responses, setResponses] = useState<CoachResponse[]>(loadResponses)
  const [inputMode, setInputMode] = useState<'paste' | 'quick'>('paste')
  const [resSchool, setResSchool] = useState('')
  const [resCoach, setResCoach] = useState('')
  const [resText, setResText] = useState('')
  const [quickVisit, setQuickVisit] = useState(false)
  const [quickQuestions, setQuickQuestions] = useState(false)
  const [quickScholarship, setQuickScholarship] = useState(false)
  const [ratingLoading, setRatingLoading] = useState(false)
  const [ratingError, setRatingError] = useState('')

  const loadContacts = useCallback(async () => {
    if (!user?.id) return
    setContactsLoading(true)
    try {
      const { contacts: data } = await getContacts(user.id)
      setContacts(data)
    } catch { /* show empty state */ }
    finally { setContactsLoading(false) }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    loadContacts()
    getGmailStatus(user.id).then((s) => {
      setGmailConnected(s.connected)
      setGmailEmail(s.email)
    }).catch(() => {})
  }, [user?.id, loadContacts])

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'gmail-connected') {
        setGmailConnected(true)
        setGmailEmail(e.data.email ?? null)
        setGmailLoading(false)
        // Sync threads after connecting
        if (user?.id) syncThreads(user.id)
      } else if (e.data?.type === 'gmail-error') {
        setGmailLoading(false)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [user?.id])

  function connectGmail() {
    if (!user?.id) return
    setGmailLoading(true)
    window.open(`/api/gmail/auth?userId=${encodeURIComponent(user.id)}`, 'gmail-auth', 'width=500,height=600,left=200,top=100')
  }

  async function syncThreads(uid: string) {
    setSyncLoading(true); setSyncMsg('')
    try {
      const { tracked, untracked } = await gmailGetThreads(uid)
      setContacts(tracked)
      setUntrackedThreads(untracked)
      const newReplies = tracked.filter((c) => c.status === 'replied' && c.lastReplyAt).length
      setSyncMsg(newReplies > 0 ? `${newReplies} coach repl${newReplies === 1 ? 'y' : 'ies'} found!` : 'Up to date.')
    } catch {
      setSyncMsg('Sync failed — check Gmail connection.')
    } finally { setSyncLoading(false) }
  }

  async function handleStatusChange(id: string, status: OutreachContact['status']) {
    if (!user?.id) return
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c))
    try { await updateContact(id, user.id, { status }) } catch { loadContacts() }
  }

  function handleSendEmail(contact: OutreachContact) {
    // Contacts don't store email body — navigate to email generator with school prefilled
    const params = new URLSearchParams({
      school: contact.schoolName,
      division: contact.division,
      coachName: contact.coachName,
      coachEmail: contact.coachEmail,
    })
    navigate(`/dashboard/emails?${params.toString()}`)
  }

  async function addContact() {
    if (!newSchool || !user?.id) return
    try {
      await createContact(user.id, {
        coachName: newCoach, schoolName: newSchool,
        coachEmail: newCoachEmail, division: newDivision,
      })
      await loadContacts()
      setNewSchool(''); setNewCoach(''); setNewCoachEmail(''); setShowAdd(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add contact')
    }
  }

  async function handleRateResponse() {
    if (!resSchool || !resCoach) { setRatingError('Please enter school and coach name.'); return }
    const text = inputMode === 'paste' ? resText
      : `Coach responded. ${quickVisit ? 'Invited to visit campus.' : ''} ${quickQuestions ? 'Asked follow-up questions.' : ''} ${quickScholarship ? 'Mentioned scholarship possibility.' : ''}`
    if (!text.trim()) { setRatingError('Please provide some context about the response.'); return }
    setRatingError(''); setRatingLoading(true)
    try {
      const result = await rateResponse(resSchool, resCoach, text)
      const entry: CoachResponse = { ...result, rawText: inputMode === 'paste' ? resText : undefined }
      const updated = [entry, ...responses]
      setResponses(updated); saveResponses(updated)
      setResSchool(''); setResCoach(''); setResText('')
      setQuickVisit(false); setQuickQuestions(false); setQuickScholarship(false)
    } catch (e) {
      setRatingError(e instanceof Error ? e.message : 'Failed to rate response')
    } finally { setRatingLoading(false) }
  }

  const filtered = filter === 'all' ? contacts : contacts.filter((c) => c.status === filter)
  const counts = {
    all: contacts.length,
    contacted: contacts.filter((c) => c.status === 'contacted').length,
    replied: contacts.filter((c) => c.status === 'replied').length,
    scheduled_visit: contacts.filter((c) => c.status === 'scheduled_visit').length,
  }

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Outreach</span>
          </div>
          <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Outreach Tracker</h1>
          <p className="text-[#64748b] mt-2 text-sm">Track every contact, response, and follow-up in one place.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {gmailConnected ? (
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#4ade80] inline-block" />
                  <span className="text-xs text-[#4ade80] font-semibold">Gmail Connected</span>
                </div>
                {gmailEmail && <div className="text-xs text-[#64748b]">{gmailEmail}</div>}
              </div>
              <Button variant="outline" size="sm" onClick={() => user?.id && syncThreads(user.id)} disabled={syncLoading}>
                {syncLoading ? 'Syncing...' : '↻ Check for Replies'}
              </Button>
            </div>
          ) : (
            <Button onClick={connectGmail} disabled={gmailLoading || !user?.id} size="sm">
              {gmailLoading ? 'Connecting...' : '📧 Connect Gmail'}
            </Button>
          )}
          {syncMsg && <div className="text-xs text-[#eab308]">{syncMsg}</div>}
          {!user?.id && <div className="text-xs text-[#64748b]">Sign in to connect Gmail</div>}
        </div>
      </div>

      <div className="flex gap-0 border-b border-[rgba(255,255,255,0.07)] mb-8">
        {[{ id: 'contacts', label: 'Contacts' }, { id: 'responses', label: 'Coach Responses' }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'contacts' | 'responses')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id ? 'border-[#eab308] text-[#eab308]' : 'border-transparent text-[#64748b] hover:text-[#f1f5f9]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'contacts' && (
        <>
          {!gmailConnected && (
            <Card className="p-4 mb-6 flex items-center justify-between gap-4">
              <div className="text-sm text-[#94a3b8]">
                📧 Connect Gmail to see coach replies, send emails, and get AI interest ratings.
              </div>
              <Button size="sm" onClick={connectGmail} disabled={gmailLoading || !user?.id}>
                {gmailLoading ? 'Connecting...' : 'Connect Gmail'}
              </Button>
            </Card>
          )}

          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowAdd(!showAdd)}>+ Add Contact</Button>
          </div>

          {showAdd && (
            <Card className="p-5 mb-6 flex items-end gap-4 flex-wrap">
              <div className="flex-1 min-w-36">
                <Input label="School" value={newSchool} onChange={(e) => setNewSchool(e.target.value)} placeholder="University name" />
              </div>
              <div className="flex-1 min-w-36">
                <Input label="Coach name" value={newCoach} onChange={(e) => setNewCoach(e.target.value)} placeholder="Coach name" />
              </div>
              <div className="flex-1 min-w-36">
                <Input label="Coach email" value={newCoachEmail} onChange={(e) => setNewCoachEmail(e.target.value)} placeholder="coach@school.edu" />
              </div>
              <div>
                <label className="text-xs text-[#64748b] block mb-1.5">Division</label>
                <select
                  value={newDivision}
                  onChange={(e) => setNewDivision(e.target.value as Division)}
                  className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded text-xs text-[#f1f5f9] px-3 py-2 focus:outline-none focus:border-[#eab308]"
                >
                  {['D1', 'D2', 'D3', 'NAIA', 'JUCO'].map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <Button onClick={addContact}>Add</Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            </Card>
          )}

          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total', value: counts.all, color: 'text-[#f1f5f9]' },
              { label: 'Contacted', value: counts.contacted, color: 'text-[#60a5fa]' },
              { label: 'Replied', value: counts.replied, color: 'text-[#4ade80]' },
              { label: 'Visit Scheduled', value: counts.scheduled_visit, color: 'text-[#eab308]' },
            ].map(({ label, value, color }) => (
              <Card key={label} className="p-4 text-center">
                <div className={`font-serif text-3xl font-black ${color}`}>{value}</div>
                <div className="text-xs text-[#64748b] mt-0.5">{label}</div>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 mb-5">
            {(['all', 'contacted', 'replied', 'scheduled_visit', 'no_response'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${
                  filter === f
                    ? 'bg-[#eab308] text-black border-[#eab308]'
                    : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>

          {contactsLoading ? (
            <div className="text-xs text-[#64748b] py-8 text-center">Loading contacts...</div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.07)]">
                      {['School', 'Coach', 'Div', 'Status', 'Interest', 'Last Reply', 'Actions'].map((h) => (
                        <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-[#64748b] uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-xs text-[#64748b]">
                          No contacts yet. Add your first coach above.
                        </td>
                      </tr>
                    ) : filtered.map((c) => (
                      <ContactRow
                        key={c.id}
                        contact={c}
                        userId={user?.id ?? ''}
                        gmailConnected={gmailConnected}
                        onStatusChange={handleStatusChange}
                        onSendEmail={handleSendEmail}
                        sendingId={sendingId}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {gmailConnected && user?.id && (
            <UntrackedSection
              userId={user.id}
              threads={untrackedThreads}
              onContactAdded={loadContacts}
            />
          )}
        </>
      )}

      {tab === 'responses' && (
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <div className="text-sm font-bold text-[#f1f5f9] mb-4">Log a Coach Response</div>
            <div className="flex gap-3 mb-5">
              {[{ id: 'paste', label: 'Paste Full Reply' }, { id: 'quick', label: 'Quick Form' }].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setInputMode(m.id as 'paste' | 'quick')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    inputMode === m.id
                      ? 'bg-[#eab308] text-black border-[#eab308]'
                      : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="School" value={resSchool} onChange={(e) => setResSchool(e.target.value)} placeholder="University name" />
              <Input label="Coach name" value={resCoach} onChange={(e) => setResCoach(e.target.value)} placeholder="Coach name" />
            </div>
            {inputMode === 'paste' ? (
              <Textarea label="Coach's reply (paste the full email text)" value={resText} onChange={(e) => setResText(e.target.value)} placeholder="Paste the coach's email reply here..." rows={5} />
            ) : (
              <div className="flex flex-col gap-3 p-4 bg-[rgba(255,255,255,0.02)] rounded-xl border border-[rgba(255,255,255,0.07)]">
                <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">What happened in their reply?</div>
                {[
                  { id: 'visit', label: 'Invited me for a campus visit', checked: quickVisit, set: setQuickVisit },
                  { id: 'questions', label: 'Asked follow-up questions about me', checked: quickQuestions, set: setQuickQuestions },
                  { id: 'scholarship', label: 'Mentioned scholarship possibilities', checked: quickScholarship, set: setQuickScholarship },
                ].map((item) => (
                  <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={item.checked} onChange={(e) => item.set(e.target.checked)} className="w-4 h-4 accent-[#eab308]" />
                    <span className="text-sm text-[#f1f5f9]">{item.label}</span>
                  </label>
                ))}
              </div>
            )}
            {ratingError && <p className="text-xs text-red-400 mt-3">{ratingError}</p>}
            <Button onClick={handleRateResponse} disabled={ratingLoading} className="mt-4">
              {ratingLoading ? 'Analyzing...' : 'Rate Interest Level'}
            </Button>
          </Card>
          {responses.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-3xl mb-3">📬</div>
              <div className="font-serif text-base font-bold text-[#f1f5f9] mb-1">No responses logged yet</div>
              <p className="text-xs text-[#64748b]">When coaches reply, log them here and the AI will rate their interest level.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {responses.map((r) => {
                const cfg = ratingConfig[r.rating as keyof typeof ratingConfig]
                if (!cfg) return null
                return (
                  <Card key={r.id} className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="font-medium text-[#f1f5f9]">{r.school}</div>
                        <div className="text-xs text-[#64748b]">{r.coachName} · {new Date(r.date).toLocaleDateString()}</div>
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg border text-sm font-bold whitespace-nowrap ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                        <span className="ml-2 text-xs font-normal opacity-70">{r.confidence}% confident</span>
                      </div>
                    </div>
                    {r.signals.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {r.signals.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded text-xs text-[#64748b]">{s}</span>
                        ))}
                      </div>
                    )}
                    <div className="p-3 bg-[rgba(234,179,8,0.04)] border border-[rgba(234,179,8,0.15)] rounded-lg">
                      <span className="text-xs font-semibold text-[#eab308]">Next Step: </span>
                      <span className="text-xs text-[#f1f5f9]">{r.nextAction}</span>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify app compiles**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/dashboard/Tracker.tsx
git commit -m "feat: refactor Tracker to use DB contacts + ContactRow/UntrackedSection components"
```

---

## Task 12: Update FollowUp.tsx to accept prefill from URL params

**Files:**
- Modify: `client/src/pages/dashboard/FollowUp.tsx`

- [ ] **Step 1: Add useSearchParams and prefill logic to FollowUp.tsx**

At the top of `FollowUp.tsx`, add to imports:
```typescript
import { useSearchParams } from 'react-router-dom'
```

Inside the `FollowUp` function, after the existing `useState` declarations, add:

```typescript
const [searchParams] = useSearchParams()

useEffect(() => {
  const prefillType = searchParams.get('type') as 'followup' | 'thankyou' | 'answer' | null
  const prefillCoachName = searchParams.get('coachName')
  const prefillSchool = searchParams.get('school')
  const prefillMessage = searchParams.get('message')

  if (prefillType && ['followup', 'thankyou', 'answer'].includes(prefillType)) {
    setType(prefillType)
  }
  if (prefillMessage && prefillCoachName && prefillSchool) {
    setContext(
      `Coach ${prefillCoachName} at ${prefillSchool} replied:\n\n"${prefillMessage}"`
    )
  }
}, [])
```

Also add the missing `useEffect` import — update the existing React import line:
```typescript
import { useState, useEffect } from 'react'
```

- [ ] **Step 2: Verify navigation from ThreadView works**

Start the dev server:
```bash
npm run dev
```

In the Tracker, open a thread with a coach reply, click "Generate Reply". Verify that you're navigated to `/dashboard/followup` with the coach's message pre-filled in the context field and `type` set to `answer`.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/dashboard/FollowUp.tsx
git commit -m "feat: prefill FollowUp page from URL params when navigating from thread view"
```

---

## Final Verification

- [ ] Run all tests: `npm test` — all pass
- [ ] Run `npm run build` — no TypeScript errors
- [ ] Start dev server: `npm run dev`
- [ ] Open Tracker page — contacts table loads (empty if no DB rows, no crash)
- [ ] Connect Gmail via "Connect Gmail" button — popup opens, closes, banner updates to show connected email
- [ ] Click "↻ Check for Replies" — sync runs, untracked section appears if any coach-like emails found
- [ ] Click "▼ Thread" on a contact with a `gmailThreadId` — thread panel expands, messages load, AI rating appears
- [ ] Click "Generate Reply" — navigates to Follow-Up page with coach message pre-filled
- [ ] Add a new contact via "+ Add Contact" — appears in table immediately
- [ ] Run tests one final time: `npm test`

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: Gmail smart inbox — live coach replies, AI ratings, thread view in Outreach Tracker"
```
