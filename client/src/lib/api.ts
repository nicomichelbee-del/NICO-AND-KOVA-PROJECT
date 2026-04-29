import type { AthleteProfile, Division, School, VideoRating, CoachResponse, IdCamp, CampCoach, LeaderboardEntry, RosterProgram, PositionNeed, IdEvent } from '../types'

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error((err as { error: string }).error ?? 'Request failed')
  }
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error((err as { error: string }).error ?? 'Request failed')
  }
  return res.json()
}

export function generateEmail(profile: AthleteProfile, school: string, division: Division, coachName: string, gender: 'mens' | 'womens') {
  return post<{ subject: string; body: string }>('/api/ai/email', { profile, school, division, coachName, gender })
}

export function findCoach(school: string, division: Division, gender: 'mens' | 'womens') {
  return post<{ coachName: string; coachEmail: string; confidence: 'high' | 'low' }>('/api/ai/find-coach', { school, division, gender })
}

export function matchSchools(profile: AthleteProfile) {
  return post<{ schools: School[] }>('/api/ai/schools', { profile })
}

export function rateVideo(videoUrl: string, profile: AthleteProfile) {
  return post<VideoRating>('/api/ai/video', { videoUrl, profile })
}

export function generateFollowUp(profile: AthleteProfile, context: string, type: 'followup' | 'thankyou' | 'answer') {
  return post<{ body: string }>('/api/ai/followup', { profile, context, type })
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

export type { LeaderboardEntry, IdEvent }
