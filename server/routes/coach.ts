import { Router, type Request, type Response, type NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import rosterPrograms from '../data/rosterPrograms.json'
import { ask, parseJSON } from '../lib/aiClient'

// Simple in-memory rate limiter for the AI-calling fit-score endpoint.
//
// Why not express-rate-limit's aiInteractiveLimiter? In testing (express-
// rate-limit v8.5.1 on Node 24 + tsx) the singleton's keyGenerator silently
// failed to bucket localhost IPv6 requests when mounted on a sub-router —
// 35 rapid requests all passed even though the bare-express equivalent test
// correctly rate-limited the same import. Diagnosing the library quirk was
// out of scope; a 30-line custom counter is reliable and bounded.
//
// Bucket key = userId from the request body (this endpoint requires it
// anyway). One bucket per user, 60-second sliding window, max 30 calls.
// Memory is bounded by user count and we clear stale entries on each tick.
const FIT_RATE_WINDOW_MS = 60_000
const FIT_RATE_MAX = 30
interface RateBucket { hits: number[]; firstSeen: number }
const fitRateBuckets = new Map<string, RateBucket>()
function fitScoreRateLimit(req: Request, res: Response, next: NextFunction): void {
  const userId = (req.body as { userId?: string })?.userId
  // Skip the limiter if the body is malformed — the route handler returns
  // 400 on missing userId, so we let the request through to that error path.
  if (!userId || typeof userId !== 'string') { next(); return }
  const now = Date.now()
  const bucket = fitRateBuckets.get(userId) ?? { hits: [], firstSeen: now }
  // Drop hits outside the window
  bucket.hits = bucket.hits.filter((t) => now - t < FIT_RATE_WINDOW_MS)
  if (bucket.hits.length >= FIT_RATE_MAX) {
    res.status(429).json({
      error: 'Too many fit-score requests. Slow down — try again in a minute.',
    })
    return
  }
  bucket.hits.push(now)
  fitRateBuckets.set(userId, bucket)
  // Periodic cleanup: every ~500 ticks, drop buckets with no recent hits.
  if (fitRateBuckets.size > 500 && Math.random() < 0.01) {
    for (const [k, b] of fitRateBuckets) {
      if (b.hits.length === 0) fitRateBuckets.delete(k)
    }
  }
  next()
}

const router = Router()

interface RawProgram {
  id: string
  school: string
  conference: string
  division: string
  location: string
  gender: 'mens' | 'womens'
  coachName: string
  coachEmail: string
  typicalRecruitingNeeds: { position: string; level: 'High' | 'Medium' | 'Low' }[]
  formationStyle: string
  notes: string
}

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!url || !key || key === 'placeholder_anon_key') {
    throw new Error('Supabase not configured — set VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY')
  }
  return createClient(url, key)
}

function findProgram(schoolId: string, gender: 'mens' | 'womens'): RawProgram | undefined {
  return (rosterPrograms as RawProgram[]).find((p) => p.id === schoolId && p.gender === gender)
}

function shapeProgram(p: RawProgram, override?: { needs?: { position: string; level: 'High' | 'Medium' | 'Low' }[]; notes?: string }) {
  return {
    id: p.id,
    school: p.school,
    conference: p.conference,
    division: p.division,
    location: p.location,
    gender: p.gender,
    coachName: p.coachName,
    coachEmail: p.coachEmail,
    formationStyle: p.formationStyle,
    needs: override?.needs ?? p.typicalRecruitingNeeds,
    notes: override?.notes ?? p.notes,
  }
}

// ── Public: program search (no auth — used from the claim flow) ─────────────
router.get('/search', (req, res) => {
  const q = (req.query.q as string ?? '').trim().toLowerCase()
  if (!q) return res.json({ programs: [] })
  const matches = (rosterPrograms as RawProgram[])
    .filter((p) => p.school.toLowerCase().includes(q))
    .slice(0, 20)
    .map((p) => ({
      id: p.id, school: p.school, conference: p.conference,
      division: p.division, gender: p.gender, location: p.location,
    }))
  res.json({ programs: matches })
})

