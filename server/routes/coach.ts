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
    .select('coach_email, school_id')
    .eq('coach_user_id', userId)
    .maybeSingle()
  if (!claim) return res.json({ athletes: [] })

  // Cross-reference any outreach_contact whose coach_email matches this coach.
  const { data: contacts } = await supabase
    .from('outreach_contacts')
    .select('*')
    .ilike('coach_email', claim.coach_email)
    .order('created_at', { ascending: false })
    .limit(100)

  // Drop user_id from the response — we don't expose other athletes' user ids
  // to the coach, but we do show their school + outreach metadata.
  const shaped = (contacts ?? []).map((c: any) => ({
    id: c.id,
    athleteEmail: c.user_id,  // user id only — not their actual email
    schoolName: c.school_name,
    division: c.division,
    position: c.position,
    status: c.status,
    interestRating: c.interest_rating,
    lastReplyAt: c.last_reply_at,
    createdAt: c.created_at,
  }))
  res.json({ athletes: shaped })
})

export default router
