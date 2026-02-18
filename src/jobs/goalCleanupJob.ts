import { goalsService } from "../modules/goals/service"

export const runGoalCleanupJob = async (tenantId: string) => {
  try {
    await goalsService.deleteOldCompletedTargets(tenantId)
  } catch (error) {
    console.error(`Goal cleanup job failed for tenant ${tenantId}`, error)
  }
}
