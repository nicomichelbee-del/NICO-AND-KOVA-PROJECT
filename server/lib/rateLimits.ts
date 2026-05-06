import rateLimit, { type Options } from 'express-rate-limit'
import type { Request } from 'express'

// Per-user (or per-IP for unauthed paths) limiters.
// The /api/ai routes are the expensive ones — every call hits Anthropic and
// costs real money. The limits below are generous for legitimate athletes
// (a normal session is ~10–20 calls) and tight enough to neuter scraping or
// a leaked token spamming requests overnight.

function userKey(req: Request): string {
  return req.user?.id ?? req.ip ?? 'anonymous'
}

function buildLimiter(opts: Partial<Options> & { windowMs: number; max: number }) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: userKey,
    handler: (_req, res) =>
      res.status(429).json({
        error:
          'Too many requests. Slow down — if this is a bug, email infokickriq@gmail.com.',
      }),
    ...opts,
  })
}

// Generous "are you a real human" limiter for the dashboard's interactive routes.
export const aiInteractiveLimiter = buildLimiter({
  windowMs: 60_000,
  max: 30,
})

// Tighter limiter for the truly expensive operations (video frame analysis,
// long school-matching prompts). Caps the worst-case per-user spend.
export const aiHeavyLimiter = buildLimiter({
  windowMs: 60_000,
  max: 8,
})
