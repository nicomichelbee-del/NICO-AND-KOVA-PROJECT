// Bridge between the new onboarding storage shape (AthleteProfileRecord,
// keyed under 'athleteProfileRecord') and the legacy AthleteProfile shape
// most dashboard pages still consume. Returns null when no profile exists.

import type { AthleteProfile, Division, Region } from '../types'
import { POSITION_LABELS, type AthleteProfileRecord } from '../types/profile'

const RECORD_KEY = 'athleteProfileRecord'
const LEGACY_KEY = 'athleteProfile'

const VALID_DIVISIONS: readonly Division[] = ['D1', 'D2', 'D3', 'NAIA', 'JUCO']
// Onboarding offers more regions than the legacy Region union recognises
// ('South' and 'Northwest' aren't in the type). Anything outside the union
// degrades to 'any' rather than crashing the matcher.
const VALID_REGIONS: readonly Region[] = ['any', 'Northeast', 'Southeast', 'Midwest', 'Southwest', 'West']

function readRecord(): AthleteProfileRecord | null {
  try {
    const raw = localStorage.getItem(RECORD_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AthleteProfileRecord
  } catch {
    return null
  }
}

function readLegacy(): AthleteProfile | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AthleteProfile
  } catch {
    return null
  }
}

export function readLegacyProfile(): AthleteProfile | null {
  const r = readRecord()
  // Fall back to the legacy key for users who completed the older onboarding
  // before the new record schema landed.
  if (!r) return readLegacy()

  // Map position code (e.g. "CM") to long form ("Central Mid"). Pages match
  // on the long form, so we always expand here.
  const position = (r.primary_position && POSITION_LABELS[r.primary_position])
    || r.primary_position
    || 'Forward'

  // Take the first listed division target as the primary, but pass the full
  // list through so multi-target matching still works.
  const divs = (r.desired_division_levels ?? []).filter((d): d is Division =>
    VALID_DIVISIONS.includes(d as Division))
  const targetDivision: Division = divs[0] ?? 'D1'

  const regions = (r.regions_of_interest ?? []).filter((reg): reg is Region =>
    VALID_REGIONS.includes(reg as Region))
  const locationPreference: Region = regions[0] ?? 'any'

  // Onboarding doesn't capture gender today. Default to 'mens' so the gender
  // filter is deterministic; once gender is added to the profile schema,
  // wire it through here.
  const gender: 'mens' | 'womens' = 'mens'

  return {
    name: r.full_name ?? '',
    gradYear: r.graduation_year ?? new Date().getFullYear() + 2,
    position,
    gender,
    clubTeam: r.current_club ?? '',
    clubLeague: r.current_league_or_division ?? '',
    gpa: r.gpa ?? 0,
    satAct: r.sat_score || r.act_score || undefined,
    goals: 0,
    assists: 0,
    intendedMajor: undefined,
    highlightUrl: r.highlight_video_url ?? undefined,
    targetDivision,
    targetDivisions: divs.length > 1 ? divs : undefined,
    locationPreference,
    sizePreference: 'any',
    excludedDivisions: undefined,
  }
}
