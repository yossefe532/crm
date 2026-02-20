import { Request, Response } from "express"
import { leadService } from "./service"
import { coreService } from "../core/service"
import { meetingService } from "../meeting/service"
import { getPagination } from "../../utils/pagination"
import { logActivity } from "../../utils/activity"
import { intelligenceService } from "../intelligence/service"
import { notificationService } from "../notifications/service"
import { lifecycleService } from "../lifecycle/service"
import { prisma } from "../../prisma/client"
import { UserPayload } from "../../utils/auth"

const resolveAssignmentTarget = async (tenantId: string, actor: UserPayload | undefined, assignedUserId: string) => {
  const targetUser = await prisma.user.findFirst({ where: { id: assignedUserId, tenantId, deletedAt: null, status: "active" } })
  if (!targetUser) throw { status: 404, message: "المستخدم غير موجود" }
  const roleLinks = await prisma.userRole.findMany({ where: { tenantId, userId: assignedUserId, revokedAt: null }, include: { role: true } })
  const targetRoles = roleLinks.length ? roleLinks.map((link) => link.role.name) : ["sales"]
  let resolvedTeamId: string | undefined
  if (actor?.roles?.includes("owner")) {
    if (!targetRoles.includes("team_leader") && !targetRoles.includes("sales")) {
      throw { status: 400, message: "لا يمكن التعيين إلا لقائد فريق أو مندوب مبيعات" }
    }
    if (targetRoles.includes("team_leader")) {
      const team = await prisma.team.findFirst({ where: { tenantId, leaderUserId: assignedUserId, deletedAt: null } })
      resolvedTeamId = team?.id
    }
    return { resolvedTeamId, targetRoles }
  }
  if (actor?.roles?.includes("team_leader")) {
    if (!targetRoles.includes("sales")) throw { status: 403, message: "يمكن التعيين لمندوبي المبيعات فقط" }
    const team = await prisma.team.findFirst({ where: { tenantId, leaderUserId: actor.id, deletedAt: null }, select: { id: true } })
    if (!team) throw { status: 400, message: "لا يوجد فريق مرتبط بك" }
    if (assignedUserId === actor.id) {
      resolvedTeamId = team.id
      return { resolvedTeamId, targetRoles }
    }
    const membership = await prisma.teamMember.findFirst({ where: { tenantId, teamId: team.id, userId: assignedUserId, leftAt: null, deletedAt: null } })
    if (!membership) throw { status: 403, message: "المندوب ليس ضمن فريقك" }
    resolvedTeamId = team.id
    return { resolvedTeamId, targetRoles }
  }
  if (actor?.roles?.includes("sales")) {
    if (assignedUserId !== actor.id) throw { status: 403, message: "غير مصرح بتنفيذ التعيين" }
    const membership = await prisma.teamMember.findFirst({ where: { tenantId, userId: assignedUserId, leftAt: null, deletedAt: null }, select: { teamId: true } })
    resolvedTeamId = membership?.teamId
    return { resolvedTeamId, targetRoles }
  }
  throw { status: 403, message: "غير مصرح بتنفيذ التعيين" }
}

const checkLeadAccess = async (lead: any, user: UserPayload, requireAction: boolean = true) => {
  if (user.roles?.includes("owner")) return true
  
  if (user.roles?.includes("team_leader")) {
    if (lead.assignedUserId === user.id) return true
    
    // Check if lead is assigned to a member of the leader's team
    const team = await prisma.team.findFirst({
      where: { tenantId: user.tenantId, leaderUserId: user.id, deletedAt: null },
      include: { members: true }
    })
    
    if (team) {
      const memberIds = team.members.map(m => m.userId)
      if (lead.assignedUserId && memberIds.includes(lead.assignedUserId)) return true
      if (lead.teamId === team.id) return true
    }
  }

  if (user.roles?.includes("sales")) {
    if (lead.assignedUserId === user.id) return true
  }

  return false
}

