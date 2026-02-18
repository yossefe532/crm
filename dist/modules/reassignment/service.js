"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reassignmentService = void 0;
const client_1 = require("../../prisma/client");
exports.reassignmentService = {
    evaluateAndReassign: async (tenantId, leadId, triggerKey) => {
        const rules = await client_1.prisma.reassignmentRule.findMany({ where: { tenantId, triggerKey, isActive: true } });
        if (rules.length === 0)
            return null;
        const pool = await client_1.prisma.reassignmentPool.findFirst({ where: { tenantId } });
        if (!pool)
            return null;
        const members = await client_1.prisma.poolMember.findMany({ where: { tenantId, poolId: pool.id }, include: { user: true } });
        if (members.length === 0)
            return null;
        const chosen = members.sort((a, b) => b.weight - a.weight)[0];
        const lead = await client_1.prisma.lead.findFirst({ where: { id: leadId, tenantId } });
        if (!lead)
            return null;
        await client_1.prisma.lead.update({ where: { id: leadId, tenantId }, data: { assignedUserId: chosen.userId } });
        const event = await client_1.prisma.reassignmentEvent.create({ data: { tenantId, leadId, fromUserId: lead.assignedUserId || undefined, toUserId: chosen.userId, ruleId: rules[0]?.id } });
        await client_1.prisma.leadAssignment.create({ data: { tenantId, leadId, assignedUserId: chosen.userId, assignedBy: null, reason: "auto" } });
        return event;
    },
    addNegligencePoints: (tenantId, leadId, userId, points, reason) => client_1.prisma.negligencePoint.create({ data: { tenantId, leadId, userId, points, reason } })
};
