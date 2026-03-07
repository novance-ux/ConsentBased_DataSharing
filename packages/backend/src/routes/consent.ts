import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()
router.use(authMiddleware)

const requestSchema = z.object({
  dataCategoryId: z.string(),
  message: z.string().min(10).max(500),
  requestedExpiryDays: z.number().min(1).max(365).optional(),
})

router.post('/request', async (req, res, next) => {
  try {
    const data = requestSchema.parse(req.body)
    const requesterId = req.user!.sub

    const category = await prisma.dataUpload.findUniqueOrThrow({
      where: { id: data.dataCategoryId },
    })

    const consentReq = await prisma.consentRequest.create({
      data: {
        dataUploadId: category.id,
        requesterId,
        studentId: category.ownerId,
        dataCategory: category.category,
        message: data.message,
        requestedExpiry: data.requestedExpiryDays
          ? new Date(Date.now() + data.requestedExpiryDays * 86400000)
          : null,
      },
    })

    res.json({ success: true, data: { consentRequest: consentReq }, error: null })
  } catch (err) {
    next(err)
  }
})

router.get('/incoming', async (req, res, next) => {
  try {
    const userId = req.user!.sub
    const requests = await prisma.consentRequest.findMany({
      where: { studentId: userId },
      include: { requester: true, dataUpload: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: { requests }, error: null })
  } catch (err) {
    next(err)
  }
})

router.get('/outgoing', async (req, res, next) => {
  try {
    const userId = req.user!.sub
    const requests = await prisma.consentRequest.findMany({
      where: { requesterId: userId },
      include: { student: true, dataUpload: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: { requests }, error: null })
  } catch (err) {
    next(err)
  }
})

router.post('/grant/:requestId', async (req, res, next) => {
  try {
    const userId = req.user!.sub
    const requestId = req.params.requestId

    const consentReq = await prisma.consentRequest.findUniqueOrThrow({
      where: { id: requestId },
    })

    if (consentReq.studentId !== userId) {
      res.status(403).json({ success: false, error: 'Not authorized', data: null })
      return
    }

    const updated = await prisma.consentRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        respondedAt: new Date(),
      },
    })

    await prisma.auditEntry.create({
      data: {
        userId,
        action: 'consent_grant',
        resourceId: requestId,
        metadata: JSON.stringify({ requesterId: consentReq.requesterId }),
      },
    })

    res.json({ success: true, data: { consentRequest: updated }, error: null })
  } catch (err) {
    next(err)
  }
})

router.post('/revoke/:requestId', async (req, res, next) => {
  try {
    const userId = req.user!.sub
    const requestId = req.params.requestId

    const consentReq = await prisma.consentRequest.findUniqueOrThrow({
      where: { id: requestId },
    })

    if (consentReq.studentId !== userId) {
      res.status(403).json({ success: false, error: 'Not authorized', data: null })
      return
    }

    const updated = await prisma.consentRequest.update({
      where: { id: requestId },
      data: { status: 'REVOKED' },
    })

    await prisma.auditEntry.create({
      data: {
        userId,
        action: 'consent_revoke',
        resourceId: requestId,
        metadata: JSON.stringify({ requesterId: consentReq.requesterId }),
      },
    })

    res.json({ success: true, data: { consentRequest: updated }, error: null })
  } catch (err) {
    next(err)
  }
})

router.get('/active', async (req, res, next) => {
  try {
    const userId = req.user!.sub
    const consents = await prisma.consentRequest.findMany({
      where: { studentId: userId, status: 'APPROVED' },
      include: { requester: true, dataUpload: true },
      orderBy: { respondedAt: 'desc' },
    })
    res.json({ success: true, data: { consents }, error: null })
  } catch (err) {
    next(err)
  }
})

// Search student uploads by wallet address (for requesters)
router.get('/search-student', async (req, res, next) => {
  try {
    const address = z.string().min(1).parse(req.query.address)
    const user = await prisma.user.findUnique({
      where: { walletAddress: address },
    })
    if (!user) {
      res.json({ success: true, data: { student: null, uploads: [] }, error: null })
      return
    }
    const uploads = await prisma.dataUpload.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: { student: { id: user.id, walletAddress: user.walletAddress, name: user.name }, uploads }, error: null })
  } catch (err) {
    next(err)
  }
})

export default router
