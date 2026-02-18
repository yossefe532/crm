import { prisma } from "../../prisma/client"
import { env } from "../../config/env"
import { Prisma } from "@prisma/client"

export const whatsappService = {
  sendTemplateMessage: async (tenantId: string, data: { leadId?: string; contactId?: string; templateId: string; payload: Record<string, unknown> }) => {
    const message = await prisma.whatsappMessage.create({
      data: {
        tenantId,
        leadId: data.leadId,
        contactId: data.contactId,
        templateId: data.templateId,
        direction: "outbound",
        payload: data.payload as Prisma.InputJsonValue
      }
    })
    return { message, provider: env.whatsappApiBaseUrl }
  },

  registerWebhook: (tenantId: string, data: { provider: string; eventType: string; payload: Record<string, unknown> }) =>
    prisma.whatsappWebhook.create({ data: { tenantId, provider: data.provider, eventType: data.eventType, payload: data.payload as Prisma.InputJsonValue } })
}
