import { Router } from 'express'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { categorizeEmail, isBulkMessage, classifyCoachMessage, isNewsletterEmail, getHeader, decodeMessageBody, resolveSchoolFromEmail, resolveCoachName } from '../lib/gmailUtils'
import { rateCoachReply, filterRealCoachEmails, batchRateCoachEmails } from '../lib/aiClient'
import schoolsData from '../data/schools.json'

const router = Router()

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!url || !key || key === 'placeholder_anon_key') {
    throw new Error('Supabase not configured — set VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY')
  }
  return createClient(url, key)
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/gmail/callback'
  )
}

const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173'

// Paginate through Gmail threads.list — Gmail caps a single call at 500 results, so a
// query that matches more than that needs pageToken iteration. We cap total threads
// per query at maxThreads as a safety net against runaway inboxes.
async function listAllThreads(
  gmail: any,
  q: string,
  maxThreads: number,
): Promise<{ id?: string | null; snippet?: string | null }[]> {
  const all: { id?: string | null; snippet?: string | null }[] = []
  let pageToken: string | undefined = undefined
  do {
    const remaining = maxThreads - all.length
    if (remaining <= 0) break
    const r: any = await gmail.users.threads.list({
      userId: 'me',
      q,
      maxResults: Math.min(500, remaining),
      pageToken,
    })
    for (const t of r.data.threads ?? []) all.push(t)
    pageToken = r.data.nextPageToken ?? undefined
  } while (pageToken)
  return all
}

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

// GET /api/gmail/auth?userId=<uid>
router.get('/auth', (req, res) => {
  const { userId } = req.query as { userId: string }
  if (!userId) return res.status(400).json({ error: 'userId required' })
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: `Missing env vars: ${!clientId ? 'GOOGLE_CLIENT_ID ' : ''}${!clientSecret ? 'GOOGLE_CLIENT_SECRET' : ''}` })
    }
    const oauth2Client = getOAuth2Client()
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
      ],
      state: userId,
      prompt: 'consent',
    })
    res.json({ url })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to start Gmail auth' })
  }
})

// GET /api/gmail/callback
router.get('/callback', async (req, res) => {
  const { code, state: userId } = req.query as { code: string; state: string }
  try {
    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    const profile = await gmail.users.getProfile({ userId: 'me' })
    const email = profile.data.emailAddress ?? ''
    await getSupabase().from('user_gmail_tokens').upsert({
      user_id: userId,
      refresh_token: tokens.refresh_token ?? '',
      email,
    })
    res.send(`<!DOCTYPE html><html><body>
<script>
  try { window.opener && window.opener.postMessage({ type: 'gmail-connected', email: '${email}' }, '${CLIENT_URL}'); } catch(e) {}
  window.close();
</script>
<p>Gmail connected! You can close this window.</p>
</body></html>`)
  } catch {
    res.send(`<!DOCTYPE html><html><body>
<script>
  try { window.opener && window.opener.postMessage({ type: 'gmail-error' }, '${CLIENT_URL}'); } catch(e) {}
  window.close();
</script>
<p>Connection failed. Please close this window and try again.</p>
</body></html>`)
  }
})

// GET /api/gmail/status?userId=<uid>
router.get('/status', async (req, res) => {
  const { userId } = req.query as { userId: string }
  if (!userId) return res.json({ connected: false, email: null })
  const { data } = await getSupabase()
    .from('user_gmail_tokens')
    .select('email')
    .eq('user_id', userId)
    .single()
  res.json({ connected: !!data, email: data?.email ?? null })
})

// POST /api/gmail/send
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
    res.json({ success: true, threadId, messageId })
    // Log asynchronously — DB failure should not affect send response
    if (threadId) {
      void Promise.resolve(supabase.from('sent_emails').insert({
        user_id: userId,
        contact_id: contactId ?? null,
        gmail_thread_id: threadId,
        gmail_message_id: messageId,
        subject,
        body,
        email_type: emailType ?? 'initial_outreach',
      })).catch((err: Error) => {
        console.error('sent_emails insert failed:', err.message)
      })
    }
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to send' })
  }
})

