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

const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)

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
      const name = String(req.body?.name || "").trim()
      
      if (roles.includes("sales") && !roles.includes("owner") && !roles.includes("team_leader")) {
        const actor = await prisma.user.findUnique({ where: { id: req.user?.id }, select: { profile: { select: { firstName: true, lastName: true } }, email: true } })
        const actorName = actor?.profile ? `${actor.profile.firstName || ""} ${actor.profile.lastName || ""}`.trim() : (actor?.email || "Unknown")
        
        const requestPayload = { ...req.body, assignedUserId: req.user?.id }
        const request = await coreService.createUserRequest(tenantId, req.user?.id || "", "create_lead", requestPayload)
        await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.request.created", entityType: "user_request", entityId: request.id })
        
        // Notify admins/team leaders
        const admins = await prisma.userRole.findMany({ 
          where: { tenantId, role: { name: { in: ["owner", "admin", "team_leader"] } }, revokedAt: null },
          select: { userId: true }
        })
        const recipientIds = [...new Set(admins.map(a => a.userId))]
        await notificationService.sendMany(recipientIds, {
          tenantId,
          title: "طلب إضافة عميل جديد",
          message: `طلب المندوب ${actorName} إضافة عميل جديد: ${name}`,
          type: "info",
          entityId: request.id,
          entityType: "user_request",
          actionUrl: `/settings/requests/${request.id}`
        })

        return res.json({ 
          message: "تم إرسال طلب إضافة العميل للموافقة", 
          request,
          status: "pending" 
        })
      }

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
    const filters = {
      status: req.query.status as string,
      assignment: req.query.assignment as string
    }
    const leads = await leadService.listLeads(tenantId, skip, take, req.user, req.query.q as string, filters)
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
    if (!isValidUUID(req.params.id)) throw { status: 404, message: "العميل غير موجود" }
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
      notes: req.body?.notes ? String(req.body.notes) : undefined,
      isWrongNumber: phone && phone !== existing.phone ? false : undefined
    })
    
    // Check for mentions in notes
    if (req.body?.notes && req.body.notes !== existing.notes) {
      const actor = await prisma.user.findUnique({ where: { id: req.user?.id }, select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } })
      const actorName = actor?.profile ? `${actor.profile.firstName || ""} ${actor.profile.lastName || ""}`.trim() : (actor?.email || "Unknown")
      
      await notificationService.notifyMentions(
        tenantId,
        req.body.notes,
        { id: req.user?.id || "", name: actorName },
        "lead",
        lead.id,
        `/leads/${lead.id}`
      ).catch(console.error)
    }

    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.updated", entityType: "lead", entityId: lead.id })
    intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: lead.id, userId: lead.assignedUserId || undefined })
    res.json(lead)
  },
  getLead: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!isValidUUID(req.params.id)) throw { status: 404, message: "العميل غير موجود" }
    const lead = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!lead) throw { status: 404, message: "العميل غير موجود" }
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.viewed", entityType: "lead", entityId: lead.id })
    res.json(lead)
  },
  deleteLead: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!isValidUUID(req.params.id)) throw { status: 404, message: "العميل غير موجود" }
    const existing = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!existing) throw { status: 404, message: "العميل غير موجود" }
    const lead = await leadService.deleteLead(tenantId, req.params.id)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.deleted", entityType: "lead", entityId: lead.id })
    res.json(lead)
  },

  restoreLead: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!isValidUUID(req.params.id)) throw { status: 404, message: "العميل غير موجود" }
    
    // Check if lead exists (even if deleted)
    const existing = await prisma.lead.findFirst({ where: { id: req.params.id, tenantId } })
    if (!existing) throw { status: 404, message: "العميل غير موجود" }

    const lead = await leadService.restoreLead(tenantId, req.params.id)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.restored", entityType: "lead", entityId: lead.id })
    res.json(lead)
  },

  listDeletedLeads: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const leads = await leadService.listDeletedLeads(tenantId)
    res.json(leads)
  },

  updateStage: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!isValidUUID(req.params.id)) throw { status: 404, message: "العميل غير موجود" }
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
    const orderMap: Record<string, number> = { new: 0, call: 1, meeting: 2, site_visit: 3, closing: 4 }
    const currentIndex = orderMap[existing.status] ?? 0
    const targetIndex = orderMap[stageCode]
    
    if (targetIndex === undefined) throw { status: 400, message: "المرحلة غير صالحة" }

    // Prevent skipping stages
    if (targetIndex > currentIndex + 1) {
      throw { status: 400, message: "لا يمكن تخطي المراحل" }
    }
    
    // Allow strict forward for now, but if we want backward, we need to handle it in lifecycle service too.
    // The previous code enforced targetIndex !== currentIndex + 1, which strictly enforces next step.
    // If I want to allow backward, I'd remove the lower bound check.
    // But since lifecycleService checks for DB transitions which are only forward, I will keep strict forward for now.
    
    if (targetIndex !== currentIndex + 1) {
       // Check if it is a backward move?
       if (targetIndex <= currentIndex) {
          // It's a backward move or same stage. 
          // Lifecycle service requires a transition record. 
          // Default stages don't have backward transitions.
          // So this will fail in service unless we bypass it there.
          // For now, I'll enforce strict forward progression to be safe and consistent.
          throw { status: 400, message: "يجب الانتقال للمرحلة التالية بالترتيب" }
       }
    }
    const answers = req.body?.answers
    const updatedState = await lifecycleService.transitionLead(tenantId, req.params.id, state.id, req.user?.id, answers)
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
    // Logic for undo... (Assuming this was truncated in previous read, but I'm appending after undoStage)
    // Actually I should find the END of leadController object.
    // The file ends with `export const leadController = { ... }`
    // I'll search for the end of `undoStage` and append there.
    // Let's read the end of the file first to be safe.
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
    if (!isValidUUID(req.params.id)) throw { status: 404, message: "العميل غير موجود" }
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
    if (!isValidUUID(req.params.id)) throw { status: 404, message: "العميل غير موجود" }
    const lead = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!lead) throw { status: 404, message: "العميل غير موجود" }
    const updated = await leadService.unassignLead(tenantId, req.params.id)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.unassigned", entityType: "lead", entityId: req.params.id, metadata: { previousAssignedUserId: lead.assignedUserId || null } })
    intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: req.params.id, userId: req.user?.id })
    res.json(updated)
  },
  addLeadContact: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!isValidUUID(req.params.id)) throw { status: 404, message: "العميل غير موجود" }
    const link = await leadService.createLeadContact(tenantId, req.params.id, req.body.contactId, req.body.role)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.contact.added", entityType: "lead", entityId: req.params.id, metadata: { contactId: req.body.contactId } })
    res.json(link)
  },
  addLeadTask: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!isValidUUID(req.params.id)) throw { status: 404, message: "العميل غير موجود" }
    const task = await leadService.createLeadTask(tenantId, { leadId: req.params.id, assignedUserId: req.body.assignedUserId, taskType: req.body.taskType, dueAt: req.body.dueAt })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.task.created", entityType: "lead_task", entityId: task.id, metadata: { leadId: req.params.id } })
    intelligenceService.queueTrigger({ type: "task_changed", tenantId, leadId: req.params.id, userId: req.body.assignedUserId })
    res.json(task)
  },
  addCallLog: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!isValidUUID(req.params.id)) throw { status: 404, message: "العميل غير موجود" }
    const outcome = req.body?.outcome ? String(req.body.outcome) : undefined
    if (!outcome) throw { status: 400, message: "نتيجة المكالمة مطلوبة" }
    const lead = await leadService.getLead(tenantId, req.params.id)
    if (!lead) throw { status: 404, message: "العميل غير موجود" }
    const call = await leadService.createCallLog(tenantId, { leadId: req.params.id, callerUserId: req.user?.id, durationSeconds: req.body.durationSeconds, outcome, recordingFileId: req.body.recordingFileId })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.call.logged", entityType: "call_log", entityId: call.id, metadata: { leadId: req.params.id } })
    intelligenceService.queueTrigger({ type: "lead_engaged", tenantId, leadId: req.params.id, userId: req.user?.id })
    
    if (outcome === "wrong_number") {
      await leadService.updateLead(tenantId, lead.id, { isWrongNumber: true })
      const messageAr = `⚠️ تنبيه: رقم خاطئ تم الإبلاغ عنه للعميل ${lead.name}`
      const event = await notificationService.publishEvent(tenantId, "lead.phone.wrong", {
        leadId: req.params.id,
        leadName: lead.name,
        reportedBy: req.user?.id,
        phone: lead.phone,
        messageAr
      })
      await notificationService.queueDelivery(tenantId, event.id, "in_app")
      // Also broadcast to owner specifically
      await notificationService.broadcast(tenantId, { type: "role", value: "owner" }, messageAr, ["in_app", "push"])
    } else {
      const event = await notificationService.publishEvent(tenantId, "lead.call.logged", {
        leadId: req.params.id,
        outcome,
        targets: ["owner"],
        messageAr: `تم تسجيل مكالمة للعميل ${lead.name}`
      })
      await notificationService.queueDelivery(tenantId, event.id, "in_app")
    }
    
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
    if (!isValidUUID(req.params.id)) throw { status: 404, message: "العميل غير موجود" }
    const existing = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!existing) throw { status: 404, message: "العميل غير موجود" }
    const deadline = await leadService.getActiveDeadline(tenantId, req.params.id)
    res.json(deadline)
  },
  listDeadlines: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const roles = req.user?.roles || []
    const role = roles.includes("owner") ? "owner" : roles.includes("team_leader") ? "team_leader" : "sales"
    const deadlines = await leadService.listActiveDeadlines(tenantId, req.user?.id, role)
    res.json(deadlines)
  },
  listFailures: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const roles = req.user?.roles || []
    const role = roles.includes("owner") ? "owner" : roles.includes("team_leader") ? "team_leader" : "sales"
    const failures = await leadService.listFailures(tenantId, req.query.leadId ? String(req.query.leadId) : undefined, req.user?.id, role)
    res.json(failures)
  },
  listClosures: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const roles = req.user?.roles || []
    const role = roles.includes("owner") ? "owner" : roles.includes("team_leader") ? "team_leader" : "sales"
    const closures = await leadService.listClosures(tenantId, req.user?.id, role)
    res.json(closures)
  },
  decideClosure: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!isValidUUID(req.params.closureId)) throw { status: 404, message: "طلب الإغلاق غير موجود" }
    if (!req.user?.roles?.includes("owner")) throw { status: 403, message: "غير مصرح" }
    const status = String(req.body?.status || "").trim()
    if (!status || !["approved", "rejected"].includes(status)) throw { status: 400, message: "قرار غير صالح" }

    const amount = req.body.amount ? Number(req.body.amount) : undefined
    const note = req.body.note ? String(req.body.note) : undefined

    const closure = await leadService.decideClosure(tenantId, req.params.closureId, {
      status,
      decidedBy: req.user?.id || "",
      amount,
      note
    })

    if (status === "approved") {
      await prisma.lead.update({ where: { id: closure.leadId, tenantId }, data: { status: "won", assignedUserId: null } })
      await prisma.leadDeadline.updateMany({ where: { tenantId, leadId: closure.leadId, status: "active" }, data: { status: "completed" } })

      // Create Finance Entry
      await prisma.financeEntry.create({
        data: {
          tenantId,
          entryType: "income",
          category: "sales_revenue",
          amount: closure.amount,
          note: `إغلاق صفقة للعميل (ID: ${closure.leadId})`,
          occurredAt: new Date(),
          createdBy: req.user?.id
        }
      })
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
    if (!isValidUUID(req.params.id)) throw { status: 404, message: "العميل غير موجود" }
    const lead = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!lead) throw { status: 404, message: "العميل غير موجود" }
    if (!req.user?.roles?.includes("sales") || lead.assignedUserId !== req.user?.id) {
      throw { status: 403, message: "غير مصرح بإغلاق الصفقة" }
    }
    if (lead.status !== "closing" && lead.status !== "site_visit" && lead.status !== "meeting" && lead.status !== "call" && lead.status !== "new") {
       // Allow closing from any active stage, but typically it follows site_visit.
       // The previous check was: if (lead.status !== "closing") throw ...
       // But wait, if status is "closing", it means it is ALREADY in closing stage?
       // If so, we are just creating the closure request?
       // But the requirement is to use transition to validate questions.
       // If the lead is already in "closing", we might be updating the closure info?
       // Actually, the previous code:
       // if (lead.status !== "closing") throw { status: 400, message: "لا يمكن الإغلاق قبل مرحلة الإغلاق" }
       // This implies the user must have MANUALLY moved to "closing" stage first using updateStage?
       // But updateStage to "closing" would require questions!
       // So if they are already in "closing", they must have answered questions.
       
       // BUT, the UI shows "ClosureModal" usually when clicking "Won" or "Close Deal".
       // If the user flow is: Click "Won" -> Open Modal -> Submit -> Transition to Closing -> Create Closure Request.
       // Then we should allow transition from any previous stage to "closing".
       
       // Let's assume the user can click "Close Deal" from any stage (e.g. after a call).
    }
    
    const amount = Number(req.body?.amount)
    if (!Number.isFinite(amount) || amount <= 0) throw { status: 400, message: "قيمة الإغلاق غير صحيحة" }
    
    const contractDate = req.body?.contractDate ? String(req.body.contractDate) : undefined
    if (!contractDate) throw { status: 400, message: "تاريخ العقد مطلوب" }

    const note = req.body?.note ? String(req.body.note) : undefined
    const address = req.body?.address ? String(req.body.address) : undefined
    if (!address) throw { status: 400, message: "عنوان الإغلاق مطلوب" }

    // 1. Get Closing State
    const closingState = await lifecycleService.getStateByCode(tenantId, "closing")
    if (!closingState) throw { status: 500, message: "مرحلة الإغلاق غير معرفة في النظام" }

    // 2. Transition Lead (Validates questions and deadlines)
    await lifecycleService.transitionLead(tenantId, lead.id, closingState.id, req.user?.id, {
        amount,
        contract_date: contractDate
    })

    // 3. Create Closure Record
    const closure = await leadService.createClosure(tenantId, { leadId: lead.id, closedBy: req.user?.id, amount, note, address })
    
    // 4. Notifications
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
    if (!isValidUUID(req.params.id)) throw { status: 404, message: "العميل غير موجود" }
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
    if (!isValidUUID(req.params.failureId)) throw { status: 404, message: "طلب الفشل غير موجود" }
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
    if (!isValidUUID(leadId)) throw { status: 404, message: "العميل غير موجود" }
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
  },

  advanceStage: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!isValidUUID(req.params.id)) throw { status: 404, message: "العميل غير موجود" }
    
    const lead = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!lead) throw { status: 404, message: "العميل غير موجود أو ليس لديك صلاحية" }
    
    if (req.user?.roles?.includes("sales") && !req.user?.roles?.includes("owner") && !req.user?.roles?.includes("team_leader")) {
        if (lead.assignedUserId !== req.user.id) {
            throw { status: 403, message: "غير مصرح بتعديل هذا العميل" }
        }
    }

    const result = await leadService.advanceStage(tenantId, req.params.id, req.user?.id || "")
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.stage.advanced", entityType: "lead", entityId: req.params.id, metadata: { from: lead.lifecycleStage, to: result.nextStage } })
    res.json(result)
  },

  submitDeal: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!isValidUUID(req.params.id)) throw { status: 404, message: "العميل غير موجود" }
    
    const lead = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!lead) throw { status: 404, message: "العميل غير موجود" }

    if (req.user?.roles?.includes("sales") && !req.user?.roles?.includes("owner") && !req.user?.roles?.includes("team_leader")) {
        if (lead.assignedUserId !== req.user.id) {
            throw { status: 403, message: "غير مصرح بإنشاء صفقة لهذا العميل" }
        }
    }

    const listingId = req.body.listingId
    const price = Number(req.body.price)
    
    if (!listingId || isNaN(price)) throw { status: 400, message: "بيانات الصفقة غير مكتملة" }

    const deal = await leadService.submitDeal(tenantId, req.params.id, req.user?.id || "", {
        price,
        listingId,
        closedAt: new Date()
    })
    
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.deal.submitted", entityType: "deal", entityId: deal.id })
    res.json(deal)
  },

  approveDeal: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!req.user?.roles?.includes("owner")) throw { status: 403, message: "فقط المالك يمكنه الموافقة على الصفقات" }
    
    const netProfit = Number(req.body.netProfit)
    if (isNaN(netProfit)) throw { status: 400, message: "صافي الربح مطلوب" }

    const deal = await leadService.approveDeal(tenantId, req.params.dealId, req.user?.id || "", {
        netProfit,
        price: req.body.price ? Number(req.body.price) : undefined
    })

    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.deal.approved", entityType: "deal", entityId: deal.id })
    res.json(deal)
  },

  requestExtension: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const lead = await leadService.getLeadForUser(tenantId, req.params.id, req.user)
    if (!lead) throw { status: 404, message: "العميل غير موجود" }
    
    const reason = req.body.reason
    if (!reason) throw { status: 400, message: "سبب التمديد مطلوب" }

    const ext = await leadService.requestExtension(tenantId, req.params.id, req.user?.id || "", reason)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.extension.requested", entityType: "lead_extension", entityId: ext.id })
    res.json(ext)
  },

  approveExtension: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!req.user?.roles?.includes("owner") && !req.user?.roles?.includes("team_leader")) {
        throw { status: 403, message: "غير مصرح بالموافقة على التمديد" }
    }
    
    const ext = await leadService.approveExtension(tenantId, req.params.extensionId, req.user?.id || "")
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.extension.approved", entityType: "lead_extension", entityId: ext.success ? req.params.extensionId : "" })
    res.json(ext)
  },

  rejectExtension: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!req.user?.roles?.includes("owner") && !req.user?.roles?.includes("team_leader")) {
        throw { status: 403, message: "غير مصرح برفض التمديد" }
    }
    
    const result = await leadService.rejectExtension(tenantId, req.params.extensionId, req.user?.id || "")
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.extension.rejected", entityType: "lead_extension", entityId: req.params.extensionId })
    res.json(result)
  },

  rejectDeal: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!req.user?.roles?.includes("owner")) throw { status: 403, message: "فقط المالك يمكنه رفض الصفقات" }
    
    const reason = req.body?.reason ? String(req.body.reason) : undefined

    const deal = await leadService.rejectDeal(tenantId, req.params.dealId, req.user?.id || "", reason)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.deal.rejected", entityType: "deal", entityId: deal.id })
    res.json(deal)
  }
}
