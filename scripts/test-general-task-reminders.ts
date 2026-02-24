
import { prisma } from "../src/prisma/client"
import { taskReminderJob } from "../src/jobs/taskReminderJob"

async function main() {
  console.log("Starting General Task Reminder Test...")

  // 1. Setup Data
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error("No tenant found")

  const user = await prisma.user.findFirst({ where: { tenantId: tenant.id } })
  if (!user) throw new Error("No user found")

  // Create a second user (Manager/Creator) to test overdue escalation
  let manager = await prisma.user.findFirst({ 
    where: { tenantId: tenant.id, id: { not: user.id } } 
  })
  
  if (!manager) {
      console.log("Creating dummy manager...")
      manager = await prisma.user.create({
          data: {
              tenantId: tenant.id,
              email: `manager-${Date.now()}@test.com`,
              passwordHash: "dummy",
              status: "active"
          }
      })
  }

  console.log(`Using Tenant: ${tenant.id}, User: ${user.id}, Manager: ${manager.id}`)

  const now = new Date()
  
  // Create Upcoming Task (Due in 10 mins)
  const upcomingTask = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      title: "Test Upcoming Task",
      description: "This task is due soon",
      status: "pending",
      priority: "high",
      dueDate: new Date(now.getTime() + 10 * 60 * 1000), // +10 mins
      assignedUserId: user.id,
      createdByUserId: user.id
    }
  })
  console.log(`Created Upcoming Task: ${upcomingTask.id}`)

  // Create Overdue Task (Due 25 hours ago)
  // Assigned to User, Created by Manager -> Manager should be notified
  const overdueTask = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      title: "Test Overdue Task",
      description: "This task is overdue",
      status: "pending",
      priority: "high",
      dueDate: new Date(now.getTime() - 25 * 60 * 60 * 1000), // -25 hours
      assignedUserId: user.id,
      createdByUserId: manager.id
    }
  })
  console.log(`Created Overdue Task: ${overdueTask.id}`)

  // 2. Run Job
  console.log("Running Task Reminder Job...")
  await taskReminderJob()

  // 3. Verify Notifications
  // Check notifications for User (Upcoming) and Manager (Overdue Alert)
  const notifications = await prisma.notificationDelivery.findMany({
    where: {
      tenantId: tenant.id,
      userId: { in: [user.id, manager.id] },
      entityType: "task",
      entityId: { in: [upcomingTask.id, overdueTask.id] }
    },
    orderBy: { createdAt: "desc" }
  })

  console.log("\n--- Notifications Found ---")
  notifications.forEach(n => {
    console.log(`[${n.type}] ${n.title}: ${n.message} (Entity: ${n.entityId})`)
  })

  // Cleanup
  await prisma.task.deleteMany({ where: { id: { in: [upcomingTask.id, overdueTask.id] } } })
  await prisma.notificationDelivery.deleteMany({ where: { id: { in: notifications.map(n => n.id) } } })
  
  console.log("\nTest Completed.")
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
