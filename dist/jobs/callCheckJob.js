"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCallCheckJob = void 0;
const client_1 = require("../prisma/client");
const service_1 = require("../modules/reassignment/service");
const runCallCheckJob = async (tenantId) => {
    const leads = await client_1.prisma.lead.findMany({ where: { tenantId, status: "call" } });
    const cutoff = new Date(Date.now() - 48 * 3600 * 1000);
    for (const lead of leads) {
        const recentCall = await client_1.prisma.callLog.findFirst({ where: { tenantId, leadId: lead.id, callTime: { gte: cutoff } } });
        if (!recentCall && lead.assignedUserId) {
            await service_1.reassignmentService.addNegligencePoints(tenantId, lead.id, lead.assignedUserId, 1, "No call in 48 hours");
            await service_1.reassignmentService.evaluateAndReassign(tenantId, lead.id, "call_missed");
        }
    }
};
exports.runCallCheckJob = runCallCheckJob;