// POST /api/gmail/sync
router.post('/sync', async (req, res) => {
  const { userId, contacts } = req.body as {
    userId: string
    contacts: { id: string; coachEmail: string }[]
  }
  const { data: tokenRow } = await getSupabase()
    .from('user_gmail_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .single()
  if (!tokenRow?.refresh_token) return res.status(403).json({ error: 'Gmail not connected' })
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: tokenRow.refresh_token })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const results: { contactId: string; replied: boolean; snippet: string }[] = []
  for (const contact of contacts.filter((c) => c.coachEmail)) {
    try {
      const threads = await gmail.users.threads.list({
        userId: 'me',
        q: `from:${contact.coachEmail}`,
        maxResults: 1,
      })
      const replied = (threads.data.resultSizeEstimate ?? 0) > 0
      const snippet = threads.data.threads?.[0]?.snippet ?? ''
      results.push({ contactId: contact.id, replied, snippet })
    } catch {
      results.push({ contactId: contact.id, replied: false, snippet: '' })
    }
  }
  res.json({ results })
})

// GET /api/gmail/contacts
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

// PATCH /api/gmail/contacts/:id
router.patch('/contacts/:id', async (req, res) => {
  const { id } = req.params
  const { userId, ...updates } = req.body as { userId: string; [key: string]: any }
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const allowed: Record<string, string> = {
    status: 'status',
    interestRating: 'interest_rating',
    notes: 'notes',
    gmailThreadId: 'gmail_thread_id',
    lastReplyAt: 'last_reply_at',
    lastReplySnippet: 'last_reply_snippet',
    coachName: 'coach_name',
    schoolName: 'school_name',
    coachEmail: 'coach_email',
    division: 'division',
  }
  const patch: Record<string, any> = {}
  for (const [key, col] of Object.entries(allowed)) {
    if (key in updates) patch[col] = updates[key]
  }
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' })
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

// GET /api/gmail/threads?userId=<uid>
router.get('/threads', async (req, res) => {
  const { userId } = req.query as { userId: string }
  if (!userId) return res.status(400).json({ error: 'userId required' })
  try {
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
    if (!contact.gmail_thread_id) { tracked.push(mapContact(contact)); continue }
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
        }).eq('id', contact.id).eq('user_id', userId)
        tracked.push(mapContact({ ...contact, last_reply_snippet: snippet, last_reply_at: lastReplyAt, status: 'replied' }))
      } else {
        tracked.push(mapContact(contact))
      }
    } catch {
      tracked.push(mapContact(contact))
    }
  }

  // Scan the FULL mailbox (not just the 30 newest inbox threads) for untracked potential
  // coach replies — mirrors the /history-scan three-query approach so archived threads,
  // older replies, and coach emails from non-.edu addresses all surface in the picker.
  const trackedEmails = new Set((contacts ?? []).map((c: any) => c.coach_email?.toLowerCase()).filter(Boolean))
  const untracked: any[] = []
  try {
    // 3-year scan with pagination — three parallel queries, each capped at 200 threads.
    // The /threads picker has no AI cost (deterministic filters only), but we still cap
    // to keep the metadata-fetch loop fast.
    const searchResults = await Promise.allSettled([
      listAllThreads(gmail, 'newer_than:1095d from:.edu', 200),
      listAllThreads(gmail, 'newer_than:1095d -from:.edu {subject:"head coach" subject:"assistant coach" subject:scholarship subject:recruiting subject:"soccer coach" subject:"college soccer" subject:"college recruit"}', 200),
      listAllThreads(gmail, 'newer_than:1095d to:.edu in:sent', 200),
    ])
    const seenIds = new Set<string>()
    const allThreads: any[] = []
    for (const r of searchResults) {
      if (r.status !== 'fulfilled') continue
      for (const t of r.value) {
        if (t.id && !seenIds.has(t.id)) { seenIds.add(t.id); allThreads.push(t) }
      }
    }

    // Process threads in parallel batches of 10 — keeps the picker responsive even with
    // a few hundred candidate threads.
    const BATCH = 10
    for (let i = 0; i < allThreads.length; i += BATCH) {
      const batch = allThreads.slice(i, i + BATCH)
      const batchResults = await Promise.allSettled(batch.map(async (thread) => {
        const td = await gmail.users.threads.get({
          userId: 'me', id: thread.id!,
          format: 'metadata',
          metadataHeaders: [
            'From', 'Subject',
            'List-Unsubscribe', 'Precedence', 'X-Mailer',
            'X-Campaign-Id', 'X-Mailchimp-Campaign', 'X-Bulk-Signature',
            'X-Spam-Flag', 'X-Spam-Status',
          ],
        })
        // Look at every message in the thread, not just the first — coach replies often
        // arrive after the athlete's outbound email.
        for (const msg of td.data.messages ?? []) {
          const headers: any[] = msg.payload?.headers ?? []
          const fromHeader = getHeader(headers, 'From')
          const subject = getHeader(headers, 'Subject')
          const emailMatch = fromHeader.match(/<([^>]+)>/) ?? fromHeader.match(/([^\s]+@[^\s]+)/)
          const senderEmail = emailMatch?.[1]?.toLowerCase() ?? ''
          if (!senderEmail || trackedEmails.has(senderEmail)) continue
          if (isBulkMessage(headers, senderEmail, subject)) continue
          if (isNewsletterEmail(subject)) continue

          const category = categorizeEmail(senderEmail, subject)
          if (category !== 'id_camp' && category !== 'coach') continue

          const displayName = fromHeader.replace(/<[^>]+>/, '').trim().replace(/^"|"$/g, '')
          const confidence = classifyCoachMessage(displayName, senderEmail, subject)
          if (confidence !== 'accept') continue

          return {
            threadId: thread.id,
            senderEmail,
            senderName: displayName,
            subject,
            snippet: td.data.snippet ?? thread.snippet ?? '',
            category,
          }
        }
        return null
      }))
      for (const r of batchResults) {
        if (r.status === 'fulfilled' && r.value) untracked.push(r.value)
      }
    }
  } catch (e) {
    console.error('untracked inbox scan failed:', e instanceof Error ? e.message : e)
  }

  res.json({ tracked, untracked })
  } catch (e) {
    console.error('threads error:', e instanceof Error ? e.message : e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Sync failed' })
  }
})

