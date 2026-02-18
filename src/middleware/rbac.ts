import { Request, Response, NextFunction } from "express"
import { prisma } from "../prisma/client"

export const requirePermission = (permissionCode: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user
    if (!user) return res.status(401).json({ error: "Unauthorized" })
    if (user.roles.includes("owner")) return next()
    
    // Check direct permissions
    let directPermissions: Array<{ permission: { code: string } }> = []
    try {
      directPermissions = await prisma.userPermission.findMany({
        where: { userId: user.id, tenantId: user.tenantId },
        include: { permission: true }
      })
    } catch (error: any) {
      if (error?.code !== "P2021") throw error
    }
    
    if (directPermissions.some(p => p.permission.code === permissionCode)) return next()

    // Check role permissions
    const roleLinks = await prisma.userRole.findMany({
      where: { userId: user.id, tenantId: user.tenantId, revokedAt: null },
      include: { role: { include: { permissions: { include: { permission: true } } } } }
    })
    const permissions = new Set(
      (roleLinks as Array<{ role: { permissions: Array<{ permission: { code: string } }> } }>).flatMap(
        (link) => link.role.permissions.map((p) => p.permission.code)
      )
    )
    if (!permissions.has(permissionCode)) {
      return res.status(403).json({ error: "Forbidden" })
    }
    return next()
  }
}

export const requireOwner = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user
  if (!user) return res.status(401).json({ error: "Unauthorized" })
  if (user.roles.includes("owner")) return next()
  return res.status(403).json({ error: "غير مصرح" })
}
