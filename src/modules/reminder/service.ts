import { prisma } from "../../prisma/client"
import { Prisma } from "@prisma/client"

export const reminderService = {
  createRule: (tenantId: string, data: { name: string; triggerKey: string; schedule?: Record<string, unknown>; channel: string }) =>
    prisma.reminderRule.create({
      data: {
        tenantId,
        name: data.name,
        triggerKey: data.triggerKey,
        schedule: data.schedule ? (data.schedule as Prisma.InputJsonValue) : undefined,
        channel: data.channel
      }
    }),

  scheduleReminder: (tenantId: string, data: { leadId: string; ruleId: string; scheduledAt: string }) =>
    prisma.reminderSchedule.create({ data: { tenantId, leadId: data.leadId, ruleId: data.ruleId, scheduledAt: new Date(data.scheduledAt) } }),

  markSent: (tenantId: string, data: { leadId: string; ruleId: string; channel: string; result?: string }) =>
    prisma.remindersSent.create({ data: { tenantId, leadId: data.leadId, ruleId: data.ruleId, channel: data.channel, result: data.result } })
}
