"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoringService = void 0;
const service_1 = require("../intelligence/service");
exports.scoringService = {
    scoreLead: async (tenantId, leadId) => {
        return service_1.intelligenceService.scoreLead(tenantId, leadId);
    }
};
