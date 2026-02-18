"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const env_1 = require("../config/env");
const client_1 = require("../prisma/client");
const leadCountdownJob_1 = require("./leadCountdownJob");
const callCheckJob_1 = require("./callCheckJob");
const meetingDeadlineJob_1 = require("./meetingDeadlineJob");
const meetingReminderJob_1 = require("./meetingReminderJob");
const dailyReportJob_1 = require("./dailyReportJob");
const weeklyReportJob_1 = require("./weeklyReportJob");
const goalCleanupJob_1 = require("./goalCleanupJob");
const startJobs = () => {
    node_cron_1.default.schedule("0 */6 * * *", async () => {
        const tenants = await client_1.prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true } });
        await Promise.all(tenants.map((t) => (0, leadCountdownJob_1.runLeadCountdownJob)(t.id)));
    }, { timezone: env_1.env.cronTimezone });
    node_cron_1.default.schedule("0 */2 * * *", async () => {
        const tenants = await client_1.prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true } });
        await Promise.all(tenants.map((t) => (0, callCheckJob_1.runCallCheckJob)(t.id)));
    }, { timezone: env_1.env.cronTimezone });
    node_cron_1.default.schedule("*/30 * * * *", async () => {
        const tenants = await client_1.prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true } });
        await Promise.all(tenants.map((t) => (0, meetingDeadlineJob_1.runMeetingDeadlineJob)(t.id)));
    }, { timezone: env_1.env.cronTimezone });
    node_cron_1.default.schedule("* * * * *", async () => {
        try {
            await (0, meetingReminderJob_1.meetingReminderJob)();
        }
        catch (error) {
            console.error("Meeting reminder job failed", error);
        }
    }, { timezone: env_1.env.cronTimezone });
    node_cron_1.default.schedule("0 1 * * *", async () => {
        const tenants = await client_1.prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true } });
        await Promise.all(tenants.map((t) => (0, dailyReportJob_1.runDailyReportJob)(t.id)));
    }, { timezone: env_1.env.cronTimezone });
    node_cron_1.default.schedule("0 2 * * *", async () => {
        const tenants = await client_1.prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true } });
        await Promise.all(tenants.map((t) => (0, goalCleanupJob_1.runGoalCleanupJob)(t.id)));
    }, { timezone: env_1.env.cronTimezone });
    node_cron_1.default.schedule("0 9 * * 1", async () => {
        const tenants = await client_1.prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true } });
        await Promise.all(tenants.map((t) => (0, weeklyReportJob_1.runWeeklyReportJob)(t.id)));
    }, { timezone: env_1.env.cronTimezone });
};
exports.startJobs = startJobs;