// ── Authenticated: claim a program ──────────────────────────────────────────
// Coach must be signed in via Supabase Auth (their email). We verify their
// auth-user email matches the program's coach_email in rosterPrograms.json
// before granting the claim.
router.post('/claim', async (req, res) => {
  const { userId, userEmail, schoolId, gender } = req.body as {
    userId: string; userEmail: string; schoolId: string; gender: 'mens' | 'womens'
  }
  if (!userId || !userEmail || !schoolId || !gender) {
    return res.status(400).json({ error: 'userId, userEmail, schoolId, gender required' })
  }
  const program = findProgram(schoolId, gender)
  if (!program) return res.status(404).json({ error: 'Program not found' })

  const emailMatches = program.coachEmail.toLowerCase() === userEmail.toLowerCase()
  // Also accept partial domain match — many coaches have multiple .edu addresses.
  const domainMatches = program.coachEmail.includes('@') &&
    userEmail.toLowerCase().endsWith('@' + program.coachEmail.split('@')[1].toLowerCase())

  if (!emailMatches && !domainMatches) {
    return res.status(403).json({
      error: `Your email must match the program's listed coach (${program.coachEmail}) or domain.`,
    })
  }

  const supabase = getSupabase()
  // Insert or take ownership if no other coach claimed this slot yet.
  const { data: existing } = await supabase
    .from('claimed_programs')
    .select('*')
    .eq('school_id', schoolId)
    .eq('gender', gender)
    .maybeSingle()

  if (existing && existing.coach_user_id && existing.coach_user_id !== userId) {
    return res.status(409).json({ error: 'This program is already claimed by another coach.' })
  }

  if (existing) {
    const { error } = await supabase
      .from('claimed_programs')
      .update({ coach_user_id: userId, coach_email: userEmail.toLowerCase(), is_verified: true })
      .eq('id', existing.id)
    if (error) return res.status(500).json({ error: error.message })
  } else {
    const { error } = await supabase.from('claimed_programs').insert({
      school_id: schoolId,
      school_name: program.school,
      gender,
      coach_email: userEmail.toLowerCase(),
      coach_name: program.coachName,
      coach_user_id: userId,
      is_verified: true,
    })
    if (error) return res.status(500).json({ error: error.message })
  }

  res.json({
    program: shapeProgram(program),
    claim: { schoolId, gender, claimedAt: new Date().toISOString() },
  })
})

// GET /api/coach/me?userId=
router.get('/me', async (req, res) => {
  const { userId } = req.query as { userId?: string }
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const { data } = await getSupabase()
    .from('claimed_programs')
    .select('*')
    .eq('coach_user_id', userId)
    .maybeSingle()
  if (!data) return res.json({ claim: null })

  const program = findProgram(data.school_id, data.gender)
  if (!program) return res.json({ claim: null })
  res.json({
    claim: {
      schoolId: data.school_id,
      gender: data.gender,
      coachEmail: data.coach_email,
      claimedAt: data.claimed_at,
    },
    program: shapeProgram(program, {
      needs: data.needs_overrides ?? undefined,
      notes: data.notes_override ?? undefined,
    }),
  })
})

