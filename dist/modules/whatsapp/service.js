"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappService = void 0;
const client_1 = require("../../prisma/client");
const env_1 = require("../../config/env");
exports.whatsappService = {
    sendTemplateMessage: async (tenantId, data) => {
        const message = await client_1.prisma.whatsappMessage.create({
            data: {
                tenantId,
                leadId: data.leadId,
                contactId: data.contactId,
                templateId: data.templateId,
                direction: "outbound",
                payload: data.payload
            }
        });
        return { message, provider: env_1.env.whatsappApiBaseUrl };
    },
    registerWebhook: (tenantId, data) => client_1.prisma.whatsappWebhook.create({ data: { tenantId, provider: data.provider, eventType: data.eventType, payload: data.payload } })
};
