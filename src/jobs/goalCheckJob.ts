import { prisma } from "../prisma/client"
import { goalsService } from "../modules/goals/service"

export const runGoalCheckJob = async (tenantId: string) => {
  try {
    const plans = await prisma.goalPlan.findMany({
      where: {
        tenantId,
        status: "active",
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() }
      }
    })

    for (const plan of plans) {
      await goalsService.buildReport(tenantId, plan.id).catch(err => {
        console.error(`Failed to check goals for plan ${plan.id}`, err)
      })
    }
  } catch (error) {
    console.error(`Goal check job failed for tenant ${tenantId}`, error)
  }
}
