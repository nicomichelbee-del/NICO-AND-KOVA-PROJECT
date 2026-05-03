// Stub types/profile.ts — created to satisfy in-progress refactor imports.
// Replace with the real schema when the ProfileContext refactor lands.

export type ProfileVisibility = 'public' | 'recruiters_only' | 'private'

export type PositionCode =
  | 'GK' | 'CB' | 'RB' | 'LB' | 'DM' | 'CM' | 'AM' | 'RW' | 'LW' | 'ST'

export const POSITION_LABELS: Record<string, string> = {
  GK: 'Goalkeeper',
  CB: 'Center Back',
  RB: 'Right Back',
  LB: 'Left Back',
  DM: 'Defensive Mid',
  CM: 'Central Mid',
  AM: 'Attacking Mid',
  RW: 'Right Wing',
  LW: 'Left Wing',
  ST: 'Striker',
}

export type DivisionTarget = 'D1' | 'D2' | 'D3' | 'NAIA' | 'JUCO'

export const DIVISION_TARGET_LABELS: Record<string, string> = {
  D1: 'Division I',
  D2: 'Division II',
  D3: 'Division III',
  NAIA: 'NAIA',
  JUCO: 'JUCO',
}

export interface AthleteProfileRecord {
  id?: string
  user_id?: string
  full_name: string | null
  graduation_year: number | null
  primary_position: string | null
  secondary_position: string | null
  preferred_foot: string | null
  current_club: string | null
  current_league_or_division: string | null
  high_school_name: string | null
  gpa: number | null
  sat_score: string | null
  act_score: string | null
  ncaa_eligibility_id: string | null
  desired_division_levels: string[]
  regions_of_interest: string[]
  highlight_video_url: string | null
  slug: string | null
  profile_visibility: ProfileVisibility
  profile_strength_score: number
  profile_completed: boolean
}

export interface ProfileMediaItem {
  id: string
  url: string
  kind: 'video' | 'image' | 'doc'
  title?: string
}
