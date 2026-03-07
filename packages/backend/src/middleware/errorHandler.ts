import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('Error:', err)

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      data: err.errors,
    })
    return
  }

  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
    data: null,
  })
}