// POST /api/gmail/auto-import
// One-shot: scan the connected Gmail for coach emails and bulk-create outreach_contacts
// rows for every confirmed coach the user isn't already tracking. School name is resolved
// from the sender's .edu domain via schools.json; coach name from the display header.
// Returns { imported, skipped, contacts } so the UI can refresh the list.
router.post('/auto-import', async (req, res) => {
  const { userId } = req.body as { userId: string }
  if (!userId) return res.status(400).json({ error: 'userId required' })
  try {
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

    const { data: existing } = await supabase
      .from('outreach_contacts')
      .select('coach_email, gmail_thread_id')
      .eq('user_id', userId)
    const existingEmails = new Set((existing ?? []).map((r: any) => r.coach_email?.toLowerCase()).filter(Boolean))
    const existingThreads = new Set((existing ?? []).map((r: any) => r.gmail_thread_id).filter(Boolean))

    // Same three-query scan used by /threads — maximum recall on real coach emails.
    const searchResults = await Promise.allSettled([
      listAllThreads(gmail, 'newer_than:1095d from:.edu', 200),
      listAllThreads(gmail, 'newer_than:1095d -from:.edu {subject:"head coach" subject:"assistant coach" subject:scholarship subject:recruiting subject:"soccer coach" subject:"college soccer" subject:"college recruit"}', 200),
      listAllThreads(gmail, 'newer_than:1095d to:.edu in:sent', 200),
    ])
    const seenIds = new Set<string>()
    const allThreads: any[] = []
    for (const r of searchResults) {
      if (r.status !== 'fulfilled') continue
      for (const t of r.value) {
        if (t.id && !seenIds.has(t.id)) { seenIds.add(t.id); allThreads.push(t) }
      }
    }

    // Process in parallel batches of 10. For each thread, find the latest coach message
    // that passes deterministic filters (no AI cost — same bar as the Discovered tab).
    const BATCH = 10
    const candidates: { threadId: string; senderEmail: string; senderName: string; subject: string; lastReplyAt: string | null; snippet: string; category: 'coach' | 'id_camp' }[] = []
    for (let i = 0; i < allThreads.length; i += BATCH) {
      const batch = allThreads.slice(i, i + BATCH)
      const batchResults = await Promise.allSettled(batch.map(async (thread) => {
        const td = await gmail.users.threads.get({
          userId: 'me', id: thread.id!,
          format: 'metadata',
          metadataHeaders: [
            'From', 'Subject', 'Date',
            'List-Unsubscribe', 'Precedence', 'X-Mailer',
            'X-Campaign-Id', 'X-Mailchimp-Campaign', 'X-Bulk-Signature',
            'X-Spam-Flag', 'X-Spam-Status',
          ],
        })
        // Iterate every message and pick the latest non-bulk coach message in the thread.
        let latest: any = null
        for (const msg of td.data.messages ?? []) {
          const headers: any[] = msg.payload?.headers ?? []
          const fromHeader = getHeader(headers, 'From')
          const subject = getHeader(headers, 'Subject')
          const emailMatch = fromHeader.match(/<([^>]+)>/) ?? fromHeader.match(/([^\s]+@[^\s]+)/)
          const senderEmail = emailMatch?.[1]?.toLowerCase() ?? ''
          if (!senderEmail) continue
          if (isBulkMessage(headers, senderEmail, subject)) continue
          if (isNewsletterEmail(subject)) continue
          const category = categorizeEmail(senderEmail, subject)
          if (category !== 'id_camp' && category !== 'coach') continue
          const displayName = fromHeader.replace(/<[^>]+>/, '').trim().replace(/^"|"$/g, '')
          const confidence = classifyCoachMessage(displayName, senderEmail, subject)
          if (confidence !== 'accept') continue
          const dateVal = getHeader(headers, 'Date')
          latest = {
            threadId: thread.id,
            senderEmail,
            senderName: displayName,
            subject,
            lastReplyAt: dateVal ? new Date(dateVal).toISOString() : null,
            snippet: ((msg as any).snippet ?? td.data.snippet ?? '').slice(0, 300),
            category,
          }
        }
        return latest
      }))
      for (const r of batchResults) {
        if (r.status === 'fulfilled' && r.value) candidates.push(r.value)
      }
    }

    // De-duplicate by senderEmail — one contact per coach, keep the most recent thread.
    const byEmail = new Map<string, typeof candidates[number]>()
    for (const c of candidates) {
      const prev = byEmail.get(c.senderEmail)
      if (!prev) { byEmail.set(c.senderEmail, c); continue }
      const a = c.lastReplyAt ? Date.parse(c.lastReplyAt) : 0
      const b = prev.lastReplyAt ? Date.parse(prev.lastReplyAt) : 0
      if (a > b) byEmail.set(c.senderEmail, c)
    }

    // Build insert rows for everything not yet tracked.
    const toInsert: any[] = []
    let skipped = 0
    for (const c of byEmail.values()) {
      if (existingEmails.has(c.senderEmail) || existingThreads.has(c.threadId)) {
        skipped++
        continue
      }
      const schoolName = resolveSchoolFromEmail(c.senderEmail, c.senderName, schoolsData as any[])
      const coachName = resolveCoachName(c.senderName, c.senderEmail)
      // Status defaults to 'replied' when there's a recent message — auto-imports
      // are coming from existing inbox threads, so the user has already been contacted.
      toInsert.push({
        user_id: userId,
        coach_name: coachName,
        school_name: schoolName,
        coach_email: c.senderEmail,
        division: 'D1', // best default; user can edit per row
        gmail_thread_id: c.threadId,
        last_reply_at: c.lastReplyAt,
        last_reply_snippet: c.snippet,
        status: 'replied',
      })
    }

    let imported = 0
    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from('outreach_contacts')
        .insert(toInsert)
        .select()
      if (error) {
        console.error('auto-import insert failed:', error.message)
        return res.status(500).json({ error: error.message })
      }
      imported = data?.length ?? 0
    }

    const { data: allContacts } = await supabase
      .from('outreach_contacts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    res.json({
      imported,
      skipped,
      contacts: (allContacts ?? []).map(mapContact),
    })
  } catch (e) {
    console.error('auto-import error:', e instanceof Error ? e.message : e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Auto-import failed' })
  }
})

