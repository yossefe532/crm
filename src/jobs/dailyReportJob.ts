import { prisma } from "../prisma/client"

export const runDailyReportJob = async (tenantId: string) => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const start = new Date(yesterday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(yesterday)
  end.setHours(23, 59, 59, 999)

  const leadsCreated = await prisma.lead.count({ where: { tenantId, createdAt: { gte: start, lte: end } } })
  const leadsClosed = await prisma.deal.count({ where: { tenantId, status: "closed", closedAt: { gte: start, lte: end } } })

  await prisma.leadMetricsDaily.create({ data: { tenantId, metricDate: start, leadsCreated, leadsClosed } })
}
