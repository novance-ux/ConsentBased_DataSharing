import type { Request, Response, NextFunction } from 'express'
import { verifyJwt } from '../lib/jwt.js'

declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string
        address: string
        role: string
      }
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Missing authorization header', data: null })
      return
    }

    const token = authHeader.slice(7)
    const payload = await verifyJwt(token)

    req.user = {
      sub: payload.sub as string,
      address: payload.address as string,
      role: payload.role as string,
    }

    next()
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token', data: null })
  }
}
