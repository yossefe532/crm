import { Request, Response, NextFunction } from "express"
import { parseAuthToken, UserPayload } from "../utils/auth"
import { prisma } from "../prisma/client"

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined
  const payload = parseAuthToken(token)
  if (payload) {
    ;(req as any).user = payload
    const user = await prisma.user.findFirst({ where: { tenantId: payload.tenantId, id: payload.id } })
    if (!user || user.status !== "active") {
      const allowPaths = req.path.startsWith("/api/leads/failures")
      if (!allowPaths) {
        return res.status(403).json({ error: "الحساب موقوف مؤقتًا" })
      }
    }
    return next()
  }
  if (process.env.NODE_ENV === "production") {
    return res.status(401).json({ error: "Unauthorized" })
  }
  const fallbackUserId = req.headers["x-user-id"] as string | undefined
  const fallbackTenantId = req.headers["x-tenant-id"] as string | undefined
  const fallbackRoles = (req.headers["x-roles"] as string | undefined)?.split(",").filter(Boolean) || []
  if (fallbackUserId && fallbackTenantId) {
    const user: UserPayload = { id: fallbackUserId, tenantId: fallbackTenantId, roles: fallbackRoles };
    ;(req as any).user = user
    const existing = await prisma.user.findFirst({ where: { tenantId: fallbackTenantId, id: fallbackUserId } })
    if (!existing || existing.status !== "active") {
      const allowPaths = req.path.startsWith("/api/leads/failures")
      if (!allowPaths) {
        return res.status(403).json({ error: "الحساب موقوف مؤقتًا" })
      }
    }
    return next()
  }
  res.status(401).json({ error: "Unauthorized" })
}