// PATCH /api/coach/needs — coach updates their roster needs + notes
router.patch('/needs', async (req, res) => {
  const { userId, needs, notes } = req.body as {
    userId: string
    needs?: { position: string; level: 'High' | 'Medium' | 'Low' }[]
    notes?: string
  }
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const update: Record<string, unknown> = {}
  if (needs !== undefined) update.needs_overrides = needs
  if (notes !== undefined) update.notes_override = notes
  if (Object.keys(update).length === 0) return res.status(400).json({ error: 'no fields to update' })
  const { error } = await getSupabase()
    .from('claimed_programs')
    .update(update)
    .eq('coach_user_id', userId)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

// GET /api/coach/inbound?userId=
// List athletes who've emailed this coach via KickrIQ (looked up by coach email
// against the existing outreach_contacts table). Free, no AI cost.
router.get('/inbound', async (req, res) => {
  const { userId } = req.query as { userId?: string }
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const supabase = getSupabase()

  const { data: claim } = await supabase
    .from('claimed_programs')
    .select('coach_email, school_id, school_name, gender')
    .eq('coach_user_id', userId)
    .maybeSingle()
  if (!claim) return res.json({ athletes: [] })

  // Pull every consent row for this coach. Athletes appear once per
  // coach_email — even if they emailed twice — because of the unique index.
  const { data: consents } = await supabase
    .from('coach_inbound_consents')
    .select('athlete_id, outreach_id, created_at')
    .ilike('coach_email', claim.coach_email)
    .eq('consent', true)
    .order('created_at', { ascending: false })
    .limit(200)

  if (!consents || consents.length === 0) return res.json({ athletes: [] })

  const athleteIds = [...new Set(consents.map((c: any) => c.athlete_id))]

  // Athlete profile + outreach contact join — both keyed on athlete user ids.
  const [{ data: profiles }, { data: contacts }] = await Promise.all([
    supabase
      .from('athlete_profiles')
      .select('user_id, slug, full_name, primary_position, secondary_position, graduation_year, gpa, current_club, current_league_or_division, height_cm, intended_major, profile_photo_url, highlight_video_url, city, state, desired_division_levels')
      .in('user_id', athleteIds),
    supabase
      .from('outreach_contacts')
      .select('id, user_id, status, interest_rating, last_reply_at, last_reply_snippet, gmail_thread_id, created_at')
      .in('user_id', athleteIds)
      .ilike('coach_email', claim.coach_email),
  ])

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]))
  // One outreach row per (athlete, coach) — pick the most recent if duplicates.
  const contactMap = new Map<string, any>()
  for (const c of contacts ?? []) {
    const prev = contactMap.get(c.user_id)
    if (!prev || new Date(c.created_at) > new Date(prev.created_at)) contactMap.set(c.user_id, c)
  }

  const athletes = consents.map((cs: any) => {
    const p = profileMap.get(cs.athlete_id)
    const c = contactMap.get(cs.athlete_id)
    return {
      consentId: cs.athlete_id,
      athleteId: cs.athlete_id,
      consentedAt: cs.created_at,
      // Profile (only present if athlete has completed profile + visibility allows)
      name: p?.full_name ?? 'KickrIQ Athlete',
      slug: p?.slug ?? null,
      position: p?.primary_position ?? null,
      secondaryPosition: p?.secondary_position ?? null,
      gradYear: p?.graduation_year ?? null,
      gpa: p?.gpa ?? null,
      club: p?.current_club ?? null,
      clubLeague: p?.current_league_or_division ?? null,
      heightCm: p?.height_cm ?? null,
      intendedMajor: p?.intended_major ?? null,
      photoUrl: p?.profile_photo_url ?? null,
      highlightUrl: p?.highlight_video_url ?? null,
      location: [p?.city, p?.state].filter(Boolean).join(', '),
      desiredDivisions: p?.desired_division_levels ?? [],
      // Outreach status (may be missing if the consent row exists but no contact)
      contactId: c?.id ?? null,
      status: c?.status ?? 'contacted',
      interestRating: c?.interest_rating ?? 'pending',
      lastReplyAt: c?.last_reply_at ?? null,
      lastReplySnippet: c?.last_reply_snippet ?? null,
      gmailThreadId: c?.gmail_thread_id ?? null,
    }
  })

  res.json({ athletes })
})

// ── AI fit-score (Phase 2) ────────────────────────────────────────────────
// Coach requests a fit assessment for one athlete in their inbound feed.
// Returns { score (1-10), oneLine, strengths[], concerns[] }. Result is
// cached in coach_fit_scores keyed on (coach_user_id, athlete_id). The
// cached row stores hashes of the inputs that fed the prompt — when either
// the athlete's profile fields or the coach's needs change, the next read
// detects the stale hash and recomputes (one AI call), otherwise the
// cached row is returned without hitting Anthropic.
//
// Charged to Anthropic credits per recompute (~$0.002 per call). Caching is
// non-negotiable for coaches scrolling a feed of dozens of athletes.

interface FitScoreResult {
  score: number
  oneLine: string
  strengths: string[]
  concerns: string[]
}

const ALLOWED_ATHLETE_FIELDS = [
  'full_name', 'primary_position', 'secondary_position', 'graduation_year',
  'gpa', 'current_club', 'current_league_or_division', 'intended_major',
  'height_cm', 'highlight_video_url', 'desired_division_levels',
  'goals_last_season', 'assists_last_season',
] as const

// Stable canonical JSON — sorts object keys at every depth so semantically
// equivalent payloads serialize identically. Plain JSON.stringify with a
// replacer array does NOT do this: the replacer is also a deep whitelist,
// which silently strips nested keys not in the top-level list. That was the
// original bug — every coach_fit_scores cache key looked unique but the
// hashed payload was empty objects, so unrelated athletes shared cache rows.
function canonicalJSON(value: unknown): string {
  if (value === undefined || value === null) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']'
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJSON(obj[k])).join(',') + '}'
}

function hashShape(input: unknown): string {
  // 16 hex chars is enough collision-resistance for a per-coach cache row
  // (we're using it as a stale-detector, not a security primitive).
  return crypto.createHash('sha256').update(canonicalJSON(input)).digest('hex').slice(0, 16)
}

function pickAthleteFields(row: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!row) return {}
  const out: Record<string, unknown> = {}
  for (const k of ALLOWED_ATHLETE_FIELDS) out[k] = row[k] ?? null
  return out
}

