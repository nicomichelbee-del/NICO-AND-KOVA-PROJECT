import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import rosterPrograms from '../data/rosterPrograms.json'

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

export default router
