import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import aiRouter from './routes/ai'
import gmailRouter from './routes/gmail'

const app = express()
const PORT = 3001

app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173' }))
app.use(express.json())
app.use('/api/ai', aiRouter)
app.use('/api/gmail', gmailRouter)

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
