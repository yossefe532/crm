import { prisma } from "../prisma/client"

export const getModuleConfig = async (tenantId: string, moduleKey: string) => {
  return prisma.moduleConfig.findFirst({ where: { tenantId, moduleKey, isEnabled: true } })
}
