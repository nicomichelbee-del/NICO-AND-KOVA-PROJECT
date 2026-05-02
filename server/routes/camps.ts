import { Router } from 'express'
import type { Request, Response } from 'express'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const router = Router()

function getSupabase(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!url || !key || key === 'placeholder_anon_key') {
    throw new Error('Supabase not configured — set VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY')
  }
  return createClient(url, key)
}

async function getUserIdFromAuth(req: Request): Promise<string | null> {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null
  const { data, error } = await getSupabase().auth.getUser(token)
  if (error || !data?.user) return null
  return data.user.id
}

router.get('/:campId/summary', async (req: Request, res: Response) => {
  try {
    const campId = req.params.campId
    const supabase = getSupabase()
    const { data: ratings, error } = await supabase
      .from('camp_ratings')
      .select('rating, user_id')
      .eq('camp_id', campId)
    if (error) throw error
    const ratingCount = ratings?.length ?? 0
    const averageRating = ratingCount > 0
      ? (ratings!.reduce((s, r) => s + r.rating, 0) / ratingCount)
      : 0
    let userRating: number | null = null
    const userId = await getUserIdFromAuth(req)
    if (userId && ratings) {
      userRating = ratings.find((r) => r.user_id === userId)?.rating ?? null
    }
    res.json({
      campId,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingCount,
      userRating,
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load summary' })
  }
})

router.get('/:campId/comments', async (req: Request, res: Response) => {
  try {
    const campId = req.params.campId
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200)
    const { data, error } = await getSupabase()
      .from('camp_comments')
      .select('id, camp_id, user_id, display_name, body, created_at')
      .eq('camp_id', campId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    const comments = (data ?? []).map((c) => ({
      id: c.id,
      campId: c.camp_id,
      userId: c.user_id,
      displayName: c.display_name,
      body: c.body,
      createdAt: c.created_at,
    }))
    res.json({ comments })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to load comments' })
  }
})

router.post('/:campId/rate', async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromAuth(req)
    if (!userId) return res.status(401).json({ error: 'Sign in to rate a camp.' })
    const campId = req.params.campId
    const rating = Number(req.body?.rating)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer 1–5.' })
    }
    const { error } = await getSupabase()
      .from('camp_ratings')
      .upsert(
        { user_id: userId, camp_id: campId, rating, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,camp_id' },
      )
    if (error) throw error
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to save rating' })
  }
})

router.post('/:campId/comment', async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromAuth(req)
    if (!userId) return res.status(401).json({ error: 'Sign in to leave a comment.' })
    const campId = req.params.campId
    const body = String(req.body?.body ?? '').trim()
    const displayName = String(req.body?.displayName ?? 'Anonymous').trim().slice(0, 60) || 'Anonymous'
    if (!body || body.length > 2000) {
      return res.status(400).json({ error: 'Comment must be 1–2000 characters.' })
    }
    const { data, error } = await getSupabase()
      .from('camp_comments')
      .insert({ user_id: userId, camp_id: campId, body, display_name: displayName })
      .select('id, camp_id, user_id, display_name, body, created_at')
      .single()
    if (error) throw error
    res.json({
      comment: {
        id: data.id,
        campId: data.camp_id,
        userId: data.user_id,
        displayName: data.display_name,
        body: data.body,
        createdAt: data.created_at,
      },
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to save comment' })
  }
})

router.delete('/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const userId = await getUserIdFromAuth(req)
    if (!userId) return res.status(401).json({ error: 'Sign in to delete a comment.' })
    const commentId = req.params.commentId
    const { error } = await getSupabase()
      .from('camp_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId)
    if (error) throw error
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to delete comment' })
  }
})

export default router
