import { prisma } from "../../prisma/client"
import { notificationService } from "../notifications/service"

const defaultStages = [
  { 
    code: "new", 
    name: "New", 
    isTerminal: false,
    questions: []
  },
  { 
    code: "call", 
    name: "Call", 
    isTerminal: false,
    questions: [
      { id: "outcome", text: "نتيجة المكالمة", required: true, type: "select", options: ["تم الرد", "لم يتم الرد", "رقم خاطئ", "مشغول"] },
      { id: "notes", text: "ملاحظات المكالمة", required: false, type: "text" }
    ]
  },
  { 
    code: "meeting", 
    name: "Meeting", 
    isTerminal: false,
    questions: [
      { id: "date", text: "تاريخ الاجتماع", required: true, type: "date" },
      { id: "location", text: "مكان الاجتماع", required: true, type: "select", options: ["مقر الشركة", "موقع خارجي", "أونلاين"] }
    ]
  },
  { 
    code: "site_visit", 
    name: "Site Visit", 
    isTerminal: false,
    questions: [
      { id: "date", text: "تاريخ الزيارة", required: true, type: "date" },
      { id: "project", text: "المشروع", required: true, type: "text" }
    ]
  },
  { 
    code: "closing", 
    name: "Closing", 
    isTerminal: true,
    questions: [
      { id: "amount", text: "قيمة الصفقة", required: true, type: "number" },
      { id: "contract_date", text: "تاريخ العقد", required: true, type: "date" }
    ]
  }
]

const ensureDefaultStages = async (tenantId: string) => {
  const codes = defaultStages.map((stage) => stage.code)
  const existing = await prisma.leadStateDefinition.findMany({ where: { tenantId, code: { in: codes } } })
  const byCode = new Map(existing.map((state) => [state.code, state]))
  const states = [] as Array<{ id: string; code: string }>
  for (const stage of defaultStages) {
    const found = byCode.get(stage.code)
    if (found) {
      // Update questions to ensure feature is active
      await prisma.leadStateDefinition.update({
        where: { id: found.id },
        data: { questions: stage.questions || undefined }
      })
      states.push({ id: found.id, code: found.code })
      continue
    }
    const created = await prisma.leadStateDefinition.create({
      data: { tenantId, code: stage.code, name: stage.name, isTerminal: stage.isTerminal, questions: stage.questions || undefined }
    })
    states.push({ id: created.id, code: created.code })
  }
  for (let index = 0; index < states.length - 1; index += 1) {
    const fromStateId = states[index]?.id
    const toStateId = states[index + 1]?.id
    if (!fromStateId || !toStateId) continue
    const existingTransition = await prisma.leadStateTransition.findFirst({ where: { tenantId, fromStateId, toStateId } })
    if (!existingTransition) {
      await prisma.leadStateTransition.create({ data: { tenantId, fromStateId, toStateId } })
    }
  }
  return states
}

