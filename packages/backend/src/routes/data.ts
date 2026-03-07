import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { uploadToIpfs, fetchFromIpfs } from '../services/ipfs.js'

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

    await prisma.auditEntry.create({
      data: {
        userId,
        action: 'upload',
        resourceId: cid,
        metadata: JSON.stringify({ fileName: data.fileName, category: data.category }),
      },
    })

    res.json({ success: true, data: { category }, error: null })
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
        },
      })
      if (!hasConsent) {
        res.status(403).json({ success: false, error: 'No valid consent', data: null })
        return
      }
    }

    if (!category.ipfsCid) {
      res.status(404).json({ success: false, error: 'No data uploaded', data: null })
      return
    }

    const encryptedData = await fetchFromIpfs(category.ipfsCid)

    await prisma.auditEntry.create({
      data: {
        userId,
        action: 'download',
        resourceId: category.ipfsCid,
        metadata: JSON.stringify({ categoryId, fileName: category.fileName }),
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
