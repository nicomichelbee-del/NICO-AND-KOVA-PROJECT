import { Router } from 'express'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { isCoachEmail, decodeMessageBody } from '../lib/gmailUtils'
import { rateCoachReply } from '../lib/aiClient'

const router = Router()

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
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
  res.redirect(url)
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
      supabase.from('sent_emails').insert({
        user_id: userId,
        contact_id: contactId ?? null,
        gmail_thread_id: threadId,
        gmail_message_id: messageId,
        subject,
        body,
        email_type: emailType ?? 'initial_outreach',
      }).then().catch((err: Error) => {
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
  } catch (e) {
    console.error('untracked inbox scan failed:', e instanceof Error ? e.message : e)
  }

  res.json({ tracked, untracked })
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
