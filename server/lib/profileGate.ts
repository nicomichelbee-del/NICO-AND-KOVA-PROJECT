import type { Request, Response, NextFunction } from 'express'

// Stub middleware — the real version verifies Supabase auth and checks
// that the athlete's profile row is marked complete. While the profile
// system is being rebuilt, let every request through so the dashboard
// keeps working.
export function requireCompleteProfile(_req: Request, _res: Response, next: NextFunction) {
  next()
}
