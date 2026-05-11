// Bridge between the new onboarding storage shape (AthleteProfileRecord,
// keyed under 'athleteProfileRecord') and the legacy AthleteProfile shape
// most dashboard pages still consume. Returns null when no profile exists.

import type { AthleteProfile, Division, Region } from '../types'
import { POSITION_LABELS, type AthleteProfileRecord } from '../types/profile'

const RECORD_KEY = 'athleteProfileRecord'
const RECORD_KEY_PREFIX = 'athleteProfileRecord:'
const LEGACY_KEY = 'athleteProfile'

const VALID_DIVISIONS: readonly Division[] = ['D1', 'D2', 'D3', 'NAIA', 'JUCO']
// Onboarding offers more regions than the legacy Region union recognises
// ('South' and 'Northwest' aren't in the type). Anything outside the union
// degrades to 'any' rather than crashing the matcher.
const VALID_REGIONS: readonly Region[] = ['any', 'Northeast', 'Southeast', 'Midwest', 'Southwest', 'West']

function readRecord(): AthleteProfileRecord | null {
  try {
    // ProfileContext writes user-scoped keys (athleteProfileRecord:<userId>) and
    // migrates the old global key on first load. Scan for the user-scoped record
    // first so the dashboard's getProfile helpers see the data ProfileContext owns.
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(RECORD_KEY_PREFIX)) {
        const raw = localStorage.getItem(k)
        if (raw) return JSON.parse(raw) as AthleteProfileRecord
      }
    }
    // Fallback for the brief window between onboarding writing the global key
    // and ProfileContext mounting + migrating it.
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

  // Gender lives on the AthleteProfileRecord directly. The matcher REQUIRES
  // a real choice — it throws on missing gender (silently picking one was
  // the bug that surfaced women's programs for men's profiles and vice
  // versa). If the stored record predates the gender field (legacy users
  // who completed onboarding before gender was required), return null here
  // so the caller routes them back through onboarding instead of building
  // a profile with a fake gender.
  if (r.gender !== 'mens' && r.gender !== 'womens') return null
  const gender: 'mens' | 'womens' = r.gender

  // Convert stored metric measurements into the imperial units the email
  // generator and other consumers expect. Round height to the nearest whole
  // inch and weight to the nearest pound so coach emails read cleanly.
  const heightInches = r.height_cm != null ? Math.round(r.height_cm / 2.54) : undefined
  const weightLbs = r.weight_kg != null ? Math.round(r.weight_kg * 2.20462) : undefined

  return {
    name: r.full_name ?? '',
    gradYear: r.graduation_year ?? new Date().getFullYear() + 2,
    position,
    gender,
    clubTeam: r.current_club ?? '',
    clubLeague: r.current_league_or_division ?? '',
    gpa: r.gpa ?? 0,
    satAct: r.sat_score || r.act_score || undefined,
    goals: r.goals_last_season ?? 0,
    assists: r.assists_last_season ?? 0,
    intendedMajor: undefined,
    highlightUrl: r.highlight_video_url ?? undefined,
    heightInches,
    weightLbs,
    targetDivision,
    targetDivisions: divs.length > 1 ? divs : undefined,
    locationPreference,
    sizePreference: 'any',
    excludedDivisions: undefined,
    academicMinimum: r.academic_minimum ?? undefined,
  }
}
