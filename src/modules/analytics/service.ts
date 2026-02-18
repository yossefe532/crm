import { prisma } from "../../prisma/client"
import { Prisma } from "@prisma/client"

export const analyticsService = {
  listDailyMetrics: (tenantId: string, from?: string, to?: string) =>
    prisma.leadMetricsDaily.findMany({
      where: {
        tenantId,
        metricDate: {
          gte: from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600 * 1000),
          lte: to ? new Date(to) : new Date()
        }
      },
      orderBy: { metricDate: "asc" }
    }),

  listRankingSnapshots: (tenantId: string, type?: string, limit = 20) =>
    prisma.rankingSnapshot.findMany({
      where: { tenantId, ...(type ? { rankingType: type } : {}) },
      orderBy: { snapshotDate: "desc" },
      take: limit
    }),

  createDailyMetrics: (tenantId: string, data: { metricDate: string; teamId?: string; userId?: string; leadsCreated?: number; leadsClosed?: number; avgCycleHours?: number }) =>
    prisma.leadMetricsDaily.create({
      data: {
        tenantId,
        metricDate: new Date(data.metricDate),
        teamId: data.teamId,
        userId: data.userId,
        leadsCreated: data.leadsCreated || 0,
        leadsClosed: data.leadsClosed || 0,
        avgCycleHours: data.avgCycleHours
      }
    }),

  createDisciplineSnapshot: (tenantId: string, data: { userId: string; snapshotDate: string; score: number; factors?: Record<string, unknown> }) =>
    prisma.disciplineIndexSnapshot.create({
      data: {
        tenantId,
        userId: data.userId,
        snapshotDate: new Date(data.snapshotDate),
        score: data.score,
        factors: data.factors ? (data.factors as Prisma.InputJsonValue) : undefined
      }
    }),

  createRankingSnapshot: (tenantId: string, data: { snapshotDate: string; rankingType: string; payload: Record<string, unknown> }) =>
    prisma.rankingSnapshot.create({
      data: {
        tenantId,
        snapshotDate: new Date(data.snapshotDate),
        rankingType: data.rankingType,
        payload: data.payload as Prisma.InputJsonValue
      }
    }),

  getStageDistribution: async (tenantId: string) => {
    const distribution = await prisma.lead.groupBy({
      by: ["status"],
      where: { tenantId, deletedAt: null },
      _count: { id: true }
    })
    return distribution.map(d => ({ stage: d.status, count: d._count.id }))
  },

  getConversionRate: async (tenantId: string) => {
    const total = await prisma.lead.count({ where: { tenantId, deletedAt: null } })
    const won = await prisma.lead.count({ where: { tenantId, deletedAt: null, status: "won" } }) // Assuming 'won' is the success status
    return { total, won, rate: total > 0 ? (won / total) * 100 : 0 }
  },

  getSalesPerformance: async (tenantId: string) => {
    const performance = await prisma.lead.groupBy({
      by: ["assignedUserId"],
      where: { tenantId, deletedAt: null, status: "won", assignedUserId: { not: null } },
      _count: { id: true },
      _sum: { budget: true }
    })
    
    // Enrich with user names
    const users = await prisma.user.findMany({
      where: { id: { in: performance.map(p => p.assignedUserId!).filter(Boolean) } },
      select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } }
    })

    return performance.map(p => {
      const user = users.find(u => u.id === p.assignedUserId)
      const name = user?.profile ? `${user.profile.firstName || ""} ${user.profile.lastName || ""}`.trim() : user?.email
      return {
        userId: p.assignedUserId,
        name: name || "Unknown",
        deals: p._count.id,
        value: p._sum.budget || 0
      }
    }).sort((a, b) => b.deals - a.deals)
  },

  getTeamPerformance: async (tenantId: string) => {
    // Group leads by team
    const performance = await prisma.lead.groupBy({
      by: ["teamId"],
      where: { tenantId, deletedAt: null, status: "won", teamId: { not: null } },
      _count: { id: true },
      _sum: { budget: true }
    })

    const teams = await prisma.team.findMany({
      where: { id: { in: performance.map(p => p.teamId!).filter(Boolean) } },
      select: { id: true, name: true, leaderUserId: true }
    })
    
    // Fetch leader names
    const leaderIds = teams.map(t => t.leaderUserId).filter(Boolean) as string[]
    const leaders = await prisma.user.findMany({
      where: { id: { in: leaderIds } },
      select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } }
    })

    return performance.map(p => {
      const team = teams.find(t => t.id === p.teamId)
      const leader = leaders.find(u => u.id === team?.leaderUserId)
      const leaderName = leader?.profile ? `${leader.profile.firstName || ""} ${leader.profile.lastName || ""}`.trim() : leader?.email

      return {
        teamId: p.teamId,
        teamName: team?.name || "Unknown Team",
        leaderName: leaderName || "No Leader",
        deals: p._count.id,
        value: p._sum.budget || 0
      }
    }).sort((a, b) => b.deals - a.deals)
  },

  getAvgTimePerStage: async (tenantId: string) => {
    // This is a heavy query, in production it should be cached or pre-calculated
    const history = await prisma.leadStateHistory.findMany({
      where: { tenantId },
      orderBy: [{ leadId: "asc" }, { changedAt: "asc" }],
      select: { leadId: true, fromStateId: true, toState: { select: { name: true } }, changedAt: true }
    })

    const stageDurations: Record<string, number[]> = {}
    
    // Group by lead and calculate duration between states
    let currentLeadId = ""
    let lastChange: { leadId: string; toState: { name: string }; changedAt: Date } | null = null

    for (const record of history) {
      if (record.leadId !== currentLeadId) {
        currentLeadId = record.leadId
        lastChange = record
        continue
      }

      if (lastChange && lastChange.leadId === record.leadId) {
        // Duration from last state to this state
        const durationHours = (record.changedAt.getTime() - lastChange.changedAt.getTime()) / (1000 * 60 * 60)
        const stageName = lastChange.toState.name // The stage the lead was IN
        if (!stageDurations[stageName]) stageDurations[stageName] = []
        stageDurations[stageName].push(durationHours)
      }
      lastChange = record
    }

    // Calculate averages
    return Object.entries(stageDurations).map(([stage, durations]) => ({
      stage,
      avgHours: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
    }))
  },

  getLeadTimeline: async (tenantId: string, leadId: string) => {
    const [history, assignments, notes, meetings] = await Promise.all([
      prisma.leadStateHistory.findMany({
        where: { tenantId, leadId },
        include: { toState: true, changer: { include: { profile: true } } },
        orderBy: { changedAt: "desc" }
      }),
      prisma.leadAssignment.findMany({
        where: { tenantId, leadId },
        include: { assignedUser: { include: { profile: true } } },
        orderBy: { assignedAt: "desc" }
      }),
      prisma.note.findMany({
        where: { tenantId, entityId: leadId, entityType: "lead" },
        include: { creator: { include: { profile: true } } },
        orderBy: { createdAt: "desc" }
      }),
      prisma.meeting.findMany({
        where: { tenantId, leadId },
        include: { organizer: { include: { profile: true } } },
        orderBy: { startsAt: "desc" }
      })
    ])

    const timeline = [
      ...history.map(h => ({
        id: h.id,
        type: "stage_change",
        date: h.changedAt,
        actor: h.changer,
        details: { from: h.fromStateId, to: h.toState.name }
      })),
      ...assignments.map(a => ({
        id: a.id,
        type: "assignment",
        date: a.assignedAt,
        actor: a.assignedUser,
        details: { assignedTo: a.assignedUser }
      })),
      ...notes.map(n => ({
        id: n.id,
        type: "note",
        date: n.createdAt,
        actor: n.creator,
        details: { content: n.body }
      })),
      ...meetings.map(m => ({
        id: m.id,
        type: "meeting",
        date: m.startsAt,
        actor: m.organizer,
        details: { title: m.title, status: m.status }
      }))
    ]

    return timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  },
  getEmployeePerformance: async (tenantId: string, periodDays = 30) => {
    const since = new Date()
    since.setDate(since.getDate() - periodDays)
    const [users, callLogs, meetings, stateHistory, closures, failures] = await Promise.all([
      prisma.user.findMany({ where: { tenantId, deletedAt: null }, include: { profile: true } }),
      prisma.callLog.findMany({ where: { tenantId, callTime: { gte: since } } }),
      prisma.meeting.findMany({ where: { tenantId, createdAt: { gte: since } } }),
      prisma.leadStateHistory.findMany({
        where: { tenantId, changedAt: { gte: since } },
        include: { toState: true }
      }),
      prisma.leadClosure.findMany({ where: { tenantId, closedAt: { gte: since }, status: "approved" } }),
      prisma.leadFailure.findMany({ where: { tenantId, createdAt: { gte: since } } })
    ])
    const rows = users.map((user) => {
      const calls = callLogs.filter((log) => log.callerUserId === user.id).length
      const meetingsCount = meetings.filter((meeting) => meeting.organizerUserId === user.id).length
      const siteVisits = stateHistory.filter((h) => h.changedBy === user.id && h.toState?.name === "site_visit").length
      const userClosures = closures.filter((closure) => closure.closedBy === user.id)
      const wins = userClosures.length
      const fails = failures.filter((failure) => failure.failedBy === user.id).length
      const points = calls * 1 + meetingsCount * 3 + siteVisits * 5 + wins * 10 - fails * 10
      const revenue = userClosures.reduce((sum, closure) => {
        const amount = typeof closure.amount === "object" && "toNumber" in closure.amount ? closure.amount.toNumber() : Number(closure.amount)
        return sum + (Number.isFinite(amount) ? amount : 0)
      }, 0)
      const name = user.profile?.firstName
        ? `${user.profile.firstName}${user.profile.lastName ? ` ${user.profile.lastName}` : ""}`
        : user.email
      return {
        userId: user.id,
        name: name || user.email,
        points,
        revenue,
        breakdown: { calls, meetings: meetingsCount, siteVisits, wins, fails }
      }
    })
    return rows.sort((a, b) => b.points - a.points)
  }
}
