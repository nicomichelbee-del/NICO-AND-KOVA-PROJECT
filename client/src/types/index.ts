export type Division = 'D1' | 'D2' | 'D3' | 'NAIA' | 'JUCO'

export interface AthleteProfile {
  id?: string
  userId?: string
  name: string
  gradYear: number
  position: string
  clubTeam: string
  clubLeague: string
  gpa: number
  satAct?: string
  goals: number
  assists: number
  season: string
  intendedMajor: string
  highlightUrl: string
  targetDivision: Division
  locationPreference: string
  sizePreference: 'small' | 'medium' | 'large' | 'any'
}

export interface School {
  id: string
  name: string
  division: Division
  location: string
  enrollment: number
  conferece: string
  coachName?: string
  coachEmail?: string
  category: 'reach' | 'target' | 'safety'
  matchScore: number
  notes?: string
}

export interface CoachEmail {
  id: string
  school: string
  division: Division
  coachName: string
  coachEmail: string
  subject: string
  body: string
  status: 'draft' | 'sent' | 'responded' | 'not_interested'
  sentAt?: string
  respondedAt?: string
  createdAt: string
}

export interface VideoRating {
  score: number
  summary: string
  openingClip: string
  clipVariety: string
  videoLength: string
  production: string
  statOverlay: string
  positionSkills: string
  improvements: string[]
}

export type SubscriptionTier = 'free' | 'pro' | 'family'

export interface User {
  id: string
  email: string
  tier: SubscriptionTier
  emailsUsed: number
  schoolMatchesUsed: number
}

export interface CoachResponse {
  id: string
  school: string
  coachName: string
  date: string
  rating: 'hot' | 'warm' | 'cold' | 'not_interested'
  confidence: number
  signals: string[]
  nextAction: string
  rawText?: string
}

export interface CampCoach {
  name: string
  title: string
}

export interface IdCamp {
  id: string
  school: string
  division: Division
  campName: string
  date: string
  location: string
  cost: string
  url: string
  coaches: CampCoach[]
}

export interface LeaderboardEntry {
  id: string
  athleteName: string
  position: string
  clubTeam: string
  gradYear: number
  divisionGoal: Division
  score: number
  videoUrl: string
  ratedAt: string
}

export interface RosterProgram {
  school: string
  conference: string
  division: Division
  seniorsLeaving: { position: string; count: number }[]
  predictedNeed: { position: string; level: 'High' | 'Medium' | 'Low' }[]
  coachName: string
}

export interface PositionNeed {
  position: string
  demand: 'High' | 'Medium' | 'Low'
  schoolCount: number
}
