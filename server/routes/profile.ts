import { Router } from 'express'

// Stub profile router — the real version reads/writes the Supabase
// profiles table. While the profile system is being rebuilt, return
// 501 so client calls fail loudly instead of silently corrupting state.
const router = Router()

router.all('*', (_req, res) => {
  res.status(501).json({ error: 'Profile API is being rebuilt.' })
})

export default router
