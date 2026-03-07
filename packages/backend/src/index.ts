import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { errorHandler } from './middleware/errorHandler.js'
import authRoutes from './routes/auth.js'
import dataRoutes from './routes/data.js'
import consentRoutes from './routes/consent.js'
import auditRoutes from './routes/audit.js'
import agentRoutes from './routes/agent.js'
import adminRoutes from './routes/admin.js'

const app = express()
const PORT = parseInt(process.env.PORT || '3001')

// Middleware
app.use(cors())
app.use(helmet())
app.use(morgan('dev'))
app.use(express.json({ limit: '50mb' }))

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/data', dataRoutes)
app.use('/api/v1/consent', consentRoutes)
app.use('/api/v1/audit', auditRoutes)
app.use('/api/v1/agent', agentRoutes)
app.use('/api/v1/admin', adminRoutes)

// Error handler
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`[ConsentChain API] Server running on http://localhost:${PORT}`)
  console.log(`[ConsentChain API] Health check: http://localhost:${PORT}/api/health`)
})

export default app
