import { prisma } from "../../prisma/client"
import { getModuleConfig } from "../../utils/moduleConfig"
import { logActivity } from "../../utils/activity"
import { clamp, normalize, scoreLead as scoreLeadFormula, scoreDiscipline as scoreDisciplineFormula, timeDecayWeight, wilsonInterval } from "./formulas"
import { DisciplineFactors, ForecastPayload, IntelligenceTrigger, LeadEngagementEvent, LeadScoreFactors, PerformanceRow, ReminderPriority, ScriptBlock } from "./types"
import { Prisma } from "@prisma/client"

type LeadTagLinkItem = { tag: { name: string } }
type LeadStateHistoryItem = { changedAt: Date }
type LeadTaskItem = { status: string; createdAt: Date; dueAt?: Date; assignedUserId?: string; leadId: string }
type MeetingItem = { status: string; endsAt: Date; organizerUserId?: string; id: string; createdAt: Date; leadId?: string }
type CallLogItem = { callTime: Date; callerUserId?: string; outcome?: string }
type LeadActivityItem = { activityType: string; createdAt: Date; leadId: string }
type LeadExtensionItem = { status: string }
type LeadItem = {
  id: string
  tenantId: string
  leadCode?: string | null
  budgetMin?: { toNumber(): number } | null
  budgetMax?: { toNumber(): number } | null
  propertyType?: string | null
  desiredLocation?: string | null
  sourceId?: string | null
  assignedUserId?: string | null
  updatedAt: Date
  createdAt: Date
  status?: string | null
}
type DealItem = { id: string; leadId: string; status: string; stage: string; dealValue?: { toNumber(): number } | null; createdAt: Date; closedAt?: Date | null }
type ContactItem = { firstName?: string | null }
type LeadContactItem = { contact: ContactItem }
type UserItem = { id: string }
type MeetingRescheduleRequestItem = { meetingId: string }
type OfferItem = { dealId: string }

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
  targetLocations: [] as string[],
  companySizeScores: { enterprise: 95, midmarket: 75, smb: 55, startup: 45 },
  industryScores: { finance: 85, healthcare: 80, tech: 90, retail: 70 }
}

const readConfig = async (tenantId: string) => {
  const moduleConfig = await getModuleConfig(tenantId, "intelligence")
  const config = (moduleConfig?.config as Record<string, unknown>) || {}
  return {
    ...defaultConfig,
    ...config,
    leadScoreWeights: { ...defaultConfig.leadScoreWeights, ...(config.leadScoreWeights as Record<string, number> | undefined) },
    disciplineWeights: { ...defaultConfig.disciplineWeights, ...(config.disciplineWeights as Record<string, number> | undefined) },
    engagementWeights: { ...defaultConfig.engagementWeights, ...(config.engagementWeights as Record<string, number> | undefined) }
  }
}

const daysBetween = (date: Date, other: Date) => Math.abs(date.getTime() - other.getTime()) / (1000 * 60 * 60 * 24)

const computeEngagementScore = (events: { activityType: string; createdAt: Date }[], weights: Record<string, number>, target: number) => {
  const now = new Date()
  const weighted = events.reduce((sum, event) => {
    const daysAgo = daysBetween(now, event.createdAt)
    const weight = weights[event.activityType] || 1
    return sum + weight * timeDecayWeight(daysAgo, 30)
  }, 0)
  return normalize(weighted, 0, target)
}

const computeBehavioralScore = (input: { tasks: { status: string }[]; meetings: { status: string; endsAt: Date }[]; callLogs: { callTime: Date }[]; extensions: { status: string }[] }) => {
  const totalTasks = input.tasks.length
  const completedTasks = input.tasks.filter((task) => ["done", "completed"].includes(task.status)).length
  const taskCompletion = totalTasks ? completedTasks / totalTasks : 0
  const meetingsDone = input.meetings.filter((meeting) => meeting.status === "completed" || meeting.endsAt < new Date()).length
  const meetingRate = input.meetings.length ? meetingsDone / input.meetings.length : 0
  const recentCalls = input.callLogs.filter((log) => daysBetween(new Date(), log.callTime) <= 14).length
  const followUpScore = normalize(recentCalls, 0, 6)
  const extensionPenalty = input.extensions.filter((ext) => ext.status !== "approved").length * 4
  const raw = clamp((taskCompletion * 40) + (meetingRate * 40) + followUpScore - extensionPenalty)
  return raw
}

