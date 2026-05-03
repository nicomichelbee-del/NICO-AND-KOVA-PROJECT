import { supabase } from './supabase'
import type { AthleteProfile, Division, School, SchoolDirectoryEntry, ProgramIntel, VideoRating, CoachResponse, FindCoachResult, IdCamp, CampCoach, LeaderboardEntry, RosterProgram, PositionNeed, IdEvent, IdCampEntry, OutreachContact, SentEmail, ThreadMessage, UntrackedThread, HistoryEmail, CampRatingSummary, CampComment } from '../types'

// The server-side profile gate runs on /api/ai, /api/gmail, and /api/camps,
// so every fetch needs the user's bearer token. Centralising it here means
// individual API helpers don't have to think about auth.
async function authedHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Custom error so route guards can react to "profile incomplete" responses
// (HTTP 403 with { redirect }) by sending the user to /onboarding/profile.
export class ProfileIncompleteError extends Error {
  redirect: string
  constructor(redirect: string) {
    super('Profile incomplete')
    this.redirect = redirect
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' })) as { error?: string; redirect?: string }
    if (res.status === 403 && err.redirect) {
      throw new ProfileIncompleteError(err.redirect)
    }
    throw new Error(err.error ?? 'Request failed')
  }
  return res.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authedHeaders()) },
    body: JSON.stringify(body),
  })
  return handleResponse<T>(res)
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: await authedHeaders() })
  return handleResponse<T>(res)
}

export function generateEmail(profile: AthleteProfile, school: string, division: Division, coachName: string, gender: 'mens' | 'womens') {
  return post<{ subject: string; body: string }>('/api/ai/email', { profile, school, division, coachName, gender })
}

export function findCoach(school: string, division: Division, gender: 'mens' | 'womens') {
  return post<FindCoachResult>('/api/ai/find-coach', { school, division, gender })
}

export type { FindCoachResult }

export function matchSchools(profile: AthleteProfile, video?: VideoRating | null) {
  return post<{ schools: School[] }>('/api/ai/schools', { profile, video: video ?? null })
}

export function listAllSchools() {
  return get<{ schools: SchoolDirectoryEntry[] }>('/api/ai/schools-directory')
}

export function getProgramIntel(schoolId: string, gender: 'mens' | 'womens', refresh = false) {
  return post<{ intel: ProgramIntel }>('/api/ai/program-intel', { schoolId, gender, refresh })
}

export function getShowcaseEvents() {
  return get<{ events: IdEvent[] }>('/api/ai/showcase-events')
}

export function getIdCamps() {
  return get<{ camps: IdCampEntry[] }>('/api/ai/id-camps')
}

export function rateVideo(videoUrl: string, profile: AthleteProfile) {
  return post<VideoRating>('/api/ai/video', { videoUrl, profile })
}

export function generateFollowUp(profile: AthleteProfile, context: string, type: 'followup' | 'thankyou' | 'answer') {
  return post<{ body: string; advice?: string }>('/api/ai/followup', { profile, context, type })
}

export function rateResponse(school: string, coachName: string, text: string) {
  return post<CoachResponse>('/api/ai/rate-response', { school, coachName, text })
}

export function findCamps(profile: AthleteProfile, schools: { name: string; division: string }[]) {
  return post<{ camps: IdCamp[] }>('/api/ai/find-camps', { profile, schools })
}

export function generateCampEmails(profile: AthleteProfile, camp: IdCamp, coaches: CampCoach[]) {
  return post<{ emails: { coachName: string; subject: string; body: string }[] }>('/api/ai/camp-emails', { profile, camp, coaches })
}

export function getRosterIntel(gender: 'mens' | 'womens', division: Division | 'all', athletePosition: string) {
  return post<{ programs: RosterProgram[]; positionSummary: PositionNeed[] }>('/api/ai/roster-intel', { gender, division, athletePosition })
}

export function getGmailStatus(userId: string) {
  return get<{ connected: boolean; email: string | null }>(`/api/gmail/status?userId=${encodeURIComponent(userId)}`)
}

export function gmailSend(userId: string, to: string, subject: string, body: string) {
  return post<{ success: boolean }>('/api/gmail/send', { userId, to, subject, body })
}

export function gmailSync(userId: string, contacts: { id: string; coachEmail: string }[]) {
  return post<{ results: { contactId: string; replied: boolean; snippet: string }[] }>('/api/gmail/sync', { userId, contacts })
}

export function getContacts(userId: string) {
  return get<{ contacts: OutreachContact[] }>(`/api/gmail/contacts?userId=${encodeURIComponent(userId)}`)
}

export function createContact(userId: string, data: {
  coachName: string; schoolName: string; coachEmail: string
  division: string; position?: string; gmailThreadId?: string
}) {
  return post<{ contact: OutreachContact }>('/api/gmail/contacts', { userId, ...data })
}

export async function updateContact(id: string, userId: string, updates: Partial<OutreachContact>) {
  const res = await fetch(`/api/gmail/contacts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...updates }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error((err as { error: string }).error ?? 'Request failed')
  }
  return res.json() as Promise<{ contact: OutreachContact }>
}

export function gmailGetThreads(userId: string) {
  return get<{ tracked: OutreachContact[]; untracked: UntrackedThread[] }>(
    `/api/gmail/threads?userId=${encodeURIComponent(userId)}`
  )
}

export function gmailHistoryScan(userId: string) {
  return get<{ emails: HistoryEmail[] }>(`/api/gmail/history-scan?userId=${encodeURIComponent(userId)}`)
}

export function gmailAutoImport(userId: string) {
  return post<{ imported: number; skipped: number; contacts: OutreachContact[] }>(
    '/api/gmail/auto-import',
    { userId },
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

export function chatWithBeeko(
  messages: { role: 'user' | 'assistant'; content: string }[],
  profile?: AthleteProfile,
) {
  return post<{ reply: string }>('/api/ai/chat', { messages, profile })
}

// ── Camp ratings + comments ─────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function getCampSummary(campId: string): Promise<CampRatingSummary> {
  const headers = await authHeaders()
  const res = await fetch(`/api/camps/${encodeURIComponent(campId)}/summary`, { headers })
  if (!res.ok) throw new Error('Failed to load summary')
  return res.json()
}

export async function getCampComments(campId: string): Promise<{ comments: CampComment[] }> {
  const res = await fetch(`/api/camps/${encodeURIComponent(campId)}/comments`)
  if (!res.ok) throw new Error('Failed to load comments')
  return res.json()
}

export async function rateCamp(campId: string, rating: number): Promise<void> {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' }
  const res = await fetch(`/api/camps/${encodeURIComponent(campId)}/rate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ rating }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to rate' }))
    throw new Error((err as { error?: string }).error ?? 'Failed to rate')
  }
}

export async function postCampComment(campId: string, body: string, displayName: string): Promise<{ comment: CampComment }> {
  const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' }
  const res = await fetch(`/api/camps/${encodeURIComponent(campId)}/comment`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body, displayName }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to post comment' }))
    throw new Error((err as { error?: string }).error ?? 'Failed to post comment')
  }
  return res.json()
}

export async function deleteCampComment(commentId: string): Promise<void> {
  const headers = await authHeaders()
  const res = await fetch(`/api/camps/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) throw new Error('Failed to delete comment')
}

export type { LeaderboardEntry, IdEvent }