function buildFitPrompt(
  gender: 'mens' | 'womens',
  programName: string,
  programDivision: string,
  needs: { position: string; level: 'High' | 'Medium' | 'Low' }[],
  notes: string,
  athlete: Record<string, unknown>,
): string {
  const genderLabel = gender === 'womens' ? "women's" : "men's"
  const needsLines = needs.length
    ? needs.map((n) => `  - ${n.position}: ${n.level} need`).join('\n')
    : '  (no specific roster needs set)'
  return `You are an experienced ${genderLabel} college soccer recruiting coordinator at ${programName} (${programDivision}). Assess how well the inbound athlete below fits your current program needs.

Program needs (set by the head coach):
${needsLines}

Coach's notes about the program: ${notes || '(none)'}

Athlete profile (only what they've shared via KickrIQ):
${JSON.stringify(athlete, null, 2)}

Return JSON only:
{
  "score": 1-10 integer,
  "oneLine": "single sentence verdict — does this athlete fit your needs right now?",
  "strengths": ["2-4 short bullet strings — concrete things that make this athlete a fit"],
  "concerns": ["1-3 short bullet strings — concrete things to verify or that don't fit yet"]
}

Scoring rubric (calibrate to ${genderLabel} ${programDivision} recruiting):
  1-3: clear mismatch — wrong position level, wrong tier, or critical info missing
  4-5: marginal fit — possible if other factors line up but not a priority
  6-7: solid fit — clears the bar for this program, worth a conversation
  8-9: strong fit — addresses an actual need, profile is recruitable at this tier
  10: rare — exact-fit on position, level, and timing

Honesty rules:
  - If the athlete's profile is sparse (e.g. no GPA, no stats), say so in concerns. Don't pad the score for missing data.
  - Reference specific fields from the profile in strengths/concerns (e.g. "3.7 GPA clears your academic floor", not "good academics").
  - Strengths and concerns must each be specific to THIS athlete + THIS program need — no generic recruiting advice.
  - Output ONLY the JSON object. No preamble, no markdown fences.`
}

