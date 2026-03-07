import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { analyzeRequester } from '../services/agent.js'

const router = Router()
router.use(authMiddleware)

const suggestSchema = z.object({
  requesterAddress: z.string().min(58).max(58),
  dataCategory: z.string(),
  requestedExpiryDays: z.number().min(1).max(365),
})

router.post('/suggest', async (req, res, next) => {
  try {
    const { requesterAddress, dataCategory, requestedExpiryDays } = suggestSchema.parse(req.body)
    const suggestion = await analyzeRequester(requesterAddress, dataCategory, requestedExpiryDays)
    res.json({ success: true, data: suggestion, error: null })
  } catch (err) {
    next(err)
  }
})

export default router
