import { prisma } from "../../prisma/client"

export const blacklistService = {
  createEntry: (tenantId: string, data: { identifierType: string; identifierValue: string; reason?: string; severity: string }) =>
    prisma.blacklistEntry.create({ data: { tenantId, identifierType: data.identifierType, identifierValue: data.identifierValue, reason: data.reason, severity: data.severity } }),

  checkLead: async (tenantId: string, leadId: string, identifiers: { type: string; value: string }[]) => {
    const matches = await prisma.blacklistEntry.findMany({
      where: {
        tenantId,
        OR: identifiers.map((id) => ({ identifierType: id.type, identifierValue: id.value }))
      }
    })
    const created = await Promise.all(
      (matches as Array<{ id: string }>).map((entry) =>
        prisma.blacklistMatch.create({ data: { tenantId, leadId, entryId: entry.id, matchScore: 100, status: "flagged" } })
      )
    )
    return created
  }
}
