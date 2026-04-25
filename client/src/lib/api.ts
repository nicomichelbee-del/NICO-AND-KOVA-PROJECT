import type { AthleteProfile, Division, School, VideoRating } from '../types'

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

export function generateEmail(profile: AthleteProfile, school: string, division: Division, coachName: string) {
  return post<{ subject: string; body: string }>('/api/ai/email', { profile, school, division, coachName })
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
