import type { ConfidenceTag } from '../../client/src/types/athletic'

export function tagField<T extends object>(
  payload: T,
  source: string,
  confidence: ConfidenceTag
): T & { source: string; confidence: ConfidenceTag; lastVerified: string } {
  return { ...payload, source, confidence, lastVerified: new Date().toISOString() }
}

export function isFresh(lastVerified: string, maxAgeDays: number): boolean {
  const age = Date.now() - new Date(lastVerified).getTime()
  return age < maxAgeDays * 86400_000
}
