import { Router } from 'express'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const router = Router()

// Wrap async handlers — Express 4 doesn't auto-forward thrown errors.
for (const method of ['get', 'post', 'put', 'delete', 'patch'] as const) {
  const original = router[method].bind(router) as (path: string, ...handlers: unknown[]) => unknown
  ;(router as unknown as Record<string, unknown>)[method] = (path: string, ...handlers: unknown[]) => {
    const wrapped = handlers.map((h) => {
      if (typeof h !== 'function') return h
      return (req: unknown, res: unknown, next: unknown) =>
        Promise.resolve((h as (...a: unknown[]) => unknown)(req, res, next)).catch(next as (e: unknown) => void)
    })
    return original(path, ...wrapped)
  }
}

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!url || !key || key === 'placeholder_anon_key') {
    throw new Error('Supabase not configured')
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

// ── POST /api/coach/reply/draft ─────────────────────────────────────────────
// Looks up coach claim + athlete profile + most recent inbound message,
// then calls /api/ai/coach-reply-draft to compose a draft reply.
router.post('/reply/draft', async (req, res) => {
  const { coachUserId, athleteId } = req.body as { coachUserId: string; athleteId: string }
  if (!coachUserId || !athleteId) return res.status(400).json({ error: 'coachUserId and athleteId required' })
  const supabase = getSupabase()

  const [{ data: claim }, { data: athlete }, { data: lastEmail }] = await Promise.all([
    supabase.from('claimed_programs')
      .select('school_name, gender, coach_name, notes_override')
      .eq('coach_user_id', coachUserId).maybeSingle(),
    supabase.from('athlete_profiles')
      .select('full_name, primary_position, graduation_year, current_club, highlight_video_url')
      .eq('user_id', athleteId).maybeSingle(),
    supabase.from('sent_emails')
      .select('body')
      .eq('user_id', athleteId)
      .order('sent_at', { ascending: false })
      .limit(1).maybeSingle(),
  ])

  if (!claim) return res.status(404).json({ error: 'No claimed program' })
  if (!athlete) return res.status(404).json({ error: 'Athlete not found' })

  const aiResp = await fetch(`http://localhost:${process.env.PORT ?? 3001}/api/ai/coach-reply-draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': athleteId,
    },
    body: JSON.stringify({
      athleteName: athlete.full_name ?? 'the recruit',
      athletePosition: athlete.primary_position ?? null,
      athleteGradYear: athlete.graduation_year ?? null,
      athleteClub: athlete.current_club ?? null,
      athleteHighlight: athlete.highlight_video_url ?? null,
      athleteLastMessage: lastEmail?.body ?? '',
      programName: claim.school_name,
      programDivision: claim.gender === 'mens' ? "Men's program" : "Women's program",
      coachName: claim.coach_name ?? 'Coach',
      programNotes: claim.notes_override ?? null,
    }),
  })
  if (!aiResp.ok) return res.status(500).json({ error: 'AI draft failed' })
  res.json(await aiResp.json())
})

// ── POST /api/coach/reply/send ──────────────────────────────────────────────
// Sends via the coach's connected Gmail (reuses user_gmail_tokens),
// records a coach_messages row, and updates outreach_contacts.status.
router.post('/reply/send', async (req, res) => {
  const { coachUserId, athleteId, subject, body } = req.body as {
    coachUserId: string; athleteId: string; subject: string; body: string
  }
  if (!coachUserId || !athleteId || !subject || !body) {
    return res.status(400).json({ error: 'coachUserId, athleteId, subject, body required' })
  }
  const supabase = getSupabase()

  const { data: tokenRow } = await supabase
    .from('user_gmail_tokens')
    .select('refresh_token, email')
    .eq('user_id', coachUserId)
    .single()
  if (!tokenRow?.refresh_token) {
    return res.status(403).json({ error: 'gmail_not_connected' })
  }

  const { data: athleteToken } = await supabase
    .from('user_gmail_tokens')
    .select('email')
    .eq('user_id', athleteId)
    .single()
  const to = athleteToken?.email ?? ''
  if (!to) return res.status(400).json({ error: 'athlete_email_unknown — athlete must have Gmail connected' })

  const { data: claim } = await supabase
    .from('claimed_programs').select('coach_email').eq('coach_user_id', coachUserId).maybeSingle()
  const { data: contact } = await supabase
    .from('outreach_contacts')
    .select('id, gmail_thread_id')
    .eq('user_id', athleteId)
    .ilike('coach_email', claim?.coach_email ?? '')
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: tokenRow.refresh_token })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  let finalSubject = subject
  if (contact?.gmail_thread_id) {
    if (!/^re:\s/i.test(finalSubject)) finalSubject = `Re: ${finalSubject}`
  }

  const headerLines = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${finalSubject}`,
  ]
  const raw = Buffer.from(headerLines.join('\r\n') + '\r\n\r\n' + body).toString('base64url')

  try {
    const sent = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    const gmailMsgId = sent.data.id ?? ''
    const gmailThreadId = sent.data.threadId ?? ''

    await supabase.from('coach_messages').insert({
      coach_user_id: coachUserId,
      athlete_id: athleteId,
      outreach_id: contact?.id ?? null,
      direction: 'outbound',
      gmail_msg_id: gmailMsgId,
      gmail_thread_id: gmailThreadId,
      subject: finalSubject,
      body,
    })

    if (contact?.id) {
      await supabase
        .from('outreach_contacts')
        .update({ status: 'replied', last_reply_at: new Date().toISOString(), last_reply_snippet: body.slice(0, 150) })
        .eq('id', contact.id)
    }

    res.json({ success: true, gmailMsgId, gmailThreadId })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Send failed' })
  }
})

// ── GET /api/coach/thread/:athleteId?coachUserId= ───────────────────────────
router.get('/thread/:athleteId', async (req, res) => {
  const { athleteId } = req.params
  const { coachUserId } = req.query as { coachUserId: string }
  if (!coachUserId) return res.status(400).json({ error: 'coachUserId required' })
  const supabase = getSupabase()

  const { data: claim } = await supabase
    .from('claimed_programs').select('coach_email').eq('coach_user_id', coachUserId).maybeSingle()

  const [{ data: athleteSent }, { data: coachSent }] = await Promise.all([
    supabase.from('sent_emails')
      .select('id, subject, body, sent_at, contact_id')
      .eq('user_id', athleteId)
      .order('sent_at', { ascending: false })
      .limit(50),
    supabase.from('coach_messages')
      .select('id, subject, body, sent_at, direction')
      .eq('coach_user_id', coachUserId)
      .eq('athlete_id', athleteId)
      .order('sent_at', { ascending: false })
      .limit(50),
  ])

  const contactIds = (athleteSent ?? []).map((e: any) => e.contact_id).filter(Boolean)
  let validContactIds = new Set<string>()
  if (contactIds.length > 0 && claim?.coach_email) {
    const { data: contacts } = await supabase
      .from('outreach_contacts')
      .select('id')
      .in('id', contactIds)
      .ilike('coach_email', claim.coach_email)
    validContactIds = new Set((contacts ?? []).map((c: any) => c.id))
  }

  const messages = [
    ...(athleteSent ?? [])
      .filter((e: any) => validContactIds.has(e.contact_id))
      .map((e: any) => ({ id: e.id, direction: 'inbound', subject: e.subject, body: e.body, sentAt: e.sent_at })),
    ...(coachSent ?? []).map((m: any) => ({ id: m.id, direction: m.direction, subject: m.subject, body: m.body, sentAt: m.sent_at })),
  ].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())

  res.json({ messages })
})

