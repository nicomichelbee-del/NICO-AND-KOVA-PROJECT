import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import aiRouter from './routes/ai'
import gmailRouter from './routes/gmail'
import campsRouter from './routes/camps'
import profileRouter from './routes/profile'
import { requireCompleteProfile } from './lib/profileGate'

const app = express()
const PORT = 3001

app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173' }))
app.use(express.json({ limit: '4mb' }))

// Profile router is exempt from the completeness gate — it's how athletes
// fill out their profile in the first place.
app.use('/api/profile', profileRouter)

// Every other authenticated feature router sits behind the gate. Anonymous
// callers still get rejected first (401), so this also tightens auth on
// routers that previously passed userId in the body.
app.use('/api/ai', requireCompleteProfile, aiRouter)
app.use('/api/gmail', requireCompleteProfile, gmailRouter)
app.use('/api/camps', requireCompleteProfile, campsRouter)

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
