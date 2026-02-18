"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commissionService = void 0;
const client_1 = require("../../prisma/client");
exports.commissionService = {
    listLedger: (tenantId, limit = 50) => client_1.prisma.commissionLedger.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: limit }),
    createPlan: (tenantId, data) => client_1.prisma.commissionPlan.create({ data: { tenantId, name: data.name } }),
    createRule: (tenantId, data) => client_1.prisma.commissionRule.create({ data: { tenantId, planId: data.planId, rule: data.rule } }),
    createLedgerEntry: (tenantId, data) => client_1.prisma.commissionLedger.create({ data: { tenantId, dealId: data.dealId, userId: data.userId, amount: data.amount, entryType: data.entryType, currency: data.currency || "USD" } }),
    approveLedgerEntry: (tenantId, ledgerId, approvedBy) => client_1.prisma.commissionApproval.create({ data: { tenantId, ledgerId, approvedBy, status: "approved", decidedAt: new Date() } })
};
