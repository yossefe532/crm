
import { prisma } from "../src/prisma/client"
import { goalsService } from "../src/modules/goals/service"

async function main() {
  console.log("Starting Goals Notification Test...")

  // 1. Setup Data
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error("No tenant found")

  const user = await prisma.user.findFirst({ where: { tenantId: tenant.id } })
  if (!user) throw new Error("No user found")

  console.log(`Using Tenant: ${tenant.id}, User: ${user.id}`)

  // 2. Create Plan
  const plan = await goalsService.createPlan(tenant.id, {
      name: "Test Goal Plan",
      period: "monthly",
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  })
  console.log(`Created Plan: ${plan.id}`)

  // 3. Set Targets (triggers Assignment Notification)
  console.log("Setting Targets...")
  await goalsService.setTargets(tenant.id, plan.id, [{
      subjectType: "user",
      subjectId: user.id,
      metricKey: "leads_created",
      targetValue: 1 // Target: 1 Lead
  }])

  // 4. Verify Assignment Notification
  const assignmentNotif = await prisma.notificationDelivery.findFirst({
      where: {
          tenantId: tenant.id,
          userId: user.id,
          type: "assignment",
          entityType: "goal_plan",
          entityId: plan.id
      },
      orderBy: { createdAt: "desc" }
  })

  if (assignmentNotif) {
      console.log(`[SUCCESS] Assignment Notification Found: ${assignmentNotif.title}`)
  } else {
      console.error("[FAILURE] Assignment Notification NOT Found")
  }

  // 5. Simulate Achievement
  console.log("Simulating Achievement (Creating a Lead)...")
  
  // Find a valid source or create one
  let source = await prisma.leadSource.findFirst({ where: { tenantId: tenant.id } })
  if (!source) {
      source = await prisma.leadSource.create({
           data: { tenantId: tenant.id, name: "Test Source" }
       })
  }

  await prisma.lead.create({
      data: {
          tenantId: tenant.id,
          name: "Goal Test Lead",
          status: "new",
          sourceId: source.id,
          assignedUserId: user.id,
          leadCode: "TEST-" + Date.now(),
          phone: "+123456789" + Math.floor(Math.random() * 1000)
      }
  })

  // 6. Build Report (triggers Achievement Notification)
  console.log("Building Report...")
  await goalsService.buildReport(tenant.id, plan.id)

  // 7. Verify Achievement Notification
  // Note: entityType is 'goal_target', we need to find the target ID first
  const target = await prisma.goalTarget.findFirst({ where: { planId: plan.id } })
  
  if (target) {
    const successNotif = await prisma.notificationDelivery.findFirst({
        where: {
            tenantId: tenant.id,
            userId: user.id,
            type: "success",
            entityType: "goal_target",
            entityId: target.id
        },
        orderBy: { createdAt: "desc" }
    })

    if (successNotif) {
        console.log(`[SUCCESS] Achievement Notification Found: ${successNotif.title}`)
    } else {
        console.error("[FAILURE] Achievement Notification NOT Found")
    }
  }

  // Cleanup
  console.log("Cleaning up...")
  await goalsService.deletePlan(tenant.id, plan.id) // This deletes targets too
  // Note: Lead deletion skipped to avoid FK issues, or we can delete it if we track ID
  
  // Clean notifications
  if (assignmentNotif) await prisma.notificationDelivery.delete({ where: { id: assignmentNotif.id } })
  
  console.log("Test Completed.")
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