// Rate-limit applied directly on the route because /api/coach is mounted
// without the global limiter (the rest of the coach router is pure DB reads —
// only this endpoint hits Anthropic). 30 calls/min/user is enough for an
// active session of scoring a feed but caps the worst case if a coach holds
// down the "regenerate" button or a script spams it.
router.post('/inbound/:athleteId/fit', fitScoreRateLimit, async (req, res) => {
  try {
    const { athleteId } = req.params as { athleteId: string }
    const { userId, refresh } = req.body as { userId: string; refresh?: boolean }
    if (!userId || !athleteId) {
      return res.status(400).json({ error: 'userId and athleteId required' })
    }
    const supabase = getSupabase()

    // Verify the coach owns a claim AND has consented access to this athlete.
    // Reuses the same join the inbound feed uses, so a coach can never score
    // an athlete that hasn't opted in to share with them.
    //
    // We log Supabase errors server-side because the previous "silently
    // treat any error as no-row" pattern surfaced misleading 404/403s when
    // the underlying issue was a network failure or RLS misconfiguration.
    // The user-facing error stays generic; only the server log distinguishes.
    const { data: claim, error: claimErr } = await supabase
      .from('claimed_programs')
      .select('school_id, school_name, gender, coach_email, needs_overrides, notes_override')
      .eq('coach_user_id', userId)
      .maybeSingle()
    if (claimErr) console.error('[coach/fit] claim lookup failed:', claimErr.message)
    if (!claim) return res.status(404).json({ error: 'No claimed program for this coach' })
    if (claim.gender !== 'mens' && claim.gender !== 'womens') {
      return res.status(400).json({ error: 'Claim missing gender — re-claim program' })
    }

    const { data: consent, error: consentErr } = await supabase
      .from('coach_inbound_consents')
      .select('id')
      .eq('athlete_id', athleteId)
      .ilike('coach_email', claim.coach_email)
      .eq('consent', true)
      .limit(1)
      .maybeSingle()
    if (consentErr) console.error('[coach/fit] consent lookup failed:', consentErr.message)
    if (!consent) return res.status(403).json({ error: 'This athlete has not shared their profile with you' })

    const { data: athleteRow, error: athleteErr } = await supabase
      .from('athlete_profiles')
      .select('full_name, primary_position, secondary_position, graduation_year, gpa, current_club, current_league_or_division, intended_major, height_cm, highlight_video_url, desired_division_levels, goals_last_season, assists_last_season')
      .eq('user_id', athleteId)
      .maybeSingle()
    if (athleteErr) console.error('[coach/fit] athlete lookup failed:', athleteErr.message)
    if (!athleteRow) return res.status(404).json({ error: 'Athlete profile not found' })

    const athletePayload = pickAthleteFields(athleteRow as Record<string, unknown>)
    const needs = (claim.needs_overrides ?? []) as { position: string; level: 'High' | 'Medium' | 'Low' }[]
    const notes = (claim.notes_override ?? '') as string

    const athleteHash = hashShape(athletePayload)
    const needsHash = hashShape({ needs, notes })

    // Cache lookup — return cached row if hashes still match AND the caller
    // didn't pass refresh=true. Refresh bypass is for the "regenerate" button
    // in the UI when a coach wants a second opinion without editing inputs.
    if (!refresh) {
      const { data: cached } = await supabase
        .from('coach_fit_scores')
        .select('*')
        .eq('coach_user_id', userId)
        .eq('athlete_id', athleteId)
        .maybeSingle()
      if (cached && cached.athlete_hash === athleteHash && cached.needs_hash === needsHash) {
        return res.json({
          fit: {
            score: cached.score,
            oneLine: cached.one_line,
            strengths: cached.strengths ?? [],
            concerns: cached.concerns ?? [],
          },
          cached: true,
          generatedAt: cached.created_at,
        })
      }
    }

    // AI call. Default JSON shape covers parser failures so the UI doesn't
    // crash on malformed responses.
    const programName = (typeof claim.school_name === 'string' && claim.school_name.trim())
      ? claim.school_name
      : 'this program'
    const prompt = buildFitPrompt(
      claim.gender as 'mens' | 'womens',
      programName,
      'College',
      needs,
      notes,
      athletePayload,
    )
    const text = await ask(prompt, 500)
    const parsed = parseJSON<Partial<FitScoreResult>>(text, {})
    const rawScore = Number(parsed.score)
    const score = Number.isFinite(rawScore)
      ? Math.max(1, Math.min(10, Math.round(rawScore)))
      : 5
    // Log when we fall back so an upstream model regression is debuggable
    // rather than silently producing useless cache rows.
    if (!Number.isFinite(rawScore) || typeof parsed.oneLine !== 'string') {
      console.warn('[coach/fit] AI returned malformed fit JSON for athlete', athleteId, '— first 200 chars:', text.slice(0, 200))
    }
    // Defensive length caps — a pathological AI response with multi-kilobyte
    // strengths/concerns strings would bloat the cache row and ugly the UI.
    // 240 chars is room for a sentence; we trim with ellipsis to signal cap.
    const capString = (s: string, max = 240): string =>
      s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…'
    const fit: FitScoreResult = {
      score,
      oneLine: typeof parsed.oneLine === 'string' && parsed.oneLine.trim()
        ? capString(parsed.oneLine.trim(), 280)
        : 'Fit assessment unavailable — re-run for a fresh take.',
      strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .map((s) => capString(s.trim()))
            .slice(0, 4)
        : [],
      concerns: Array.isArray(parsed.concerns)
        ? parsed.concerns
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .map((s) => capString(s.trim()))
            .slice(0, 3)
        : [],
    }

    // Upsert the cache row. On conflict (coach_user_id, athlete_id) we update
    // every field — the new score replaces the old one. We use the service key
    // so this works regardless of the RLS policy. Log failures because a
    // silent cache-write failure would cause every page load to burn an AI
    // call (defeats the entire point of the cache).
    const { error: upsertErr } = await supabase
      .from('coach_fit_scores')
      .upsert({
        coach_user_id: userId,
        athlete_id: athleteId,
        score: fit.score,
        one_line: fit.oneLine,
        strengths: fit.strengths,
        concerns: fit.concerns,
        athlete_hash: athleteHash,
        needs_hash: needsHash,
        created_at: new Date().toISOString(),
      }, { onConflict: 'coach_user_id,athlete_id' })
    if (upsertErr) console.error('[coach/fit] cache upsert failed:', upsertErr.message)

    res.json({ fit, cached: false, generatedAt: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to score fit' })
  }
})

// Export internals so vitest can exercise the deterministic helpers without
// needing a Supabase + Anthropic round-trip. The route itself is integration-
// tested live via curl in the smoke pass.
export const __testables = {
  hashShape,
  pickAthleteFields,
  buildFitPrompt,
  fitScoreRateLimit,
  fitRateBuckets,
  FIT_RATE_MAX,
}

export default router
