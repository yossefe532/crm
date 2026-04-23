import { Request, Response, NextFunction } from "express"

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error("API Error:", err)
  const rawStatus = (err as { status?: number })?.status
  const rawMessage = (err as { message?: string })?.message || "حدث خطأ في الخادم"
  const normalizedMessage = rawMessage.toLowerCase()
  const dbConnectivityError =
    rawMessage.includes("Can't reach database server") ||
    rawMessage.includes("PrismaClientInitializationError") ||
    rawMessage.includes("P1001") ||
    normalizedMessage.includes("authentication failed") ||
    normalizedMessage.includes("password authentication failed") ||
    normalizedMessage.includes("circuit breaker open") ||
    normalizedMessage.includes("too many authentication errors")
  const status = dbConnectivityError ? 503 : (rawStatus || 500)
  const message = dbConnectivityError ? "الخدمة غير متاحة مؤقتًا، حاول مرة أخرى خلال دقائق" : rawMessage
  const details = (err as { details?: unknown })?.details
  if (details) {
    res.status(status).json({ error: message, message, details })
    return
  }
  res.status(status).json({ error: message, message })
}
