
import { PrismaClient } from "@prisma/client"
import { taskReminderJob } from "../src/jobs/taskReminderJob"

const prisma = new PrismaClient()

async function main() {
  console.log("Starting Task Reminder Job Test...")

  // 1. Setup Data
  const tenant = await prisma.tenant.create({
    data: { name: "Test Tenant for Reminders" }
  })
  
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `test_reminder_${Date.now()}@example.com`,
      passwordHash: "hash",
      status: "active"
    }
  })

  // Create a manager/creator user
  const manager = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `test_manager_${Date.now()}@example.com`,
      passwordHash: "hash",
      status: "active"
    }
  })

  // Create a general task due in 10 minutes (should trigger upcoming reminder)
  const upcomingTask = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      title: "Upcoming General Task",
      description: "This task is due soon",
      dueDate: new Date(Date.now() + 10 * 60 * 1000), // 10 mins from now
      status: "pending",
      assignedUserId: user.id,
      createdByUserId: user.id
    }
  })

  // Create an overdue general task (due 40 hours ago -> > 1 day, < 2 days)
  // Logic in job: dueDate < oneDayAgo && dueDate > twoDaysAgo
  const overdueTask = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      title: "Overdue General Task",
      description: "This task is overdue",
      dueDate: new Date(Date.now() - 40 * 60 * 60 * 1000), // 40 hours ago
      status: "pending",
      assignedUserId: user.id,
      createdByUserId: manager.id // Manager is the creator, so they should get the notification
    }
  })

  console.log("Created tasks:", { upcomingId: upcomingTask.id, overdueId: overdueTask.id })

  // 2. Run the Job
  console.log("Running taskReminderJob...")
  await taskReminderJob()

  // 3. Verify Notifications
  // Check user for upcoming
  const userNotifications = await prisma.notificationDelivery.findMany({
    where: { tenantId: tenant.id, userId: user.id },
    orderBy: { createdAt: "desc" }
  })
  
  // Check manager for overdue
  const managerNotifications = await prisma.notificationDelivery.findMany({
    where: { tenantId: tenant.id, userId: manager.id },
    orderBy: { createdAt: "desc" }
  })

  const notifications = [...userNotifications, ...managerNotifications]

  console.log("Notifications found:", notifications.length)
  notifications.forEach(n => {
    console.log(`- [${n.type}] User:${n.userId === user.id ? 'Employee' : 'Manager'} Title:${n.title}: ${n.message}`)
  })

  // Check Upcoming (Employee)
  const hasUpcoming = userNotifications.some(n => n.entityId === upcomingTask.id && n.title.includes("تذكير بمهمة"))
  if (hasUpcoming) console.log("✅ Upcoming task reminder sent correctly")
  else console.error("❌ Upcoming task reminder NOT sent")

  // Check Overdue (Manager)
  // The job logic sends to MANAGER (creator or team leader).
  const hasOverdue = managerNotifications.some(n => n.entityId === overdueTask.id && n.title.includes("مهمة عامة متأخرة"))
  if (hasOverdue) console.log("✅ Overdue task reminder sent correctly")
  else console.error("❌ Overdue task reminder NOT sent")

  // Cleanup
  await prisma.notificationDelivery.deleteMany({ where: { tenantId: tenant.id } })
  await prisma.task.deleteMany({ where: { tenantId: tenant.id } })
  await prisma.user.deleteMany({ where: { tenantId: tenant.id } })
  await prisma.tenant.delete({ where: { id: tenant.id } })
  
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
