// Pro-feature waitlist + free-preview tracker.
//
// While Pro billing is on hold, gate Pro pages with a small free preview
// (1 use per feature, per user) and a waitlist signup. Preview counters live
// in localStorage; waitlist signups POST to /api/public/waitlist.

export type ProFeature = 'tracker' | 'followup' | 'video'

export const PRO_FEATURE_LABEL: Record<ProFeature, string> = {
  tracker: 'Outreach Tracker',
  followup: 'Follow-up Assistant',
  video: 'Highlight Video Rater',
}

export const FREE_PREVIEW_LIMIT = 1

const PREVIEW_KEY = 'kickriq:proPreview'
const WAITLIST_KEY = 'kickriq:waitlistEmails'

type PreviewMap = Partial<Record<ProFeature, number>>

function readPreview(): PreviewMap {
  try {
    return JSON.parse(localStorage.getItem(PREVIEW_KEY) ?? '{}') as PreviewMap
  } catch {
    return {}
  }
}

function writePreview(map: PreviewMap) {
  try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(map)) } catch { /* ignore quota */ }
}

export function getPreviewUses(feature: ProFeature): number {
  return readPreview()[feature] ?? 0
}

export function previewRemaining(feature: ProFeature): number {
  return Math.max(0, FREE_PREVIEW_LIMIT - getPreviewUses(feature))
}

export function consumePreview(feature: ProFeature) {
  const map = readPreview()
  map[feature] = (map[feature] ?? 0) + 1
  writePreview(map)
}

export function hasJoinedWaitlist(email?: string | null): boolean {
  if (!email) return false
  try {
    const list = JSON.parse(localStorage.getItem(WAITLIST_KEY) ?? '[]') as string[]
    return list.includes(email.toLowerCase())
  } catch { return false }
}

function rememberWaitlist(email: string) {
  try {
    const list = JSON.parse(localStorage.getItem(WAITLIST_KEY) ?? '[]') as string[]
    const next = Array.from(new Set([...list, email.toLowerCase()]))
    localStorage.setItem(WAITLIST_KEY, JSON.stringify(next))
  } catch { /* ignore */ }
}

export async function joinWaitlist(input: {
  email: string
  feature?: ProFeature | 'general'
  tier?: 'pro' | 'family'
}): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Please enter a valid email.' }
  }
  try {
    const res = await fetch('/api/public/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        feature: input.feature ?? 'general',
        tier: input.tier ?? 'pro',
        source: typeof window !== 'undefined' ? window.location.pathname : '',
      }),
    })
    if (!res.ok && res.status !== 409) {
      // Still remember locally so the UI doesn't repeatedly nag this user
      rememberWaitlist(email)
      return { ok: true }
    }
    rememberWaitlist(email)
    return { ok: true }
  } catch {
    // Network down — don't block the user; remember locally
    rememberWaitlist(email)
    return { ok: true }
  }
}
