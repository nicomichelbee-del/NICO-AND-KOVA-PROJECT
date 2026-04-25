import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import aiRouter from './routes/ai'

const app = express()
const PORT = 3001

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())
app.use('/api/ai', aiRouter)

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