export const leadController = {
  createLead: async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId || ""
      const roles = req.user?.roles || []
      
      if (roles.includes("sales") && !roles.includes("owner") && !roles.includes("team_leader")) {
        throw { status: 403, message: "غير مصرح لك بإضافة عملاء مباشرة. يرجى إرسال طلب إضافة." }
      }

      const name = String(req.body?.name || "").trim()
      const leadCode = String(req.body?.leadCode || "").trim()
      if (!name) throw { status: 400, message: "اسم العميل مطلوب" }

      const email = req.body?.email ? String(req.body.email).trim() : undefined
      const phone = req.body?.phone ? String(req.body.phone).trim() : undefined
      if (!phone) throw { status: 400, message: "رقم الهاتف مطلوب" }
      const duplicateChecks: Array<Record<string, unknown>> = []
      if (email) duplicateChecks.push({ email: { equals: email, mode: "insensitive" } })
      if (phone) duplicateChecks.push({ phone })
      const existing = await prisma.lead.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          name: { equals: name, mode: "insensitive" },
          OR: duplicateChecks
        }
      })
      if (existing) {
        res.status(409).json({
          message: "هذا العميل مسجل بالفعل",
          lead: {
            id: existing.id,
            name: existing.name,
            phone: existing.phone,
            email: existing.email,
            status: existing.status,
            assignedUserId: existing.assignedUserId,
            teamId: existing.teamId,
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt
          }
        })
        return
      }
      
      const requestedAssignedUserId = req.body?.assignedUserId ? String(req.body.assignedUserId) : undefined
      if (req.user?.roles?.includes("sales") && requestedAssignedUserId && requestedAssignedUserId !== req.user?.id) {
        throw { status: 403, message: "يمكن لمندوب المبيعات التعيين لنفسه فقط" }
      }
      const assignedUserId = requestedAssignedUserId || (req.user?.roles?.includes("sales") ? req.user?.id : undefined)
      const assignmentContext = assignedUserId ? await resolveAssignmentTarget(tenantId, req.user, assignedUserId) : undefined
      
      // If leadCode is not provided, generate one or use a default if acceptable (though schema says optional, logic below uses it)
      // Actually schema says leadCode is optional in Zod, but controller was checking it. 
      // Let's remove mandatory check for leadCode if it's meant to be auto-generated or optional.
      // But looking at service, it uses data.leadCode directly.
      // If the frontend sends empty string, we should handle it.
      // Let's assume if empty, we generate one.
      
      const finalLeadCode = leadCode || `L-${Date.now()}`

      

      const lead = await leadService.createLead(tenantId, {
        leadCode: finalLeadCode,
        name,
        phone,
        email,
        budget: req.body?.budget ? Number(req.body.budget) : undefined,
        areaOfInterest: req.body?.areaOfInterest ? String(req.body.areaOfInterest) : undefined,
        sourceLabel: req.body?.source ? String(req.body.source) : req.body?.sourceLabel ? String(req.body.sourceLabel) : undefined,
        sourceId: req.body?.sourceId ? String(req.body.sourceId) : undefined,
        assignedUserId,
        teamId: assignmentContext?.resolvedTeamId || (req.body?.teamId ? String(req.body.teamId) : undefined),
        priority: req.body?.priority ? String(req.body.priority) : undefined,
        budgetMin: req.body?.budgetMin ? Number(req.body.budgetMin) : undefined,
        budgetMax: req.body?.budgetMax ? Number(req.body.budgetMax) : undefined,
        desiredLocation: req.body?.desiredLocation ? String(req.body.desiredLocation) : undefined,
        propertyType: req.body?.propertyType ? String(req.body.propertyType) : undefined,
        profession: req.body?.profession ? String(req.body.profession) : undefined,
        notes: req.body?.notes ? String(req.body.notes) : undefined
      })
      if (assignedUserId) {
        await leadService.assignLead(tenantId, lead.id, assignedUserId, req.user?.id, req.body?.assignReason, assignmentContext?.resolvedTeamId || null)
        await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.assigned", entityType: "lead", entityId: lead.id, metadata: { assignedUserId } })
      }
      await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.created", entityType: "lead", entityId: lead.id })
      intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: lead.id, userId: lead.assignedUserId || undefined })
      res.json(lead)
    } catch (error: any) {
      console.error("Lead creation failed:", error)
      if (error.code === 'P2002') {
         throw { status: 409, message: "العميل موجود بالفعل" }
      }
      throw error
    }
  },
  listLeads: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const { skip, take, page, pageSize } = getPagination(req.query.page as string, req.query.pageSize as string)
    const q = req.query.q ? String(req.query.q) : undefined
    const leads = await leadService.listLeads(tenantId, skip, take, req.user, q)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.listed", entityType: "lead" })
    res.json({ data: leads, page, pageSize })
  },
  listTasks: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const tasks = await leadService.listTasks(tenantId, req.user)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.task.listed", entityType: "lead_task" })
    res.json(tasks)
  },
  updateLead: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const existing = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!existing) throw { status: 404, message: "العميل غير موجود" }
    const phone = req.body?.phone ? String(req.body.phone).trim() : undefined
    if (phone) {
      const duplicate = await prisma.lead.findFirst({
        where: { tenantId, deletedAt: null, phone, id: { not: existing.id } }
      })
      if (duplicate) throw { status: 409, message: "رقم الهاتف مستخدم بالفعل" }
    }
    const lead = await leadService.updateLead(tenantId, req.params.id, {
      name: req.body?.name ? String(req.body.name) : undefined,
      phone,
      email: req.body?.email ? String(req.body.email) : undefined,
      budget: req.body?.budget ? Number(req.body.budget) : undefined,
      areaOfInterest: req.body?.areaOfInterest ? String(req.body.areaOfInterest) : undefined,
      sourceLabel: req.body?.source ? String(req.body.source) : req.body?.sourceLabel ? String(req.body.sourceLabel) : undefined,
      sourceId: req.body?.sourceId ? String(req.body.sourceId) : undefined,
      priority: req.body?.priority ? String(req.body.priority) : undefined,
      budgetMin: req.body?.budgetMin ? Number(req.body.budgetMin) : undefined,
      budgetMax: req.body?.budgetMax ? Number(req.body.budgetMax) : undefined,
      desiredLocation: req.body?.desiredLocation ? String(req.body.desiredLocation) : undefined,
      propertyType: req.body?.propertyType ? String(req.body.propertyType) : undefined,
      profession: req.body?.profession ? String(req.body.profession) : undefined,
      notes: req.body?.notes ? String(req.body.notes) : undefined
    })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.updated", entityType: "lead", entityId: lead.id })
    intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: lead.id, userId: lead.assignedUserId || undefined })
    res.json(lead)
  },
  getLead: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const lead = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!lead) throw { status: 404, message: "العميل غير موجود" }
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.viewed", entityType: "lead", entityId: lead.id })
    res.json(lead)
  },
  deleteLead: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const existing = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!existing) throw { status: 404, message: "العميل غير موجود" }
    const lead = await leadService.deleteLead(tenantId, req.params.id)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.deleted", entityType: "lead", entityId: lead.id })
    res.json(lead)
  },
  updateStage: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const stageCode = String(req.body?.stage || req.body?.code || "").trim().toLowerCase()
    if (!stageCode) throw { status: 400, message: "المرحلة مطلوبة" }
    const state = await lifecycleService.getStateByCode(tenantId, stageCode)
    if (!state) throw { status: 404, message: "المرحلة غير موجودة" }
    const existing = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!existing) throw { status: 404, message: "العميل غير موجود" }
    if (req.user?.roles?.includes("sales") && !req.user?.roles?.includes("owner") && !req.user?.roles?.includes("team_leader")) {
      if (existing.assignedUserId !== req.user?.id) {
        throw { status: 403, message: "غير مصرح بتنفيذ المراحل" }
      }
    }
    const orderMap: Record<string, number> = { new: 0, call: 0, meeting: 1, site_visit: 2, closing: 3 }
    const currentIndex = orderMap[existing.status] ?? 0
    const targetIndex = orderMap[stageCode]
    if (targetIndex === undefined || targetIndex !== currentIndex + 1) {
      throw { status: 400, message: "انتقال غير صالح بين المراحل" }
    }
    const updatedState = await lifecycleService.transitionLead(tenantId, req.params.id, state.id, req.user?.id)
    const lead = await prisma.lead.findFirst({ where: { tenantId, id: req.params.id }, select: { id: true, name: true, assignedUserId: true, teamId: true } })
    const stageLabelMap: Record<string, string> = { new: "جديد", call: "مكالمة هاتفية", meeting: "اجتماع", site_visit: "رؤية الموقع", closing: "إغلاق الصفقة" }
    const messageAr = `تم نقل العميل ${lead?.name || req.params.id} إلى مرحلة ${stageLabelMap[updatedState.code] || updatedState.code}`
    const event = await notificationService.publishEvent(tenantId, "lead.stage.completed", {
      leadId: req.params.id,
      leadName: lead?.name,
      stage: updatedState.code,
      changedBy: req.user?.id,
      recipientUserId: lead?.assignedUserId,
      targets: ["owner", "team_leader", "sales"],
      messageAr
    })
    await notificationService.queueDelivery(tenantId, event.id, "in_app")
    if (lead?.assignedUserId) {
      await notificationService.broadcast(tenantId, { type: "user", value: lead.assignedUserId }, messageAr, ["push"])
    }
    await notificationService.broadcast(tenantId, { type: "role", value: "team_leader" }, messageAr, ["push"])
    await notificationService.broadcast(tenantId, { type: "role", value: "owner" }, messageAr, ["push"])
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.stage.updated", entityType: "lead", entityId: req.params.id, metadata: { stage: updatedState.code } })
    intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: req.params.id, userId: req.user?.id })
    res.json(updatedState)
  },
  undoStage: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const lead = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!lead) throw { status: 404, message: "العميل غير موجود" }
    const lastHistory = await prisma.leadStateHistory.findFirst({
      where: { tenantId, leadId: lead.id },
      orderBy: { changedAt: "desc" }
    })
    if (!lastHistory?.fromStateId) throw { status: 400, message: "لا يمكن التراجع حالياً" }
    const lastMetadata = (lastHistory.metadata || {}) as Record<string, unknown>
    if (lastMetadata.undoOf) throw { status: 400, message: "لا يمكن التراجع مرة أخرى" }
    const previousState = await prisma.leadStateDefinition.findFirst({ where: { tenantId, id: lastHistory.fromStateId } })
    if (!previousState) throw { status: 404, message: "المرحلة غير موجودة" }
    await prisma.leadStateHistory.update({
      where: { id: lastHistory.id },
      data: { metadata: { ...lastMetadata, undoneAt: new Date().toISOString(), undoneBy: req.user?.id } }
    })
    await prisma.leadStateHistory.create({
      data: {
        tenantId,
        leadId: lead.id,
        fromStateId: lastHistory.toStateId,
        toStateId: previousState.id,
        changedBy: req.user?.id,
        metadata: { undoOf: lastHistory.id }
      }
    })
    await prisma.lead.update({ where: { id: lead.id, tenantId }, data: { status: previousState.code } })
    await prisma.leadDeadline.updateMany({ where: { tenantId, leadId: lead.id, status: "active" }, data: { status: "completed" } })
    await prisma.leadDeadline.create({ data: { tenantId, leadId: lead.id, stateId: previousState.id, dueAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) } })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.stage.undone", entityType: "lead", entityId: lead.id, metadata: { toStage: previousState.code } })
    intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: lead.id, userId: req.user?.id })
    res.json({ status: previousState.code })
  },
  assignLead: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const assignedUserId = String(req.body?.assignedUserId || "").trim()
    if (!assignedUserId) throw { status: 400, message: "المستخدم المُسند مطلوب" }
    const lead = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!lead) throw { status: 404, message: "العميل غير موجود" }
    const assignmentContext = await resolveAssignmentTarget(tenantId, req.user, assignedUserId)
    const assignment = await leadService.assignLead(tenantId, req.params.id, assignedUserId, req.user?.id, req.body?.reason, assignmentContext.resolvedTeamId || null)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.assigned", entityType: "lead", entityId: req.params.id, metadata: { assignedUserId, previousAssignedUserId: lead.assignedUserId || null, reason: req.body?.reason } })
    intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: req.params.id, userId: assignedUserId })
    res.json(assignment)
  },
  unassignLead: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const lead = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!lead) throw { status: 404, message: "العميل غير موجود" }
    const updated = await leadService.unassignLead(tenantId, req.params.id)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.unassigned", entityType: "lead", entityId: req.params.id, metadata: { previousAssignedUserId: lead.assignedUserId || null } })
    intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: req.params.id, userId: req.user?.id })
    res.json(updated)
  },
  addLeadContact: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const link = await leadService.createLeadContact(tenantId, req.params.id, req.body.contactId, req.body.role)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.contact.added", entityType: "lead", entityId: req.params.id, metadata: { contactId: req.body.contactId } })
    res.json(link)
  },
  addLeadTask: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const task = await leadService.createLeadTask(tenantId, { leadId: req.params.id, assignedUserId: req.body.assignedUserId, taskType: req.body.taskType, dueAt: req.body.dueAt })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.task.created", entityType: "lead_task", entityId: task.id, metadata: { leadId: req.params.id } })
    intelligenceService.queueTrigger({ type: "task_changed", tenantId, leadId: req.params.id, userId: req.body.assignedUserId })
    res.json(task)
  },
  addCallLog: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const outcome = req.body?.outcome ? String(req.body.outcome) : undefined
    if (!outcome) throw { status: 400, message: "نتيجة المكالمة مطلوبة" }
    const lead = await leadService.getLead(tenantId, req.params.id)
    if (!lead) throw { status: 404, message: "العميل غير موجود" }
    const call = await leadService.createCallLog(tenantId, { leadId: req.params.id, callerUserId: req.user?.id, durationSeconds: req.body.durationSeconds, outcome, recordingFileId: req.body.recordingFileId })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.call.logged", entityType: "call_log", entityId: call.id, metadata: { leadId: req.params.id } })
    intelligenceService.queueTrigger({ type: "lead_engaged", tenantId, leadId: req.params.id, userId: req.user?.id })
    const event = await notificationService.publishEvent(tenantId, "lead.call.logged", {
      leadId: req.params.id,
      outcome,
      targets: ["owner"],
      messageAr: `تم تسجيل مكالمة للعميل ${lead.name}`
    })
    await notificationService.queueDelivery(tenantId, event.id, "in_app")
    res.json(call)
  },
  createLeadSource: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const source = await leadService.createLeadSource(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead_source.created", entityType: "lead_source", entityId: source.id })
    res.json(source)
  },
  listLeadSources: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const sources = await leadService.listLeadSources(tenantId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead_source.listed", entityType: "lead_source" })
    res.json(sources)
  },
  getDeadline: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const existing = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!existing) throw { status: 404, message: "العميل غير موجود" }
    const deadline = await leadService.getActiveDeadline(tenantId, req.params.id)
    res.json(deadline)
  },
  listDeadlines: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const deadlines = await leadService.listActiveDeadlines(tenantId)
    res.json(deadlines)
  },
  listFailures: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const failures = await leadService.listFailures(tenantId, req.query.leadId ? String(req.query.leadId) : undefined)
    res.json(failures)
  },
  listClosures: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const closures = await leadService.listClosures(tenantId)
    
    let filtered = closures
    const user = req.user!
    
    if (user.roles?.includes("owner")) {
      // Owner sees all
    } else if (user.roles?.includes("team_leader")) {
      const team = await prisma.team.findFirst({
        where: { tenantId, leaderUserId: user.id, deletedAt: null },
        include: { members: true }
      })
      const memberIds = team?.members.map(m => m.userId) || []
      filtered = closures.filter(c => 
        c.closedBy === user.id || (c.closedBy && memberIds.includes(c.closedBy))
      )
    } else {
      // Sales sees own
      filtered = closures.filter(c => c.closedBy === user.id)
    }

    res.json(filtered)
  },
  decideClosure: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!req.user?.roles?.includes("owner")) throw { status: 403, message: "غير مصرح" }
    const status = String(req.body?.status || "").trim()
    if (!status || !["approved", "rejected"].includes(status)) throw { status: 400, message: "قرار غير صالح" }
    const closure = await leadService.decideClosure(tenantId, req.params.closureId, { status, decidedBy: req.user?.id || "" })
    if (status === "approved") {
      await prisma.lead.update({ where: { id: closure.leadId, tenantId }, data: { status: "closed", assignedUserId: null } })
      await prisma.leadDeadline.updateMany({ where: { tenantId, leadId: closure.leadId, status: "active" }, data: { status: "completed" } })
    }
    if (status === "rejected") {
      await prisma.lead.update({ where: { id: closure.leadId, tenantId }, data: { status: "failed", assignedUserId: null } })
    }
    const lead = await prisma.lead.findFirst({ where: { id: closure.leadId, tenantId } })
    const actor = closure.closedBy ? await prisma.user.findFirst({ where: { tenantId, id: closure.closedBy }, include: { profile: true } }) : null
    const actorName = actor?.profile?.firstName
      ? `${actor.profile.firstName}${actor.profile.lastName ? ` ${actor.profile.lastName}` : ""}`
      : actor?.email
    const message = status === "approved"
      ? `نجح المستخدم ${actorName || "غير معروف"} في صفقة`
      : `فشل المستخدم ${actorName || "غير معروف"} في صفقة`
    const event = await notificationService.publishEvent(tenantId, "lead.closure.decided", {
      leadId: closure.leadId,
      leadName: lead?.name,
      status,
      userId: closure.closedBy,
      targets: ["all"],
      messageAr: message
    })
    await notificationService.queueDelivery(tenantId, event.id, "in_app")
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.close.decided", entityType: "lead_closure", entityId: closure.id, metadata: { status } })
    res.json(closure)
  },
  closeLead: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const lead = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!lead) throw { status: 404, message: "العميل غير موجود" }
    if (!req.user?.roles?.includes("sales") || lead.assignedUserId !== req.user?.id) {
      throw { status: 403, message: "غير مصرح بإغلاق الصفقة" }
    }
    if (lead.status !== "closing") throw { status: 400, message: "لا يمكن الإغلاق قبل مرحلة الإغلاق" }
    const amount = Number(req.body?.amount)
    if (!Number.isFinite(amount) || amount <= 0) throw { status: 400, message: "قيمة الإغلاق غير صحيحة" }
    const note = req.body?.note ? String(req.body.note) : undefined
    const address = req.body?.address ? String(req.body.address) : undefined
    if (!address) throw { status: 400, message: "عنوان الإغلاق مطلوب" }
    const closure = await leadService.createClosure(tenantId, { leadId: lead.id, closedBy: req.user?.id, amount, note, address })
    await prisma.lead.update({ where: { id: lead.id, tenantId }, data: { status: "closing", assignedUserId: null } })
    const event = await notificationService.publishEvent(tenantId, "lead.closed", {
      leadId: lead.id,
      leadName: lead.name,
      amount,
      targets: ["owner"],
      messageAr: `طلب اعتماد صفقة للعميل ${lead.name} بقيمة ${amount.toLocaleString("ar-EG")}`
    })
    await notificationService.queueDelivery(tenantId, event.id, "in_app")
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.close.requested", entityType: "lead", entityId: lead.id, metadata: { amount } })
    res.json(closure)
  },
  failLead: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const lead = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!lead) throw { status: 404, message: "العميل غير موجود" }
    
    const hasAccess = await checkLeadAccess(lead, req.user!)
    if (!hasAccess) {
      throw { status: 403, message: "غير مصرح بتسجيل الفشل" }
    }

    const failureType = String(req.body?.failureType || "surrender")
    const reason = req.body?.reason ? String(req.body.reason) : undefined
    if (failureType !== "overdue" && failureType !== "surrender") throw { status: 400, message: "نوع الفشل غير صالح" }
    if (failureType === "surrender" && !reason) throw { status: 400, message: "سبب الفشل مطلوب" }
    const status = reason ? "resolved" : "pending"
    const failure = await leadService.createFailure(tenantId, { leadId: lead.id, failedBy: req.user?.id || undefined, failureType, reason, status })
    await prisma.lead.update({ where: { id: lead.id, tenantId }, data: { status: "failed", assignedUserId: null } })
    await prisma.leadDeadline.updateMany({ where: { tenantId, leadId: lead.id, status: "active" }, data: { status: "overdue" } })
    if (!reason && lead.assignedUserId) {
      const user = await prisma.user.findFirst({ where: { tenantId, id: lead.assignedUserId } })
      const roles = await prisma.userRole.findMany({ where: { tenantId, userId: lead.assignedUserId, revokedAt: null }, include: { role: true } })
      const roleNames = roles.map((row) => row.role.name)
      if (user && roleNames.includes("sales")) {
        await prisma.user.update({ where: { id: user.id }, data: { status: "inactive" } })
      }
    }
    const event = await notificationService.publishEvent(tenantId, "lead.failed", {
      leadId: lead.id,
      leadName: lead.name,
      failureType,
      reason: reason || null,
      targets: ["owner"],
      messageAr: `فشل العميل ${lead.name}${reason ? `: ${reason}` : ""}`
    })
    await notificationService.queueDelivery(tenantId, event.id, "in_app")
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.failed", entityType: "lead", entityId: lead.id, metadata: { failureType } })
    res.json(failure)
  },
  resolveFailure: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const reason = String(req.body?.reason || "").trim()
    if (!reason) throw { status: 400, message: "سبب الفشل مطلوب" }
    const failure = await leadService.resolveFailure(tenantId, req.params.failureId, reason)
    if (failure.failedBy) {
      const user = await prisma.user.findFirst({ where: { tenantId, id: failure.failedBy } })
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { status: "active" } })
      }
    }
    const lead = await prisma.lead.findFirst({ where: { id: failure.leadId, tenantId } })
    const actor = failure.failedBy ? await prisma.user.findFirst({ where: { tenantId, id: failure.failedBy }, include: { profile: true } }) : null
    const actorName = actor?.profile?.firstName
      ? `${actor.profile.firstName}${actor.profile.lastName ? ` ${actor.profile.lastName}` : ""}`
      : actor?.email
    const event = await notificationService.publishEvent(tenantId, "lead.failure.decided", {
      leadId: failure.leadId,
      leadName: lead?.name,
      userId: failure.failedBy,
      targets: ["all"],
      messageAr: `فشل المستخدم ${actorName || "غير معروف"} في صفقة`
    })
    await notificationService.queueDelivery(tenantId, event.id, "in_app")
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.failure.resolved", entityType: "lead_failure", entityId: failure.id })
    res.json(failure)
  },

  createMeeting: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const leadId = req.params.leadId
    const title = String(req.body.title || "اجتماع جديد")
    const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : new Date()
    const durationMinutes = req.body.durationMinutes ? parseInt(req.body.durationMinutes) : 60
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000)
    const status = req.body.status || "scheduled"

    const meeting = await leadService.createMeeting(tenantId, {
      leadId,
      organizerUserId: req.user?.id || "",
      title,
      startsAt,
      endsAt,
      status
    })

    await logActivity({ tenantId, actorUserId: req.user?.id, action: "meeting.created", entityType: "meeting", entityId: meeting.id, metadata: { leadId } })
    res.json(meeting)
  }
}
