import { Router } from 'express'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { categorizeEmail, isBulkMessage, classifyCoachMessage, getHeader, decodeMessageBody } from '../lib/gmailUtils'
import { rateCoachReply, filterRealCoachEmails, batchRateCoachEmails } from '../lib/aiClient'

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
        const category = categorizeEmail(senderEmail, subject)
        if (category === 'id_camp' || category === 'coach') {
          untracked.push({
            threadId: thread.id,
            senderEmail,
            senderName: fromHeader.replace(/<[^>]+>/, '').trim().replace(/^"|"$/g, ''),
            subject,
            snippet: thread.snippet ?? '',
            category,
          })
        }
      } catch { /* skip */ }
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

    const [contactsResult, ...searchResults] = await Promise.allSettled([
      supabase.from('outreach_contacts').select('gmail_thread_id, coach_email').eq('user_id', userId),
      // Search 1: any .edu sender — covers coach-initiated AND coach-replied threads
      gmail.users.threads.list({ userId: 'me', q: 'newer_than:730d from:.edu', maxResults: 150 }),
      // Search 2: non-.edu coaches with recruiting subjects (coaches using Gmail, etc.)
      gmail.users.threads.list({ userId: 'me', q: 'newer_than:730d -from:.edu {subject:"head coach" subject:"assistant coach" subject:scholarship subject:recruiting subject:"soccer coach" subject:"college soccer" subject:"college recruit"}', maxResults: 50 }),
      // Search 3: sent-to-.edu threads where coach may have replied from a non-.edu address
      gmail.users.threads.list({ userId: 'me', q: 'newer_than:730d to:.edu in:sent', maxResults: 75 }),
    ])

    const contacts = contactsResult.status === 'fulfilled' ? (contactsResult.value.data ?? []) : []
    const trackedThreadIds = new Set(contacts.map((c: any) => c.gmail_thread_id).filter(Boolean))
    const trackedEmails = new Set(contacts.map((c: any) => c.coach_email?.toLowerCase()).filter(Boolean))

    // Deduplicate threads across all three searches
    const seenIds = new Set<string>()
    const allThreads: any[] = []
    for (const r of searchResults) {
      if (r.status !== 'fulfilled') continue
      for (const t of r.value.data.threads ?? []) {
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

    // Batch AI rating — ONE call rates every confirmed email
    const ratingMap = new Map<string, any>()
    if (confirmed.length > 0) {
      try {
        const ratings = await batchRateCoachEmails(
          confirmed.map((c) => ({ threadId: c.threadId, senderName: c.senderName, subject: c.subject, snippet: c.snippet }))
        )
        for (const r of ratings) ratingMap.set(r.threadId, r)
      } catch {
        // Ratings optional — emails still surface without them
      }
    }

    const results = confirmed
      .map((c) => {
        const r = ratingMap.get(c.threadId)
        return {
          ...c,
          score: r?.score ?? 5,
          rating: r?.rating ?? 'cold',
          interestLevel: r?.interestLevel ?? 'Unknown',
          genuineness: r?.genuineness ?? 5,
          ratingNote: r?.ratingNote ?? '',
          nextAction: r?.nextAction ?? 'Send a follow-up within two weeks.',
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
