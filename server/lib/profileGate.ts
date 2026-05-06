import type { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

// Verifies the Supabase JWT on every authenticated route. Rejects anonymous
// callers with 401 — closes the loophole where /api/ai/* would happily run
// (and burn Anthropic credits) for any caller that knew the URL.
//
// Profile-completeness checks live on the client (RequireCompleteProfile)
// during the in-progress profile refactor; once profiles persist in Postgres
// we can reinstate the server-side completeness check here.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string | null }
    }
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? ''

// One reusable client. Anon key is enough for verifying a user-supplied JWT —
// supabase.auth.getUser(token) returns the user on a valid token.
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

export async function requireCompleteProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Misconfigured envs shouldn't 200 a request silently — fail closed.
  if (!supabase) {
    return res
      .status(500)
      .json({ error: 'Server is missing Supabase env vars; auth cannot be verified.' })
  }

  const header = req.headers.authorization ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) {
    return res.status(401).json({ error: 'Missing Authorization bearer token.' })
  }
  const token = match[1].trim()

  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired session.' })
    }
    req.user = { id: data.user.id, email: data.user.email ?? null }
    next()
  } catch {
    return res.status(401).json({ error: 'Auth verification failed.' })
  }
}
