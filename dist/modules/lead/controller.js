"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadController = void 0;
const service_1 = require("./service");
const pagination_1 = require("../../utils/pagination");
const activity_1 = require("../../utils/activity");
const service_2 = require("../intelligence/service");
const service_3 = require("../notifications/service");
const service_4 = require("../lifecycle/service");
const client_1 = require("../../prisma/client");
const resolveAssignmentTarget = async (tenantId, actor, assignedUserId) => {
    const targetUser = await client_1.prisma.user.findFirst({ where: { id: assignedUserId, tenantId, deletedAt: null, status: "active" } });
    if (!targetUser)
        throw { status: 404, message: "المستخدم غير موجود" };
    const roleLinks = await client_1.prisma.userRole.findMany({ where: { tenantId, userId: assignedUserId, revokedAt: null }, include: { role: true } });
    const targetRoles = roleLinks.length ? roleLinks.map((link) => link.role.name) : ["sales"];
    let resolvedTeamId;
    if (actor?.roles?.includes("owner")) {
        if (!targetRoles.includes("team_leader") && !targetRoles.includes("sales")) {
            throw { status: 400, message: "لا يمكن التعيين إلا لقائد فريق أو مندوب مبيعات" };
        }
        if (targetRoles.includes("team_leader")) {
            const team = await client_1.prisma.team.findFirst({ where: { tenantId, leaderUserId: assignedUserId, deletedAt: null } });
            resolvedTeamId = team?.id;
        }
        return { resolvedTeamId, targetRoles };
    }
    if (actor?.roles?.includes("team_leader")) {
        if (!targetRoles.includes("sales"))
            throw { status: 403, message: "يمكن التعيين لمندوبي المبيعات فقط" };
        const team = await client_1.prisma.team.findFirst({ where: { tenantId, leaderUserId: actor.id, deletedAt: null }, select: { id: true } });
        if (!team)
            throw { status: 400, message: "لا يوجد فريق مرتبط بك" };
        if (assignedUserId === actor.id) {
            resolvedTeamId = team.id;
            return { resolvedTeamId, targetRoles };
        }
        const membership = await client_1.prisma.teamMember.findFirst({ where: { tenantId, teamId: team.id, userId: assignedUserId, leftAt: null, deletedAt: null } });
        if (!membership)
            throw { status: 403, message: "المندوب ليس ضمن فريقك" };
        resolvedTeamId = team.id;
        return { resolvedTeamId, targetRoles };
    }
    if (actor?.roles?.includes("sales")) {
        if (assignedUserId !== actor.id)
            throw { status: 403, message: "غير مصرح بتنفيذ التعيين" };
        const membership = await client_1.prisma.teamMember.findFirst({ where: { tenantId, userId: assignedUserId, leftAt: null, deletedAt: null }, select: { teamId: true } });
        resolvedTeamId = membership?.teamId;
        return { resolvedTeamId, targetRoles };
    }
    throw { status: 403, message: "غير مصرح بتنفيذ التعيين" };
};
exports.leadController = {
    createLead: async (req, res) => {
        try {
            const tenantId = req.user?.tenantId || "";
            const roles = req.user?.roles || [];
            if (roles.includes("sales") && !roles.includes("owner") && !roles.includes("team_leader")) {
                throw { status: 403, message: "غير مصرح لك بإضافة عملاء مباشرة. يرجى إرسال طلب إضافة." };
            }
            const name = String(req.body?.name || "").trim();
            const leadCode = String(req.body?.leadCode || "").trim();
            if (!name)
                throw { status: 400, message: "اسم العميل مطلوب" };
            const email = req.body?.email ? String(req.body.email).trim() : undefined;
            const phone = req.body?.phone ? String(req.body.phone).trim() : undefined;
            if (!phone)
                throw { status: 400, message: "رقم الهاتف مطلوب" };
            const duplicateChecks = [];
            if (email)
                duplicateChecks.push({ email: { equals: email, mode: "insensitive" } });
            if (phone)
                duplicateChecks.push({ phone });
            const existing = await client_1.prisma.lead.findFirst({
                where: {
                    tenantId,
                    deletedAt: null,
                    name: { equals: name, mode: "insensitive" },
                    OR: duplicateChecks
                }
            });
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
                });
                return;
            }
            const requestedAssignedUserId = req.body?.assignedUserId ? String(req.body.assignedUserId) : undefined;
            if (req.user?.roles?.includes("sales") && requestedAssignedUserId && requestedAssignedUserId !== req.user?.id) {
                throw { status: 403, message: "يمكن لمندوب المبيعات التعيين لنفسه فقط" };
            }
            const assignedUserId = requestedAssignedUserId || (req.user?.roles?.includes("sales") ? req.user?.id : undefined);
            const assignmentContext = assignedUserId ? await resolveAssignmentTarget(tenantId, req.user, assignedUserId) : undefined;
            // If leadCode is not provided, generate one or use a default if acceptable (though schema says optional, logic below uses it)
            // Actually schema says leadCode is optional in Zod, but controller was checking it. 
            // Let's remove mandatory check for leadCode if it's meant to be auto-generated or optional.
            // But looking at service, it uses data.leadCode directly.
            // If the frontend sends empty string, we should handle it.
            // Let's assume if empty, we generate one.
            const finalLeadCode = leadCode || `L-${Date.now()}`;
            const lead = await service_1.leadService.createLead(tenantId, {
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
            });
            if (assignedUserId) {
                await service_1.leadService.assignLead(tenantId, lead.id, assignedUserId, req.user?.id, req.body?.assignReason, assignmentContext?.resolvedTeamId || null);
                await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.assigned", entityType: "lead", entityId: lead.id, metadata: { assignedUserId } });
            }
            await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.created", entityType: "lead", entityId: lead.id });
            service_2.intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: lead.id, userId: lead.assignedUserId || undefined });
            res.json(lead);
        }
        catch (error) {
            console.error("Lead creation failed:", error);
            if (error.code === 'P2002') {
                throw { status: 409, message: "العميل موجود بالفعل" };
            }
            throw error;
        }
    },
    listLeads: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const { skip, take, page, pageSize } = (0, pagination_1.getPagination)(req.query.page, req.query.pageSize);
        const q = req.query.q ? String(req.query.q) : undefined;
        const leads = await service_1.leadService.listLeads(tenantId, skip, take, req.user, q);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.listed", entityType: "lead" });
        res.json({ data: leads, page, pageSize });
    },
    listTasks: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const tasks = await service_1.leadService.listTasks(tenantId, req.user);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.task.listed", entityType: "lead_task" });
        res.json(tasks);
    },
    updateLead: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const existing = await service_1.leadService.getLeadForUser(tenantId, req.params.id, req.user);
        if (!existing)
            throw { status: 404, message: "العميل غير موجود" };
        const phone = req.body?.phone ? String(req.body.phone).trim() : undefined;
        if (phone) {
            const duplicate = await client_1.prisma.lead.findFirst({
                where: { tenantId, deletedAt: null, phone, id: { not: existing.id } }
            });
            if (duplicate)
                throw { status: 409, message: "رقم الهاتف مستخدم بالفعل" };
        }
        const lead = await service_1.leadService.updateLead(tenantId, req.params.id, {
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
        });
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.updated", entityType: "lead", entityId: lead.id });
        service_2.intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: lead.id, userId: lead.assignedUserId || undefined });
        res.json(lead);
    },
    getLead: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const lead = await service_1.leadService.getLeadForUser(tenantId, req.params.id, req.user);
        if (!lead)
            throw { status: 404, message: "العميل غير موجود" };
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.viewed", entityType: "lead", entityId: lead.id });
        res.json(lead);
    },
    deleteLead: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const existing = await service_1.leadService.getLeadForUser(tenantId, req.params.id, req.user);
        if (!existing)
            throw { status: 404, message: "العميل غير موجود" };
        const lead = await service_1.leadService.deleteLead(tenantId, req.params.id);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.deleted", entityType: "lead", entityId: lead.id });
        res.json(lead);
    },
    updateStage: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const stageCode = String(req.body?.stage || req.body?.code || "").trim().toLowerCase();
        if (!stageCode)
            throw { status: 400, message: "المرحلة مطلوبة" };
        const state = await service_4.lifecycleService.getStateByCode(tenantId, stageCode);
        if (!state)
            throw { status: 404, message: "المرحلة غير موجودة" };
        const existing = await service_1.leadService.getLeadForUser(tenantId, req.params.id, req.user);
        if (!existing)
            throw { status: 404, message: "العميل غير موجود" };
        if (!req.user?.roles?.includes("sales") || existing.assignedUserId !== req.user?.id) {
            throw { status: 403, message: "غير مصرح بتنفيذ المراحل" };
        }
        const orderMap = { new: 0, call: 0, meeting: 1, site_visit: 2, closing: 3 };
        const currentIndex = orderMap[existing.status] ?? 0;
        const targetIndex = orderMap[stageCode];
        if (targetIndex === undefined || targetIndex !== currentIndex + 1) {
            throw { status: 400, message: "انتقال غير صالح بين المراحل" };
        }
        const updatedState = await service_4.lifecycleService.transitionLead(tenantId, req.params.id, state.id, req.user?.id);
        const event = await service_3.notificationService.publishEvent(tenantId, "lead.stage.completed", {
            leadId: req.params.id,
            stage: updatedState.code,
            changedBy: req.user?.id,
            targets: ["owner", "team_leader"]
        });
        await service_3.notificationService.queueDelivery(tenantId, event.id, "in_app");
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.stage.updated", entityType: "lead", entityId: req.params.id, metadata: { stage: updatedState.code } });
        service_2.intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: req.params.id, userId: req.user?.id });
        res.json(updatedState);
    },
    undoStage: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const lead = await service_1.leadService.getLeadForUser(tenantId, req.params.id, req.user);
        if (!lead)
            throw { status: 404, message: "العميل غير موجود" };
        const lastHistory = await client_1.prisma.leadStateHistory.findFirst({
            where: { tenantId, leadId: lead.id },
            orderBy: { changedAt: "desc" }
        });
        if (!lastHistory?.fromStateId)
            throw { status: 400, message: "لا يمكن التراجع حالياً" };
        const lastMetadata = (lastHistory.metadata || {});
        if (lastMetadata.undoOf)
            throw { status: 400, message: "لا يمكن التراجع مرة أخرى" };
        const previousState = await client_1.prisma.leadStateDefinition.findFirst({ where: { tenantId, id: lastHistory.fromStateId } });
        if (!previousState)
            throw { status: 404, message: "المرحلة غير موجودة" };
        await client_1.prisma.leadStateHistory.update({
            where: { id: lastHistory.id },
            data: { metadata: { ...lastMetadata, undoneAt: new Date().toISOString(), undoneBy: req.user?.id } }
        });
        await client_1.prisma.leadStateHistory.create({
            data: {
                tenantId,
                leadId: lead.id,
                fromStateId: lastHistory.toStateId,
                toStateId: previousState.id,
                changedBy: req.user?.id,
                metadata: { undoOf: lastHistory.id }
            }
        });
        await client_1.prisma.lead.update({ where: { id: lead.id, tenantId }, data: { status: previousState.code } });
        await client_1.prisma.leadDeadline.updateMany({ where: { tenantId, leadId: lead.id, status: "active" }, data: { status: "completed" } });
        await client_1.prisma.leadDeadline.create({ data: { tenantId, leadId: lead.id, stateId: previousState.id, dueAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) } });
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.stage.undone", entityType: "lead", entityId: lead.id, metadata: { toStage: previousState.code } });
        service_2.intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: lead.id, userId: req.user?.id });
        res.json({ status: previousState.code });
    },
    assignLead: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const assignedUserId = String(req.body?.assignedUserId || "").trim();
        if (!assignedUserId)
            throw { status: 400, message: "المستخدم المُسند مطلوب" };
        const lead = await service_1.leadService.getLeadForUser(tenantId, req.params.id, req.user);
        if (!lead)
            throw { status: 404, message: "العميل غير موجود" };
        const assignmentContext = await resolveAssignmentTarget(tenantId, req.user, assignedUserId);
        const assignment = await service_1.leadService.assignLead(tenantId, req.params.id, assignedUserId, req.user?.id, req.body?.reason, assignmentContext.resolvedTeamId || null);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.assigned", entityType: "lead", entityId: req.params.id, metadata: { assignedUserId, previousAssignedUserId: lead.assignedUserId || null, reason: req.body?.reason } });
        service_2.intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: req.params.id, userId: assignedUserId });
        res.json(assignment);
    },
    unassignLead: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const lead = await service_1.leadService.getLeadForUser(tenantId, req.params.id, req.user);
        if (!lead)
            throw { status: 404, message: "العميل غير موجود" };
        const updated = await service_1.leadService.unassignLead(tenantId, req.params.id);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.unassigned", entityType: "lead", entityId: req.params.id, metadata: { previousAssignedUserId: lead.assignedUserId || null } });
        service_2.intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: req.params.id, userId: req.user?.id });
        res.json(updated);
    },
    addLeadContact: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const link = await service_1.leadService.createLeadContact(tenantId, req.params.id, req.body.contactId, req.body.role);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.contact.added", entityType: "lead", entityId: req.params.id, metadata: { contactId: req.body.contactId } });
        res.json(link);
    },
    addLeadTask: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const task = await service_1.leadService.createLeadTask(tenantId, { leadId: req.params.id, assignedUserId: req.body.assignedUserId, taskType: req.body.taskType, dueAt: req.body.dueAt });
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.task.created", entityType: "lead_task", entityId: task.id, metadata: { leadId: req.params.id } });
        service_2.intelligenceService.queueTrigger({ type: "task_changed", tenantId, leadId: req.params.id, userId: req.body.assignedUserId });
        res.json(task);
    },
    addCallLog: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const outcome = req.body?.outcome ? String(req.body.outcome) : undefined;
        if (!outcome)
            throw { status: 400, message: "نتيجة المكالمة مطلوبة" };
        const lead = await service_1.leadService.getLead(tenantId, req.params.id);
        if (!lead)
            throw { status: 404, message: "العميل غير موجود" };
        const call = await service_1.leadService.createCallLog(tenantId, { leadId: req.params.id, callerUserId: req.user?.id, durationSeconds: req.body.durationSeconds, outcome, recordingFileId: req.body.recordingFileId });
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.call.logged", entityType: "call_log", entityId: call.id, metadata: { leadId: req.params.id } });
        service_2.intelligenceService.queueTrigger({ type: "lead_engaged", tenantId, leadId: req.params.id, userId: req.user?.id });
        const event = await service_3.notificationService.publishEvent(tenantId, "lead.call.logged", {
            leadId: req.params.id,
            outcome,
            targets: ["owner"],
            messageAr: `تم تسجيل مكالمة للعميل ${lead.name}`
        });
        await service_3.notificationService.queueDelivery(tenantId, event.id, "in_app");
        res.json(call);
    },
    createLeadSource: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const source = await service_1.leadService.createLeadSource(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead_source.created", entityType: "lead_source", entityId: source.id });
        res.json(source);
    },
    listLeadSources: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const sources = await service_1.leadService.listLeadSources(tenantId);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead_source.listed", entityType: "lead_source" });
        res.json(sources);
    },
    getDeadline: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const existing = await service_1.leadService.getLeadForUser(tenantId, req.params.id, req.user);
        if (!existing)
            throw { status: 404, message: "العميل غير موجود" };
        const deadline = await service_1.leadService.getActiveDeadline(tenantId, req.params.id);
        res.json(deadline);
    },
    listDeadlines: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const deadlines = await service_1.leadService.listActiveDeadlines(tenantId);
        res.json(deadlines);
    },
    listFailures: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const failures = await service_1.leadService.listFailures(tenantId, req.query.leadId ? String(req.query.leadId) : undefined);
        res.json(failures);
    },
    listClosures: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const closures = await service_1.leadService.listClosures(tenantId);
        res.json(closures);
    },
    decideClosure: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        if (!req.user?.roles?.includes("owner"))
            throw { status: 403, message: "غير مصرح" };
        const status = String(req.body?.status || "").trim();
        if (!status || !["approved", "rejected"].includes(status))
            throw { status: 400, message: "قرار غير صالح" };
        const closure = await service_1.leadService.decideClosure(tenantId, req.params.closureId, { status, decidedBy: req.user?.id || "" });
        if (status === "approved") {
            await client_1.prisma.lead.update({ where: { id: closure.leadId, tenantId }, data: { status: "closed", assignedUserId: null } });
            await client_1.prisma.leadDeadline.updateMany({ where: { tenantId, leadId: closure.leadId, status: "active" }, data: { status: "completed" } });
        }
        if (status === "rejected") {
            await client_1.prisma.lead.update({ where: { id: closure.leadId, tenantId }, data: { status: "failed", assignedUserId: null } });
        }
        const lead = await client_1.prisma.lead.findFirst({ where: { id: closure.leadId, tenantId } });
        const actor = closure.closedBy ? await client_1.prisma.user.findFirst({ where: { tenantId, id: closure.closedBy }, include: { profile: true } }) : null;
        const actorName = actor?.profile?.firstName
            ? `${actor.profile.firstName}${actor.profile.lastName ? ` ${actor.profile.lastName}` : ""}`
            : actor?.email;
        const message = status === "approved"
            ? `نجح المستخدم ${actorName || "غير معروف"} في صفقة`
            : `فشل المستخدم ${actorName || "غير معروف"} في صفقة`;
        const event = await service_3.notificationService.publishEvent(tenantId, "lead.closure.decided", {
            leadId: closure.leadId,
            leadName: lead?.name,
            status,
            userId: closure.closedBy,
            targets: ["all"],
            messageAr: message
        });
        await service_3.notificationService.queueDelivery(tenantId, event.id, "in_app");
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.close.decided", entityType: "lead_closure", entityId: closure.id, metadata: { status } });
        res.json(closure);
    },
    closeLead: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const lead = await service_1.leadService.getLeadForUser(tenantId, req.params.id, req.user);
        if (!lead)
            throw { status: 404, message: "العميل غير موجود" };
        if (!req.user?.roles?.includes("sales") || lead.assignedUserId !== req.user?.id) {
            throw { status: 403, message: "غير مصرح بإغلاق الصفقة" };
        }
        if (lead.status !== "closing")
            throw { status: 400, message: "لا يمكن الإغلاق قبل مرحلة الإغلاق" };
        const amount = Number(req.body?.amount);
        if (!Number.isFinite(amount) || amount <= 0)
            throw { status: 400, message: "قيمة الإغلاق غير صحيحة" };
        const note = req.body?.note ? String(req.body.note) : undefined;
        const address = req.body?.address ? String(req.body.address) : undefined;
        if (!address)
            throw { status: 400, message: "عنوان الإغلاق مطلوب" };
        const closure = await service_1.leadService.createClosure(tenantId, { leadId: lead.id, closedBy: req.user?.id, amount, note, address });
        await client_1.prisma.lead.update({ where: { id: lead.id, tenantId }, data: { status: "closing", assignedUserId: null } });
        const event = await service_3.notificationService.publishEvent(tenantId, "lead.closed", {
            leadId: lead.id,
            leadName: lead.name,
            amount,
            targets: ["owner"],
            messageAr: `طلب اعتماد صفقة للعميل ${lead.name} بقيمة ${amount.toLocaleString("ar-EG")}`
        });
        await service_3.notificationService.queueDelivery(tenantId, event.id, "in_app");
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.close.requested", entityType: "lead", entityId: lead.id, metadata: { amount } });
        res.json(closure);
    },
    failLead: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const lead = await service_1.leadService.getLeadForUser(tenantId, req.params.id, req.user);
        if (!lead)
            throw { status: 404, message: "العميل غير موجود" };
        if (!req.user?.roles?.includes("sales") || lead.assignedUserId !== req.user?.id) {
            throw { status: 403, message: "غير مصرح بتسجيل الفشل" };
        }
        const failureType = String(req.body?.failureType || "surrender");
        const reason = req.body?.reason ? String(req.body.reason) : undefined;
        if (failureType !== "overdue" && failureType !== "surrender")
            throw { status: 400, message: "نوع الفشل غير صالح" };
        if (failureType === "surrender" && !reason)
            throw { status: 400, message: "سبب الفشل مطلوب" };
        const status = reason ? "resolved" : "pending";
        const failure = await service_1.leadService.createFailure(tenantId, { leadId: lead.id, failedBy: req.user?.id || undefined, failureType, reason, status });
        await client_1.prisma.lead.update({ where: { id: lead.id, tenantId }, data: { status: "failed", assignedUserId: null } });
        await client_1.prisma.leadDeadline.updateMany({ where: { tenantId, leadId: lead.id, status: "active" }, data: { status: "overdue" } });
        if (!reason && lead.assignedUserId) {
            const user = await client_1.prisma.user.findFirst({ where: { tenantId, id: lead.assignedUserId } });
            const roles = await client_1.prisma.userRole.findMany({ where: { tenantId, userId: lead.assignedUserId, revokedAt: null }, include: { role: true } });
            const roleNames = roles.map((row) => row.role.name);
            if (user && roleNames.includes("sales")) {
                await client_1.prisma.user.update({ where: { id: user.id }, data: { status: "inactive" } });
            }
        }
        const event = await service_3.notificationService.publishEvent(tenantId, "lead.failed", {
            leadId: lead.id,
            leadName: lead.name,
            failureType,
            reason: reason || null,
            targets: ["owner"],
            messageAr: `فشل العميل ${lead.name}${reason ? `: ${reason}` : ""}`
        });
        await service_3.notificationService.queueDelivery(tenantId, event.id, "in_app");
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.failed", entityType: "lead", entityId: lead.id, metadata: { failureType } });
        res.json(failure);
    },
    resolveFailure: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const reason = String(req.body?.reason || "").trim();
        if (!reason)
            throw { status: 400, message: "سبب الفشل مطلوب" };
        const failure = await service_1.leadService.resolveFailure(tenantId, req.params.failureId, reason);
        if (failure.failedBy) {
            const user = await client_1.prisma.user.findFirst({ where: { tenantId, id: failure.failedBy } });
            if (user) {
                await client_1.prisma.user.update({ where: { id: user.id }, data: { status: "active" } });
            }
        }
        const lead = await client_1.prisma.lead.findFirst({ where: { id: failure.leadId, tenantId } });
        const actor = failure.failedBy ? await client_1.prisma.user.findFirst({ where: { tenantId, id: failure.failedBy }, include: { profile: true } }) : null;
        const actorName = actor?.profile?.firstName
            ? `${actor.profile.firstName}${actor.profile.lastName ? ` ${actor.profile.lastName}` : ""}`
            : actor?.email;
        const event = await service_3.notificationService.publishEvent(tenantId, "lead.failure.decided", {
            leadId: failure.leadId,
            leadName: lead?.name,
            userId: failure.failedBy,
            targets: ["all"],
            messageAr: `فشل المستخدم ${actorName || "غير معروف"} في صفقة`
        });
        await service_3.notificationService.queueDelivery(tenantId, event.id, "in_app");
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "lead.failure.resolved", entityType: "lead_failure", entityId: failure.id });
        res.json(failure);
    },
    createMeeting: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const leadId = req.params.leadId;
        const title = String(req.body.title || "اجتماع جديد");
        const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : new Date();
        const durationMinutes = req.body.durationMinutes ? parseInt(req.body.durationMinutes) : 60;
        const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);
        const status = req.body.status || "scheduled";
        const meeting = await service_1.leadService.createMeeting(tenantId, {
            leadId,
            organizerUserId: req.user?.id || "",
            title,
            startsAt,
            endsAt,
            status
        });
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "meeting.created", entityType: "meeting", entityId: meeting.id, metadata: { leadId } });
        res.json(meeting);
    }
};
