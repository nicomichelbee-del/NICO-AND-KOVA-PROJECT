import { Resend } from 'resend'

interface InboundParams {
  coachName: string
  programName: string
  athleteName: string
  athletePosition: string | null
  athleteGradYear: number | null
  athleteSlug: string | null
}

interface DigestAthlete {
  name: string; position: string | null; gradYear: number | null; slug: string | null
}

interface DigestParams {
  coachName: string; programName: string; athletes: DigestAthlete[]
}

const APP_URL = process.env.PUBLIC_BASE_URL ?? 'https://kickriq.com'

function profileLink(slug: string | null): string {
  return slug ? `${APP_URL}/players/${slug}` : `${APP_URL}/for-coaches/dashboard`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function renderInboundEmail(p: InboundParams): { subject: string; html: string; text: string } {
  const positionLine = p.athletePosition
    ? `${p.athletePosition}${p.athleteGradYear ? `, '${String(p.athleteGradYear).slice(-2)}` : ''}`
    : ''
  const subject = `${p.athleteName} just emailed your ${p.programName} program`
  const text = `Hi ${p.coachName},\n\n${p.athleteName} (${positionLine}) just reached out via KickrIQ.\n\nView their profile: ${profileLink(p.athleteSlug)}\n\nReply from your dashboard: ${APP_URL}/for-coaches/dashboard\n\n— KickrIQ`
  const html = `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="font-size:18px;margin:0 0 12px">New athlete interest</h2>
  <p>Hi ${escapeHtml(p.coachName)},</p>
  <p><strong>${escapeHtml(p.athleteName)}</strong>${positionLine ? ` (${escapeHtml(positionLine)})` : ''} just emailed your ${escapeHtml(p.programName)} program through KickrIQ.</p>
  <p style="margin:24px 0">
    <a href="${profileLink(p.athleteSlug)}" style="background:#f0b65a;color:#1a1a1a;padding:10px 18px;text-decoration:none;border-radius:6px;font-weight:600">View their profile</a>
  </p>
  <p style="font-size:12px;color:#666">Reply from your <a href="${APP_URL}/for-coaches/dashboard">coach dashboard</a>. KickrIQ never charges coaches.</p>
</div>`
  return { subject, html, text }
}

export function renderDailyDigestEmail(p: DigestParams): { subject: string; html: string; text: string } | null {
  if (p.athletes.length === 0) return null
  const subject = `${p.athletes.length} new athletes interested in ${p.programName}`
  const list = p.athletes.map((a) => {
    const meta = [a.position, a.gradYear ? `'${String(a.gradYear).slice(-2)}` : null].filter(Boolean).join(', ')
    return { name: a.name, meta, link: profileLink(a.slug) }
  })
  const text = `Hi ${p.coachName},\n\n${list.length} new athletes reached out yesterday:\n\n${list.map((l) => `- ${l.name} (${l.meta}) — ${l.link}`).join('\n')}\n\nView all in your dashboard: ${APP_URL}/for-coaches/dashboard\n\n— KickrIQ`
  const html = `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="font-size:18px;margin:0 0 12px">${list.length} new ${list.length === 1 ? 'athlete' : 'athletes'} interested in ${escapeHtml(p.programName)}</h2>
  <ul style="padding-left:20px;margin:16px 0">
    ${list.map((l) => `<li style="margin-bottom:8px"><a href="${l.link}"><strong>${escapeHtml(l.name)}</strong></a>${l.meta ? ` <span style="color:#666">(${escapeHtml(l.meta)})</span>` : ''}</li>`).join('')}
  </ul>
  <p style="margin:24px 0">
    <a href="${APP_URL}/for-coaches/dashboard" style="background:#f0b65a;color:#1a1a1a;padding:10px 18px;text-decoration:none;border-radius:6px;font-weight:600">View dashboard</a>
  </p>
</div>`
  return { subject, html, text }
}

export async function sendCoachEmail(args: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) {
    console.warn('[coachNotifications] RESEND_API_KEY/RESEND_FROM_EMAIL not set — skipping send')
    return
  }
  const resend = new Resend(apiKey)
  await resend.emails.send({ from, to: args.to, subject: args.subject, html: args.html, text: args.text })
}
