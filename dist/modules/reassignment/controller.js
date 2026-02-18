"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reassignmentController = void 0;
const service_1 = require("./service");
const activity_1 = require("../../utils/activity");
exports.reassignmentController = {
    triggerReassignment: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const event = await service_1.reassignmentService.evaluateAndReassign(tenantId, req.body.leadId, req.body.triggerKey);
        if (event) {
            await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.reassigned", entityType: "lead", entityId: event.leadId, metadata: { toUserId: event.toUserId } });
        }
        res.json({ event });
    },
    addNegligence: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const record = await service_1.reassignmentService.addNegligencePoints(tenantId, req.body.leadId, req.body.userId, Number(req.body.points), req.body.reason);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "negligence.added", entityType: "negligence_point", entityId: record.id });
        res.json(record);
    }
};
