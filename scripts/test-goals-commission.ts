
import { PrismaClient } from "@prisma/client"
import { goalsService } from "../src/modules/goals/service"
import { leadService } from "../src/modules/lead/service"

const prisma = new PrismaClient()

async function main() {
  console.log("Starting Goals-Commission Integration Test...")

  try {
    // 1. Setup Data
    const tenant = await prisma.tenant.findFirst()
    if (!tenant) throw new Error("No tenant found")

    // Cleanup old plans to speed up test
    console.log("Cleaning up old test plans...")
    const oldPlans = await prisma.goalPlan.findMany({ where: { name: { startsWith: "Commission Test Plan" } } })
    if (oldPlans.length > 0) {
        const oldPlanIds = oldPlans.map(p => p.id)
        await prisma.goalTarget.deleteMany({ where: { planId: { in: oldPlanIds } } })
        await prisma.goalPlan.deleteMany({ where: { id: { in: oldPlanIds } } })
        console.log(`Deleted ${oldPlans.length} old plans`)
    }

    // Find a user with a role (to avoid foreign key issues if we were creating one, but we'll use existing)
    const user = await prisma.user.findFirst({ 
        where: { tenantId: tenant.id, status: 'active' } 
    })
    if (!user) throw new Error("No active user found")

    console.log(`Using Tenant: ${tenant.id}, User: ${user.id}`)

    // 2. Create Goal Plan
    const plan = await prisma.goalPlan.create({
        data: {
            tenantId: tenant.id,
            name: "Commission Test Plan " + Date.now(),
            period: "monthly",
            startsAt: new Date(),
            endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
    })
    console.log(`Created Plan: ${plan.id}`)

    // 3. Set Target with Bonus
    console.log("Setting Targets (Multiple)...")
    const bonusAmount = 500
    await goalsService.setTargets(tenant.id, plan.id, [
        {
            subjectType: "user",
            subjectId: user.id,
            metricKey: "leads_created",
            targetValue: 1, // Target: 1 Lead
            bonusAmount: bonusAmount
        },
        {
            subjectType: "user",
            subjectId: user.id,
            metricKey: "meetings", // Another target to test grouping
            targetValue: 5,
            bonusAmount: 0
        }
    ])

    // 4. Simulate Achievement (Create a Lead)
    console.log("Simulating Achievement (Creating a Lead)...")
    let source = await prisma.leadSource.findFirst({ where: { tenantId: tenant.id } })
    if (!source) {
        source = await prisma.leadSource.create({
             data: { tenantId: tenant.id, name: "Test Source" }
         })
    }

    const lead = await leadService.createLead(tenant.id, {
        leadCode: "TEST-" + Date.now(),
        name: "Goal Commission Test Lead",
        phone: "+999" + Math.floor(Math.random() * 1000000),
        sourceId: source.id,
        assignedUserId: user.id,
        createdByUserId: user.id // This should trigger the hook
    })
    console.log(`Created Lead: ${lead.id}`)

    // Wait for async hooks to fire (checkAchievement is fire-and-forget in leadService)
    console.log("Waiting for async goal processing...")
    await new Promise(resolve => setTimeout(resolve, 10000))

    // 6. Verify Commission Ledger Entry
    console.log("Verifying Commission Ledger Entry...")
    const ledgerEntry = await prisma.commissionLedger.findFirst({
        where: {
            tenantId: tenant.id,
            userId: user.id,
            entryType: "goal_bonus",
            amount: bonusAmount
        }
    })

    if (ledgerEntry) {
        console.log(`[SUCCESS] Commission Ledger Entry Found: ID=${ledgerEntry.id}, Amount=${ledgerEntry.amount}`)
    } else {
        console.error("[FAILURE] Commission Ledger Entry NOT Found")
        // Debug: check if any entry created
        const anyEntry = await prisma.commissionLedger.findFirst({
            where: { tenantId: tenant.id, userId: user.id },
            orderBy: { createdAt: "desc" }
        })
        if (anyEntry) {
            console.log("Latest entry found (might mismatch):", anyEntry)
        }
        process.exit(1)
    }

    // Cleanup
    console.log("Cleaning up...")
    // Delete related data first
    await prisma.leadStateHistory.deleteMany({ where: { leadId: lead.id } })
    await prisma.leadActivityLog.deleteMany({ where: { leadId: lead.id } })
    // Also delete commission ledger entry created
    await prisma.commissionLedger.deleteMany({ where: { tenantId: tenant.id, userId: user.id, entryType: "goal_bonus" } })
    
    await prisma.lead.delete({ where: { id: lead.id } })
    await prisma.goalTarget.deleteMany({ where: { planId: plan.id } })
    await prisma.goalPlan.delete({ where: { id: plan.id } })

  } catch (e) {
    console.error("Test Failed:", e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
