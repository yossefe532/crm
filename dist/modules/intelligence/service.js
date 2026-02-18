"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intelligenceService = void 0;
const client_1 = require("../../prisma/client");
const moduleConfig_1 = require("../../utils/moduleConfig");
const activity_1 = require("../../utils/activity");
const formulas_1 = require("./formulas");
const defaultConfig = {
    leadScoreWeights: { demographic: 0.25, engagement: 0.25, behavioral: 0.25, historical: 0.25 },
    disciplineWeights: { followUpFrequency: 0.2, meetingAdherence: 0.2, taskCompletion: 0.2, dataEntryTimeliness: 0.2, pipelineHygiene: 0.2 },
    thresholds: { hot: 80, warm: 60 },
    engagementWeights: { email_open: 3, website_visit: 2, form_submission: 6, social_interaction: 2, meeting_attended: 6, call_logged: 4 },
    engagementTarget: 40,
    followUpTarget: 20,
    taskCompletionTarget: 0.85,
    meetingAdherenceTarget: 0.9,
    hygieneTargetDays: 14,
    dataEntryTargetHours: 2,
    dataEntryMaxHours: 48,
    dealStageBase: {
        prospecting: 20,
        qualification: 30,
        proposal: 50,
        negotiation: 65,
        contract: 75,
        closing: 85,
        won: 100
    },
    targetPropertyTypes: ["residential", "commercial", "luxury"],
    targetLocations: [],
    companySizeScores: { enterprise: 95, midmarket: 75, smb: 55, startup: 45 },
    industryScores: { finance: 85, healthcare: 80, tech: 90, retail: 70 }
};
const readConfig = async (tenantId) => {
    const moduleConfig = await (0, moduleConfig_1.getModuleConfig)(tenantId, "intelligence");
    const config = moduleConfig?.config || {};
    return {
        ...defaultConfig,
        ...config,
        leadScoreWeights: { ...defaultConfig.leadScoreWeights, ...config.leadScoreWeights },
        disciplineWeights: { ...defaultConfig.disciplineWeights, ...config.disciplineWeights },
        engagementWeights: { ...defaultConfig.engagementWeights, ...config.engagementWeights }
    };
};
const daysBetween = (date, other) => Math.abs(date.getTime() - other.getTime()) / (1000 * 60 * 60 * 24);
const computeEngagementScore = (events, weights, target) => {
    const now = new Date();
    const weighted = events.reduce((sum, event) => {
        const daysAgo = daysBetween(now, event.createdAt);
        const weight = weights[event.activityType] || 1;
        return sum + weight * (0, formulas_1.timeDecayWeight)(daysAgo, 30);
    }, 0);
    return (0, formulas_1.normalize)(weighted, 0, target);
};
const computeBehavioralScore = (input) => {
    const totalTasks = input.tasks.length;
    const completedTasks = input.tasks.filter((task) => ["done", "completed"].includes(task.status)).length;
    const taskCompletion = totalTasks ? completedTasks / totalTasks : 0;
    const meetingsDone = input.meetings.filter((meeting) => meeting.status === "completed" || meeting.endsAt < new Date()).length;
    const meetingRate = input.meetings.length ? meetingsDone / input.meetings.length : 0;
    const recentCalls = input.callLogs.filter((log) => daysBetween(new Date(), log.callTime) <= 14).length;
    const followUpScore = (0, formulas_1.normalize)(recentCalls, 0, 6);
    const extensionPenalty = input.extensions.filter((ext) => ext.status !== "approved").length * 4;
    const raw = (0, formulas_1.clamp)((taskCompletion * 40) + (meetingRate * 40) + followUpScore - extensionPenalty);
    return raw;
};
const computeHistoricalScore = (conversionRate, velocityHours) => {
    const conversionScore = (0, formulas_1.clamp)(conversionRate * 100);
    const velocityScore = velocityHours ? (0, formulas_1.normalize)(Math.max(0, 168 - velocityHours), 0, 168) : 50;
    return (0, formulas_1.clamp)(conversionScore * 0.6 + velocityScore * 0.4);
};
const computeDemographicScore = (input, config) => {
    const budgetValue = input.budgetMax || input.budgetMin || 0;
    const budgetScore = (0, formulas_1.normalize)(budgetValue, 100000, 2000000);
    const propertyScore = input.propertyType && config.targetPropertyTypes.includes(input.propertyType) ? 90 : 60;
    const locationScore = input.desiredLocation && config.targetLocations.includes(input.desiredLocation) ? 95 : 55;
    const normalizedTags = input.tags.map((tag) => tag.toLowerCase());
    const companySizeScore = normalizedTags.reduce((score, tag) => Math.max(score, config.companySizeScores[tag] || 0), 0) || 50;
    const industryScore = normalizedTags.reduce((score, tag) => Math.max(score, config.industryScores[tag] || 0), 0) || 55;
    return (0, formulas_1.clamp)((budgetScore * 0.35) + (propertyScore * 0.2) + (locationScore * 0.15) + (companySizeScore * 0.15) + (industryScore * 0.15));
};
const buildStageBase = (stage, config) => {
    const key = stage?.toLowerCase() || "prospecting";
    return config.dealStageBase[key] || 35;
};
const recordTiming = async (tenantId, component, durationMs, entityId) => {
    await (0, activity_1.logActivity)({ tenantId, action: "intelligence.calculated", entityType: "intelligence", entityId, metadata: { component, durationMs } });
};
exports.intelligenceService = {
    recordEngagementEvent: async (tenantId, leadId, event) => {
        return client_1.prisma.leadActivityLog.create({
            data: {
                tenantId,
                leadId,
                activityType: event.type,
                payload: event.metadata ? event.metadata : undefined,
                createdAt: event.occurredAt ? new Date(event.occurredAt) : undefined
            }
        });
    },
    scoreLead: async (tenantId, leadId) => {
        const start = Date.now();
        const config = await readConfig(tenantId);
        const lead = (await client_1.prisma.lead.findFirst({
            where: { tenantId, id: leadId },
            include: {
                tags: { include: { tag: true } },
                tasks: true,
                callLogs: true,
                meetings: true,
                stateHistory: true,
                activities: true,
                extensions: true
            }
        }));
        if (!lead)
            throw { status: 404, message: "Lead not found" };
        const tagNames = lead.tags.map((link) => link.tag.name);
        const conversionWindow = new Date();
        conversionWindow.setDate(conversionWindow.getDate() - 180);
        const conversionLeadCount = await client_1.prisma.lead.count({ where: { tenantId, sourceId: lead.sourceId || undefined, createdAt: { gte: conversionWindow } } });
        const conversionDealCount = await client_1.prisma.deal.count({ where: { tenantId, status: "closed", createdAt: { gte: conversionWindow }, lead: { sourceId: lead.sourceId || undefined } } });
        const conversionRate = conversionLeadCount ? conversionDealCount / conversionLeadCount : 0.1;
        const velocityHours = lead.stateHistory.length > 1
            ? lead.stateHistory
                .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime())
                .slice(1)
                .reduce((sum, record, index) => sum + (record.changedAt.getTime() - lead.stateHistory[index].changedAt.getTime()), 0) / (lead.stateHistory.length - 1) / (1000 * 60 * 60)
            : undefined;
        const demographic = computeDemographicScore({ budgetMax: lead.budgetMax?.toNumber(), budgetMin: lead.budgetMin?.toNumber(), propertyType: lead.propertyType, desiredLocation: lead.desiredLocation, tags: tagNames }, config);
        const engagement = computeEngagementScore(lead.activities, config.engagementWeights, config.engagementTarget);
        const behavioral = computeBehavioralScore({ tasks: lead.tasks, meetings: lead.meetings, callLogs: lead.callLogs, extensions: lead.extensions });
        const historical = computeHistoricalScore(conversionRate, velocityHours);
        const factors = { demographic, engagement, behavioral, historical };
        const { score, tier } = (0, formulas_1.scoreLead)(factors, config.leadScoreWeights);
        const leadScore = await client_1.prisma.leadScore.create({
            data: {
                tenantId,
                leadId,
                score,
                reasons: { factors, tier, conversionRate, velocityHours }
            }
        });
        await recordTiming(tenantId, "lead_score", Date.now() - start, leadId);
        return leadScore;
    },
    computeDisciplineIndex: async (tenantId, userId) => {
        const start = Date.now();
        const config = await readConfig(tenantId);
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const assignedLeads = (await client_1.prisma.lead.findMany({ where: { tenantId, assignedUserId: userId, deletedAt: null } }));
        const leadIds = assignedLeads.map((lead) => lead.id);
        const callLogs = (await client_1.prisma.callLog.findMany({ where: { tenantId, callerUserId: userId, callTime: { gte: since } } }));
        const meetings = (await client_1.prisma.meeting.findMany({ where: { tenantId, organizerUserId: userId, createdAt: { gte: since } } }));
        const tasks = (await client_1.prisma.leadTask.findMany({ where: { tenantId, assignedUserId: userId, createdAt: { gte: since } } }));
        const activityLogs = leadIds.length ? (await client_1.prisma.leadActivityLog.findMany({ where: { tenantId, leadId: { in: leadIds }, createdAt: { gte: since } } })) : [];
        const recentUpdates = assignedLeads.filter((lead) => daysBetween(new Date(), lead.updatedAt) <= config.hygieneTargetDays).length;
        const followUpFrequency = (0, formulas_1.normalize)(callLogs.length + tasks.length, 0, config.followUpTarget);
        const meetingAdherence = meetings.length ? (0, formulas_1.normalize)(meetings.filter((meeting) => meeting.status === "completed").length / meetings.length, 0, 1) : 50;
        const taskCompletion = tasks.length ? (0, formulas_1.normalize)(tasks.filter((task) => ["done", "completed"].includes(task.status)).length / tasks.length, 0, 1) : 50;
        const firstTouchTimes = leadIds.map((leadId) => {
            const lead = assignedLeads.find((row) => row.id === leadId);
            const firstActivity = activityLogs.filter((log) => log.leadId === leadId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
            if (!lead)
                return config.dataEntryMaxHours;
            const reference = firstActivity?.createdAt || lead.updatedAt;
            return Math.min(config.dataEntryMaxHours, Math.max(0, (reference.getTime() - lead.createdAt.getTime()) / (1000 * 60 * 60)));
        });
        const avgEntryHours = firstTouchTimes.length ? firstTouchTimes.reduce((sum, value) => sum + value, 0) / firstTouchTimes.length : config.dataEntryMaxHours;
        const dataEntryTimeliness = (0, formulas_1.normalize)(config.dataEntryMaxHours - avgEntryHours, 0, config.dataEntryMaxHours - config.dataEntryTargetHours);
        const pipelineHygiene = assignedLeads.length ? (0, formulas_1.normalize)(recentUpdates / assignedLeads.length, 0, 1) : 50;
        const factors = { followUpFrequency, meetingAdherence, taskCompletion, dataEntryTimeliness, pipelineHygiene };
        const { score } = (0, formulas_1.scoreDiscipline)(factors, config.disciplineWeights);
        const snapshot = await client_1.prisma.disciplineIndexSnapshot.create({
            data: {
                tenantId,
                userId,
                snapshotDate: new Date(),
                score,
                factors
            }
        });
        await recordTiming(tenantId, "discipline_index", Date.now() - start, userId);
        return snapshot;
    },
    computeDealProbability: async (tenantId, dealId) => {
        const start = Date.now();
        const config = await readConfig(tenantId);
        const deal = (await client_1.prisma.deal.findFirst({
            where: { tenantId, id: dealId },
            include: { lead: { include: { contacts: true, meetings: true, activities: true } }, offers: true }
        }));
        if (!deal)
            throw { status: 404, message: "Deal not found" };
        const stageBase = buildStageBase(deal.stage, config);
        const closedDeals = (await client_1.prisma.deal.findMany({ where: { tenantId, status: { in: ["closed", "lost"] } }, select: { dealValue: true, createdAt: true, closedAt: true, stage: true, status: true } }));
        const stageDeals = closedDeals.filter((row) => row.stage === deal.stage);
        const avgDealValue = stageDeals.length ? stageDeals.reduce((sum, row) => sum + (row.dealValue?.toNumber() || 0), 0) / stageDeals.length : 0;
        const avgCycleHours = stageDeals.length ? stageDeals.reduce((sum, row) => sum + (row.closedAt ? (row.closedAt.getTime() - row.createdAt.getTime()) : 0), 0) / stageDeals.length / (1000 * 60 * 60) : 0;
        const sizeFactor = avgDealValue ? (0, formulas_1.normalize)((deal.dealValue?.toNumber() || 0) / avgDealValue, 0, 2) - 50 : 0;
        const ageHours = (Date.now() - deal.createdAt.getTime()) / (1000 * 60 * 60);
        const velocityFactor = avgCycleHours ? (0, formulas_1.normalize)(Math.max(0, avgCycleHours - ageHours), 0, avgCycleHours) - 50 : 0;
        const engagementFactor = (0, formulas_1.normalize)(deal.lead.contacts.length + deal.lead.meetings.length, 0, 10) - 50;
        const competitorFlag = deal.lead.activities.some((activity) => activity.activityType === "competitor_flag") ? -15 : 0;
        const probability = (0, formulas_1.clamp)(stageBase + sizeFactor * 0.3 + velocityFactor * 0.25 + engagementFactor * 0.2 + competitorFlag);
        const wins = stageDeals.filter((row) => row.status === "closed").length;
        const total = stageDeals.length;
        const interval = (0, formulas_1.wilsonInterval)(wins, total);
        const riskScore = await client_1.prisma.riskScore.create({
            data: {
                tenantId,
                leadId: deal.leadId,
                score: probability,
                factors: { probability, confidenceLow: interval.low, confidenceHigh: interval.high, dealId: deal.id, stage: deal.stage }
            }
        });
        await recordTiming(tenantId, "deal_probability", Date.now() - start, dealId);
        return { riskScore, probability, confidenceLow: interval.low, confidenceHigh: interval.high };
    },
    computeRevenueForecast: async (tenantId) => {
        const start = Date.now();
        const deals = (await client_1.prisma.deal.findMany({ where: { tenantId, status: "open" } }));
        const closed = (await client_1.prisma.deal.findMany({ where: { tenantId, status: { in: ["closed", "lost"] } } }));
        const stageGroups = closed.reduce((acc, deal) => {
            const stage = deal.stage || "prospecting";
            acc[stage] = acc[stage] || { totalValue: 0, totalCycle: 0, count: 0, wins: 0 };
            acc[stage].totalValue += deal.dealValue?.toNumber() || 0;
            acc[stage].totalCycle += deal.closedAt ? (deal.closedAt.getTime() - deal.createdAt.getTime()) : 0;
            acc[stage].count += 1;
            if (deal.status === "closed")
                acc[stage].wins += 1;
            return acc;
        }, {});
        const monthlyHistory = closed.reduce((acc, deal) => {
            if (!deal.closedAt)
                return acc;
            const monthKey = `${deal.closedAt.getFullYear()}-${deal.closedAt.getMonth() + 1}`;
            acc[monthKey] = (acc[monthKey] || 0) + (deal.dealValue?.toNumber() || 0);
            return acc;
        }, {});
        const monthlyValues = Object.values(monthlyHistory);
        const overallAvg = monthlyValues.reduce((sum, value) => sum + value, 0) / (monthlyValues.length || 1);
        const monthlyBuckets = {};
        for (const deal of deals) {
            const stageStats = stageGroups[deal.stage] || { totalValue: 0, totalCycle: 0, count: 0, wins: 0 };
            const avgCycleHours = stageStats.count ? stageStats.totalCycle / stageStats.count / (1000 * 60 * 60) : 720;
            const winRate = stageStats.count ? stageStats.wins / stageStats.count : 0.25;
            const expectedClose = new Date(deal.createdAt.getTime() + avgCycleHours * 3600 * 1000);
            const monthKey = `${expectedClose.getFullYear()}-${expectedClose.getMonth() + 1}`;
            const baseValue = deal.dealValue?.toNumber() || 0;
            const seasonality = overallAvg ? (monthlyHistory[monthKey] || overallAvg) / overallAvg : 1;
            const weighted = baseValue * winRate * seasonality;
            if (!monthlyBuckets[monthKey])
                monthlyBuckets[monthKey] = { expected: 0, weighted: 0 };
            monthlyBuckets[monthKey].expected += baseValue;
            monthlyBuckets[monthKey].weighted += weighted;
        }
        const monthly = Object.entries(monthlyBuckets)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([period, values]) => ({ period, expected: values.expected, weighted: values.weighted }));
        const quarterly = monthly.reduce((acc, row) => {
            const [year, month] = row.period.split("-").map(Number);
            const quarter = Math.floor((month - 1) / 3) + 1;
            const key = `${year}-Q${quarter}`;
            acc[key] = acc[key] || { expected: 0, weighted: 0 };
            acc[key].expected += row.expected;
            acc[key].weighted += row.weighted;
            return acc;
        }, {});
        const annual = monthly.reduce((acc, row) => {
            const year = row.period.split("-")[0];
            acc[year] = acc[year] || { expected: 0, weighted: 0 };
            acc[year].expected += row.expected;
            acc[year].weighted += row.weighted;
            return acc;
        }, {});
        const payload = {
            monthly,
            quarterly: Object.entries(quarterly).map(([period, values]) => ({ period, expected: values.expected, weighted: values.weighted })),
            annual: Object.entries(annual).map(([period, values]) => ({ period, expected: values.expected, weighted: values.weighted })),
            updatedAt: new Date().toISOString()
        };
        await client_1.prisma.rankingSnapshot.create({ data: { tenantId, snapshotDate: new Date(), rankingType: "revenue_forecast", payload } });
        await recordTiming(tenantId, "revenue_forecast", Date.now() - start);
        return payload;
    },
    computeReminderPriorities: async (tenantId, userId) => {
        const start = Date.now();
        const now = new Date();
        const dueSoon = new Date(now);
        dueSoon.setDate(dueSoon.getDate() + 7);
        const tasks = await client_1.prisma.leadTask.findMany({
            where: { tenantId, status: "open", dueAt: { lte: dueSoon }, ...(userId ? { assignedUserId: userId } : {}) },
            include: { lead: { include: { deals: true } } }
        });
        const deadlines = await client_1.prisma.leadDeadline.findMany({
            where: { tenantId, status: "active", dueAt: { lte: dueSoon } },
            include: { lead: { include: { deals: true } } }
        });
        const priorities = [];
        for (const task of tasks) {
            const dealValue = task.lead.deals[0]?.dealValue?.toNumber() || 0;
            const hoursToDue = task.dueAt ? (task.dueAt.getTime() - now.getTime()) / (1000 * 60 * 60) : 168;
            const urgency = (0, formulas_1.clamp)(100 - (0, formulas_1.normalize)(hoursToDue, 0, 168));
            const impact = (0, formulas_1.normalize)(dealValue, 0, 2000000);
            const score = (0, formulas_1.clamp)(urgency * 0.6 + impact * 0.4);
            priorities.push({ leadId: task.leadId, assignedUserId: task.assignedUserId || undefined, dueAt: task.dueAt?.toISOString(), reason: "task_due", priorityScore: score, dealValue });
        }
        for (const deadline of deadlines) {
            const dealValue = deadline.lead.deals[0]?.dealValue?.toNumber() || 0;
            const hoursToDue = (deadline.dueAt.getTime() - now.getTime()) / (1000 * 60 * 60);
            const urgency = (0, formulas_1.clamp)(100 - (0, formulas_1.normalize)(hoursToDue, 0, 168));
            const impact = (0, formulas_1.normalize)(dealValue, 0, 2000000);
            const score = (0, formulas_1.clamp)(urgency * 0.7 + impact * 0.3);
            priorities.push({ leadId: deadline.leadId, assignedUserId: deadline.lead.assignedUserId || undefined, dueAt: deadline.dueAt.toISOString(), reason: "deadline", priorityScore: score, dealValue });
        }
        const sorted = priorities.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 25);
        await client_1.prisma.rankingSnapshot.create({ data: { tenantId, snapshotDate: new Date(), rankingType: "reminder_priority", payload: { items: sorted } } });
        await recordTiming(tenantId, "reminder_priority", Date.now() - start, userId);
        return sorted;
    },
    generateScripts: async (tenantId, leadId, stage) => {
        const start = Date.now();
        const lead = (await client_1.prisma.lead.findFirst({ where: { tenantId, id: leadId }, include: { contacts: { include: { contact: true } }, callLogs: true, deals: true } }));
        if (!lead)
            throw { status: 404, message: "Lead not found" };
        const primaryContact = lead.contacts[0]?.contact;
        const objections = lead.callLogs.map((log) => log.outcome || "").filter(Boolean);
        const stageKey = (stage || lead.status || "qualification").toLowerCase();
        const scripts = [
            {
                stage: stageKey,
                confidence: 0.84,
                objections,
                script: `Hi ${primaryContact?.firstName || "there"}, this is ${lead.leadCode}. I wanted to follow up on your ${lead.propertyType || "property"} interest in ${lead.desiredLocation || "your preferred area"}. Based on your range of ${lead.budgetMin || ""} to ${lead.budgetMax || ""}, we have options that match. Can I ask a couple of quick questions about timing and must-have features?` +
                    `\n\nValue: Our listings with ${lead.propertyType || "this type"} in ${lead.desiredLocation || "the market"} are moving quickly. We can secure priority viewings and negotiate on your behalf.` +
                    `\n\nNext step: Are you open to a short call today to align on specifics and confirm availability?`
            }
        ];
        await client_1.prisma.rankingSnapshot.create({ data: { tenantId, snapshotDate: new Date(), rankingType: "ai_scripts", payload: { leadId, stage: stageKey, scripts } } });
        await recordTiming(tenantId, "ai_scripts", Date.now() - start, leadId);
        return scripts;
    },
    computePerformanceRanking: async (tenantId) => {
        const start = Date.now();
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const users = (await client_1.prisma.user.findMany({ where: { tenantId, deletedAt: null } }));
        const leads = (await client_1.prisma.lead.findMany({ where: { tenantId, createdAt: { gte: since } } }));
        const deals = (await client_1.prisma.deal.findMany({ where: { tenantId, createdAt: { gte: since } } }));
        const callLogs = (await client_1.prisma.callLog.findMany({ where: { tenantId, callTime: { gte: since } } }));
        const meetings = (await client_1.prisma.meeting.findMany({ where: { tenantId, createdAt: { gte: since } } }));
        const reschedules = (await client_1.prisma.meetingRescheduleRequest.findMany({ where: { tenantId, createdAt: { gte: since } } }));
        const rows = users.map((user) => {
            const userLeads = leads.filter((lead) => lead.assignedUserId === user.id);
            const userDeals = deals.filter((deal) => userLeads.some((lead) => lead.id === deal.leadId));
            const revenue = userDeals.filter((deal) => deal.status === "closed").reduce((sum, deal) => sum + (deal.dealValue?.toNumber() || 0), 0);
            const pipeline = userLeads.length;
            const conversions = userDeals.filter((deal) => deal.status === "closed").length;
            const conversionRate = pipeline ? conversions / pipeline : 0;
            const activityCount = callLogs.filter((log) => log.callerUserId === user.id).length + meetings.filter((meeting) => meeting.organizerUserId === user.id).length;
            const rescheduleRate = meetings.filter((meeting) => meeting.organizerUserId === user.id).length
                ? reschedules.filter((req) => meetings.some((meeting) => meeting.id === req.meetingId && meeting.organizerUserId === user.id)).length /
                    meetings.filter((meeting) => meeting.organizerUserId === user.id).length
                : 0;
            const score = (0, formulas_1.clamp)((0, formulas_1.normalize)(revenue, 0, 2000000) * 0.35 + (0, formulas_1.normalize)(pipeline, 0, 40) * 0.2 + (0, formulas_1.normalize)(conversionRate, 0, 1) * 0.2 + (0, formulas_1.normalize)(activityCount, 0, 100) * 0.15 + (0, formulas_1.normalize)(1 - rescheduleRate, 0, 1) * 0.1);
            return { subjectId: user.id, subjectType: "user", score, metrics: { revenue, pipeline, conversionRate, activityCount, rescheduleRate } };
        });
        await client_1.prisma.rankingSnapshot.create({ data: { tenantId, snapshotDate: new Date(), rankingType: "performance_ranking", payload: { rows } } });
        await recordTiming(tenantId, "performance_ranking", Date.now() - start);
        return rows;
    },
    processTrigger: async (trigger) => {
        const start = Date.now();
        if (trigger.type === "lead_changed" && trigger.leadId) {
            await exports.intelligenceService.scoreLead(trigger.tenantId, trigger.leadId);
            if (trigger.userId)
                await exports.intelligenceService.computeDisciplineIndex(trigger.tenantId, trigger.userId);
        }
        if (trigger.type === "lead_engaged" && trigger.leadId) {
            await exports.intelligenceService.scoreLead(trigger.tenantId, trigger.leadId);
        }
        if (trigger.type === "deal_changed" && trigger.dealId) {
            await exports.intelligenceService.computeDealProbability(trigger.tenantId, trigger.dealId);
            await exports.intelligenceService.computeRevenueForecast(trigger.tenantId);
        }
        if (trigger.type === "meeting_changed" && trigger.userId) {
            await exports.intelligenceService.computeDisciplineIndex(trigger.tenantId, trigger.userId);
        }
        if (trigger.type === "task_changed") {
            await exports.intelligenceService.computeReminderPriorities(trigger.tenantId, trigger.userId);
        }
        if (trigger.type === "pipeline_changed") {
            await exports.intelligenceService.computeRevenueForecast(trigger.tenantId);
            await exports.intelligenceService.computePerformanceRanking(trigger.tenantId);
        }
        await recordTiming(trigger.tenantId, "trigger_dispatch", Date.now() - start, trigger.leadId || trigger.dealId);
    },
    queueTrigger: (trigger) => {
        setImmediate(() => {
            exports.intelligenceService.processTrigger(trigger).catch(async (error) => {
                await (0, activity_1.logActivity)({ tenantId: trigger.tenantId, action: "intelligence.error", entityType: "intelligence", entityId: trigger.leadId || trigger.dealId, metadata: { error: error.message || error } });
            });
        });
    }
};
