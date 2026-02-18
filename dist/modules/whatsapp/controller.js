"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappController = void 0;
const service_1 = require("./service");
const activity_1 = require("../../utils/activity");
exports.whatsappController = {
    sendTemplate: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const result = await service_1.whatsappService.sendTemplateMessage(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "whatsapp.message.queued", entityType: "whatsapp_message", entityId: result.message.id });
        res.json(result);
    },
    receiveWebhook: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const hook = await service_1.whatsappService.registerWebhook(tenantId, { provider: req.body.provider, eventType: req.body.eventType, payload: req.body.payload });
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "whatsapp.webhook.received", entityType: "whatsapp_webhook", entityId: hook.id });
        res.json(hook);
    }
};