// GET /api/gmail/history-scan?userId=<uid>
// Elite 2-year inbox scan — three-tier classifier + batch AI rating.
//  Search  : 3 parallel Gmail queries (max recall)
//  Tier 1  : hard reject via headers/domains — zero AI cost
//  Tier 2  : hard accept via deterministic signals — zero AI cost
//  Tier 3  : Claude batch verify uncertain cases — one compact call
//  Rating  : Claude batch rates ALL confirmed emails — one call, full analysis
router.get('/history-scan', async (req, res) => {
  const { userId } = req.query as { userId: string }
  if (!userId) return res.status(400).json({ error: 'userId required' })
  try {
    const supabase = getSupabase()
    const { data: tokenRow } = await supabase
      .from('user_gmail_tokens')
      .select('refresh_token, email')
      .eq('user_id', userId)
      .single()
    if (!tokenRow?.refresh_token) return res.status(403).json({ error: 'Gmail not connected' })

    const athleteEmail = (tokenRow.email ?? '').toLowerCase()

    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({ refresh_token: tokenRow.refresh_token })
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // 3-year scan — three parallel queries, paginated, capped at 200 threads each.
    // Caps matter here because every confirmed thread feeds Claude batch rating, so
    // candidate count directly drives token spend.
    const [contactsResult, ...searchResults] = await Promise.allSettled([
      supabase.from('outreach_contacts').select('gmail_thread_id, coach_email').eq('user_id', userId),
      // Search 1: any .edu sender — covers coach-initiated AND coach-replied threads
      listAllThreads(gmail, 'newer_than:1095d from:.edu', 200),
      // Search 2: non-.edu coaches with recruiting subjects (coaches using Gmail, etc.)
      listAllThreads(gmail, 'newer_than:1095d -from:.edu {subject:"head coach" subject:"assistant coach" subject:scholarship subject:recruiting subject:"soccer coach" subject:"college soccer" subject:"college recruit"}', 200),
      // Search 3: sent-to-.edu threads where coach may have replied from a non-.edu address
      listAllThreads(gmail, 'newer_than:1095d to:.edu in:sent', 200),
    ])

    const contacts = contactsResult.status === 'fulfilled' ? (contactsResult.value.data ?? []) : []
    const trackedThreadIds = new Set(contacts.map((c: any) => c.gmail_thread_id).filter(Boolean))
    const trackedEmails = new Set(contacts.map((c: any) => c.coach_email?.toLowerCase()).filter(Boolean))

    // Deduplicate threads across all three searches
    const seenIds = new Set<string>()
    const allThreads: any[] = []
    for (const r of searchResults) {
      if (r.status !== 'fulfilled') continue
      for (const t of r.value) {
        if (t.id && !seenIds.has(t.id)) { seenIds.add(t.id); allThreads.push(t) }
      }
    }

    // Process threads in parallel batches of 10 for speed
    const BATCH = 10
    const accepted: any[] = []
    const uncertain: any[] = []

    for (let i = 0; i < allThreads.length; i += BATCH) {
      const batch = allThreads.slice(i, i + BATCH)
      const batchResults = await Promise.allSettled(batch.map(async (t) => {
        const td = await gmail.users.threads.get({
          userId: 'me', id: t.id!,
          format: 'metadata',
          metadataHeaders: [
            'From', 'Subject', 'Date',
            'List-Unsubscribe', 'Precedence', 'X-Mailer',
            'X-Campaign-Id', 'X-Mailchimp-Campaign', 'X-Bulk-Signature',
          ],
        })
        const messages = td.data.messages ?? []
        const totalMsgs = messages.length

        // Collect every non-bulk coach message in the thread
        const coachMsgs: { from: string; email: string; displayName: string; subject: string; msg: any; msgSnippet: string }[] = []

        for (const msg of messages) {
          const headers: any[] = msg.payload?.headers ?? []
          const from = getHeader(headers, 'From')
          const emailMatch = from.match(/<([^>]+)>/) ?? from.match(/([^\s]+@[^\s]+)/)
          const email = emailMatch?.[1]?.toLowerCase() ?? ''
          if (!email || email === athleteEmail) continue  // skip athlete's own messages

          const subject = getHeader(headers, 'Subject')
          const isEdu = email.endsWith('.edu')
          // .edu = always a coach candidate; non-.edu needs keyword match
          const cat = isEdu ? 'coach' : categorizeEmail(email, subject)
          if (cat === 'other') continue
          if (isBulkMessage(headers, email, subject)) continue

          const displayName = from.replace(/<[^>]+>/, '').replace(/['"]/g, '').trim()
          // Use the message's own snippet (200 chars of its content) not the thread snippet
          const msgSnippet = (msg as any).snippet ?? ''
          coachMsgs.push({ from, email, displayName, subject, msg, msgSnippet })
        }

        if (coachMsgs.length === 0) return null

        const latest = coachMsgs[coachMsgs.length - 1]
        const dateVal = getHeader(latest.msg.payload?.headers ?? [], 'Date')
        const date = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString()

        return {
          entry: {
            threadId: t.id!,
            senderEmail: latest.email,
            senderName: latest.displayName || latest.email,
            subject: latest.subject,
            snippet: latest.msgSnippet || td.data.snippet || '',
            date,
            category: categorizeEmail(latest.email, latest.subject) as 'id_camp' | 'coach',
            isTracked: trackedThreadIds.has(t.id!) || trackedEmails.has(latest.email),
            messageCount: totalMsgs,
            coachMessageCount: coachMsgs.length,
            personalizationNote: '',
          },
          confidence: classifyCoachMessage(latest.displayName, latest.email, latest.subject),
        }
      }))

      for (const r of batchResults) {
        if (r.status !== 'fulfilled' || !r.value) continue
        if (r.value.confidence === 'accept') accepted.push(r.value.entry)
        else uncertain.push(r.value.entry)
      }
    }

    // Tier 3: Claude batch verify uncertain — one compact call
    const verifyNoteMap = new Map<string, string>()
    if (uncertain.length > 0) {
      try {
        const analysis = await filterRealCoachEmails(
          uncertain.map((c) => ({ threadId: c.threadId, senderEmail: c.senderEmail, subject: c.subject, snippet: c.snippet }))
        )
        for (const r of analysis) {
          if (r.isReal) verifyNoteMap.set(r.threadId, r.note)
        }
      } catch {
        for (const c of uncertain) verifyNoteMap.set(c.threadId, '')
      }
    }

    const verifiedUncertain = uncertain
      .filter((c) => verifyNoteMap.has(c.threadId))
      .map((c) => ({ ...c, personalizationNote: verifyNoteMap.get(c.threadId) ?? '' }))

    const confirmed = [...accepted, ...verifiedUncertain]

    // Batch AI rating — ONE call rates every confirmed email.
    // Pass messageCount + isIdCamp so the AI can weight genuineness by thread depth
    // and apply stricter caps on mass ID camp blasts.
    const ratingMap = new Map<string, any>()
    if (confirmed.length > 0) {
      try {
        const ratings = await batchRateCoachEmails(
          confirmed.map((c) => ({
            threadId: c.threadId,
            senderName: c.senderName,
            subject: c.subject,
            snippet: c.snippet,
            messageCount: c.messageCount,
            isIdCamp: c.category === 'id_camp',
          }))
        )
        for (const r of ratings) ratingMap.set(r.threadId, r)
      } catch {
        // Ratings optional — emails still surface without them
      }
    }

    const results = confirmed
      .map((c) => {
        const r = ratingMap.get(c.threadId)
        const score = r?.score ?? 5
        const genuineness = r?.genuineness ?? 5
        // Noise classification:
        //   - Mass ID camp blast: id_camp category + AI rated genuineness ≤ 2 (no personalization)
        //   - Newsletter-style subject that passed header checks but reads like a subscription update
        const isNoise =
          (c.category === 'id_camp' && genuineness <= 2 && score <= 3) ||
          isNewsletterEmail(c.subject)
        const noiseReason = isNoise
          ? c.category === 'id_camp' ? 'Mass ID camp blast' : 'Newsletter / subscription content'
          : undefined
        return {
          ...c,
          score,
          rating: r?.rating ?? 'cold',
          interestLevel: r?.interestLevel ?? 'Unknown',
          genuineness,
          ratingNote: r?.ratingNote ?? '',
          nextAction: r?.nextAction ?? 'Send a follow-up within two weeks.',
          isNoise,
          noiseReason,
        }
      })
      .sort((a, b) => b.score - a.score || new Date(b.date).getTime() - new Date(a.date).getTime())

    res.json({ emails: results })
  } catch (e) {
    console.error('history-scan error:', e instanceof Error ? e.message : e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Scan failed' })
  }
})

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

// POST /api/gmail/rate-and-log
router.post('/rate-and-log', async (req, res) => {
  const { userId, contactId, latestCoachMessage, coachName, school } = req.body as {
    userId: string; contactId: string; latestCoachMessage: string; coachName: string; school: string
  }
  if (!userId || !contactId || !latestCoachMessage) return res.status(400).json({ error: 'userId, contactId, and latestCoachMessage required' })
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

export default router
