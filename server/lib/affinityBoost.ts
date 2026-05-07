// Server-side mirror of client/src/lib/preferences.ts affinity calculator.
// Kept as a separate file (rather than a shared module) because the client
// and server are separate TS roots in this repo and a shared lib would need
// extra tsconfig plumbing — the function is small enough that duplication
// is cheaper than abstraction. If either copy changes, update both.

import type { School } from '../../client/src/types/index'

interface FeatureVector {
  division: string
  size: string
  region: string
  conference: string
  programBucket: string
  academicTier: string
}

// Subset of the SchoolRecord shape used at scoring time, plus computed
// academicTier passed in alongside (the matcher already has it).
interface SchoolFeatures {
  division: string
  size: string
  region?: string
  conference?: string
  programStrength?: number
  academicTier?: number
}

export interface ServerPreferences {
  table: Record<keyof FeatureVector, Record<string, number>>
  meaningfulCount: number
}

function programBucket(strength: number | undefined | null): string {
  if (strength == null) return 'unknown'
  if (strength >= 8) return 'high'
  if (strength >= 5) return 'mid'
  return 'low'
}

function featuresOf(s: SchoolFeatures): FeatureVector {
  return {
    division: s.division,
    size: s.size,
    region: s.region ?? 'unknown',
    conference: s.conference ?? 'unknown',
    programBucket: programBucket(s.programStrength),
    academicTier: s.academicTier ? `t${s.academicTier}` : 'tunknown',
  }
}

const FEATURE_DIMS: (keyof FeatureVector)[] = [
  'division', 'size', 'region', 'conference', 'programBucket', 'academicTier',
]
const PER_DIM_CAP = 3
const TOTAL_SCALE = 1.0

export function affinityBoost(
  prefs: ServerPreferences | null | undefined,
  school: SchoolFeatures,
): number {
  if (!prefs || prefs.meaningfulCount < 2) return 0
  const f = featuresOf(school)
  let total = 0
  for (const dim of FEATURE_DIMS) {
    const score = prefs.table[dim]?.[f[dim]] ?? 0
    total += Math.max(-PER_DIM_CAP, Math.min(PER_DIM_CAP, score * 1.5))
  }
  return total * TOTAL_SCALE
}

// Sanity-check that an incoming preferences blob from the client has the
// expected shape — defensive guard against malformed payloads since this
// flows in from a public API surface.
export function isValidPreferences(x: unknown): x is ServerPreferences {
  if (!x || typeof x !== 'object') return false
  const p = x as { table?: unknown; meaningfulCount?: unknown }
  if (typeof p.meaningfulCount !== 'number') return false
  if (!p.table || typeof p.table !== 'object') return false
  return true
}

// Convenience wrapper: accepts the raw School type the client uses so we
// can mirror the client's School-typed callsite, but we only read the
// fields featuresOf() needs.
export function affinityBoostForSchool(
  prefs: ServerPreferences | null | undefined,
  school: Pick<School, 'division' | 'size' | 'region' | 'conference' | 'programStrength' | 'academicTier'>,
): number {
  return affinityBoost(prefs, school)
}
