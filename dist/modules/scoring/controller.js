"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoringController = void 0;
const service_1 = require("./service");
const activity_1 = require("../../utils/activity");
exports.scoringController = {
    scoreLead: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const score = await service_1.scoringService.scoreLead(tenantId, req.params.leadId);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.scored", entityType: "lead_score", entityId: score.id });
        res.json(score);
    }
};
