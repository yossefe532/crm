import { prisma } from "../../prisma/client"
import { Prisma } from "@prisma/client"

export const reminderService = {
  createRule: (tenantId: string, data: { triggerKey: string }) =>
    prisma.reminderRule.create({ 
      data: { 
        tenantId, 
        name: data.triggerKey, 
        condition: { triggerKey: data.triggerKey }, 
        message: "Default reminder message", 
        method: "notification", 
        isEnabled: true 
      } 
    }),

  createSchedule: (tenantId: string, data: { leadId: string; ruleId: string; scheduledAt: string }) =>
    prisma.reminderSchedule.create({ 
      data: { 
        tenantId, 
        leadId: data.leadId, 
        ruleId: data.ruleId, 
        dueAt: new Date(data.scheduledAt) 
      } 
    }),

  createSent: (tenantId: string, data: { leadId: string; ruleId: string; channel: string; result: string }) =>
    prisma.remindersSent.create({ 
      data: { 
        tenantId, 
        leadId: data.leadId, 
        method: data.channel, 
        content: "Reminder sent via " + data.channel + ": " + data.result 
      } 
    })
}
