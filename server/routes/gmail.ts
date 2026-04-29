import { Router } from 'express'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const router = Router()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
)

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/gmail/callback'
  )
}

const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173'

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
    await supabase.from('user_gmail_tokens').upsert({
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
  const { data } = await supabase
    .from('user_gmail_tokens')
    .select('email')
    .eq('user_id', userId)
    .single()
  res.json({ connected: !!data, email: data?.email ?? null })
})

// POST /api/gmail/send
router.post('/send', async (req, res) => {
  const { userId, to, subject, body } = req.body as {
    userId: string; to: string; subject: string; body: string
  }
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
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    res.json({ success: true })
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
  const { data: tokenRow } = await supabase
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

export default router
