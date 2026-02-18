"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commissionController = void 0;
const service_1 = require("./service");
const activity_1 = require("../../utils/activity");
exports.commissionController = {
    listLedger: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const entries = await service_1.commissionService.listLedger(tenantId, limit);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "commission.ledger.listed", entityType: "commission_ledger" });
        res.json(entries);
    },
    createPlan: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const plan = await service_1.commissionService.createPlan(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "commission.plan.created", entityType: "commission_plan", entityId: plan.id });
        res.json(plan);
    },
    createRule: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const rule = await service_1.commissionService.createRule(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "commission.rule.created", entityType: "commission_rule", entityId: rule.id });
        res.json(rule);
    },
    createLedgerEntry: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const entry = await service_1.commissionService.createLedgerEntry(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "commission.ledger.created", entityType: "commission_ledger", entityId: entry.id });
        res.json(entry);
    },
    approveLedgerEntry: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const approval = await service_1.commissionService.approveLedgerEntry(tenantId, req.params.id, req.user?.id || "");
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "commission.approved", entityType: "commission_approval", entityId: approval.id });
        res.json(approval);
    }
};
