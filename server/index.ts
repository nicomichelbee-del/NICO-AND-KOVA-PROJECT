import 'dotenv/config'
import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import aiRouter from './routes/ai'
import gmailRouter from './routes/gmail'
import campsRouter from './routes/camps'
import profileRouter from './routes/profile'
import publicRouter from './routes/public'
import coachRouter from './routes/coach'
import coachReplyRouter from './routes/coachReply'
import { requireCompleteProfile } from './lib/profileGate'
import { aiInteractiveLimiter } from './lib/rateLimits'

// Keep the API server alive on unexpected promise rejections (otherwise Node
// 15+ exits the process and every subsequent request gets ECONNREFUSED).
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})

const app = express()
const PORT = Number(process.env.PORT) || 3001

// Behind Railway/Vercel proxies — required so req.protocol returns 'https'
// and rate limiters / sitemap host detection work correctly.
app.set('trust proxy', true)

app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173' }))
app.use(express.json({ limit: '4mb' }))

// Profile router is exempt from the completeness gate — it's how athletes
// fill out their profile in the first place.
app.use('/api/profile', profileRouter)

// Public router has no auth gate — feeds the indexable /open-spots SEO pages.
// Drops coach contact info before responding so the data behind signup stays gated.
app.use('/api/public', publicRouter)

// Sitemap at the URL crawlers expect (root path), proxied to publicRouter.
app.get('/sitemap.xml', (req, res, next) => {
  req.url = '/sitemap'
  publicRouter(req, res, next)
})

// Every other authenticated feature router sits behind the gate. Anonymous
// callers still get rejected first (401), so this also tightens auth on
// routers that previously passed userId in the body.
app.use('/api/ai', requireCompleteProfile, aiInteractiveLimiter, aiRouter)
app.use('/api/gmail', requireCompleteProfile, gmailRouter)
app.use('/api/camps', requireCompleteProfile, aiInteractiveLimiter, campsRouter)
// Coach portal — does NOT use requireCompleteProfile (that gate is for athletes).
// Auth is enforced inside each handler via the userId/userEmail params.
app.use('/api/coach', coachRouter)
app.use('/api/coach', coachReplyRouter)

// Final error handler — turns any error forwarded by next(err) (including the
// async-wrapped throws from the gmail router) into a clean JSON response
// instead of a dangling socket. Surfaces "Supabase not configured" and
// similar startup-misconfiguration errors as a real HTTP response the client
// can show.
//
// Honors body-parser's statusCode (400 for malformed JSON). Previously every
// such error became a 500, which is wrong — client SDKs treat 5xx as
// retryable server bugs, but a malformed payload is a 4xx caller bug.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[express error]', err)
  const e = err as { statusCode?: number; status?: number; message?: string; expose?: boolean }
  const status = typeof e?.statusCode === 'number' ? e.statusCode
    : typeof e?.status === 'number' ? e.status
    : 500
  const message = err instanceof Error ? err.message : 'Internal server error'
  if (!res.headersSent) res.status(status).json({ error: message })
})

const server = app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`)
})

// Graceful shutdown — without this, tsx watch (Ctrl+C) can't kill the
// server cleanly because app.listen() keeps the event loop alive forever.
// Tsx escalates to SIGKILL after 5s, producing the "Process didn't exit
// in 5s. Force killing..." loop. Closing the HTTP server lets keep-alive
// connections drain and the event loop empty so Node exits naturally.
function shutdown(signal: string) {
  console.log(`[${signal}] shutting down…`)
  server.close(() => {
    console.log('[server] closed; exiting')
    process.exit(0)
  })
  // Hard timeout in case a hanging request prevents close() from firing.
  // Shorter than tsx's 5s SIGKILL escalation so we at least exit ourselves.
  setTimeout(() => {
    console.warn('[server] close() timed out after 3s; force exiting')
    process.exit(0)
  }, 3000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
