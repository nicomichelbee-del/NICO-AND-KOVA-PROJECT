import { describe, it, expect, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { __testables } from './coach'

const { hashShape, pickAthleteFields, buildFitPrompt, fitScoreRateLimit, fitRateBuckets, FIT_RATE_MAX } = __testables

describe('coach fit-score — hashShape', () => {
  it('produces the same hash for the same payload', () => {
    const a = { gpa: 3.5, position: 'Forward' }
    const b = { gpa: 3.5, position: 'Forward' }
    expect(hashShape(a)).toBe(hashShape(b))
  })

  it('produces different hashes for different payloads', () => {
    expect(hashShape({ gpa: 3.5 })).not.toBe(hashShape({ gpa: 3.6 }))
  })

  it('is order-independent (sorts keys)', () => {
    // The cache key behavior depends on hash stability across key insertion
    // order — Supabase row reads don't guarantee key order, so the hash must
    // not depend on it.
    const a = { gpa: 3.5, position: 'Forward', goals: 12 }
    const b = { goals: 12, position: 'Forward', gpa: 3.5 }
    expect(hashShape(a)).toBe(hashShape(b))
  })

  it('returns a 16-char hex string', () => {
    const h = hashShape({ test: true })
    expect(h).toMatch(/^[a-f0-9]{16}$/)
  })

  it('handles null/undefined input safely', () => {
    expect(() => hashShape(null)).not.toThrow()
    expect(() => hashShape(undefined)).not.toThrow()
  })
})

describe('coach fit-score — pickAthleteFields', () => {
  it('extracts only the allowed fields the prompt reads', () => {
    const row = {
      full_name: 'Test Athlete',
      gpa: 3.5,
      primary_position: 'Forward',
      // Fields we explicitly exclude from the prompt to keep token cost down:
      profile_photo_url: 'should-be-stripped',
      slug: 'should-be-stripped',
      city: 'should-be-stripped',
    }
    const result = pickAthleteFields(row)
    expect(result.full_name).toBe('Test Athlete')
    expect(result.gpa).toBe(3.5)
    expect(result.primary_position).toBe('Forward')
    expect(result).not.toHaveProperty('profile_photo_url')
    expect(result).not.toHaveProperty('slug')
    expect(result).not.toHaveProperty('city')
  })

  it('fills missing fields with null (not undefined)', () => {
    const result = pickAthleteFields({ full_name: 'Just Name' })
    expect(result.gpa).toBeNull()
    expect(result.primary_position).toBeNull()
  })

  it('handles null/undefined input', () => {
    expect(pickAthleteFields(null)).toEqual({})
    expect(pickAthleteFields(undefined)).toEqual({})
  })
})

describe('coach fit-score — buildFitPrompt', () => {
  const baseAthlete = {
    full_name: 'Test Athlete',
    primary_position: 'Forward',
    gpa: 3.7,
    graduation_year: 2027,
  }

  it('renders gender-specific program label', () => {
    const mens = buildFitPrompt('mens', 'Indiana University', 'D1', [], '', baseAthlete)
    const womens = buildFitPrompt('womens', 'Indiana University', 'D1', [], '', baseAthlete)
    expect(mens).toContain("men's college soccer")
    expect(womens).toContain("women's college soccer")
    expect(mens).toContain("men's")
    expect(womens).toContain("women's")
  })

  it('includes program name + division', () => {
    const prompt = buildFitPrompt('mens', 'UCLA', 'D1', [], '', baseAthlete)
    expect(prompt).toContain('UCLA')
    expect(prompt).toContain('D1')
  })

  it('formats roster needs as a bulleted list', () => {
    const prompt = buildFitPrompt('womens', 'UNC', 'D1', [
      { position: 'Forward', level: 'High' },
      { position: 'Goalkeeper', level: 'Medium' },
    ], '', baseAthlete)
    expect(prompt).toContain('Forward: High need')
    expect(prompt).toContain('Goalkeeper: Medium need')
  })

  it('handles empty needs list gracefully', () => {
    const prompt = buildFitPrompt('mens', 'Akron', 'D1', [], '', baseAthlete)
    expect(prompt).toContain('(no specific roster needs set)')
  })

  it('includes coach notes when present', () => {
    const prompt = buildFitPrompt('mens', 'Maryland', 'D1', [], 'Looking for a creative #10 with ACC experience', baseAthlete)
    expect(prompt).toContain('Looking for a creative #10')
  })

  it('serializes athlete profile into the prompt', () => {
    const prompt = buildFitPrompt('mens', 'Stanford', 'D1', [], '', baseAthlete)
    expect(prompt).toContain('Test Athlete')
    expect(prompt).toContain('Forward')
    expect(prompt).toContain('3.7')
  })

  it('requests JSON-only output with the right shape', () => {
    const prompt = buildFitPrompt('mens', 'UCLA', 'D1', [], '', baseAthlete)
    expect(prompt).toContain('"score"')
    expect(prompt).toContain('"oneLine"')
    expect(prompt).toContain('"strengths"')
    expect(prompt).toContain('"concerns"')
    expect(prompt).toContain('JSON only')
  })

  it('documents the 1-10 scoring rubric', () => {
    const prompt = buildFitPrompt('mens', 'Indiana', 'D1', [], '', baseAthlete)
    expect(prompt).toMatch(/1-3.*mismatch/i)
    expect(prompt).toMatch(/8-9.*strong fit/i)
  })
})

describe('coach fit-score — rate limiter', () => {
  // Each test starts with a clean bucket map so the 30-cap isn't already
  // exhausted by an earlier test in the file.
  beforeEach(() => { fitRateBuckets.clear() })

  // Helper returns a record OBJECT (not a getter destructure target). The
  // earlier version used `get state()` and `const { state } = makeReqRes()`,
  // which evaluated the getter ONCE at destructure time and captured the
  // initial values — so post-call assertions always saw the pre-call state.
  // Now the recorder is a mutable shared object — same reference, always
  // current values.
  interface Recorder { nextCalled: boolean; statusCode: number | null; jsonBody: unknown }
  function makeReqRes(userId: string | undefined): { req: Request; res: Response; next: NextFunction; rec: Recorder } {
    const rec: Recorder = { nextCalled: false, statusCode: null, jsonBody: null }
    const req = { body: userId === undefined ? {} : { userId } } as unknown as Request
    const res = {
      status(code: number) {
        rec.statusCode = code
        return {
          json(body: unknown) { rec.jsonBody = body },
        } as unknown as Response
      },
    } as unknown as Response
    const next: NextFunction = () => { rec.nextCalled = true }
    return { req, res, next, rec }
  }

  it(`allows up to ${FIT_RATE_MAX} requests in the window`, () => {
    for (let i = 0; i < FIT_RATE_MAX; i++) {
      const { req, res, next, rec } = makeReqRes('user-1')
      fitScoreRateLimit(req, res, next)
      expect(rec.nextCalled, `request ${i + 1}`).toBe(true)
      expect(rec.statusCode).toBeNull()
    }
  })

  it(`returns 429 on the ${FIT_RATE_MAX + 1}th request from the same user`, () => {
    for (let i = 0; i < FIT_RATE_MAX; i++) {
      const { req, res, next } = makeReqRes('user-1')
      fitScoreRateLimit(req, res, next)
    }
    const { req, res, next, rec } = makeReqRes('user-1')
    fitScoreRateLimit(req, res, next)
    expect(rec.nextCalled).toBe(false)
    expect(rec.statusCode).toBe(429)
    expect((rec.jsonBody as { error?: string })?.error).toMatch(/too many|slow down/i)
  })

  it('isolates buckets by user — one user being throttled doesn\'t affect another', () => {
    // Throttle user-1
    for (let i = 0; i <= FIT_RATE_MAX; i++) {
      const { req, res, next } = makeReqRes('user-1')
      fitScoreRateLimit(req, res, next)
    }
    // user-2 should still be free
    const { req, res, next, rec } = makeReqRes('user-2')
    fitScoreRateLimit(req, res, next)
    expect(rec.nextCalled).toBe(true)
    expect(rec.statusCode).toBeNull()
  })

  it('lets the request through when userId is missing (route handler will 400 it)', () => {
    const { req, res, next, rec } = makeReqRes(undefined)
    fitScoreRateLimit(req, res, next)
    expect(rec.nextCalled).toBe(true)
    expect(rec.statusCode).toBeNull()
  })
})

describe('coach fit-score — cache hash stability across calls', () => {
  // The route caches by (athleteHash, needsHash). If hashes drift across calls
  // for unchanged inputs we'd burn AI credits unnecessarily on every refresh.
  it('athlete hash is stable for identical profile reads', () => {
    const profile = pickAthleteFields({
      full_name: 'A',
      primary_position: 'Forward',
      gpa: 3.5,
      goals_last_season: 12,
    })
    const h1 = hashShape(profile)
    const h2 = hashShape(profile)
    const h3 = hashShape(pickAthleteFields({
      full_name: 'A',
      primary_position: 'Forward',
      gpa: 3.5,
      goals_last_season: 12,
    }))
    expect(h1).toBe(h2)
    expect(h1).toBe(h3)
  })

  it('needs hash changes when needs change', () => {
    const a = hashShape({ needs: [{ position: 'Forward', level: 'High' }], notes: '' })
    const b = hashShape({ needs: [{ position: 'Forward', level: 'Medium' }], notes: '' })
    expect(a).not.toBe(b)
  })

  it('needs hash changes when notes change', () => {
    const a = hashShape({ needs: [], notes: 'looking for a striker' })
    const b = hashShape({ needs: [], notes: 'looking for a midfielder' })
    expect(a).not.toBe(b)
  })
})
