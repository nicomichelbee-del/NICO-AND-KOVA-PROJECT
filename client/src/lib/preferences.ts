// Per-school 1–5 ratings + a Tinder-style affinity calculator that re-ranks
// future matches in the direction of the user's stated taste.
//
// Persistence today: localStorage keyed under `kickriq:schoolRatings:<userId>`.
// Persistence tomorrow: Supabase `school_ratings` table (one row per
// user × school). The `loadRatings` / `saveRating` interface is the seam —
// swap the bodies and nothing else changes.
//
// Algorithm (Flavor B with simple feature-vector preference, no ML):
//   1. Each school exposes a small categorical feature vector
//      (division, size, region, conference, programStrength bucket,
//       academicTier).
//   2. Each rating contributes a signed weight to its school's features.
//      A 5 = +1.0, a 4 = +0.5, a 3 = 0, a 2 = -0.5, a 1 = -1.0.
//   3. Affinity for an unrated school = sum across feature dimensions of
//      (matching-feature weight). Scaled to ~±15 so it nudges ranking
//      without overpowering matchScore (which lives on 0–100).

import type { School } from '../types'

export type Rating = 1 | 2 | 3 | 4 | 5

export interface SchoolRatings {
  [schoolId: string]: Rating
}

// Storage key — namespaced by user so swapping browsers between accounts
// doesn't pollute. Falls back to a "guest" bucket when no user id is given.
function storageKey(userId: string | null | undefined): string {
  return `kickriq:schoolRatings:${userId ?? 'guest'}`
}

// ── Persistence (localStorage today, Supabase ready) ───────────────────────

export function loadRatings(userId: string | null | undefined): SchoolRatings {
  // TODO(supabase): once a `school_ratings` table exists, fetch by user_id
  // and return the same shape. Keep the localStorage fallback for offline.
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? (JSON.parse(raw) as SchoolRatings) : {}
  } catch {
    return {}
  }
}

export function saveRating(
  userId: string | null | undefined,
  schoolId: string,
  rating: Rating | null,
): void {
  // TODO(supabase): upsert into `school_ratings` (user_id, school_id, rating)
  // and PATCH `null` should DELETE the row.
  try {
    const current = loadRatings(userId)
    if (rating == null) delete current[schoolId]
    else current[schoolId] = rating
    localStorage.setItem(storageKey(userId), JSON.stringify(current))
    // Notify other components in the same tab so the Schools page
    // re-sorts after a rating without needing a window event listener
    // round-trip via 'storage'.
    window.dispatchEvent(new CustomEvent('kickriq:ratings-changed'))
  } catch {
    /* quota — silently ignore */
  }
}

// ── Feature extraction + affinity ──────────────────────────────────────────

// Buckets continuous numeric features (programStrength) so the affinity
// calculator treats "8 vs 9" as the same dim and "3 vs 9" as different.
function programBucket(strength: number | undefined | null): string {
  if (strength == null) return 'unknown'
  if (strength >= 8) return 'high'
  if (strength >= 5) return 'mid'
  return 'low'
}

interface FeatureVector {
  division: string
  size: string
  region: string
  conference: string
  programBucket: string
  academicTier: string
}

function featuresOf(s: School): FeatureVector {
  return {
    division: s.division,
    size: s.size,
    region: s.region ?? 'unknown',
    conference: s.conference ?? 'unknown',
    programBucket: programBucket(s.programStrength),
    academicTier: s.academicTier ? `t${s.academicTier}` : 'tunknown',
  }
}

// Map rating → signed weight. 3 = neutral, 5 = strongly liked, 1 = strongly disliked.
function weightFor(rating: Rating): number {
  return (rating - 3) / 2  // -1, -0.5, 0, +0.5, +1
}

// Build a per-feature preference table from the user's rated schools. For
// each (dimension, value) pair, sum the contributing ratings' weights. So
// if the user 5-starred two small Northeast schools and 2-starred one
// large school, we'll have positive scores on `size:small`, `region:Northeast`
// and a negative score on `size:large`.
type PreferenceTable = Record<keyof FeatureVector, Record<string, number>>

function emptyTable(): PreferenceTable {
  return {
    division: {}, size: {}, region: {}, conference: {}, programBucket: {}, academicTier: {},
  }
}

export interface Preferences {
  table: PreferenceTable
  // Number of meaningful (non-3) ratings — UI gates the affinity badge on
  // having a few real signals, otherwise a single 5-star rating leaks
  // into every other school's score.
  meaningfulCount: number
}

export function buildPreferences(
  ratings: SchoolRatings,
  ratedSchools: School[],
): Preferences {
  const table = emptyTable()
  let meaningful = 0
  const byId = new Map(ratedSchools.map((s) => [s.id, s]))
  for (const [schoolId, rating] of Object.entries(ratings)) {
    const school = byId.get(schoolId)
    if (!school) continue            // user rated a school we no longer have data for
    if (rating === 3) continue        // neutral — adds no signal
    meaningful += 1
    const w = weightFor(rating)
    const f = featuresOf(school)
    ;(Object.keys(f) as (keyof FeatureVector)[]).forEach((dim) => {
      const v = f[dim]
      table[dim][v] = (table[dim][v] ?? 0) + w
    })
  }
  return { table, meaningfulCount: meaningful }
}

// Affinity boost in matchScore-equivalent points (~ -15 to +15). Positive when
// the school's features overlap with what the user has liked; negative when
// they overlap with disliked schools. The overall scale is capped so a single
// 5-star never pushes a 30-matchScore school above a true target.
const FEATURE_DIMS: (keyof FeatureVector)[] = [
  'division', 'size', 'region', 'conference', 'programBucket', 'academicTier',
]
const PER_DIM_CAP = 3   // a single dimension can swing at most ±3 points
const TOTAL_SCALE = 1.0  // total swing across all 6 dims is ~ ±15

export function affinityBoost(prefs: Preferences, school: School): number {
  if (prefs.meaningfulCount < 2) return 0  // wait for real signal
  const f = featuresOf(school)
  let total = 0
  for (const dim of FEATURE_DIMS) {
    const score = prefs.table[dim][f[dim]] ?? 0
    // Clamp per-dim contribution so a power-rated dimension can't dominate.
    total += Math.max(-PER_DIM_CAP, Math.min(PER_DIM_CAP, score * 1.5))
  }
  return total * TOTAL_SCALE
}

// Convenience: re-rank a list of schools by (matchScore + affinityBoost) while
// preserving the original bucket/category. Returns a new array; doesn't mutate.
export function applyAffinity<T extends School>(
  schools: T[],
  prefs: Preferences,
): T[] {
  const ranked = schools.map((s) => ({ s, boost: affinityBoost(prefs, s) }))
  ranked.sort((a, b) => (b.s.matchScore + b.boost) - (a.s.matchScore + a.boost))
  return ranked.map((r) => r.s)
}
