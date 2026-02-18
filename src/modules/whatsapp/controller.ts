import { Request, Response } from "express"
import { whatsappService } from "./service"
import { logActivity } from "../../utils/activity"

export const whatsappController = {
  sendTemplate: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const result = await whatsappService.sendTemplateMessage(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "whatsapp.message.queued", entityType: "whatsapp_message", entityId: result.message.id })
    res.json(result)
  },
  receiveWebhook: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const hook = await whatsappService.registerWebhook(tenantId, { provider: req.body.provider, eventType: req.body.eventType, payload: req.body.payload })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "whatsapp.webhook.received", entityType: "whatsapp_webhook", entityId: hook.id })
    res.json(hook)
  }
}
