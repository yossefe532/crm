import { Request, Response, NextFunction } from "express"

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error("API Error:", err)
  const status = (err as { status?: number })?.status || 500
  const message = (err as { message?: string })?.message || "حدث خطأ في الخادم"
  const details = (err as { details?: unknown })?.details
  if (details) {
    res.status(status).json({ error: message, message, details })
    return
  }
  res.status(status).json({ error: message, message })
}