export const lifecycleService = {
  ensureDefaultStages,
  getStateByCode: async (tenantId: string, code: string) => {
    await ensureDefaultStages(tenantId)
    return prisma.leadStateDefinition.findFirst({ where: { tenantId, code } })
  },
  createState: (tenantId: string, data: { code: string; name: string; isTerminal?: boolean; slaHours?: number }) =>
    prisma.leadStateDefinition.create({ data: { tenantId, code: data.code, name: data.name, isTerminal: data.isTerminal || false, slaHours: data.slaHours } }),

  createTransition: (tenantId: string, data: { fromStateId: string; toStateId: string; guardKey?: string; requiresApproval?: boolean }) =>
    prisma.leadStateTransition.create({ data: { tenantId, fromStateId: data.fromStateId, toStateId: data.toStateId, guardKey: data.guardKey, requiresApproval: data.requiresApproval || false } }),

  transitionLead: async (tenantId: string, leadId: string, toStateId: string, changedBy?: string, answers?: Record<string, any>) => {
    if (!changedBy) throw { status: 400, message: "يجب تنفيذ الإجراء بواسطة مستخدم" }
    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } })
    if (!lead) throw { status: 404, message: "العميل غير موجود" }
    const state = await prisma.leadStateDefinition.findFirst({ where: { id: toStateId, tenantId } })
    if (!state) throw { status: 404, message: "المرحلة غير موجودة" }
    
    // Validate questions
    if (state.questions && Array.isArray(state.questions)) {
      const questions = state.questions as any[];
      for (const q of questions) {
        if (q.required && (!answers || !answers[q.id])) {
          throw { status: 400, message: `Missing answer for question: ${q.text || q.id}` }
        }
      }
    }

    const lastHistory = await prisma.leadStateHistory.findFirst({ where: { leadId, tenantId }, orderBy: { changedAt: "desc" } })
    if (lastHistory?.toStateId) {
      const transition = await prisma.leadStateTransition.findFirst({
        where: { tenantId, fromStateId: lastHistory.toStateId, toStateId }
      })
      if (!transition) throw { status: 400, message: "انتقال غير صالح بين المراحل" }
    }
    
    await prisma.leadStateHistory.create({ 
      data: { 
        tenantId, 
        leadId, 
        fromStateId: lastHistory?.toStateId || undefined, 
        toStateId, 
        changedBy,
        answers: answers || undefined
      } 
    })
    
    await prisma.lead.update({ where: { id: leadId, tenantId }, data: { status: state.code } })

    // If the new state is terminal (Closing/Won/Lost), complete any active deadline
    if (state.isTerminal) {
        await prisma.leadDeadline.updateMany({ 
            where: { tenantId, leadId, status: "active" }, 
            data: { status: "completed" } 
        })
    } else {
        // If not terminal, ensure there is an active deadline.
        // We do NOT reset the deadline if it exists, implementing the "7 days total" rule.
        const existingDeadline = await prisma.leadDeadline.findFirst({ 
            where: { tenantId, leadId, status: "active" }
        })

        if (!existingDeadline) {
            // Create a new 7-day deadline if none exists
            await prisma.leadDeadline.create({ 
                data: { 
                    tenantId, 
                    leadId, 
                    stateId: state.id, // Associated with current state, but represents global deadline
                    dueAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) 
                } 
            })
        }
    }
    
    // Notify assigned user if changed by someone else
    if (lead.assignedUserId && lead.assignedUserId !== changedBy) {
      await notificationService.send({
        tenantId,
        userId: lead.assignedUserId,
        type: "info",
        title: "تغيير حالة العميل",
        message: `تم تغيير حالة العميل ${lead.name || "غير معروف"} إلى ${state.name}`,
        entityType: "lead",
        entityId: leadId,
        actionUrl: `/leads/${leadId}`,
        senderId: changedBy
      }).catch(console.error)
    }

    // Celebration notification for Closed/Won deals
    if (state.code === "closing" || state.isTerminal) {
      // Assuming 'closing' is the success state. 
      // If there are multiple terminal states (e.g. Lost), we should check specifically for success.
      // Based on defaultStages, 'closing' implies a deal (amount, contract_date).
      
      const amount = answers?.amount ? parseFloat(answers.amount) : 0;
      const leadName = lead.name || lead.leadCode || "عميل";
      
      // Find team members to notify
      let recipientIds = new Set<string>();
      
      if (lead.teamId) {
        const teamMembers = await prisma.teamMember.findMany({
          where: { teamId: lead.teamId, tenantId, leftAt: null },
          select: { userId: true }
        });
        teamMembers.forEach(m => recipientIds.add(m.userId));
        
        const team = await prisma.team.findUnique({ where: { id: lead.teamId } });
        if (team?.leaderUserId) recipientIds.add(team.leaderUserId);
      }
      
      // Also notify the closer (changedBy) as a confirmation/celebration
      if (changedBy) recipientIds.add(changedBy);
      
      // Notify owners for big deals or just general success
      const owners = await prisma.user.findMany({
        where: { tenantId, roleLinks: { some: { role: { name: "owner" } } }, status: "active" },
        select: { id: true }
      });
      owners.forEach(o => recipientIds.add(o.id));

      if (recipientIds.size > 0) {
        await notificationService.sendMany(Array.from(recipientIds), {
          tenantId,
          type: "success",
          title: "مبروك! صفقة جديدة 🚀",
          message: `تم إغلاق صفقة ${leadName} بنجاح! القيمة: ${amount}`,
          entityType: "lead",
          entityId: leadId,
          actionUrl: `/leads/${leadId}`,
          metadata: { amount, isDeal: true, currency: "EGP" } // Assuming EGP
        }).catch(console.error);
      }
    }

    return state
  },

  failLead: async (tenantId: string, leadId: string, failedBy: string | null, reason: string) => {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } })
    if (!lead) throw { status: 404, message: "Lead not found" }

    // Update lead status to failed/lost (assuming 'lost' or 'failed' code exists or we use a specific status)
    // We should probably check if a 'lost' state exists in definitions, or just update the main status.
    // Ideally, we transition to a "Lost" state if it exists.
    // For now, I'll hardcode status update to "lost".
    await prisma.lead.update({ where: { id: leadId }, data: { status: "lost" } })

    // Create failure record
    await prisma.leadFailure.create({
      data: { 
        tenantId, 
        leadId, 
        failedBy, 
        failureType: failedBy ? "surrender" : "expired", 
        reason, 
        status: "pending" 
      }
    })

    // Add negligence points if assigned
    if (lead.assignedUserId) {
      await prisma.negligencePoint.create({
        data: { 
          tenantId, 
          leadId, 
          userId: lead.assignedUserId, 
          points: 10, // Penalty points
          reason: failedBy ? `Surrendered: ${reason}` : `Expired: ${reason}` 
        }
      })
      
      // Notify owner (Logic to be added in notification service)
      // console.log("Notify owner about failure for lead", leadId)
      await notificationService.send({
        tenantId,
        userId: lead.assignedUserId,
        type: "error",
        title: "فشل العميل",
        message: `تم تسجيل فشل للعميل ${lead.name}: ${reason}`,
        entityType: "lead",
        entityId: leadId,
        actionUrl: `/leads/${leadId}`,
        senderId: failedBy || undefined
      }).catch(console.error)
    }
  },

  checkLeadDeadlines: async (tenantId: string) => {
    const now = new Date()
    const expiredDeadlines = await prisma.leadDeadline.findMany({
      where: { tenantId, status: "active", dueAt: { lt: now } },
      include: { lead: true }
    })

    for (const deadline of expiredDeadlines) {
      await lifecycleService.failLead(tenantId, deadline.leadId, null, "Automatic failure: 7 days exceeded")
      await prisma.leadDeadline.update({ where: { id: deadline.id }, data: { status: "expired" } })
    }
  },

  createDeadline: (tenantId: string, leadId: string, stateId: string, dueAt: Date) =>
    prisma.leadDeadline.create({ data: { tenantId, leadId, stateId, dueAt } }),

  requestExtension: async (tenantId: string, leadId: string, stateId: string, requestedBy: string, extensionHours: number, reason?: string) => {
    const maxExtensionHours = 72
    if (!extensionHours || extensionHours <= 0) throw { status: 400, message: "Invalid extension request" }
    if (extensionHours > maxExtensionHours) throw { status: 400, message: "Extension exceeds maximum" }
    const deadline = await prisma.leadDeadline.findFirst({ where: { tenantId, leadId, stateId, status: "active" } })
    if (!deadline) throw { status: 404, message: "Active deadline not found" }
    const existing = await prisma.leadExtension.findMany({ where: { tenantId, leadId, stateId, status: { in: ["pending", "approved"] } } })
    const total = existing.reduce((sum, row) => sum + row.extensionHours, 0)
    if (total + extensionHours > maxExtensionHours) throw { status: 400, message: "Extension exceeds maximum" }
    
    const extension = await prisma.leadExtension.create({ data: { tenantId, leadId, stateId, requestedBy, extensionHours, reason } })

    // Notify Team Leader / Owner
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { team: true } })
    const requester = await prisma.user.findUnique({ where: { id: requestedBy }, include: { profile: true } })
    const requesterName = requester?.profile?.firstName || requester?.email || 'Unknown'

    // Find recipients (Team Leader of the lead's team, or Owner if no team)
    let recipientIds: string[] = []
    if (lead?.teamId && lead.team?.leaderUserId) {
        recipientIds.push(lead.team.leaderUserId)
    } else {
        // Fallback to Owner
        const ownerRole = await prisma.role.findFirst({ where: { name: 'owner', tenantId } })
        if (ownerRole) {
            const owners = await prisma.userRole.findMany({ where: { roleId: ownerRole.id, tenantId, revokedAt: null } })
            recipientIds = owners.map(o => o.userId)
        }
    }

    // Remove requester from recipients if they are the leader/owner (unlikely for extension request but possible)
    recipientIds = recipientIds.filter(id => id !== requestedBy)

    if (recipientIds.length > 0) {
        await notificationService.sendMany(recipientIds, {
            tenantId,
            type: 'warning',
            title: 'طلب تمديد مهلة',
            message: `طلب ${requesterName} تمديد مهلة للعميل ${lead?.name} لمدة ${extensionHours} ساعة. السبب: ${reason || 'غير محدد'}`,
            entityType: 'lead_extension',
            entityId: extension.id,
            actionUrl: `/leads/${leadId}`, // Or a specific requests page
            senderId: requestedBy
        }).catch(console.error)
    }

    return extension
  },

  approveExtension: async (tenantId: string, extensionId: string, approvedBy: string) => {
    const ext = await prisma.leadExtension.update({ where: { id: extensionId, tenantId }, data: { status: "approved", approvedBy, decidedAt: new Date() } })
    const deadline = await prisma.leadDeadline.findFirst({ where: { leadId: ext.leadId, stateId: ext.stateId, status: "active", tenantId }, orderBy: { dueAt: "desc" } })
    if (deadline) {
      await prisma.leadDeadline.update({ where: { id: deadline.id, tenantId }, data: { dueAt: new Date(deadline.dueAt.getTime() + ext.extensionHours * 3600 * 1000) } })
    }

    // Notify Requester
    if (ext.requestedBy) {
        await notificationService.send({
            tenantId,
            userId: ext.requestedBy,
            type: 'success',
            title: 'تمت الموافقة على التمديد',
            message: `تمت الموافقة على طلب تمديد المهلة (${ext.extensionHours} ساعة)`,
            entityType: 'lead_extension',
            entityId: extensionId,
            actionUrl: `/leads/${ext.leadId}`,
            senderId: approvedBy
        }).catch(console.error)
    }

    return ext
  },

  rejectExtension: async (tenantId: string, extensionId: string, approvedBy: string, reason?: string) => {
    const ext = await prisma.leadExtension.update({
      where: { id: extensionId, tenantId },
      data: { status: "rejected", approvedBy, decidedAt: new Date(), reason: reason || undefined }
    })

    // Notify Requester
    if (ext.requestedBy) {
        await notificationService.send({
            tenantId,
            userId: ext.requestedBy,
            type: 'error',
            title: 'تم رفض التمديد',
            message: `تم رفض طلب تمديد المهلة. السبب: ${reason || 'غير محدد'}`,
            entityType: 'lead_extension',
            entityId: extensionId,
            actionUrl: `/leads/${ext.leadId}`,
            senderId: approvedBy
        }).catch(console.error)
    }

    return ext
  }
}
