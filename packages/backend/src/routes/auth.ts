import { Router } from 'express'
import { z } from 'zod'
import algosdk from 'algosdk'
import { randomBytes } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { signJwt } from '../lib/jwt.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

const challengeSchema = z.object({
  address: z.string().min(58).max(58),
})

router.get('/challenge', async (req, res, next) => {
  try {
    const { address } = challengeSchema.parse(req.query)
    const nonce = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await prisma.authChallenge.create({
      data: { address, nonce, expiresAt },
    })

    res.json({ success: true, data: { nonce }, error: null })
  } catch (err) {
    next(err)
  }
})

const verifySchema = z.object({
  address: z.string().min(58).max(58),
  signature: z.string(),
  nonce: z.string(),
})

router.post('/verify', async (req, res, next) => {
  try {
    const { address, signature, nonce } = verifySchema.parse(req.body)

    const challenge = await prisma.authChallenge.findFirst({
      where: {
        address,
        nonce,
        consumed: false,
        expiresAt: { gt: new Date() },
      },
    })

    if (!challenge) {
      res.status(401).json({ success: false, error: 'Invalid or expired challenge', data: null })
      return
    }

    const nonceBytes = new Uint8Array(Buffer.from(nonce, 'hex'))
    const sigBytes = new Uint8Array(Buffer.from(signature, 'base64'))
    const isValid = algosdk.verifyBytes(nonceBytes, sigBytes, address)

    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid signature', data: null })
      return
    }

    await prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { consumed: true },
    })

    let user = await prisma.user.findUnique({ where: { walletAddress: address } })
    if (!user) {
      user = await prisma.user.create({
        data: { walletAddress: address, role: 'STUDENT' },
      })
    }

    const token = await signJwt({
      sub: user.id,
      address: user.walletAddress,
      role: user.role,
    })

    res.json({ success: true, data: { token, user }, error: null })
  } catch (err) {
    next(err)
  }
})

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
    })
    res.json({ success: true, data: { user }, error: null })
  } catch (err) {
    next(err)
  }
})

// Demo login — bypasses wallet signature for hackathon demonstration
const demoLoginSchema = z.object({
  role: z.enum(['STUDENT', 'REQUESTER', 'ADMIN']),
})

const DEMO_ADDRESSES: Record<string, string> = {
  STUDENT: 'DEMO_STUDENT_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  REQUESTER: 'DEMO_REQUESTER_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  ADMIN: 'DEMO_ADMIN_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
}

router.post('/demo-login', async (req, res, next) => {
  try {
    const { role } = demoLoginSchema.parse(req.body)
    const address = DEMO_ADDRESSES[role]

    let user = await prisma.user.findUnique({ where: { walletAddress: address } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: address,
          role,
          name: role === 'STUDENT' ? 'Alice (Student)' : role === 'REQUESTER' ? 'TechCorp Recruiter' : 'College Admin',
          organization: role === 'REQUESTER' ? 'TechCorp Inc.' : role === 'ADMIN' ? 'Demo University' : null,
          credentialAsaId: role === 'STUDENT' ? 'demo-credential-001' : null,
        },
      })
    }

    const token = await signJwt({
      sub: user.id,
      address: user.walletAddress,
      role: user.role,
    })

    res.json({ success: true, data: { token, user }, error: null })
  } catch (err) {
    next(err)
  }
})

export default router
