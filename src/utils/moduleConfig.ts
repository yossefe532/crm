import { prisma } from "../prisma/client"

export const getModuleConfig = async (tenantId: string, moduleKey: string) => {
  const module = await prisma.module.findFirst({ where: { key: moduleKey } })
  if (!module) return null
  return prisma.moduleConfig.findFirst({ where: { tenantId, moduleId: module.id, isActive: true } })
}
