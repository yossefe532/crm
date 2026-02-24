
import { PrismaClient } from "@prisma/client"
import { meetingReminderJob } from "../src/jobs/meetingReminderJob"

const prisma = new PrismaClient()

async function main() {
  console.log("Starting meeting reminder test...")

  // 1. Create a test tenant
  console.log("Creating test tenant...")
  const tenant = await prisma.tenant.create({
    data: {
      name: "Test Tenant Reminders",
      status: "active",
    },
  })
  console.log("Tenant created:", tenant.id)

  // 2. Create a test user (agent)
  console.log("Creating test user...")
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `test-reminders-${Date.now()}@example.com`,
      passwordHash: "hashed_password",
      status: "active",
      mustChangePassword: false,
    },
  })
  console.log("User created:", user.id)

  // 3. Create a test lead
  console.log("Creating test lead...")
  const lead = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      name: "Test Lead for Meeting",
      status: "new",
      leadCode: "TEST-LEAD-REMINDER-" + Date.now(),
      phone: "+201234567890" + Math.floor(Math.random() * 1000),
      assignedUserId: user.id,
    },
  })
  console.log("Lead created:", lead.id)

  // 4. Create a meeting starting in 10 minutes
  console.log("Creating test meeting...")
  const now = new Date()
  const startsAt = new Date(now.getTime() + 10 * 60 * 1000) // 10 minutes from now
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000) // 30 minutes duration

  const meeting = await prisma.meeting.create({
    data: {
      tenantId: tenant.id,
      leadId: lead.id,
      organizerUserId: user.id,
      title: "Test Meeting for Reminders",
      startsAt: startsAt,
      endsAt: endsAt,
      status: "scheduled",
    },
  })
  console.log("Meeting created:", meeting.id)

  // 5. Create a reminder set for 15 minutes before (should NOT trigger yet)
  console.log("Creating reminder (15 min before)...")
  const reminder15 = await prisma.meetingReminder.create({
    data: {
      tenantId: tenant.id,
      meetingId: meeting.id,
      minutesBefore: 15,
      method: "notification",
      isSent: false,
    },
  })
  console.log("Reminder (15 min) created:", reminder15.id)

  // 6. Create a reminder set for 5 minutes before (should trigger soon, but let's test logic)
  // Wait, the job checks: scheduledTime <= now
  // scheduledTime = startsAt - minutesBefore
  // If startsAt = now + 10m
  // 15m reminder: scheduledTime = (now + 10m) - 15m = now - 5m. This is <= now. SHOULD TRIGGER.
  // 5m reminder: scheduledTime = (now + 10m) - 5m = now + 5m. This is > now. SHOULD NOT TRIGGER.

  console.log("Creating reminder (5 min before)...")
  const reminder5 = await prisma.meetingReminder.create({
    data: {
      tenantId: tenant.id,
      meetingId: meeting.id,
      minutesBefore: 5,
      method: "notification",
      isSent: false,
    },
  })
  console.log("Reminder (5 min) created:", reminder5.id)

  // 7. Run the job
  console.log("Running meetingReminderJob...")
  await meetingReminderJob()

  // 8. Verify results
  const updatedReminder15 = await prisma.meetingReminder.findUnique({
    where: { id: reminder15.id },
  })
  const updatedReminder5 = await prisma.meetingReminder.findUnique({
    where: { id: reminder5.id },
  })

  console.log("Reminder 15 min sent status:", updatedReminder15?.isSent) // Should be true
  console.log("Reminder 5 min sent status:", updatedReminder5?.isSent)   // Should be false

  if (updatedReminder15?.isSent && !updatedReminder5?.isSent) {
    console.log("SUCCESS: Reminders processed correctly.")
  } else {
    console.error("FAILURE: Reminders not processed as expected.")
  }

  // 9. Cleanup
  console.log("Cleaning up...")
  await prisma.meetingReminder.deleteMany({ where: { meetingId: meeting.id } })
  await prisma.meeting.delete({ where: { id: meeting.id } })
  await prisma.lead.delete({ where: { id: lead.id } })
  await prisma.user.delete({ where: { id: user.id } })
  await prisma.tenant.delete({ where: { id: tenant.id } })
  console.log("Cleanup complete.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
