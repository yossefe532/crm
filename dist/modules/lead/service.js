"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadService = void 0;
const client_1 = require("../../prisma/client");
const service_1 = require("../lifecycle/service");
exports.leadService = {
    getLead: (tenantId, id) => client_1.prisma.lead.findFirst({ where: { id, tenantId, deletedAt: null }, include: { callLogs: { orderBy: { createdAt: "desc" }, include: { caller: true } }, meetings: { orderBy: { startsAt: "desc" }, include: { organizer: true } } } }),
    createLead: async (tenantId, data) => {
        const stages = await service_1.lifecycleService.ensureDefaultStages(tenantId);
        const callStage = stages.find((stage) => stage.code === "call");
        const status = data.status || callStage?.code || "call";
        let resolvedTeamId = data.teamId;
        if (!resolvedTeamId && data.assignedUserId) {
            const teamMembership = await client_1.prisma.teamMember.findFirst({ where: { tenantId, userId: data.assignedUserId, leftAt: null, deletedAt: null }, select: { teamId: true } });
            resolvedTeamId = teamMembership?.teamId;
            if (!resolvedTeamId) {
                const ledTeam = await client_1.prisma.team.findFirst({ where: { tenantId, leaderUserId: data.assignedUserId, deletedAt: null }, select: { id: true } });
                resolvedTeamId = ledTeam?.id;
            }
        }
        const lead = await client_1.prisma.lead.create({
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
        });
        const initialState = await service_1.lifecycleService.getStateByCode(tenantId, status);
        if (initialState) {
            await client_1.prisma.leadStateHistory.create({ data: { tenantId, leadId: lead.id, toStateId: initialState.id } });
            await client_1.prisma.leadDeadline.create({ data: { tenantId, leadId: lead.id, stateId: initialState.id, dueAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) } });
        }
        return lead;
    },
    listLeads: async (tenantId, skip, take, user, query) => {
        const baseWhere = { tenantId, deletedAt: null };
        const search = query?.trim()
            ? {
                OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { phone: { contains: query } },
                    { email: { contains: query, mode: "insensitive" } },
                    { leadCode: { contains: query, mode: "insensitive" } }
                ]
            }
            : {};
        if (!user)
            return client_1.prisma.lead.findMany({ where: { ...baseWhere, id: "00000000-0000-0000-0000-000000000000" }, skip, take, orderBy: { createdAt: "desc" } });
        if (user.roles.includes("owner")) {
            return client_1.prisma.lead.findMany({ where: { ...baseWhere, ...search }, skip, take, orderBy: { createdAt: "desc" }, include: { _count: { select: { callLogs: true } } } });
        }
        if (user.roles.includes("team_leader")) {
            const teams = await client_1.prisma.team.findMany({ where: { tenantId, leaderUserId: user.id, deletedAt: null }, select: { id: true } });
            const teamIds = teams.map((team) => team.id);
            let memberIds = [user.id];
            if (teamIds.length > 0) {
                const members = await client_1.prisma.teamMember.findMany({ where: { tenantId, teamId: { in: teamIds }, leftAt: null, deletedAt: null }, select: { userId: true } });
                memberIds = Array.from(new Set([...members.map((row) => row.userId), user.id]));
            }
            return client_1.prisma.lead.findMany({
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
            });
        }
        return client_1.prisma.lead.findMany({
            where: {
                ...baseWhere,
                ...search,
                assignedUserId: user.id
            },
            skip,
            take,
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { callLogs: true } } }
        });
    },
    listTasks: async (tenantId, user) => {
        const baseWhere = { tenantId };
        if (!user)
            return client_1.prisma.leadTask.findMany({ where: baseWhere, orderBy: { createdAt: "desc" }, include: { lead: true } });
        if (user.roles.includes("owner")) {
            return client_1.prisma.leadTask.findMany({ where: baseWhere, orderBy: { createdAt: "desc" }, include: { lead: true } });
        }
        if (user.roles.includes("team_leader")) {
            const teams = await client_1.prisma.team.findMany({ where: { tenantId, leaderUserId: user.id, deletedAt: null }, select: { id: true } });
            const teamIds = teams.map((team) => team.id);
            const members = await client_1.prisma.teamMember.findMany({ where: { tenantId, teamId: { in: teamIds }, leftAt: null, deletedAt: null }, select: { userId: true } });
            const memberIds = Array.from(new Set([...members.map((row) => row.userId), user.id]));
            return client_1.prisma.leadTask.findMany({
                where: { ...baseWhere, OR: [{ assignedUserId: { in: memberIds } }, { lead: { teamId: { in: teamIds } } }] },
                orderBy: { createdAt: "desc" },
                include: { lead: true }
            });
        }
        return client_1.prisma.leadTask.findMany({ where: { ...baseWhere, assignedUserId: user.id }, orderBy: { createdAt: "desc" }, include: { lead: true } });
    },
    updateLead: async (tenantId, id, data) => {
        return client_1.prisma.lead.update({ where: { id, tenantId }, data });
    },
    getLeadForUser: async (tenantId, leadId, user) => {
        const include = {
            callLogs: { orderBy: { createdAt: "desc" }, include: { caller: true } },
            meetings: { orderBy: { startsAt: "desc" }, include: { organizer: true } }
        };
        if (!user)
            return client_1.prisma.lead.findFirst({ where: { tenantId, id: leadId, deletedAt: null }, include });
        if (user.roles.includes("owner"))
            return client_1.prisma.lead.findFirst({ where: { tenantId, id: leadId, deletedAt: null }, include });
        if (user.roles.includes("team_leader")) {
            const teams = await client_1.prisma.team.findMany({ where: { tenantId, leaderUserId: user.id, deletedAt: null }, select: { id: true } });
            const teamIds = teams.map((team) => team.id);
            return client_1.prisma.lead.findFirst({
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
            });
        }
        return client_1.prisma.lead.findFirst({ where: { tenantId, id: leadId, assignedUserId: user.id, deletedAt: null }, include });
    },
    deleteLead: (tenantId, id) => client_1.prisma.lead.update({ where: { id, tenantId }, data: { deletedAt: new Date() } }),
    assignLead: async (tenantId, leadId, assignedUserId, assignedBy, reason, teamId) => {
        let resolvedTeamId;
        if (teamId) {
            resolvedTeamId = teamId;
        }
        else {
            const membership = await client_1.prisma.teamMember.findFirst({ where: { tenantId, userId: assignedUserId, leftAt: null, deletedAt: null }, select: { teamId: true } });
            if (membership?.teamId) {
                resolvedTeamId = membership.teamId;
            }
            else {
                const ledTeam = await client_1.prisma.team.findFirst({ where: { tenantId, leaderUserId: assignedUserId, deletedAt: null }, select: { id: true } });
                resolvedTeamId = ledTeam?.id;
            }
        }
        await client_1.prisma.leadAssignment.updateMany({ where: { tenantId, leadId, releasedAt: null }, data: { releasedAt: new Date() } });
        await client_1.prisma.lead.update({ where: { id: leadId, tenantId }, data: { assignedUserId, teamId: resolvedTeamId } });
        return client_1.prisma.leadAssignment.create({ data: { tenantId, leadId, assignedUserId, assignedBy, reason } });
    },
    unassignLead: async (tenantId, leadId) => {
        await client_1.prisma.leadAssignment.updateMany({ where: { tenantId, leadId, releasedAt: null }, data: { releasedAt: new Date() } });
        return client_1.prisma.lead.update({ where: { id: leadId, tenantId }, data: { assignedUserId: null, teamId: null } });
    },
    createLeadContact: (tenantId, leadId, contactId, role) => client_1.prisma.leadContact.create({ data: { tenantId, leadId, contactId, role: role || "primary" } }),
    createLeadTask: (tenantId, data) => client_1.prisma.leadTask.create({ data: { tenantId, leadId: data.leadId, assignedUserId: data.assignedUserId, taskType: data.taskType, dueAt: data.dueAt ? new Date(data.dueAt) : undefined } }),
    createCallLog: (tenantId, data) => client_1.prisma.callLog.create({ data: { tenantId, leadId: data.leadId, callerUserId: data.callerUserId, durationSeconds: data.durationSeconds, outcome: data.outcome, recordingFileId: data.recordingFileId } }),
    createMeeting: async (tenantId, data) => {
        const tenant = await client_1.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null }, select: { timezone: true } });
        const timezone = tenant?.timezone || "UTC";
        return client_1.prisma.meeting.create({
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
        });
    },
    createLeadSource: (tenantId, data) => client_1.prisma.leadSource.create({ data: { tenantId, name: data.name } }),
    listLeadSources: (tenantId) => client_1.prisma.leadSource.findMany({ where: { tenantId, isActive: true } }),
    getActiveDeadline: (tenantId, leadId) => client_1.prisma.leadDeadline.findFirst({ where: { tenantId, leadId, status: "active" }, orderBy: { dueAt: "asc" } }),
    listActiveDeadlines: (tenantId) => client_1.prisma.leadDeadline.findMany({ where: { tenantId, status: "active" }, orderBy: { dueAt: "asc" } }),
    listFailures: (tenantId, leadId) => client_1.prisma.leadFailure.findMany({ where: { tenantId, ...(leadId ? { leadId } : {}) }, orderBy: { createdAt: "desc" } }),
    createFailure: (tenantId, data) => client_1.prisma.leadFailure.create({
        data: {
            tenantId,
            leadId: data.leadId,
            failedBy: data.failedBy,
            failureType: data.failureType,
            reason: data.reason,
            status: data.status || "pending"
        }
    }),
    resolveFailure: (tenantId, failureId, reason) => client_1.prisma.leadFailure.update({ where: { id: failureId, tenantId }, data: { reason, status: "resolved", resolvedAt: new Date() } }),
    listClosures: (tenantId) => client_1.prisma.leadClosure.findMany({ where: { tenantId }, orderBy: { closedAt: "desc" } }),
    createClosure: (tenantId, data) => client_1.prisma.leadClosure.create({
        data: {
            tenantId,
            leadId: data.leadId,
            closedBy: data.closedBy,
            amount: data.amount,
            note: data.note,
            address: data.address
        }
    }),
    decideClosure: (tenantId, closureId, data) => client_1.prisma.leadClosure.update({ where: { id: closureId, tenantId }, data: { status: data.status, decidedBy: data.decidedBy, decidedAt: new Date() } })
};
