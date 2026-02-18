import { Request, Response, NextFunction } from "express"

const allowedPaths = new Set<string>(["/api/auth/change-password"])

export const forceResetMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user
  if (!user?.forceReset) return next()
  if (allowedPaths.has(req.path)) return next()
  return res.status(403).json({ error: "يجب تغيير كلمة المرور أولاً" })
}