const computeHistoricalScore = (conversionRate: number, velocityHours?: number) => {
  const conversionScore = clamp(conversionRate * 100)
  const velocityScore = velocityHours ? normalize(Math.max(0, 168 - velocityHours), 0, 168) : 50
  return clamp(conversionScore * 0.6 + velocityScore * 0.4)
}

const computeDemographicScore = (input: { budgetMax?: number; budgetMin?: number; propertyType?: string | null; desiredLocation?: string | null; tags: string[] }, config: typeof defaultConfig) => {
  const budgetValue = input.budgetMax || input.budgetMin || 0
  const budgetScore = normalize(budgetValue, 100000, 2000000)
  const propertyScore = input.propertyType && config.targetPropertyTypes.includes(input.propertyType) ? 90 : 60
  const locationScore = input.desiredLocation && config.targetLocations.includes(input.desiredLocation) ? 95 : 55
  const normalizedTags = input.tags.map((tag) => tag.toLowerCase())
  const companySizeScore = normalizedTags.reduce((score, tag) => Math.max(score, config.companySizeScores[tag as keyof typeof config.companySizeScores] || 0), 0) || 50
  const industryScore = normalizedTags.reduce((score, tag) => Math.max(score, config.industryScores[tag as keyof typeof config.industryScores] || 0), 0) || 55
  return clamp((budgetScore * 0.35) + (propertyScore * 0.2) + (locationScore * 0.15) + (companySizeScore * 0.15) + (industryScore * 0.15))
}

const buildStageBase = (stage: string, config: typeof defaultConfig) => {
  const key = stage?.toLowerCase() || "prospecting"
  return config.dealStageBase[key as keyof typeof config.dealStageBase] || 35
}

const recordTiming = async (tenantId: string, component: string, durationMs: number, entityId?: string) => {
  await logActivity({ tenantId, action: "intelligence.calculated", entityType: "intelligence", entityId, metadata: { component, durationMs } })
}

