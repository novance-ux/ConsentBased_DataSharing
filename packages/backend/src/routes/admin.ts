import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { issueCredentialOnChain, logActionOnChain, LOG_ACTION, getExplorerTxUrl } from '../services/algorand.js'

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
    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Admin access required', data: null })
      return
    }

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

    // Call credential_issuer smart contract to mint NFT
    let credentialAsaId = 'local-only'
    let txnId: string | null = null
    let explorerUrl: string | null = null

    try {
      const chainResult = await issueCredentialOnChain(data.studentAddress, data.studentId)
      if (chainResult) {
        credentialAsaId = chainResult.asaId.toString()
        txnId = chainResult.txnId
        explorerUrl = getExplorerTxUrl(chainResult.txnId)
      }
    } catch (err) {
      console.error('On-chain credential issuance failed, falling back to local:', err)
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { credentialAsaId },
    })

    // Also log to on-chain access logger
    let logTxnId: string | null = null
    try {
      const logResult = await logActionOnChain(LOG_ACTION.CREDENTIAL_ISSUE, data.studentAddress, data.studentId)
      if (logResult) logTxnId = logResult.txnId
    } catch (err) {
      console.error('On-chain log failed:', err)
    }

    await prisma.auditEntry.create({
      data: {
        userId: user.id,
        action: 'credential_issue',
        txnId: txnId || logTxnId,
        metadata: JSON.stringify({ studentId: data.studentId, credentialAsaId, explorerUrl }),
      },
    })

    res.json({ success: true, data: { user: updated, txnId, explorerUrl }, error: null })
  } catch (err) {
    next(err)
  }
})

export default router
