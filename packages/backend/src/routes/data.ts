import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { uploadToIpfs, fetchFromIpfs } from '../services/ipfs.js'
import { logActionOnChain, LOG_ACTION, getExplorerTxUrl } from '../services/algorand.js'

const router = Router()
router.use(authMiddleware)

const uploadSchema = z.object({
  encryptedData: z.string(),
  encryptedAesKey: z.string(),
  iv: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  fileSizeBytes: z.number(),
  category: z.string(),
  description: z.string().optional(),
})

router.post('/upload', async (req, res, next) => {
  try {
    const data = uploadSchema.parse(req.body)
    const userId = req.user!.sub

    const cipherBuffer = Buffer.from(data.encryptedData, 'base64')
    const cid = await uploadToIpfs(cipherBuffer, data.fileName)

    const category = await prisma.dataUpload.create({
      data: {
        ownerId: userId,
        category: data.category,
        ipfsCid: cid,
        encryptedAesKey: data.encryptedAesKey,
        ivHex: data.iv,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSizeBytes: data.fileSizeBytes,
        description: data.description,
      },
    })

    // Log upload to on-chain access logger
    let txnId: string | null = null
    let explorerUrl: string | null = null
    const uploader = await prisma.user.findUnique({ where: { id: userId } })
    try {
      const logResult = await logActionOnChain(
        LOG_ACTION.UPLOAD,
        uploader?.walletAddress || 'unknown',
        cid,
      )
      if (logResult) {
        txnId = logResult.txnId
        explorerUrl = getExplorerTxUrl(logResult.txnId)
      }
    } catch (err) {
      console.error('On-chain upload log failed:', err)
    }

    await prisma.auditEntry.create({
      data: {
        userId,
        action: 'upload',
        resourceId: cid,
        txnId,
        metadata: JSON.stringify({ fileName: data.fileName, category: data.category, explorerUrl }),
      },
    })

    res.json({ success: true, data: { category, txnId, explorerUrl }, error: null })
  } catch (err) {
    next(err)
  }
})

router.get('/my-uploads', async (req, res, next) => {
  try {
    const userId = req.user!.sub
    const categories = await prisma.dataUpload.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: { categories }, error: null })
  } catch (err) {
    next(err)
  }
})

router.get('/download/:categoryId', async (req, res, next) => {
  try {
    const userId = req.user!.sub
    const categoryId = req.params.categoryId

    const category = await prisma.dataUpload.findUniqueOrThrow({
      where: { id: categoryId },
      include: { owner: true },
    })

    const isOwner = category.ownerId === userId

    if (!isOwner) {
      const hasConsent = await prisma.consentRequest.findFirst({
        where: {
          dataUploadId: categoryId,
          requesterId: userId,
          status: 'APPROVED',
          OR: [
            { requestedExpiry: null },
            { requestedExpiry: { gt: new Date() } },
          ],
        },
      })
      if (!hasConsent) {
        res.status(403).json({ success: false, error: 'No valid consent or consent has expired', data: null })
        return
      }
    }

    if (!category.ipfsCid) {
      res.status(404).json({ success: false, error: 'No data uploaded', data: null })
      return
    }

    const encryptedData = await fetchFromIpfs(category.ipfsCid)

    // Log download to on-chain access logger
    let txnId: string | null = null
    let explorerUrl: string | null = null
    const downloader = await prisma.user.findUnique({ where: { id: userId } })
    try {
      const logResult = await logActionOnChain(
        LOG_ACTION.DOWNLOAD,
        downloader?.walletAddress || 'unknown',
        category.ipfsCid,
      )
      if (logResult) {
        txnId = logResult.txnId
        explorerUrl = getExplorerTxUrl(logResult.txnId)
      }
    } catch (err) {
      console.error('On-chain download log failed:', err)
    }

    await prisma.auditEntry.create({
      data: {
        userId,
        action: 'download',
        resourceId: category.ipfsCid,
        txnId,
        metadata: JSON.stringify({ categoryId, fileName: category.fileName, explorerUrl }),
      },
    })

    res.json({
      success: true,
      data: {
        encryptedData: encryptedData.toString('base64'),
        encryptedAesKey: category.encryptedAesKey,
        ivHex: category.ivHex,
        fileName: category.fileName,
        fileType: category.fileType,
      },
      error: null,
    })
  } catch (err) {
    next(err)
  }
})

export default router
