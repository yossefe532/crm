import { prisma } from "../../prisma/client"
import { Prisma } from "@prisma/client"
import { cache } from "../../utils/cache"

export const analyticsService = {
  listDailyMetrics: async (tenantId: string, from?: string, to?: string, userId?: string, role?: string) => {
    const where: any = {
      tenantId,
      metricDate: {
        gte: from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600 * 1000),
        lte: to ? new Date(to) : new Date()
      }
    }

    if (role === "sales" && userId) {
      where.userId = userId
    } else if (role === "team_leader" && userId) {
      const myTeams = await prisma.team.findMany({ where: { tenantId, leaderUserId: userId }, select: { id: true } })
      const teamIds = myTeams.map(t => t.id)
      // Show metrics for the team leader (if any) and their teams
      // Note: LeadMetricsDaily might have userId set or teamId set.
      // If we want to show team aggregate, we filter by teamId.
      // If we want to show individual members, we need to find members.
      // Let's assume for daily metrics list, we want to see rows relevant to the user's scope.
      where.OR = [
        { userId: userId },
        { teamId: { in: teamIds } }
      ]
    }

    return prisma.leadMetricsDaily.findMany({
      where,
      orderBy: { metricDate: "asc" }
    })
  },

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

  getSalesStageSummary: async (tenantId: string, userId?: string, role?: string) => {
    const cacheKey = `analytics:sales-stage-summary:${tenantId}:${userId || 'all'}:${role || 'all'}`
    const cached = await cache.get(cacheKey)
    if (cached) return cached

    let whereClause: any = { tenantId, deletedAt: null, assignedUserId: { not: null } }

    if (role === "sales" && userId) {
      whereClause.assignedUserId = userId
    } else if (role === "team_leader" && userId) {
      const myTeams = await prisma.team.findMany({
        where: { tenantId, leaderUserId: userId },
        include: { members: true }
      })
      const myMemberIds = myTeams.flatMap(t => t.members.map(m => m.userId))
      const relevantUserIds = [...new Set([userId, ...myMemberIds])]
      whereClause.assignedUserId = { in: relevantUserIds }
    }

    // Group by user and stage
    const distribution = await prisma.lead.groupBy({
      by: ["assignedUserId", "status"],
      where: whereClause,
      _count: { id: true }
    })

    // Get all users involved
    const userIds = [...new Set(distribution.map(d => d.assignedUserId).filter(Boolean))] as string[]
    
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } }
    })

    // Transform to user-centric structure
    const result = users.map(user => {
      const userStages = distribution.filter(d => d.assignedUserId === user.id)
      const name = user.profile ? `${user.profile.firstName || ""} ${user.profile.lastName || ""}`.trim() : user.email
      
      const stageCounts: Record<string, number> = {}
      userStages.forEach(s => {
        stageCounts[s.status] = s._count.id
      })

      return {
        userId: user.id,
        name: name || "Unknown",
        stages: stageCounts,
        total: userStages.reduce((sum, s) => sum + s._count.id, 0)
      }
    }).sort((a, b) => b.total - a.total)

    await cache.set(cacheKey, result, 300) // Cache for 5 minutes
    return result
  },

  getStageDistribution: async (tenantId: string, userId?: string, role?: string) => {
    const cacheKey = `analytics:stage-distribution:${tenantId}:${userId || 'all'}:${role || 'all'}`
    const cached = await cache.get(cacheKey)
    if (cached) return cached

    let whereClause: any = { tenantId, deletedAt: null }

    if (role === "sales" && userId) {
      whereClause.assignedUserId = userId
    } else if (role === "team_leader" && userId) {
      const myTeams = await prisma.team.findMany({
        where: { tenantId, leaderUserId: userId },
        include: { members: true }
      })
      const myTeamIds = myTeams.map(t => t.id)
      const myMemberIds = myTeams.flatMap(t => t.members.map(m => m.userId))
      whereClause.OR = [
        { assignedUserId: userId },
        { teamId: { in: myTeamIds } },
        { assignedUserId: { in: myMemberIds } }
      ]
    }

    const distribution = await prisma.lead.groupBy({
      by: ["status"],
      where: whereClause,
      _count: { id: true }
    })
    return distribution.map(d => ({ stage: d.status, count: d._count.id }))
  },

  getConversionRate: async (tenantId: string, userId?: string, role?: string) => {
    const cacheKey = `analytics:conversion-rate:${tenantId}:${userId || 'all'}:${role || 'all'}`
    const cached = await cache.get(cacheKey)
    if (cached) return cached

    let whereClause: any = { tenantId, deletedAt: null }

    if (role === "sales" && userId) {
      whereClause.assignedUserId = userId
    } else if (role === "team_leader" && userId) {
      const myTeams = await prisma.team.findMany({
        where: { tenantId, leaderUserId: userId },
        include: { members: true }
      })
      const myTeamIds = myTeams.map(t => t.id)
      const myMemberIds = myTeams.flatMap(t => t.members.map(m => m.userId))
      whereClause.OR = [
        { assignedUserId: userId },
        { teamId: { in: myTeamIds } },
        { assignedUserId: { in: myMemberIds } }
      ]
    }

    const total = await prisma.lead.count({ where: whereClause })
    const won = await prisma.lead.count({ where: { ...whereClause, status: "won" } })
    const result = { total, won, rate: total > 0 ? (won / total) * 100 : 0 }

    await cache.set(cacheKey, result, 300)
    return result
  },

  getSalesPerformance: async (tenantId: string, userId?: string, role?: string) => {
    const cacheKey = `analytics:sales-performance:${tenantId}:${userId || 'all'}:${role || 'all'}`
    const cached = await cache.get(cacheKey)
    if (cached) return cached

    let whereClause: any = { tenantId, deletedAt: null, assignedUserId: { not: null } }
    let wonWhereClause: any = { tenantId, deletedAt: null, status: "won", assignedUserId: { not: null } }

    if (role === "sales" && userId) {
      whereClause.assignedUserId = userId
      wonWhereClause.assignedUserId = userId
    } else if (role === "team_leader" && userId) {
      const myTeams = await prisma.team.findMany({
        where: { tenantId, leaderUserId: userId },
        include: { members: true }
      })
      const myMemberIds = myTeams.flatMap(t => t.members.map(m => m.userId))
      // Include the leader themselves if they have leads, plus their team members
      const relevantUserIds = [...new Set([userId, ...myMemberIds])]
      
      whereClause.assignedUserId = { in: relevantUserIds }
      wonWhereClause.assignedUserId = { in: relevantUserIds }
    }

    // Get won leads per user
    const wonPerformance = await prisma.lead.groupBy({
      by: ["assignedUserId"],
      where: wonWhereClause,
      _count: { id: true },
      _sum: { budget: true }
    })
    
    // Get total assigned leads per user
    const totalPerformance = await prisma.lead.groupBy({
      by: ["assignedUserId"],
      where: whereClause,
      _count: { id: true }
    })

    const userIds = [...new Set([...wonPerformance.map(p => p.assignedUserId!), ...totalPerformance.map(p => p.assignedUserId!)])].filter(Boolean)

    // Enrich with user names
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } }
    })

    return users.map(user => {
      const wonStats = wonPerformance.find(p => p.assignedUserId === user.id)
      const totalStats = totalPerformance.find(p => p.assignedUserId === user.id)
      
      const name = user.profile ? `${user.profile.firstName || ""} ${user.profile.lastName || ""}`.trim() : user.email
      
      return {
        userId: user.id,
        name: name || "Unknown",
        deals: wonStats?._count.id || 0,
        value: wonStats?._sum.budget || 0,
        total: totalStats?._count.id || 0,
        conversionRate: totalStats?._count.id ? Math.round(((wonStats?._count.id || 0) / totalStats._count.id) * 100) : 0
      }
    }).sort((a, b) => b.deals - a.deals)
  },

  getTeamPerformance: async (tenantId: string, userId?: string, role?: string) => {
    const cacheKey = `analytics:team-performance:${tenantId}:${userId || 'all'}:${role || 'all'}`
    const cached = await cache.get(cacheKey)
    if (cached) return cached

    let whereClause: any = { tenantId, deletedAt: null, teamId: { not: null } }
    let wonWhereClause: any = { tenantId, deletedAt: null, status: "won", teamId: { not: null } }

    if (role === "sales") {
       // Sales users typically don't see team performance, or only their own team if assigned?
       // For now return empty or maybe just their team?
       // Let's assume they don't see this chart or it's empty.
       return [] 
    } else if (role === "team_leader" && userId) {
      const myTeams = await prisma.team.findMany({
        where: { tenantId, leaderUserId: userId }
      })
      const myTeamIds = myTeams.map(t => t.id)
      whereClause.teamId = { in: myTeamIds }
      wonWhereClause.teamId = { in: myTeamIds }
    }

    // Get won leads
    const wonPerformance = await prisma.lead.groupBy({
      by: ["teamId"],
      where: wonWhereClause,
      _count: { id: true },
      _sum: { budget: true }
    })

    // Get total leads
    const totalPerformance = await prisma.lead.groupBy({
      by: ["teamId"],
      where: whereClause,
      _count: { id: true }
    })

    const teamIds = [...new Set([...wonPerformance.map(p => p.teamId!), ...totalPerformance.map(p => p.teamId!)])].filter(Boolean)

    const teams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true, leaderUserId: true }
    })
    
    // Fetch leader names
    const leaderIds = teams.map(t => t.leaderUserId).filter(Boolean) as string[]
    const leaders = await prisma.user.findMany({
      where: { id: { in: leaderIds } },
      select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } }
    })

    const result = teams.map(team => {
      const wonStats = wonPerformance.find(p => p.teamId === team.id)
      const totalStats = totalPerformance.find(p => p.teamId === team.id)
      
      const leader = leaders.find(u => u.id === team.leaderUserId)
      const leaderName = leader?.profile ? `${leader.profile.firstName || ""} ${leader.profile.lastName || ""}`.trim() : leader?.email

      return {
        teamId: team.id,
        teamName: team.name || "Unknown Team",
        leaderName: leaderName || "No Leader",
        deals: wonStats?._count.id || 0,
        value: wonStats?._sum.budget || 0,
        total: totalStats?._count.id || 0,
        conversionRate: totalStats?._count.id ? Math.round(((wonStats?._count.id || 0) / totalStats._count.id) * 100) : 0
      }
    }).sort((a, b) => b.deals - a.deals)

    await cache.set(cacheKey, result, 300)
    return result
  },

  getAvgTimePerStage: async (tenantId: string, userId?: string, role?: string) => {
    const cacheKey = `analytics:avg-time-stage:${tenantId}:${userId || 'all'}:${role || 'all'}`
    const cached = await cache.get(cacheKey)
    if (cached) return cached

    // Validate UUID format to prevent "invalid input syntax for type uuid" error
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!tenantId || !uuidRegex.test(tenantId)) {
      return []
    }

    try {
      let filterClause = Prisma.sql``;

      if (role === "sales" && userId) {
        filterClause = Prisma.sql`AND l.assigned_user_id = ${userId}::uuid`
      } else if (role === "team_leader" && userId) {
        const myTeams = await prisma.team.findMany({
          where: { tenantId, leaderUserId: userId },
          include: { members: true }
        })
        const myTeamIds = myTeams.map(t => t.id)
        const myMemberIds = myTeams.flatMap(t => t.members.map(m => m.userId))
        
        const conditions: any[] = [Prisma.sql`l.assigned_user_id = ${userId}::uuid`]
        if (myTeamIds.length > 0) conditions.push(Prisma.sql`l.team_id IN (${Prisma.join(myTeamIds)})`)
        if (myMemberIds.length > 0) conditions.push(Prisma.sql`l.assigned_user_id IN (${Prisma.join(myMemberIds)})`)
        
        filterClause = Prisma.sql`AND (${Prisma.join(conditions, ' OR ')})`
      }

      // Optimized raw query to calculate average time in each stage
      // Uses window function LEAD to get the next state change time for the same lead
      const result = await prisma.$queryRaw`
        SELECT
          s.name as stage,
          AVG(EXTRACT(EPOCH FROM (h.next_changed_at - h.changed_at)) / 3600) as "avgHours"
        FROM (
          SELECT
            lsh.lead_id,
            lsh.to_state_id,
            lsh.changed_at,
            LEAD(lsh.changed_at) OVER (PARTITION BY lsh.lead_id ORDER BY lsh.changed_at) as next_changed_at
          FROM lead_state_history lsh
          JOIN leads l ON lsh.lead_id = l.id
          WHERE lsh.tenant_id = ${tenantId}::uuid
            AND l.deleted_at IS NULL
            ${filterClause}
        ) h
        JOIN lead_state_definitions s ON h.to_state_id = s.id
        WHERE h.next_changed_at IS NOT NULL
        GROUP BY s.name
      ` as { stage: string, avgHours: number }[]
  
      // Format result
      const formatted = result.map(r => ({
        stage: r.stage,
        avgHours: Number(r.avgHours) || 0
      }))

      await cache.set(cacheKey, formatted, 3600)
      return formatted
    } catch (error) {
      console.error("Error calculating avg time per stage:", error)
      return []
    }
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
  },

  getRevenueOverTime: async (tenantId: string, userId?: string, role?: string) => {
    const cacheKey = `analytics:revenue-over-time:${tenantId}:${userId || 'all'}:${role || 'all'}`
    const cached = await cache.get(cacheKey)
    if (cached) return cached

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    let whereClause: any = { 
      tenantId, 
      status: "approved", 
      closedAt: { gte: sixMonthsAgo } 
    }

    if (role === "sales" && userId) {
      whereClause.closedBy = userId
    } else if (role === "team_leader" && userId) {
      const myTeams = await prisma.team.findMany({
        where: { tenantId, leaderUserId: userId },
        include: { members: true }
      })
      const myMemberIds = myTeams.flatMap(t => t.members.map(m => m.userId))
      const relevantUserIds = [...new Set([userId, ...myMemberIds])]
      whereClause.closedBy = { in: relevantUserIds }
    }

    const closures = await prisma.leadClosure.findMany({
      where: whereClause,
      orderBy: { closedAt: "asc" }
    });

    // Initialize with 0 for all months
    const revenueByMonth: Record<string, number> = {};
    const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    
    // Fill last 6 months keys
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const m = monthNames[d.getMonth()];
        revenueByMonth[m] = 0;
    }

    closures.forEach(c => {
      const date = new Date(c.closedAt);
      const monthName = monthNames[date.getMonth()];
      const amount = typeof c.amount === "object" && "toNumber" in c.amount ? c.amount.toNumber() : Number(c.amount);
      if (revenueByMonth[monthName] !== undefined) {
         revenueByMonth[monthName] += (Number.isFinite(amount) ? amount : 0);
      }
    });

    const result = Object.entries(revenueByMonth).map(([name, value]) => ({ name, value }));
    await cache.set(cacheKey, result, 300)
    return result
  },

  getLeadSources: async (tenantId: string, userId?: string, role?: string) => {
    const cacheKey = `analytics:lead-sources:${tenantId}:${userId || 'all'}:${role || 'all'}`
    const cached = await cache.get(cacheKey)
    if (cached) return cached

    let whereClause: any = { tenantId, deletedAt: null }

    if (role === "sales" && userId) {
      whereClause.assignedUserId = userId
    } else if (role === "team_leader" && userId) {
      const myTeams = await prisma.team.findMany({
        where: { tenantId, leaderUserId: userId },
        include: { members: true }
      })
      const myTeamIds = myTeams.map(t => t.id)
      const myMemberIds = myTeams.flatMap(t => t.members.map(m => m.userId))
      whereClause.OR = [
        { assignedUserId: userId },
        { teamId: { in: myTeamIds } },
        { assignedUserId: { in: myMemberIds } }
      ]
    }

    const sources = await prisma.lead.groupBy({
      by: ["sourceLabel"],
      where: whereClause,
      _count: { id: true }
    });
    
    return sources.map(s => ({
      name: s.sourceLabel || "غير محدد",
      value: s._count.id
    })).sort((a, b) => b.value - a.value);
  },

  getKeyMetrics: async (tenantId: string, userId?: string, role?: string) => {
    const cacheKey = `analytics:key-metrics:${tenantId}:${userId || 'all'}:${role || 'all'}`
    const cached = await cache.get(cacheKey)
    if (cached) return cached

    let where: any = { tenantId, deletedAt: null };

    if (role === "sales" && userId) {
      where.assignedUserId = userId;
    } else if (role === "team_leader" && userId) {
      const myTeams = await prisma.team.findMany({
        where: { tenantId, leaderUserId: userId },
        include: { members: true }
      })
      const myTeamIds = myTeams.map(t => t.id)
      const myMemberIds = myTeams.flatMap(t => t.members.map(m => m.userId))
      where.OR = [
        { assignedUserId: userId },
        { teamId: { in: myTeamIds } },
        { assignedUserId: { in: myMemberIds } }
      ]
    }

    const [totalLeads, newLeads, activeLeads, wonLeads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: "new" } }),
      prisma.lead.count({ where: { ...where, status: { notIn: ["won", "lost", "archived"] } } }),
      prisma.lead.count({ where: { ...where, status: "won" } })
    ]);

    const result = [
      { label: "إجمالي العملاء", value: totalLeads, change: 0 },
      { label: "عملاء جدد", value: newLeads, change: 0 },
      { label: "عملاء نشطين", value: activeLeads, change: 0 },
      { label: "صفقات ناجحة", value: wonLeads, change: 0 }
    ];

    await cache.set(cacheKey, result, 300)
    return result
  }
}
