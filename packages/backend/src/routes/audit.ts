import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/by-address/:address', async (req, res, next) => {
  try {
    const address = req.params.address

    const user = await prisma.user.findUnique({
      where: { walletAddress: address },
    })

    if (!user) {
      res.json({ success: true, data: { entries: [] }, error: null })
      return
    }

    const entries = await prisma.auditEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: { entries }, error: null })
  } catch (err) {
    next(err)
  }
})

export default router
