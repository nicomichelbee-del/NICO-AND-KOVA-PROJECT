import { describe, it, expect } from 'vitest'
import { tagField, isFresh } from './scraperConfidence'

describe('tagField', () => {
  it('produces a stamped record with required fields', () => {
    const tagged = tagField({ value: 42 }, 'ncaa-api', 'high')
    expect(tagged.value).toBe(42)
    expect(tagged.source).toBe('ncaa-api')
    expect(tagged.confidence).toBe('high')
    expect(tagged.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('isFresh', () => {
  it('returns true for a recent timestamp', () => {
    expect(isFresh(new Date().toISOString(), 30)).toBe(true)
  })
  it('returns false for a stale timestamp', () => {
    const stale = new Date(Date.now() - 200 * 86400_000).toISOString()
    expect(isFresh(stale, 180)).toBe(false)
  })
})
