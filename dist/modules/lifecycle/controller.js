"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lifecycleController = void 0;
const service_1 = require("./service");
const activity_1 = require("../../utils/activity");
const service_2 = require("../intelligence/service");
const service_3 = require("../notifications/service");
exports.lifecycleController = {
    createState: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const state = await service_1.lifecycleService.createState(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead_state.created", entityType: "lead_state", entityId: state.id });
        res.json(state);
    },
    createTransition: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const transition = await service_1.lifecycleService.createTransition(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead_transition.created", entityType: "lead_transition", entityId: transition.id });
        res.json(transition);
    },
    transitionLead: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const state = await service_1.lifecycleService.transitionLead(tenantId, req.params.leadId, req.body.toStateId, req.user?.id);
        const event = await service_3.notificationService.publishEvent(tenantId, "lead.stage.completed", {
            leadId: req.params.leadId,
            stage: state.code,
            changedBy: req.user?.id,
            targets: ["owner", "team_leader"]
        });
        await service_3.notificationService.queueDelivery(tenantId, event.id, "in_app");
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.transitioned", entityType: "lead", entityId: req.params.leadId, metadata: { toStateId: req.body.toStateId } });
        service_2.intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: req.params.leadId, userId: req.user?.id });
        res.json(state);
    },
    createDeadline: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const deadline = await service_1.lifecycleService.createDeadline(tenantId, req.body.leadId, req.body.stateId, new Date(req.body.dueAt));
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.deadline.created", entityType: "lead_deadline", entityId: deadline.id });
        service_2.intelligenceService.queueTrigger({ type: "task_changed", tenantId, leadId: req.body.leadId, userId: req.user?.id });
        res.json(deadline);
    },
    requestExtension: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const roles = req.user?.roles || [];
        if (!roles.includes("owner") && !roles.includes("sales")) {
            throw { status: 403, message: "غير مصرح بطلب تمديد" };
        }
        const extension = await service_1.lifecycleService.requestExtension(tenantId, req.body.leadId, req.body.stateId, req.user?.id || "", Number(req.body.extensionHours), req.body.reason);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.extension.requested", entityType: "lead_extension", entityId: extension.id });
        service_2.intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: req.body.leadId, userId: req.user?.id });
        res.json(extension);
    },
    approveExtension: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const roles = req.user?.roles || [];
        if (!roles.includes("owner") && !roles.includes("team_leader")) {
            throw { status: 403, message: "غير مصرح باعتماد التمديد" };
        }
        const extension = await service_1.lifecycleService.approveExtension(tenantId, req.params.id, req.user?.id || "");
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.extension.approved", entityType: "lead_extension", entityId: extension.id });
        res.json(extension);
    },
    rejectExtension: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const roles = req.user?.roles || [];
        if (!roles.includes("owner") && !roles.includes("team_leader")) {
            throw { status: 403, message: "غير مصرح برفض التمديد" };
        }
        const extension = await service_1.lifecycleService.rejectExtension(tenantId, req.params.id, req.user?.id || "", req.body?.reason);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.extension.rejected", entityType: "lead_extension", entityId: extension.id });
        res.json(extension);
    }
};
