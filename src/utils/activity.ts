import { prisma } from "../prisma/client"
import { Prisma } from "@prisma/client"

export const logActivity = async (input: {
  tenantId: string
  actorUserId?: string
  action: string
  entityType: string
  entityId?: string
  metadata?: Record<string, unknown>
}) => {
  return prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined
    }
  })
}
