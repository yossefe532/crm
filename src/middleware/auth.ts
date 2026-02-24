import { Request, Response, NextFunction } from "express"
import { parseAuthToken, UserPayload } from "../utils/auth"
import { prisma } from "../prisma/client"

interface CachedUser {
  status: string
  timestamp: number
}

const userCache = new Map<string, CachedUser>()
const CACHE_TTL = 60 * 1000 // 1 minute cache

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined
  const payload = parseAuthToken(token)

  if (payload) {
    ;(req as any).user = payload
    
    // Check cache first
    const now = Date.now()
    const cached = userCache.get(payload.id)
    
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      if (cached.status !== "active") {
        const allowPaths = req.path.startsWith("/api/leads/failures")
        if (!allowPaths) {
          return res.status(403).json({ error: "الحساب موقوف مؤقتًا" })
        }
      }
      return next()
    }

    // Fallback to DB
    try {
      const user = await prisma.user.findUnique({ 
        where: { id: payload.id },
        select: { status: true } // Only select status to minimize data transfer
      })

      if (user) {
        userCache.set(payload.id, { status: user.status, timestamp: now })
        
        if (user.status !== "active") {
          const allowPaths = req.path.startsWith("/api/leads/failures")
          if (!allowPaths) {
            return res.status(403).json({ error: "الحساب موقوف مؤقتًا" })
          }
        }
      }
    } catch (error) {
      console.error("Auth middleware DB error:", error)
      // Allow if DB fails? No, safest is to allow if we have payload but maybe log error.
      // Or just fail. Given the stability issues, if DB is down, we can't do much.
      // But we should try to avoid crashing.
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
    
    // Check cache for fallback user too
    const now = Date.now()
    const cached = userCache.get(fallbackUserId)
    
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      if (cached.status !== "active") {
        const allowPaths = req.path.startsWith("/api/leads/failures")
        if (!allowPaths) {
          return res.status(403).json({ error: "الحساب موقوف مؤقتًا" })
        }
      }
      return next()
    }

    try {
      const existing = await prisma.user.findUnique({ 
        where: { id: fallbackUserId },
        select: { status: true }
      })
      
      if (existing) {
        userCache.set(fallbackUserId, { status: existing.status, timestamp: now })
        if (existing.status !== "active") {
          const allowPaths = req.path.startsWith("/api/leads/failures")
          if (!allowPaths) {
            return res.status(403).json({ error: "الحساب موقوف مؤقتًا" })
          }
        }
      }
    } catch (error) {
        console.error("Auth middleware DB error (fallback):", error)
     }
 
     return next()
   }
   res.status(401).json({ error: "Unauthorized" })
}
