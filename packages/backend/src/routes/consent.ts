import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { grantConsentOnChain, revokeConsentOnChain, logActionOnChain, LOG_ACTION, getExplorerTxUrl } from '../services/algorand.js'

const router = Router()
router.use(authMiddleware)

const requestSchema = z.object({
  dataCategoryId: z.string(),
  message: z.string().min(10).max(500),
  requestedExpiryDays: z.number().min(1).max(365).optional(),
})

router.post('/request', async (req, res, next) => {
  try {
    if (req.user!.role !== 'REQUESTER') {
      res.status(403).json({ success: false, error: 'Requester access required', data: null })
      return
    }

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

    // Fetch the linked DataUpload to get the IPFS CID for the on-chain call
    const upload = consentReq.dataUploadId
      ? await prisma.dataUpload.findUnique({ where: { id: consentReq.dataUploadId } })
      : null
    const requester = await prisma.user.findUnique({ where: { id: consentReq.requesterId } })
    const student = await prisma.user.findUnique({ where: { id: userId } })

    let consentAsaId: string | null = null
    let txnId: string | null = null
    let explorerUrl: string | null = null

    // Call ConsentManager smart contract on-chain
    if (student?.walletAddress && requester?.walletAddress && upload?.ipfsCid) {
      try {
        const result = await grantConsentOnChain(
          student.walletAddress,
          requester.walletAddress,
          upload.ipfsCid,
          consentReq.dataCategory || 'general',
          consentReq.requestedExpiry
            ? Math.ceil((consentReq.requestedExpiry.getTime() - Date.now()) / 86400000)
            : 30,
        )
        if (result) {
          consentAsaId = result.consentAsaId.toString()
          txnId = result.txnId
          explorerUrl = getExplorerTxUrl(result.txnId)
        }
      } catch (err) {
        console.error('On-chain consent grant failed, falling back to local:', err)
      }
    }

    // Also log to on-chain access logger
    try {
      const logResult = await logActionOnChain(
        LOG_ACTION.CONSENT_GRANT,
        requester?.walletAddress || 'unknown',
        upload?.ipfsCid || requestId,
      )
      if (logResult && !txnId) txnId = logResult.txnId
    } catch (err) {
      console.error('On-chain log failed:', err)
    }

    const updated = await prisma.consentRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        respondedAt: new Date(),
        consentAsaId,
        txnId,
      },
    })

    await prisma.auditEntry.create({
      data: {
        userId,
        action: 'consent_grant',
        resourceId: requestId,
        txnId,
        metadata: JSON.stringify({ requesterId: consentReq.requesterId, consentAsaId, explorerUrl }),
      },
    })

    res.json({ success: true, data: { consentRequest: updated, txnId, explorerUrl }, error: null })
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

    // Fetch related records for on-chain call
    const upload = consentReq.dataUploadId
      ? await prisma.dataUpload.findUnique({ where: { id: consentReq.dataUploadId } })
      : null
    const requester = await prisma.user.findUnique({ where: { id: consentReq.requesterId } })
    const student = await prisma.user.findUnique({ where: { id: userId } })

    let txnId: string | null = null
    let explorerUrl: string | null = null

    // Call ConsentManager.revoke_consent on-chain
    if (student?.walletAddress && requester?.walletAddress && upload?.ipfsCid) {
      try {
        const result = await revokeConsentOnChain(
          student.walletAddress,
          requester.walletAddress,
          upload.ipfsCid,
        )
        if (result) {
          txnId = result.txnId
          explorerUrl = getExplorerTxUrl(result.txnId)
        }
      } catch (err) {
        console.error('On-chain consent revoke failed, falling back to local:', err)
      }
    }

    // Also log to on-chain access logger
    try {
      const logResult = await logActionOnChain(
        LOG_ACTION.CONSENT_REVOKE,
        requester?.walletAddress || 'unknown',
        upload?.ipfsCid || requestId,
      )
      if (logResult && !txnId) txnId = logResult.txnId
    } catch (err) {
      console.error('On-chain log failed:', err)
    }

    const updated = await prisma.consentRequest.update({
      where: { id: requestId },
      data: { status: 'REVOKED', txnId },
    })

    await prisma.auditEntry.create({
      data: {
        userId,
        action: 'consent_revoke',
        resourceId: requestId,
        txnId,
        metadata: JSON.stringify({ requesterId: consentReq.requesterId, explorerUrl }),
      },
    })

    res.json({ success: true, data: { consentRequest: updated, txnId, explorerUrl }, error: null })
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
