import { prisma } from "../../prisma/client"
import { env } from "../../config/env"
import { Prisma } from "@prisma/client"

export const whatsappService = {
  createMessage: async (tenantId: string, data: { leadId: string; content: string; accountId: string }) => {
    const lead = await prisma.lead.findUnique({ where: { id: data.leadId } })
    if (!lead || !lead.phone) throw new Error("Lead phone not found")
    return prisma.whatsappMessage.create({ 
      data: { 
        tenantId, 
        accountId: data.accountId, 
        toPhone: lead.phone, 
        content: data.content 
      } 
    })
  },

  createWebhook: (tenantId: string, data: { provider: string; eventType: string; payload: any }) =>
    prisma.auditLog.create({ 
      data: { 
        tenantId, 
        action: "whatsapp_webhook", 
        entity: "whatsapp", 
        details: { provider: data.provider, eventType: data.eventType, payload: data.payload } 
      } 
    })
}