// ── PATCH/GET /api/coach/notifications ──────────────────────────────────────
router.patch('/notifications', async (req, res) => {
  const { coachUserId, perInbound, dailyDigest } = req.body as {
    coachUserId: string; perInbound?: boolean; dailyDigest?: boolean
  }
  if (!coachUserId) return res.status(400).json({ error: 'coachUserId required' })
  const update: Record<string, unknown> = {}
  if (perInbound !== undefined) update.notify_per_inbound = perInbound
  if (dailyDigest !== undefined) update.notify_daily_digest = dailyDigest
  if (Object.keys(update).length === 0) return res.status(400).json({ error: 'no fields' })
  const { error } = await getSupabase()
    .from('claimed_programs').update(update).eq('coach_user_id', coachUserId)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

router.get('/notifications', async (req, res) => {
  const { coachUserId } = req.query as { coachUserId: string }
  if (!coachUserId) return res.status(400).json({ error: 'coachUserId required' })
  const { data } = await getSupabase()
    .from('claimed_programs')
    .select('notify_per_inbound, notify_daily_digest')
    .eq('coach_user_id', coachUserId)
    .maybeSingle()
  res.json({
    perInbound: data?.notify_per_inbound ?? false,
    dailyDigest: data?.notify_daily_digest ?? true,
  })
})

// ── POST /api/coach/notifications/send-digest ───────────────────────────────
// Internal — invoked by the GitHub Actions cron once per day. Auth: shared-secret
// header X-Coach-Digest-Secret (set in COACH_DIGEST_SECRET env var on the server).
router.post('/notifications/send-digest', async (req, res) => {
  const secret = req.header('X-Coach-Digest-Secret')
  if (!secret || secret !== process.env.COACH_DIGEST_SECRET) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const supabase = getSupabase()

  const { data: claims } = await supabase
    .from('claimed_programs')
    .select('coach_user_id, coach_email, coach_name, school_name, last_digest_sent_at')
    .eq('notify_daily_digest', true)
    .not('coach_user_id', 'is', null)

  const { renderDailyDigestEmail, sendCoachEmail } = await import('../lib/coachNotifications')

  let sent = 0
  for (const claim of claims ?? []) {
    const since = claim.last_digest_sent_at
      ? new Date(claim.last_digest_sent_at)
      : new Date(Date.now() - 24 * 60 * 60 * 1000)

    const { data: consents } = await supabase
      .from('coach_inbound_consents')
      .select('athlete_id, created_at')
      .ilike('coach_email', claim.coach_email)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(50)

    if (!consents || consents.length === 0) continue

    const ids = [...new Set(consents.map((c: any) => c.athlete_id))]
    const { data: profiles } = await supabase
      .from('athlete_profiles')
      .select('user_id, full_name, slug, primary_position, graduation_year')
      .in('user_id', ids)

    const athletes = (profiles ?? []).map((p: any) => ({
      name: p.full_name ?? 'A KickrIQ athlete',
      position: p.primary_position ?? null,
      gradYear: p.graduation_year ?? null,
      slug: p.slug ?? null,
    }))

    const rendered = renderDailyDigestEmail({
      coachName: claim.coach_name ?? 'Coach',
      programName: claim.school_name ?? '',
      athletes,
    })
    if (!rendered) continue

    try {
      await sendCoachEmail({ to: claim.coach_email, ...rendered })
      await supabase
        .from('claimed_programs')
        .update({ last_digest_sent_at: new Date().toISOString() })
        .eq('coach_user_id', claim.coach_user_id)
      sent++
    } catch (err) {
      console.error('digest send failed for', claim.coach_email, err)
    }
  }

  res.json({ sent, total: claims?.length ?? 0 })
})

export default router
