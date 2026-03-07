import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

// Stats is public so landing page can show live numbers
router.get('/stats', async (_req, res, next) => {
  try {
    const totalStudents = await prisma.user.count({ where: { role: 'STUDENT' } })
    const totalConsents = await prisma.consentRequest.count({ where: { status: 'APPROVED' } })
    const totalRevocations = await prisma.consentRequest.count({ where: { status: 'REVOKED' } })
    const totalRequesters = await prisma.user.count({ where: { role: 'REQUESTER' } })
    const totalDownloads = await prisma.auditEntry.count({ where: { action: 'download' } })

    res.json({
      success: true,
      data: { totalStudents, totalConsents, totalRevocations, totalRequesters, totalDownloads },
      error: null,
    })
  } catch (err) {
    next(err)
  }
})

// Auth required for all routes below
router.use(authMiddleware)

const issueSchema = z.object({
  studentAddress: z.string().min(58).max(58),
  studentId: z.string().min(1),
})

router.post('/issue-credential', async (req, res, next) => {
  try {
    const data = issueSchema.parse(req.body)

    let user = await prisma.user.findUnique({
      where: { walletAddress: data.studentAddress },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: data.studentAddress,
          role: 'STUDENT',
          name: data.studentId,
        },
      })
    }

    // TODO: Call credential_issuer smart contract to mint NFT
    // For now, mark user as having a credential
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { credentialAsaId: 'pending-deployment' },
    })

    await prisma.auditEntry.create({
      data: {
        userId: user.id,
        action: 'credential_issue',
        metadata: JSON.stringify({ studentId: data.studentId }),
      },
    })

    res.json({ success: true, data: { user: updated }, error: null })
  } catch (err) {
    next(err)
  }
})

export default router
