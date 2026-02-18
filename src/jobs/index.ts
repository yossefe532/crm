import cron from "node-cron"
import { env } from "../config/env"
import { prisma } from "../prisma/client"
import { runLeadCountdownJob } from "./leadCountdownJob"
import { runCallCheckJob } from "./callCheckJob"
import { runMeetingDeadlineJob } from "./meetingDeadlineJob"
import { meetingReminderJob } from "./meetingReminderJob"
import { runDailyReportJob } from "./dailyReportJob"
import { runWeeklyReportJob } from "./weeklyReportJob"
import { runGoalCleanupJob } from "./goalCleanupJob"

export const startJobs = () => {
  cron.schedule("0 */6 * * *", async () => {
    const tenants = await prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true } })
    await Promise.all(tenants.map((t: { id: string }) => runLeadCountdownJob(t.id)))
  }, { timezone: env.cronTimezone })

  cron.schedule("0 */2 * * *", async () => {
    const tenants = await prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true } })
    await Promise.all(tenants.map((t: { id: string }) => runCallCheckJob(t.id)))
  }, { timezone: env.cronTimezone })

  cron.schedule("*/30 * * * *", async () => {
    const tenants = await prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true } })
    await Promise.all(tenants.map((t: { id: string }) => runMeetingDeadlineJob(t.id)))
  }, { timezone: env.cronTimezone })

  cron.schedule("* * * * *", async () => {
    try {
      await meetingReminderJob()
    } catch (error) {
      console.error("Meeting reminder job failed", error)
    }
  }, { timezone: env.cronTimezone })

  cron.schedule("0 1 * * *", async () => {
    const tenants = await prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true } })
    await Promise.all(tenants.map((t: { id: string }) => runDailyReportJob(t.id)))
  }, { timezone: env.cronTimezone })

  cron.schedule("0 2 * * *", async () => {
    const tenants = await prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true } })
    await Promise.all(tenants.map((t: { id: string }) => runGoalCleanupJob(t.id)))
  }, { timezone: env.cronTimezone })

  cron.schedule("0 9 * * 1", async () => {
    const tenants = await prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true } })
    await Promise.all(tenants.map((t: { id: string }) => runWeeklyReportJob(t.id)))
  }, { timezone: env.cronTimezone })
}
