import { prisma } from "../../prisma/client"
import { UserPayload } from "../../utils/auth"
import { lifecycleService } from "../lifecycle/service"
import { notificationService } from "../notifications/service"
import { goalsService } from "../goals/service"

export const STAGES = {
  CALL: "call",
  MEETING: "meeting",
  SITE_VIEW: "site_view",
  DEAL: "deal",
  WON: "won",
  LOST: "lost"
} as const

export const leadService = {
  getLead: (tenantId: string, id: string) => prisma.lead.findFirst({ 
    where: { id, tenantId, deletedAt: null }, 
    include: { 
      callLogs: { orderBy: { createdAt: "desc" }, include: { caller: true } }, 
      meetings: { orderBy: { startsAt: "desc" }, include: { organizer: true } },
      createdByUser: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } }
    } 
  }),

  createLead: async (tenantId: string, data: { 
    leadCode: string; name: string; phone: string; email?: string; 
    budget?: number; areaOfInterest?: string; sourceLabel?: string; sourceId?: string; 
    assignedUserId?: string; teamId?: string; status?: string; priority?: string; 
    budgetMin?: number; budgetMax?: number; desiredLocation?: string; propertyType?: string; 
    profession?: string; notes?: string; createdByUserId?: string 
  }) => {
    // Determine Team ID if not provided but assignedUser is
    let resolvedTeamId = data.teamId
    if (!resolvedTeamId && data.assignedUserId) {
      const teamMembership = await prisma.teamMember.findFirst({ where: { tenantId, userId: data.assignedUserId, leftAt: null, deletedAt: null }, select: { teamId: true } })
      resolvedTeamId = teamMembership?.teamId
      if (!resolvedTeamId) {
        const ledTeam = await prisma.team.findFirst({ where: { tenantId, leaderUserId: data.assignedUserId, deletedAt: null }, select: { id: true } })
        resolvedTeamId = ledTeam?.id
      }
    }

    // Default stage is CALL
    const initialStage = STAGES.CALL
    
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
        status: initialStage, // Map status to lifecycle stage for backward compatibility
        lifecycleStage: initialStage,
        timerStartDate: new Date(), // Start 7-day timer
        priority: data.priority || "normal",
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        desiredLocation: data.desiredLocation,
        propertyType: data.propertyType,
        profession: data.profession,
        notes: data.notes,
        createdByUserId: data.createdByUserId
      }
    })

    // Create initial state history
    // We try to use lifecycleService if available to keep it in sync, otherwise manual
    try {
      const stateDef = await lifecycleService.getStateByCode(tenantId, initialStage)
      if (stateDef) {
        await prisma.leadStateHistory.create({ 
          data: { tenantId, leadId: lead.id, toStateId: stateDef.id } 
        })
      }
    } catch (e) {
      console.warn("Failed to create initial state history via lifecycle service", e)
    }

    // Notify assigned user
    if (lead.assignedUserId && lead.assignedUserId !== data.createdByUserId) {
      await notificationService.send({
        tenantId,
        userId: lead.assignedUserId,
        type: "assignment",
        title: "عميل جديد",
        message: `تم إسناد العميل ${lead.name} إليك`,
        entityType: "lead",
        entityId: lead.id,
        actionUrl: `/leads/${lead.id}`,
        senderId: data.createdByUserId
      }).catch(console.error)
    } else if (!lead.assignedUserId) {
      // Notify Admins/Owners about unassigned lead
      const admins = await prisma.user.findMany({
        where: {
          tenantId,
          roleLinks: { some: { role: { name: { in: ["owner", "admin"] } } } },
          deletedAt: null,
          status: "active"
        },
        select: { id: true }
      })
      
      if (admins.length > 0) {
         await notificationService.sendMany(
            admins.map(a => a.id),
            {
              tenantId,
              type: "warning",
              title: "عميل جديد غير مسند",
              message: `تم إنشاء عميل جديد (${lead.name}) ولم يتم إسناده لأي مستخدم.`,
              entityType: "lead",
              entityId: lead.id,
              actionUrl: `/leads/${lead.id}`,
              senderId: data.createdByUserId
            }
         ).catch(console.error)
      }
    }

    // Check Goals
    if (data.createdByUserId) {
        goalsService.checkAchievement(tenantId, data.createdByUserId).catch(console.error)
    }

    return lead
  },

  listLeads: async (tenantId: string, skip: number, take: number, user?: UserPayload | null, query?: string, filters?: { status?: string; assignment?: string }) => {
    const baseWhere: any = { tenantId, deletedAt: null }
    
    if (filters?.status && filters.status !== 'all') {
      baseWhere.lifecycleStage = filters.status
    }

    if (filters?.assignment) {
      if (filters.assignment === 'assigned') {
        baseWhere.assignedUserId = { not: null }
      } else if (filters.assignment === 'unassigned') {
        baseWhere.assignedUserId = null
      }
    }

    const search = query?.trim()
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { phone: { contains: query } },
            { email: { contains: query, mode: "insensitive" as const } },
            { leadCode: { contains: query, mode: "insensitive" as const } },
            { areaOfInterest: { contains: query, mode: "insensitive" as const } },
            { notes: { contains: query, mode: "insensitive" as const } },
            { profession: { contains: query, mode: "insensitive" as const } }
          ]
        }
      : {}

    if (!user) return prisma.lead.findMany({ where: { ...baseWhere, id: "00000000-0000-0000-0000-000000000000" }, skip, take, orderBy: { createdAt: "desc" } })
    
    if (user.roles.includes("owner") || user.roles.includes("admin")) {
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
            { assignedUserId: { in: memberIds } },
            { createdByUserId: user.id } // Can see leads they created
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
        OR: [
          { assignedUserId: user.id },
          { createdByUserId: user.id }
        ]
      }, 
      skip, 
      take, 
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { callLogs: true } } }
    })
  },

  listTasks: async (tenantId: string, user?: UserPayload | null) => {
    const baseWhere = { tenantId, lead: { deletedAt: null } }
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

  updateLead: async (tenantId: string, id: string, data: Partial<{ name: string; phone: string; email: string; budget: number; areaOfInterest: string; sourceLabel: string; sourceId: string; priority: string; budgetMin: number; budgetMax: number; desiredLocation: string; propertyType: string; profession: string; notes: string; isWrongNumber: boolean }>) => {
    return prisma.lead.update({ where: { id, tenantId }, data })
  },

  getLeadForUser: async (tenantId: string, leadId: string, user?: UserPayload | null) => {
    const include = { 
      callLogs: { orderBy: { createdAt: "desc" as const }, include: { caller: true } },
      meetings: { orderBy: { startsAt: "desc" as const }, include: { organizer: true } },
      closures: { orderBy: { closedAt: "desc" as const } },
      failures: { orderBy: { createdAt: "desc" as const } }
    }
    if (!user) return prisma.lead.findFirst({ where: { tenantId, id: leadId, deletedAt: null }, include })
    if (user.roles.includes("owner") || user.roles.includes("admin")) return prisma.lead.findFirst({ where: { tenantId, id: leadId, deletedAt: null }, include })
    if (user.roles.includes("team_leader")) {
      const teams = await prisma.team.findMany({ where: { tenantId, leaderUserId: user.id, deletedAt: null }, select: { id: true } })
      const teamIds = teams.map((team) => team.id)
      
      const members = await prisma.teamMember.findMany({ where: { tenantId, teamId: { in: teamIds }, leftAt: null, deletedAt: null }, select: { userId: true } })
      const memberIds = Array.from(new Set([...members.map((row) => row.userId), user.id]))

      return prisma.lead.findFirst({
        where: {
          tenantId,
          id: leadId,
          deletedAt: null,
          OR: [
            { teamId: { in: teamIds } },
            { assignedUserId: { in: memberIds } },
            { createdByUserId: user.id }
          ]
        },
        include
      })
    }
    
    return prisma.lead.findFirst({ where: { tenantId, id: leadId, deletedAt: null, OR: [{ assignedUserId: user.id }, { createdByUserId: user.id }] }, include })
  },

  deleteLead: (tenantId: string, id: string) =>
    prisma.lead.update({ where: { id, tenantId }, data: { deletedAt: new Date() } }),

  restoreLead: (tenantId: string, id: string) =>
    prisma.lead.update({ where: { id, tenantId }, data: { deletedAt: null } }),

  listDeletedLeads: (tenantId: string) =>
    prisma.lead.findMany({ where: { tenantId, deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } }),

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
    
    // Reset timer when re-assigned? Or keep original?
    // User said "Starts 7 day timer when assigned to a lead". 
    // If re-assigned, maybe restart?
    // For now, let's keep it simple: timer starts at creation/first assignment. 
    // If `timerStartDate` is null, set it.
    const lead = await prisma.lead.findUnique({ where: { id: leadId } })
    const timerUpdate = !lead?.timerStartDate ? { timerStartDate: new Date() } : {}

    await prisma.lead.update({ 
      where: { id: leadId, tenantId }, 
      data: { assignedUserId, teamId: resolvedTeamId, ...timerUpdate } 
    })
    
    // Notify new assignee
    if (assignedUserId !== assignedBy) {
      await notificationService.send({
        tenantId,
        userId: assignedUserId,
        type: "assignment",
        title: "إسناد عميل",
        message: `تم إسناد العميل ${lead?.name || 'مجهول'} إليك${reason ? ': ' + reason : ''}`,
        entityType: "lead",
        entityId: leadId,
        actionUrl: `/leads/${leadId}`,
        senderId: assignedBy
      }).catch(console.error)
    }

    return prisma.leadAssignment.create({ data: { tenantId, leadId, assignedUserId, assignedBy, reason } })
  },

  unassignLead: async (tenantId: string, leadId: string) => {
    await prisma.leadAssignment.updateMany({ where: { tenantId, leadId, releasedAt: null }, data: { releasedAt: new Date() } })
    return prisma.lead.update({ where: { id: leadId, tenantId }, data: { assignedUserId: null, teamId: null } })
  },

  createLeadContact: (tenantId: string, leadId: string, contactId: string, role?: string) =>
    prisma.leadContact.create({ data: { tenantId, leadId, contactId, role: role || "primary" } }),

  createLeadTask: async (tenantId: string, data: { leadId: string; assignedUserId?: string; taskType: string; dueAt?: string; createdBy?: string }) => {
    const task = await prisma.leadTask.create({ 
      data: { 
        tenantId, 
        leadId: data.leadId, 
        assignedUserId: data.assignedUserId, 
        taskType: data.taskType, 
        dueAt: data.dueAt ? new Date(data.dueAt) : undefined 
      } 
    })
    
    // Notify assignee
    if (data.assignedUserId && data.assignedUserId !== data.createdBy) {
      const lead = await prisma.lead.findUnique({ where: { id: data.leadId }, select: { name: true } });
      
      await notificationService.send({
        tenantId,
        userId: data.assignedUserId,
        type: "assignment",
        title: "مهمة جديدة",
        message: `تم تكليفك بمهمة جديدة (${data.taskType}) للعميل ${lead?.name || 'مجهول'}`,
        entityType: "task",
        entityId: task.id,
        actionUrl: `/leads/${data.leadId}`,
        senderId: data.createdBy
      }).catch(console.error)
    }
    
    return task
  },

  createCallLog: async (tenantId: string, data: { leadId: string; callerUserId?: string; durationSeconds?: number; outcome?: string; recordingFileId?: string }) => {
    const log = await prisma.callLog.create({ data: { tenantId, leadId: data.leadId, callerUserId: data.callerUserId, durationSeconds: data.durationSeconds, outcome: data.outcome, recordingFileId: data.recordingFileId } })
    
    if (data.callerUserId) {
        goalsService.checkAchievement(tenantId, data.callerUserId).catch(console.error)
    }

    return log
  },

  createMeeting: async (tenantId: string, data: { leadId: string; organizerUserId: string; title: string; startsAt: Date; endsAt: Date; status?: string }) => {
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null }, select: { timezone: true } })
    const timezone = tenant?.timezone || "UTC"
    const meeting = await prisma.meeting.create({
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

    // Notify assigned user if different from organizer
    const lead = await prisma.lead.findUnique({ where: { id: data.leadId }, select: { assignedUserId: true } })
    if (lead?.assignedUserId && lead.assignedUserId !== data.organizerUserId) {
      await notificationService.send({
        tenantId,
        userId: lead.assignedUserId,
        type: "info",
        title: "اجتماع جديد",
        message: `تم جدولة اجتماع "${data.title}" للعميل`,
        entityType: "meeting",
        entityId: meeting.id,
        actionUrl: `/leads/${data.leadId}`,
        senderId: data.organizerUserId
      }).catch(console.error)
    }

    // Check Goals
    goalsService.checkAchievement(tenantId, data.organizerUserId).catch(console.error)

    return meeting
  },

  createLeadSource: (tenantId: string, data: { name: string }) =>
    prisma.leadSource.create({ data: { tenantId, name: data.name } }),

  listLeadSources: (tenantId: string) => prisma.leadSource.findMany({ where: { tenantId, isActive: true } }),

  getActiveDeadline: (tenantId: string, leadId: string) =>
    prisma.leadDeadline.findFirst({ where: { tenantId, leadId, status: "active" }, orderBy: { dueAt: "asc" } }),

  listActiveDeadlines: async (tenantId: string, userId?: string, role?: string) => {
    let where: any = { tenantId, status: "active", lead: { deletedAt: null } }
    
    if (role === "sales" && userId) {
      where.lead = { ...where.lead, assignedUserId: userId }
    } else if (role === "team_leader" && userId) {
      const myTeams = await prisma.team.findMany({ where: { tenantId, leaderUserId: userId }, include: { members: true } })
      const memberIds = myTeams.flatMap(t => t.members.map(m => m.userId))
      where.lead = { ...where.lead, assignedUserId: { in: [userId, ...memberIds] } }
    }

    return prisma.leadDeadline.findMany({ where, orderBy: { dueAt: "asc" }, include: { lead: true } })
  },

  listFailures: async (tenantId: string, leadId?: string, userId?: string, role?: string) => {
    let where: any = { tenantId, lead: { deletedAt: null }, ...(leadId ? { leadId } : {}) }

    if (role === "sales" && userId) {
      where.failedBy = userId
    } else if (role === "team_leader" && userId) {
      const myTeams = await prisma.team.findMany({ where: { tenantId, leaderUserId: userId }, include: { members: true } })
      const memberIds = myTeams.flatMap(t => t.members.map(m => m.userId))
      where.failedBy = { in: [userId, ...memberIds] }
    }

    return prisma.leadFailure.findMany({ where, orderBy: { createdAt: "desc" }, include: { lead: true } })
  },

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

  listClosures: async (tenantId: string, userId?: string, role?: string) => {
    let where: any = { tenantId }

    if (role === "sales" && userId) {
      where.closedBy = userId
    } else if (role === "team_leader" && userId) {
      const myTeams = await prisma.team.findMany({ where: { tenantId, leaderUserId: userId }, include: { members: true } })
      const memberIds = myTeams.flatMap(t => t.members.map(m => m.userId))
      where.closedBy = { in: [userId, ...memberIds] }
    }

    return prisma.leadClosure.findMany({ where, orderBy: { closedAt: "desc" }, include: { lead: true } })
  },

  createClosure: async (tenantId: string, data: { leadId: string; closedBy?: string; amount: number; note?: string; address?: string }) => {
    const closure = await prisma.leadClosure.create({
      data: {
        tenantId,
        leadId: data.leadId,
        closedBy: data.closedBy,
        amount: data.amount,
        note: data.note,
        address: data.address
      }
    })

    if (data.closedBy) {
      const lead = await prisma.lead.findUnique({ where: { id: data.leadId }, include: { team: true } })
      const closer = await prisma.user.findUnique({ where: { id: data.closedBy }, include: { profile: true } })
      const closerName = closer?.profile?.firstName || closer?.email || 'Unknown'

      let recipientIds: string[] = []
      if (lead?.teamId && lead.team?.leaderUserId) {
          recipientIds.push(lead.team.leaderUserId)
      } else {
          const ownerRole = await prisma.role.findFirst({ where: { name: 'owner', tenantId } })
          if (ownerRole) {
              const owners = await prisma.userRole.findMany({ where: { roleId: ownerRole.id, tenantId, revokedAt: null } })
              recipientIds = owners.map(o => o.userId)
          }
      }

      recipientIds = recipientIds.filter(id => id !== data.closedBy)

      if (recipientIds.length > 0) {
          await notificationService.sendMany(recipientIds, {
              tenantId,
              type: 'warning',
              title: 'طلب إغلاق صفقة (Deal)',
              message: `قام ${closerName} بتسجيل إغلاق صفقة للعميل ${lead?.name} بقيمة ${data.amount}.`,
              entityType: 'lead_closure',
              entityId: closure.id,
              actionUrl: `/leads/${data.leadId}`,
              senderId: data.closedBy
          }).catch(console.error)
      }
    }
    return closure
  },

  decideClosure: async (tenantId: string, closureId: string, data: { status: string; decidedBy: string; amount?: number; note?: string }) => {
    const closure = await prisma.leadClosure.update({
      where: { id: closureId, tenantId },
      data: {
        status: data.status,
        decidedBy: data.decidedBy,
        decidedAt: new Date(),
        ...(data.amount ? { amount: data.amount } : {}),
        ...(data.note ? { note: data.note } : {})
      }
    })

    if (closure.closedBy) {
      await notificationService.send({
          tenantId,
          userId: closure.closedBy,
          type: data.status === 'approved' ? 'success' : 'error',
          title: data.status === 'approved' ? 'تم اعتماد الصفقة' : 'تم رفض الصفقة',
          message: data.status === 'approved' 
              ? `تم اعتماد صفقة بقيمة ${closure.amount} بنجاح` 
              : `تم رفض الصفقة.`,
          entityType: 'lead_closure',
          entityId: closure.id,
          actionUrl: `/leads/${closure.leadId}`,
          senderId: data.decidedBy
      }).catch(console.error)
    }

    // Check Goals
    if (closure.closedBy && data.status === 'approved') {
        goalsService.checkAchievement(tenantId, closure.closedBy).catch(console.error)
    }

    return closure
  },
  
  // New Lifecycle Methods
  advanceStage: async (tenantId: string, leadId: string, userId: string) => {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } })
    if (!lead) throw { status: 404, message: "Lead not found" }
    
    const currentStage = lead.lifecycleStage
    let nextStage = ""

    if (currentStage === STAGES.CALL) {
      // Validate Call Log or manual override? User said "Button 'Complete Stage'".
      nextStage = STAGES.MEETING
    } else if (currentStage === STAGES.MEETING) {
      nextStage = STAGES.SITE_VIEW
    } else if (currentStage === STAGES.SITE_VIEW) {
      nextStage = STAGES.DEAL
    } else {
      throw { status: 400, message: "Cannot advance from this stage" }
    }

    // Update
    await prisma.lead.update({
      where: { id: leadId },
      data: { lifecycleStage: nextStage, status: nextStage }
    })

    // Log history
    const stateDef = await lifecycleService.getStateByCode(tenantId, nextStage)
    if (stateDef) {
       await prisma.leadStateHistory.create({
         data: {
           tenantId,
           leadId,
           fromStateId: (await lifecycleService.getStateByCode(tenantId, currentStage))?.id,
           toStateId: stateDef.id,
           changedBy: userId
         }
       })
    }
    
    return { success: true, nextStage }
  },

  submitDeal: async (tenantId: string, leadId: string, userId: string, data: { price: number; closedAt: Date; listingId?: string }) => {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } })
    if (!lead) throw { status: 404, message: "Lead not found" }

    // Must be in Deal stage
    if (lead.lifecycleStage !== STAGES.DEAL) {
      // Allow if strictly enforced? User said strict order.
      // But maybe they are in Site View and want to close?
      // User: "Call -> Meeting -> Site View -> Deal -> Close".
      // So they must be in "Deal" stage (which is the stage BEFORE closing).
      // "End Deal" button is in Deal stage.
    }

    // Create Deal
    // We need listingId. If not provided, is it optional? Schema says `listingId` is required in Deal model.
    // "ListingId String @db.Uuid"
    // So we must have a listing.
    if (!data.listingId) {
      // Maybe pick one from interest? Or throw error.
      throw { status: 400, message: "Listing is required for a deal" }
    }

    const deal = await prisma.deal.create({
      data: {
        tenantId,
        leadId,
        listingId: data.listingId,
        price: data.price,
        status: "pending",
        approvalStatus: "pending",
        closedAt: data.closedAt
      }
    })

    // Update lead status
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "deal_submitted" } 
    })

    // Notify admins/team leaders
    const admins = await prisma.user.findMany({
      where: {
        tenantId,
        roleLinks: { some: { role: { name: { in: ["owner", "team_leader"] } } } }
      },
      select: { id: true }
    })
    
    if (admins.length > 0) {
      const submitter = await prisma.user.findUnique({ where: { id: userId }, select: { profile: { select: { firstName: true, lastName: true } }, email: true } })
      const submitterName = submitter?.profile ? `${submitter.profile.firstName || ""} ${submitter.profile.lastName || ""}`.trim() : (submitter?.email || "Unknown")

      await notificationService.sendMany(
        admins.map(a => a.id).filter(id => id !== userId),
        {
          tenantId,
          type: "info",
          title: "صفقة جديدة",
          message: `تم تقديم صفقة جديدة بواسطة ${submitterName} للعميل ${lead.name}`,
          entityType: "deal",
          entityId: deal.id,
          actionUrl: `/leads/${leadId}`,
          senderId: userId
        }
      ).catch(console.error)
    }

    return deal
  },

  approveDeal: async (tenantId: string, dealId: string, approverId: string, data: { netProfit: number; price?: number }) => {
    const deal = await prisma.deal.findFirst({ where: { id: dealId, tenantId } })
    if (!deal) throw { status: 404, message: "Deal not found" }

    const updatedDeal = await prisma.deal.update({
      where: { id: dealId },
      data: {
        status: "approved",
        approvalStatus: "approved",
        approvedByUserId: approverId,
        netProfit: data.netProfit,
        price: data.price || deal.price
      }
    })

    // Update Lead to WON
    await prisma.lead.update({
      where: { id: deal.leadId },
      data: { lifecycleStage: STAGES.WON, status: STAGES.WON }
    })

    // Create Finance Entry
    await prisma.financeEntry.create({
      data: {
        tenantId,
        entryType: "income",
        category: "deal_profit",
        amount: data.netProfit,
        occurredAt: new Date(),
        createdBy: approverId,
        note: `Profit from Deal #${deal.id}`
      }
    })

    // Notify the lead assignee (Sales Agent)
    const lead = await prisma.lead.findUnique({ where: { id: deal.leadId }, select: { assignedUserId: true, name: true } })
    if (lead?.assignedUserId) {
      await notificationService.send({
        tenantId,
        userId: lead.assignedUserId,
        type: "success",
        title: "تمت الموافقة على الصفقة",
        message: `تمت الموافقة على الصفقة للعميل ${lead.name}`,
        entityType: "deal",
        entityId: deal.id,
        actionUrl: `/leads/${deal.leadId}`,
        senderId: approverId
      }).catch(console.error)
    }

    // Check Goals for the lead assignee
    if (lead?.assignedUserId) {
        goalsService.checkAchievement(tenantId, lead.assignedUserId).catch(console.error)
    }

    return updatedDeal
  },

  requestExtension: async (tenantId: string, leadId: string, requesterId: string, reason: string, days: number = 3) => {
    // Check if lead is active
    const lead = await prisma.lead.findUnique({ where: { id: leadId } })
    if (!lead) throw { status: 404, message: "Lead not found" }

    // Create extension request
    // We use LeadExtension model
    // Need stateId.
    const currentState = await lifecycleService.getStateByCode(tenantId, lead.lifecycleStage)
    if (!currentState) throw { status: 400, message: "Current state invalid" }

    const extension = await prisma.leadExtension.create({
      data: {
        tenantId,
        leadId,
        stateId: currentState.id,
        requestedBy: requesterId,
        reason,
        extensionHours: days * 24,
        status: "pending"
      }
    })

    // Notify admins
    const admins = await prisma.user.findMany({
      where: {
        tenantId,
        roleLinks: { some: { role: { name: { in: ["owner", "team_leader"] } } } }
      },
      select: { id: true }
    })
    
    if (admins.length > 0) {
      const requester = await prisma.user.findUnique({ where: { id: requesterId }, select: { profile: { select: { firstName: true, lastName: true } }, email: true } })
      const requesterName = requester?.profile ? `${requester.profile.firstName || ""} ${requester.profile.lastName || ""}`.trim() : (requester?.email || "Unknown")

      await notificationService.sendMany(
        admins.map(a => a.id).filter(id => id !== requesterId),
        {
          tenantId,
          type: "warning",
          title: "طلب تمديد مهلة",
          message: `طلب ${requesterName} تمديد مهلة للعميل ${lead.name}`,
          entityType: "extension",
          entityId: extension.id,
          actionUrl: `/leads/${leadId}`,
          senderId: requesterId
        }
      ).catch(console.error)
    }

    return extension
  },

  approveExtension: async (tenantId: string, extensionId: string, approverId: string) => {
    const ext = await prisma.leadExtension.findUnique({ where: { id: extensionId } })
    if (!ext) throw { status: 404, message: "Extension request not found" }

    await prisma.leadExtension.update({
      where: { id: extensionId },
      data: { status: "approved", approvedBy: approverId, decidedAt: new Date() }
    })

    await prisma.lead.update({
      where: { id: ext.leadId },
      data: { isTimerExtended: true }
    })

    // Notify requester
    if (ext.requestedBy) {
        await notificationService.send({
            tenantId,
            userId: ext.requestedBy,
            type: "success",
            title: "تمت الموافقة على التمديد",
            message: "تمت الموافقة على طلب تمديد المهلة.",
            entityType: "extension",
            entityId: ext.id,
            actionUrl: `/leads/${ext.leadId}`,
            senderId: approverId
        }).catch(console.error)
    }

    return { success: true }
  },

  rejectExtension: async (tenantId: string, extensionId: string, rejecterId: string) => {
    const ext = await prisma.leadExtension.findUnique({ where: { id: extensionId } })
    if (!ext) throw { status: 404, message: "Extension request not found" }

    await prisma.leadExtension.update({
      where: { id: extensionId },
      data: { status: "rejected", approvedBy: rejecterId, decidedAt: new Date() }
    })

    // Notify requester
    if (ext.requestedBy) {
        await notificationService.send({
            tenantId,
            userId: ext.requestedBy,
            type: "error",
            title: "تم رفض التمديد",
            message: "تم رفض طلب تمديد المهلة.",
            entityType: "extension",
            entityId: ext.id,
            actionUrl: `/leads/${ext.leadId}`,
            senderId: rejecterId
        }).catch(console.error)
    }

    return { success: true }
  },

  rejectDeal: async (tenantId: string, dealId: string, rejecterId: string, reason?: string) => {
    const deal = await prisma.deal.findFirst({ where: { id: dealId, tenantId } })
    if (!deal) throw { status: 404, message: "Deal not found" }

    const updatedDeal = await prisma.deal.update({
      where: { id: dealId },
      data: {
        status: "rejected",
        approvalStatus: "rejected",
        approvedByUserId: rejecterId,
        // notes: reason // 'notes' does not exist on Deal
      }
    })

    // Update Lead status back to Deal (active)
    await prisma.lead.update({
        where: { id: deal.leadId },
        data: { status: STAGES.DEAL }
    })

    // Notify the lead assignee (Sales Agent)
    const lead = await prisma.lead.findUnique({ where: { id: deal.leadId }, select: { assignedUserId: true, name: true } })
    if (lead?.assignedUserId) {
      await notificationService.send({
        tenantId,
        userId: lead.assignedUserId,
        type: "error",
        title: "تم رفض الصفقة",
        message: `تم رفض الصفقة للعميل ${lead.name}${reason ? ': ' + reason : ''}`,
        entityType: "deal",
        entityId: deal.id,
        actionUrl: `/leads/${deal.leadId}`,
        senderId: rejecterId
      }).catch(console.error)
    }

    return updatedDeal
  }
}
