import { prisma } from "../../prisma/client"
import { UserPayload } from "../../utils/auth"
import { lifecycleService } from "../lifecycle/service"

export const leadService = {
  getLead: (tenantId: string, id: string) => prisma.lead.findFirst({ where: { id, tenantId, deletedAt: null }, include: { callLogs: { orderBy: { createdAt: "desc" }, include: { caller: true } }, meetings: { orderBy: { startsAt: "desc" }, include: { organizer: true } } } }),
  createLead: async (tenantId: string, data: { leadCode: string; name: string; phone: string; email?: string; budget?: number; areaOfInterest?: string; sourceLabel?: string; sourceId?: string; assignedUserId?: string; teamId?: string; status?: string; priority?: string; budgetMin?: number; budgetMax?: number; desiredLocation?: string; propertyType?: string; profession?: string; notes?: string }) => {
    const stages = await lifecycleService.ensureDefaultStages(tenantId)
    const callStage = stages.find((stage) => stage.code === "call")
    const status = data.status || callStage?.code || "call"
    let resolvedTeamId = data.teamId
    if (!resolvedTeamId && data.assignedUserId) {
      const teamMembership = await prisma.teamMember.findFirst({ where: { tenantId, userId: data.assignedUserId, leftAt: null, deletedAt: null }, select: { teamId: true } })
      resolvedTeamId = teamMembership?.teamId
      if (!resolvedTeamId) {
        const ledTeam = await prisma.team.findFirst({ where: { tenantId, leaderUserId: data.assignedUserId, deletedAt: null }, select: { id: true } })
        resolvedTeamId = ledTeam?.id
      }
    }
    const lead = await prisma.lead.create({
      data: {
        tenantId,
        leadCode: data.leadCode,
        name: data.name,
        phone: data.phone,
        email: data.email,
        budget: data.budget,
        areaOfInterest: data.areaOfInterest,
        sourceLabel: data.sourceLabel,
        sourceId: data.sourceId,
        assignedUserId: data.assignedUserId,
        teamId: resolvedTeamId,
        status,
        priority: data.priority || "normal",
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        desiredLocation: data.desiredLocation,
        propertyType: data.propertyType,
        profession: data.profession,
        notes: data.notes
      }
    })
    const initialState = await lifecycleService.getStateByCode(tenantId, status)
    if (initialState) {
      await prisma.leadStateHistory.create({ data: { tenantId, leadId: lead.id, toStateId: initialState.id } })
      await prisma.leadDeadline.create({ data: { tenantId, leadId: lead.id, stateId: initialState.id, dueAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) } })
    }
    return lead
  },

  listLeads: async (tenantId: string, skip: number, take: number, user?: UserPayload | null, query?: string) => {
    const baseWhere = { tenantId, deletedAt: null }
    const search = query?.trim()
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { phone: { contains: query } },
            { email: { contains: query, mode: "insensitive" as const } },
            { leadCode: { contains: query, mode: "insensitive" as const } }
          ]
        }
      : {}
    if (!user) return prisma.lead.findMany({ where: { ...baseWhere, id: "00000000-0000-0000-0000-000000000000" }, skip, take, orderBy: { createdAt: "desc" } })
    
    if (user.roles.includes("owner")) {
      return prisma.lead.findMany({ where: { ...baseWhere, ...search }, skip, take, orderBy: { createdAt: "desc" }, include: { _count: { select: { callLogs: true } } } })
    }
    
    if (user.roles.includes("team_leader")) {
      const teams = await prisma.team.findMany({ where: { tenantId, leaderUserId: user.id, deletedAt: null }, select: { id: true } })
      const teamIds = teams.map((team) => team.id)
      
      let memberIds: string[] = [user.id]
      if (teamIds.length > 0) {
        const members = await prisma.teamMember.findMany({ where: { tenantId, teamId: { in: teamIds }, leftAt: null, deletedAt: null }, select: { userId: true } })
        memberIds = Array.from(new Set([...members.map((row) => row.userId), user.id]))
      }

      return prisma.lead.findMany({
        where: {
          ...baseWhere,
          ...search,
          OR: [
            { teamId: { in: teamIds } }, 
            { assignedUserId: user.id }
          ]
        },
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { callLogs: true } } }
      })
    }
    
    if (user.roles.includes("sales")) {
      const teamMemberships = await prisma.teamMember.findMany({ where: { tenantId, userId: user.id, leftAt: null, deletedAt: null }, select: { teamId: true } })
      const teamIds = teamMemberships.map((m) => m.teamId)
      return prisma.lead.findMany({
        where: {
          ...baseWhere,
          ...search,
          OR: [
            { assignedUserId: user.id },
            { teamId: { in: teamIds } }
          ]
        },
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { callLogs: true } } }
      })
    }
    
    return prisma.lead.findMany({ 
      where: { 
        ...baseWhere, 
        ...search,
        assignedUserId: user.id 
      }, 
      skip, 
      take, 
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { callLogs: true } } }
    })
  },

  listTasks: async (tenantId: string, user?: UserPayload | null) => {
    const baseWhere = { tenantId }
    if (!user) return prisma.leadTask.findMany({ where: baseWhere, orderBy: { createdAt: "desc" }, include: { lead: true } })
    if (user.roles.includes("owner")) {
      return prisma.leadTask.findMany({ where: baseWhere, orderBy: { createdAt: "desc" }, include: { lead: true } })
    }
    if (user.roles.includes("team_leader")) {
      const teams = await prisma.team.findMany({ where: { tenantId, leaderUserId: user.id, deletedAt: null }, select: { id: true } })
      const teamIds = teams.map((team) => team.id)
      const members = await prisma.teamMember.findMany({ where: { tenantId, teamId: { in: teamIds }, leftAt: null, deletedAt: null }, select: { userId: true } })
      const memberIds = Array.from(new Set([...members.map((row) => row.userId), user.id]))
      return prisma.leadTask.findMany({
        where: { ...baseWhere, OR: [{ assignedUserId: { in: memberIds } }, { lead: { teamId: { in: teamIds } } }] },
        orderBy: { createdAt: "desc" },
        include: { lead: true }
      })
    }
    return prisma.leadTask.findMany({ where: { ...baseWhere, assignedUserId: user.id }, orderBy: { createdAt: "desc" }, include: { lead: true } })
  },

  updateLead: async (tenantId: string, id: string, data: Partial<{ name: string; phone: string; email: string; budget: number; areaOfInterest: string; sourceLabel: string; sourceId: string; priority: string; budgetMin: number; budgetMax: number; desiredLocation: string; propertyType: string; profession: string; notes: string }>) => {
    return prisma.lead.update({ where: { id, tenantId }, data })
  },

  getLeadForUser: async (tenantId: string, leadId: string, user?: UserPayload | null) => {
    const include = { 
      callLogs: { orderBy: { createdAt: "desc" as const }, include: { caller: true } },
      meetings: { orderBy: { startsAt: "desc" as const }, include: { organizer: true } }
    }
    if (!user) return prisma.lead.findFirst({ where: { tenantId, id: leadId, deletedAt: null }, include })
    if (user.roles.includes("owner")) return prisma.lead.findFirst({ where: { tenantId, id: leadId, deletedAt: null }, include })
    if (user.roles.includes("team_leader")) {
      const teams = await prisma.team.findMany({ where: { tenantId, leaderUserId: user.id, deletedAt: null }, select: { id: true } })
      const teamIds = teams.map((team) => team.id)
      return prisma.lead.findFirst({
        where: {
          tenantId,
          id: leadId,
          deletedAt: null,
          OR: [
            { teamId: { in: teamIds } },
            { assignedUserId: user.id }
          ]
        },
        include
      })
    }
    
    if (user.roles.includes("sales")) {
      const teamMemberships = await prisma.teamMember.findMany({ where: { tenantId, userId: user.id, leftAt: null, deletedAt: null }, select: { teamId: true } })
      const teamIds = teamMemberships.map((m) => m.teamId)
      return prisma.lead.findFirst({
        where: {
          tenantId,
          id: leadId,
          deletedAt: null,
          OR: [
            { assignedUserId: user.id },
            { teamId: { in: teamIds } }
          ]
        },
        include
      })
    }
    
    return prisma.lead.findFirst({ where: { tenantId, id: leadId, assignedUserId: user.id, deletedAt: null }, include })
  },

  deleteLead: (tenantId: string, id: string) =>
    prisma.lead.update({ where: { id, tenantId }, data: { deletedAt: new Date() } }),

  assignLead: async (tenantId: string, leadId: string, assignedUserId: string, assignedBy?: string, reason?: string, teamId?: string | null) => {
    let resolvedTeamId: string | undefined
    if (teamId) {
      resolvedTeamId = teamId
    } else {
      const membership = await prisma.teamMember.findFirst({ where: { tenantId, userId: assignedUserId, leftAt: null, deletedAt: null }, select: { teamId: true } })
      if (membership?.teamId) {
        resolvedTeamId = membership.teamId
      } else {
        const ledTeam = await prisma.team.findFirst({ where: { tenantId, leaderUserId: assignedUserId, deletedAt: null }, select: { id: true } })
        resolvedTeamId = ledTeam?.id
      }
    }
    await prisma.leadAssignment.updateMany({ where: { tenantId, leadId, releasedAt: null }, data: { releasedAt: new Date() } })
    await prisma.lead.update({ where: { id: leadId, tenantId }, data: { assignedUserId, teamId: resolvedTeamId } })
    return prisma.leadAssignment.create({ data: { tenantId, leadId, assignedUserId, assignedBy, reason } })
  },

  unassignLead: async (tenantId: string, leadId: string) => {
    await prisma.leadAssignment.updateMany({ where: { tenantId, leadId, releasedAt: null }, data: { releasedAt: new Date() } })
    return prisma.lead.update({ where: { id: leadId, tenantId }, data: { assignedUserId: null, teamId: null } })
  },

  createLeadContact: (tenantId: string, leadId: string, contactId: string, role?: string) =>
    prisma.leadContact.create({ data: { tenantId, leadId, contactId, role: role || "primary" } }),

  createLeadTask: (tenantId: string, data: { leadId: string; assignedUserId?: string; taskType: string; dueAt?: string }) =>
    prisma.leadTask.create({ data: { tenantId, leadId: data.leadId, assignedUserId: data.assignedUserId, taskType: data.taskType, dueAt: data.dueAt ? new Date(data.dueAt) : undefined } }),

  createCallLog: (tenantId: string, data: { leadId: string; callerUserId?: string; durationSeconds?: number; outcome?: string; recordingFileId?: string }) =>
    prisma.callLog.create({ data: { tenantId, leadId: data.leadId, callerUserId: data.callerUserId, durationSeconds: data.durationSeconds, outcome: data.outcome, recordingFileId: data.recordingFileId } }),

  createMeeting: async (tenantId: string, data: { leadId: string; organizerUserId: string; title: string; startsAt: Date; endsAt: Date; status?: string }) => {
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null }, select: { timezone: true } })
    const timezone = tenant?.timezone || "UTC"
    return prisma.meeting.create({
      data: {
        tenantId,
        leadId: data.leadId,
        organizerUserId: data.organizerUserId,
        title: data.title,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        timezone,
        status: data.status || "scheduled"
      }
    })
  },

  createLeadSource: (tenantId: string, data: { name: string }) =>
    prisma.leadSource.create({ data: { tenantId, name: data.name } }),

  listLeadSources: (tenantId: string) => prisma.leadSource.findMany({ where: { tenantId, isActive: true } }),

  getActiveDeadline: (tenantId: string, leadId: string) =>
    prisma.leadDeadline.findFirst({ where: { tenantId, leadId, status: "active" }, orderBy: { dueAt: "asc" } }),

  listActiveDeadlines: (tenantId: string) =>
    prisma.leadDeadline.findMany({ where: { tenantId, status: "active" }, orderBy: { dueAt: "asc" } }),

  listFailures: (tenantId: string, leadId?: string) =>
    prisma.leadFailure.findMany({ where: { tenantId, ...(leadId ? { leadId } : {}) }, orderBy: { createdAt: "desc" } }),

  createFailure: (tenantId: string, data: { leadId: string; failedBy?: string; failureType: string; reason?: string; status?: string }) =>
    prisma.leadFailure.create({
      data: {
        tenantId,
        leadId: data.leadId,
        failedBy: data.failedBy,
        failureType: data.failureType,
        reason: data.reason,
        status: data.status || "pending"
      }
    }),

  resolveFailure: (tenantId: string, failureId: string, reason: string) =>
    prisma.leadFailure.update({ where: { id: failureId, tenantId }, data: { reason, status: "resolved", resolvedAt: new Date() } }),

  listClosures: (tenantId: string) =>
    prisma.leadClosure.findMany({ where: { tenantId }, orderBy: { closedAt: "desc" } }),

  createClosure: (tenantId: string, data: { leadId: string; closedBy?: string; amount: number; note?: string; address?: string }) =>
    prisma.leadClosure.create({
      data: {
        tenantId,
        leadId: data.leadId,
        closedBy: data.closedBy,
        amount: data.amount,
        note: data.note,
        address: data.address
      }
    }),

  decideClosure: (tenantId: string, closureId: string, data: { status: string; decidedBy: string }) =>
    prisma.leadClosure.update({ where: { id: closureId, tenantId }, data: { status: data.status, decidedBy: data.decidedBy, decidedAt: new Date() } })
}
