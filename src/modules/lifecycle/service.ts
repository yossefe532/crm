import { prisma } from "../../prisma/client"

const defaultStages = [
  { code: "call", name: "Call", isTerminal: false },
  { code: "meeting", name: "Meeting", isTerminal: false },
  { code: "site_visit", name: "Site Visit", isTerminal: false },
  { code: "closing", name: "Closing", isTerminal: true }
]

const ensureDefaultStages = async (tenantId: string) => {
  const codes = defaultStages.map((stage) => stage.code)
  const existing = await prisma.leadStateDefinition.findMany({ where: { tenantId, code: { in: codes } } })
  const byCode = new Map(existing.map((state) => [state.code, state]))
  const states = [] as Array<{ id: string; code: string }>
  for (const stage of defaultStages) {
    const found = byCode.get(stage.code)
    if (found) {
      states.push({ id: found.id, code: found.code })
      continue
    }
    const created = await prisma.leadStateDefinition.create({
      data: { tenantId, code: stage.code, name: stage.name, isTerminal: stage.isTerminal }
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

  transitionLead: async (tenantId: string, leadId: string, toStateId: string, changedBy?: string) => {
    if (!changedBy) throw { status: 400, message: "يجب تنفيذ الإجراء بواسطة مستخدم" }
    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } })
    if (!lead) throw { status: 404, message: "العميل غير موجود" }
    const state = await prisma.leadStateDefinition.findFirst({ where: { id: toStateId, tenantId } })
    if (!state) throw { status: 404, message: "المرحلة غير موجودة" }
    const lastHistory = await prisma.leadStateHistory.findFirst({ where: { leadId, tenantId }, orderBy: { changedAt: "desc" } })
    if (lastHistory?.toStateId) {
      const transition = await prisma.leadStateTransition.findFirst({
        where: { tenantId, fromStateId: lastHistory.toStateId, toStateId }
      })
      if (!transition) throw { status: 400, message: "انتقال غير صالح بين المراحل" }
    }
    await prisma.leadStateHistory.create({ data: { tenantId, leadId, fromStateId: lastHistory?.toStateId || undefined, toStateId, changedBy } })
    await prisma.lead.update({ where: { id: leadId, tenantId }, data: { status: state.code } })
    await prisma.leadDeadline.updateMany({ where: { tenantId, leadId, status: "active" }, data: { status: "completed" } })
    await prisma.leadDeadline.create({ data: { tenantId, leadId, stateId: state.id, dueAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) } })
    return state
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
    return prisma.leadExtension.create({ data: { tenantId, leadId, stateId, requestedBy, extensionHours, reason } })
  },

  approveExtension: async (tenantId: string, extensionId: string, approvedBy: string) => {
    const ext = await prisma.leadExtension.update({ where: { id: extensionId, tenantId }, data: { status: "approved", approvedBy, decidedAt: new Date() } })
    const deadline = await prisma.leadDeadline.findFirst({ where: { leadId: ext.leadId, stateId: ext.stateId, status: "active", tenantId }, orderBy: { dueAt: "desc" } })
    if (deadline) {
      await prisma.leadDeadline.update({ where: { id: deadline.id, tenantId }, data: { dueAt: new Date(deadline.dueAt.getTime() + ext.extensionHours * 3600 * 1000) } })
    }
    return ext
  },

  rejectExtension: async (tenantId: string, extensionId: string, approvedBy: string, reason?: string) => {
    return prisma.leadExtension.update({
      where: { id: extensionId, tenantId },
      data: { status: "rejected", approvedBy, decidedAt: new Date(), reason: reason || undefined }
    })
  }
}
