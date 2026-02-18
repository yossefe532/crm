"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGoalCleanupJob = void 0;
const service_1 = require("../modules/goals/service");
const runGoalCleanupJob = async (tenantId) => {
    try {
        await service_1.goalsService.deleteOldCompletedTargets(tenantId);
    }
    catch (error) {
        console.error(`Goal cleanup job failed for tenant ${tenantId}`, error);
    }
};
exports.runGoalCleanupJob = runGoalCleanupJob;
