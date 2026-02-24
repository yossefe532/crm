
import { PrismaClient } from "@prisma/client"
import { commissionService } from "../src/modules/commission/service"
import { notificationService } from "../src/modules/notifications/service"

const prisma = new PrismaClient()

// Mock Notification Service send to intercept notifications
const originalSend = notificationService.send
let lastNotification: any = null

notificationService.send = async (data) => {
  console.log("[NOTIFICATION SENT]", JSON.stringify(data, null, 2))
  lastNotification = data
  return originalSend(data)
}

async function main() {
  console.log("Starting Commission Notification Test...")

  // 1. Setup Tenant and User
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error("No tenant found")
  
  const user = await prisma.user.findFirst({ where: { tenantId: tenant.id } })
  if (!user) throw new Error("No user found")

  const approver = await prisma.user.findFirst({ 
    where: { tenantId: tenant.id, id: { not: user.id } } 
  }) || user // Fallback to same user if only one exists

  console.log(`Using Tenant: ${tenant.id}, User: ${user.id}, Approver: ${approver.id}`)

  // 2. Create Commission Plan (optional but good practice)
  const plan = await commissionService.createPlan(tenant.id, {
    name: "Test Commission Plan",
    targetAmount: 10000,
    baseRate: 5
  })
  console.log(`Created Plan: ${plan.id}`)

  // 3. Create Ledger Entry (Commission)
  console.log("Creating Ledger Entry...")
  lastNotification = null
  const entry = await commissionService.createLedgerEntry(tenant.id, {
    userId: user.id,
    amount: 500,
    entryType: "commission",
    currency: "USD",
    dealId: undefined // No deal for this test
  })
  console.log(`Created Entry: ${entry.id}`)

  // Verify Notification
  if (lastNotification && lastNotification.title.includes("عمولة جديدة")) {
    console.log("[SUCCESS] Commission Creation Notification Found")
  } else {
    console.error("[FAILURE] Commission Creation Notification NOT Found")
    console.log("Last Notification:", lastNotification)
  }

  // 4. Approve Ledger Entry
  console.log("Approving Ledger Entry...")
  lastNotification = null
  await commissionService.approveLedgerEntry(tenant.id, entry.id, approver.id)

  // Verify Notification
  if (lastNotification && lastNotification.title.includes("تمت الموافقة")) {
    console.log("[SUCCESS] Commission Approval Notification Found")
  } else {
    console.error("[FAILURE] Commission Approval Notification NOT Found")
    console.log("Last Notification:", lastNotification)
  }

  // Cleanup
  console.log("Cleaning up...")
  await prisma.commissionApproval.deleteMany({ where: { ledgerId: entry.id } })
  await prisma.commissionLedger.delete({ where: { id: entry.id } })
  await prisma.commissionPlan.delete({ where: { id: plan.id } })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