export const intelligenceService = {
  recordEngagementEvent: async (tenantId: string, leadId: string, event: LeadEngagementEvent) => {
    return prisma.leadActivityLog.create({
      data: {
        tenantId,
        leadId,
        activityType: event.type,
        payload: event.metadata ? (event.metadata as Prisma.InputJsonValue) : undefined,
        createdAt: event.occurredAt ? new Date(event.occurredAt) : undefined
      }
    })
  },

  scoreLead: async (tenantId: string, leadId: string) => {
    const start = Date.now()
    const config = await readConfig(tenantId)
    const lead = (await prisma.lead.findFirst({
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
    })) as (LeadItem & {
      tags: LeadTagLinkItem[]
      tasks: LeadTaskItem[]
      callLogs: CallLogItem[]
      meetings: MeetingItem[]
      stateHistory: LeadStateHistoryItem[]
      activities: LeadActivityItem[]
      extensions: LeadExtensionItem[]
    }) | null
    if (!lead) throw { status: 404, message: "Lead not found" }
    const tagNames = lead.tags.map((link: LeadTagLinkItem) => link.tag.name)
    const conversionWindow = new Date()
    conversionWindow.setDate(conversionWindow.getDate() - 180)
    const conversionLeadCount = await prisma.lead.count({ where: { tenantId, sourceId: lead.sourceId || undefined, createdAt: { gte: conversionWindow } } })
    const conversionDealCount = await prisma.deal.count({ where: { tenantId, status: "closed", createdAt: { gte: conversionWindow }, lead: { sourceId: lead.sourceId || undefined } } })
    const conversionRate = conversionLeadCount ? conversionDealCount / conversionLeadCount : 0.1
    const velocityHours = lead.stateHistory.length > 1
      ? lead.stateHistory
          .sort((a: LeadStateHistoryItem, b: LeadStateHistoryItem) => a.changedAt.getTime() - b.changedAt.getTime())
          .slice(1)
          .reduce((sum: number, record: LeadStateHistoryItem, index: number) => sum + (record.changedAt.getTime() - lead.stateHistory[index].changedAt.getTime()), 0) / (lead.stateHistory.length - 1) / (1000 * 60 * 60)
      : undefined
    const demographic = computeDemographicScore({ budgetMax: lead.budgetMax?.toNumber(), budgetMin: lead.budgetMin?.toNumber(), propertyType: lead.propertyType, desiredLocation: lead.desiredLocation, tags: tagNames }, config)
    const engagement = computeEngagementScore(lead.activities, config.engagementWeights, config.engagementTarget)
    const behavioral = computeBehavioralScore({ tasks: lead.tasks, meetings: lead.meetings, callLogs: lead.callLogs, extensions: lead.extensions })
    const historical = computeHistoricalScore(conversionRate, velocityHours)
    const factors: LeadScoreFactors = { demographic, engagement, behavioral, historical }
    const { score, tier } = scoreLeadFormula(factors, config.leadScoreWeights)
    const leadScore = await prisma.leadScore.create({
      data: {
        tenantId,
        leadId,
        score,
        reasons: { factors, tier, conversionRate, velocityHours }
      }
    })
    await recordTiming(tenantId, "lead_score", Date.now() - start, leadId)
    return leadScore
  },

  computeDisciplineIndex: async (tenantId: string, userId: string) => {
    const start = Date.now()
    const config = await readConfig(tenantId)
    const since = new Date()
    since.setDate(since.getDate() - 30)
    const assignedLeads = (await prisma.lead.findMany({ where: { tenantId, assignedUserId: userId, deletedAt: null } })) as LeadItem[]
    const leadIds = assignedLeads.map((lead: LeadItem) => lead.id)
    const callLogs = (await prisma.callLog.findMany({ where: { tenantId, callerUserId: userId, callTime: { gte: since } } })) as CallLogItem[]
    const meetings = (await prisma.meeting.findMany({ where: { tenantId, organizerUserId: userId, createdAt: { gte: since } } })) as MeetingItem[]
    const tasks = (await prisma.leadTask.findMany({ where: { tenantId, assignedUserId: userId, createdAt: { gte: since } } })) as LeadTaskItem[]
    const activityLogs = leadIds.length ? (await prisma.leadActivityLog.findMany({ where: { tenantId, leadId: { in: leadIds }, createdAt: { gte: since } } })) as LeadActivityItem[] : []
    const recentUpdates = assignedLeads.filter((lead: LeadItem) => daysBetween(new Date(), lead.updatedAt) <= config.hygieneTargetDays).length
    const followUpFrequency = normalize(callLogs.length + tasks.length, 0, config.followUpTarget)
    const meetingAdherence = meetings.length ? normalize(meetings.filter((meeting: MeetingItem) => meeting.status === "completed").length / meetings.length, 0, 1) : 50
    const taskCompletion = tasks.length ? normalize(tasks.filter((task: LeadTaskItem) => ["done", "completed"].includes(task.status)).length / tasks.length, 0, 1) : 50
    const firstTouchTimes = leadIds.map((leadId: string) => {
      const lead = assignedLeads.find((row: LeadItem) => row.id === leadId)
      const firstActivity = activityLogs.filter((log: LeadActivityItem) => log.leadId === leadId).sort((a: LeadActivityItem, b: LeadActivityItem) => a.createdAt.getTime() - b.createdAt.getTime())[0]
      if (!lead) return config.dataEntryMaxHours
      const reference = firstActivity?.createdAt || lead.updatedAt
      return Math.min(config.dataEntryMaxHours, Math.max(0, (reference.getTime() - lead.createdAt.getTime()) / (1000 * 60 * 60)))
    })
    const avgEntryHours = firstTouchTimes.length ? firstTouchTimes.reduce((sum: number, value: number) => sum + value, 0) / firstTouchTimes.length : config.dataEntryMaxHours
    const dataEntryTimeliness = normalize(config.dataEntryMaxHours - avgEntryHours, 0, config.dataEntryMaxHours - config.dataEntryTargetHours)
    const pipelineHygiene = assignedLeads.length ? normalize(recentUpdates / assignedLeads.length, 0, 1) : 50
    const factors: DisciplineFactors = { followUpFrequency, meetingAdherence, taskCompletion, dataEntryTimeliness, pipelineHygiene }
    const { score } = scoreDisciplineFormula(factors, config.disciplineWeights)
    const snapshot = await prisma.disciplineIndexSnapshot.create({
      data: {
        tenantId,
        userId,
        snapshotDate: new Date(),
        score,
        factors
      }
    })
    await recordTiming(tenantId, "discipline_index", Date.now() - start, userId)
    return snapshot
  },

  computeDealProbability: async (tenantId: string, dealId: string) => {
    const start = Date.now()
    const config = await readConfig(tenantId)
    const deal = (await prisma.deal.findFirst({
      where: { tenantId, id: dealId },
      include: { lead: { include: { contacts: true, meetings: true, activities: true } }, offers: true }
    })) as (DealItem & { lead: LeadItem & { contacts: LeadContactItem[]; meetings: MeetingItem[]; activities: LeadActivityItem[] }; offers: OfferItem[] }) | null
    if (!deal) throw { status: 404, message: "Deal not found" }
    const stageBase = buildStageBase(deal.stage, config)
    const closedDeals = (await prisma.deal.findMany({ where: { tenantId, status: { in: ["closed", "lost"] } }, select: { dealValue: true, createdAt: true, closedAt: true, stage: true, status: true } })) as DealItem[]
    const stageDeals = closedDeals.filter((row: DealItem) => row.stage === deal.stage)
    const avgDealValue = stageDeals.length ? stageDeals.reduce((sum: number, row: DealItem) => sum + (row.dealValue?.toNumber() || 0), 0) / stageDeals.length : 0
    const avgCycleHours = stageDeals.length ? stageDeals.reduce((sum: number, row: DealItem) => sum + (row.closedAt ? (row.closedAt.getTime() - row.createdAt.getTime()) : 0), 0) / stageDeals.length / (1000 * 60 * 60) : 0
    const sizeFactor = avgDealValue ? normalize((deal.dealValue?.toNumber() || 0) / avgDealValue, 0, 2) - 50 : 0
    const ageHours = (Date.now() - deal.createdAt.getTime()) / (1000 * 60 * 60)
    const velocityFactor = avgCycleHours ? normalize(Math.max(0, avgCycleHours - ageHours), 0, avgCycleHours) - 50 : 0
    const engagementFactor = normalize(deal.lead.contacts.length + deal.lead.meetings.length, 0, 10) - 50
    const competitorFlag = deal.lead.activities.some((activity: LeadActivityItem) => activity.activityType === "competitor_flag") ? -15 : 0
    const probability = clamp(stageBase + sizeFactor * 0.3 + velocityFactor * 0.25 + engagementFactor * 0.2 + competitorFlag)
    const wins = stageDeals.filter((row: DealItem) => row.status === "closed").length
    const total = stageDeals.length
    const interval = wilsonInterval(wins, total)
    const riskScore = await prisma.riskScore.create({
      data: {
        tenantId,
        leadId: deal.leadId,
        score: probability,
        factors: { probability, confidenceLow: interval.low, confidenceHigh: interval.high, dealId: deal.id, stage: deal.stage }
      }
    })
    await recordTiming(tenantId, "deal_probability", Date.now() - start, dealId)
    return { riskScore, probability, confidenceLow: interval.low, confidenceHigh: interval.high }
  },

  computeRevenueForecast: async (tenantId: string) => {
    const start = Date.now()
    const deals = (await prisma.deal.findMany({ where: { tenantId, status: "open" } })) as DealItem[]
    const closed = (await prisma.deal.findMany({ where: { tenantId, status: { in: ["closed", "lost"] } } })) as DealItem[]
    const stageGroups = closed.reduce((acc: Record<string, { totalValue: number; totalCycle: number; count: number; wins: number }>, deal: DealItem) => {
      const stage = deal.stage || "prospecting"
      acc[stage] = acc[stage] || { totalValue: 0, totalCycle: 0, count: 0, wins: 0 }
      acc[stage].totalValue += deal.dealValue?.toNumber() || 0
      acc[stage].totalCycle += deal.closedAt ? (deal.closedAt.getTime() - deal.createdAt.getTime()) : 0
      acc[stage].count += 1
      if (deal.status === "closed") acc[stage].wins += 1
      return acc
    }, {} as Record<string, { totalValue: number; totalCycle: number; count: number; wins: number }>)
    const monthlyHistory = closed.reduce((acc: Record<string, number>, deal: DealItem) => {
      if (!deal.closedAt) return acc
      const monthKey = `${deal.closedAt.getFullYear()}-${deal.closedAt.getMonth() + 1}`
      acc[monthKey] = (acc[monthKey] || 0) + (deal.dealValue?.toNumber() || 0)
      return acc
    }, {} as Record<string, number>)
    const monthlyValues = Object.values(monthlyHistory) as number[]
    const overallAvg = monthlyValues.reduce((sum: number, value: number) => sum + value, 0) / (monthlyValues.length || 1)
    const monthlyBuckets: Record<string, { expected: number; weighted: number }> = {}
    for (const deal of deals) {
      const stageStats = stageGroups[deal.stage] || { totalValue: 0, totalCycle: 0, count: 0, wins: 0 }
      const avgCycleHours = stageStats.count ? stageStats.totalCycle / stageStats.count / (1000 * 60 * 60) : 720
      const winRate = stageStats.count ? stageStats.wins / stageStats.count : 0.25
      const expectedClose = new Date(deal.createdAt.getTime() + avgCycleHours * 3600 * 1000)
      const monthKey = `${expectedClose.getFullYear()}-${expectedClose.getMonth() + 1}`
      const baseValue = deal.dealValue?.toNumber() || 0
      const seasonality = overallAvg ? (monthlyHistory[monthKey] || overallAvg) / overallAvg : 1
      const weighted = baseValue * winRate * seasonality
      if (!monthlyBuckets[monthKey]) monthlyBuckets[monthKey] = { expected: 0, weighted: 0 }
      monthlyBuckets[monthKey].expected += baseValue
      monthlyBuckets[monthKey].weighted += weighted
    }
    const monthly = Object.entries(monthlyBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, values]) => ({ period, expected: values.expected, weighted: values.weighted }))
    const quarterly = monthly.reduce<Record<string, { expected: number; weighted: number }>>((acc, row) => {
      const [year, month] = row.period.split("-").map(Number)
      const quarter = Math.floor((month - 1) / 3) + 1
      const key = `${year}-Q${quarter}`
      acc[key] = acc[key] || { expected: 0, weighted: 0 }
      acc[key].expected += row.expected
      acc[key].weighted += row.weighted
      return acc
    }, {})
    const annual = monthly.reduce<Record<string, { expected: number; weighted: number }>>((acc, row) => {
      const year = row.period.split("-")[0]
      acc[year] = acc[year] || { expected: 0, weighted: 0 }
      acc[year].expected += row.expected
      acc[year].weighted += row.weighted
      return acc
    }, {})
    const payload: ForecastPayload = {
      monthly,
      quarterly: Object.entries(quarterly).map(([period, values]) => ({ period, expected: values.expected, weighted: values.weighted })),
      annual: Object.entries(annual).map(([period, values]) => ({ period, expected: values.expected, weighted: values.weighted })),
      updatedAt: new Date().toISOString()
    }
    await prisma.rankingSnapshot.create({ data: { tenantId, snapshotDate: new Date(), rankingType: "revenue_forecast", payload } })
    await recordTiming(tenantId, "revenue_forecast", Date.now() - start)
    return payload
  },

  computeReminderPriorities: async (tenantId: string, userId?: string) => {
    const start = Date.now()
    const now = new Date()
    const dueSoon = new Date(now)
    dueSoon.setDate(dueSoon.getDate() + 7)
    const tasks = await prisma.leadTask.findMany({
      where: { tenantId, status: "open", dueAt: { lte: dueSoon }, ...(userId ? { assignedUserId: userId } : {}) },
      include: { lead: { include: { deals: true } } }
    })
    const deadlines = await prisma.leadDeadline.findMany({
      where: { tenantId, status: "active", dueAt: { lte: dueSoon } },
      include: { lead: { include: { deals: true } } }
    })
    const priorities: ReminderPriority[] = []
    for (const task of tasks) {
      const dealValue = task.lead.deals[0]?.dealValue?.toNumber() || 0
      const hoursToDue = task.dueAt ? (task.dueAt.getTime() - now.getTime()) / (1000 * 60 * 60) : 168
      const urgency = clamp(100 - normalize(hoursToDue, 0, 168))
      const impact = normalize(dealValue, 0, 2000000)
      const score = clamp(urgency * 0.6 + impact * 0.4)
      priorities.push({ leadId: task.leadId, assignedUserId: task.assignedUserId || undefined, dueAt: task.dueAt?.toISOString(), reason: "task_due", priorityScore: score, dealValue })
    }
    for (const deadline of deadlines) {
      const dealValue = deadline.lead.deals[0]?.dealValue?.toNumber() || 0
      const hoursToDue = (deadline.dueAt.getTime() - now.getTime()) / (1000 * 60 * 60)
      const urgency = clamp(100 - normalize(hoursToDue, 0, 168))
      const impact = normalize(dealValue, 0, 2000000)
      const score = clamp(urgency * 0.7 + impact * 0.3)
      priorities.push({ leadId: deadline.leadId, assignedUserId: deadline.lead.assignedUserId || undefined, dueAt: deadline.dueAt.toISOString(), reason: "deadline", priorityScore: score, dealValue })
    }
    const sorted = priorities.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 25)
    await prisma.rankingSnapshot.create({ data: { tenantId, snapshotDate: new Date(), rankingType: "reminder_priority", payload: { items: sorted } } })
    await recordTiming(tenantId, "reminder_priority", Date.now() - start, userId)
    return sorted
  },

  generateScripts: async (tenantId: string, leadId: string, stage?: string) => {
    const start = Date.now()
    const lead = (await prisma.lead.findFirst({ where: { tenantId, id: leadId }, include: { contacts: { include: { contact: true } }, callLogs: true, deals: true } })) as (LeadItem & { contacts: LeadContactItem[]; callLogs: CallLogItem[]; deals: DealItem[] }) | null
    if (!lead) throw { status: 404, message: "Lead not found" }
    const primaryContact = lead.contacts[0]?.contact
    const objections = lead.callLogs.map((log: CallLogItem) => log.outcome || "").filter(Boolean)
    const stageKey = (stage || lead.status || "qualification").toLowerCase()
    const scripts: ScriptBlock[] = [
      {
        stage: stageKey,
        confidence: 0.84,
        objections,
        script: `Hi ${primaryContact?.firstName || "there"}, this is ${lead.leadCode}. I wanted to follow up on your ${lead.propertyType || "property"} interest in ${lead.desiredLocation || "your preferred area"}. Based on your range of ${lead.budgetMin || ""} to ${lead.budgetMax || ""}, we have options that match. Can I ask a couple of quick questions about timing and must-have features?` +
          `\n\nValue: Our listings with ${lead.propertyType || "this type"} in ${lead.desiredLocation || "the market"} are moving quickly. We can secure priority viewings and negotiate on your behalf.` +
          `\n\nNext step: Are you open to a short call today to align on specifics and confirm availability?`
      }
    ]
    await prisma.rankingSnapshot.create({ data: { tenantId, snapshotDate: new Date(), rankingType: "ai_scripts", payload: { leadId, stage: stageKey, scripts } } })
    await recordTiming(tenantId, "ai_scripts", Date.now() - start, leadId)
    return scripts
  },

  computePerformanceRanking: async (tenantId: string) => {
    const start = Date.now()
    const since = new Date()
    since.setDate(since.getDate() - 30)
    const users = (await prisma.user.findMany({ where: { tenantId, deletedAt: null } })) as UserItem[]
    const leads = (await prisma.lead.findMany({ where: { tenantId, createdAt: { gte: since } } })) as LeadItem[]
    const deals = (await prisma.deal.findMany({ where: { tenantId, createdAt: { gte: since } } })) as DealItem[]
    const callLogs = (await prisma.callLog.findMany({ where: { tenantId, callTime: { gte: since } } })) as CallLogItem[]
    const meetings = (await prisma.meeting.findMany({ where: { tenantId, createdAt: { gte: since } } })) as MeetingItem[]
    const reschedules = (await prisma.meetingRescheduleRequest.findMany({ where: { tenantId, createdAt: { gte: since } } })) as MeetingRescheduleRequestItem[]
    const rows: PerformanceRow[] = users.map((user: UserItem) => {
      const userLeads = leads.filter((lead: LeadItem) => lead.assignedUserId === user.id)
      const userDeals = deals.filter((deal: DealItem) => userLeads.some((lead: LeadItem) => lead.id === deal.leadId))
      const revenue = userDeals.filter((deal: DealItem) => deal.status === "closed").reduce((sum: number, deal: DealItem) => sum + (deal.dealValue?.toNumber() || 0), 0)
      const pipeline = userLeads.length
      const conversions = userDeals.filter((deal: DealItem) => deal.status === "closed").length
      const conversionRate = pipeline ? conversions / pipeline : 0
      const activityCount = callLogs.filter((log: CallLogItem) => log.callerUserId === user.id).length + meetings.filter((meeting: MeetingItem) => meeting.organizerUserId === user.id).length
      const rescheduleRate = meetings.filter((meeting: MeetingItem) => meeting.organizerUserId === user.id).length
        ? reschedules.filter((req: MeetingRescheduleRequestItem) => meetings.some((meeting: MeetingItem) => meeting.id === req.meetingId && meeting.organizerUserId === user.id)).length /
          meetings.filter((meeting: MeetingItem) => meeting.organizerUserId === user.id).length
        : 0
      const score = clamp(normalize(revenue, 0, 2000000) * 0.35 + normalize(pipeline, 0, 40) * 0.2 + normalize(conversionRate, 0, 1) * 0.2 + normalize(activityCount, 0, 100) * 0.15 + normalize(1 - rescheduleRate, 0, 1) * 0.1)
      return { subjectId: user.id, subjectType: "user", score, metrics: { revenue, pipeline, conversionRate, activityCount, rescheduleRate } }
    })
    await prisma.rankingSnapshot.create({ data: { tenantId, snapshotDate: new Date(), rankingType: "performance_ranking", payload: { rows } } })
    await recordTiming(tenantId, "performance_ranking", Date.now() - start)
    return rows
  },

  processTrigger: async (trigger: IntelligenceTrigger) => {
    const start = Date.now()
    if (trigger.type === "lead_changed" && trigger.leadId) {
      await intelligenceService.scoreLead(trigger.tenantId, trigger.leadId)
      if (trigger.userId) await intelligenceService.computeDisciplineIndex(trigger.tenantId, trigger.userId)
    }
    if (trigger.type === "lead_engaged" && trigger.leadId) {
      await intelligenceService.scoreLead(trigger.tenantId, trigger.leadId)
    }
    if (trigger.type === "deal_changed" && trigger.dealId) {
      await intelligenceService.computeDealProbability(trigger.tenantId, trigger.dealId)
      await intelligenceService.computeRevenueForecast(trigger.tenantId)
    }
    if (trigger.type === "meeting_changed" && trigger.userId) {
      await intelligenceService.computeDisciplineIndex(trigger.tenantId, trigger.userId)
    }
    if (trigger.type === "task_changed") {
      await intelligenceService.computeReminderPriorities(trigger.tenantId, trigger.userId)
    }
    if (trigger.type === "pipeline_changed") {
      await intelligenceService.computeRevenueForecast(trigger.tenantId)
      await intelligenceService.computePerformanceRanking(trigger.tenantId)
    }
    await recordTiming(trigger.tenantId, "trigger_dispatch", Date.now() - start, trigger.leadId || trigger.dealId)
  },

  queueTrigger: (trigger: IntelligenceTrigger) => {
    setImmediate(() => {
      intelligenceService.processTrigger(trigger).catch(async (error) => {
        await logActivity({ tenantId: trigger.tenantId, action: "intelligence.error", entityType: "intelligence", entityId: trigger.leadId || trigger.dealId, metadata: { error: (error as Error).message || error } })
      })
    })
  }
}
