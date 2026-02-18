"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationController = void 0;
const service_1 = require("./service");
const service_2 = require("../core/service");
const activity_1 = require("../../utils/activity");
const client_1 = require("../../prisma/client");
exports.conversationController = {
    list: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const user = req.user;
        if (!user)
            throw { status: 401, message: "Unauthorized" };
        if (user.roles.includes("owner")) {
            await service_1.conversationService.ensureOwnerGroup(tenantId);
            const list = await service_1.conversationService.listConversationsForUser(tenantId, user);
            res.json(list);
            return;
        }
        const teamLeaderTeam = user.roles.includes("team_leader")
            ? await service_2.coreService.getTeamByLeader(tenantId, user.id)
            : null;
        const leaderTeamId = teamLeaderTeam?.id;
        const myTeams = await client_1.prisma.teamMember.findMany({
            where: { tenantId, userId: user.id, leftAt: null, deletedAt: null },
            select: { teamId: true }
        });
        if (leaderTeamId)
            await service_1.conversationService.ensureTeamGroup(tenantId, leaderTeamId);
        for (const teamRow of myTeams)
            await service_1.conversationService.ensureTeamGroup(tenantId, teamRow.teamId);
        const ownerRole = await service_2.coreService.getOrCreateRole(tenantId, "owner");
        const ownerLinks = await service_2.coreService.listUsers(tenantId);
        const ownerUser = ownerLinks.find((u) => (u.roleLinks || []).some((link) => link.roleId === ownerRole.id));
        if (ownerUser)
            await service_1.conversationService.ensureDirect(tenantId, user.id, ownerUser.id);
        if (user.roles.includes("sales")) {
            const membership = await client_1.prisma.teamMember.findFirst({
                where: { tenantId, userId: user.id, leftAt: null, deletedAt: null },
                select: { teamId: true }
            });
            if (membership?.teamId) {
                const team = await client_1.prisma.team.findFirst({ where: { tenantId, id: membership.teamId, deletedAt: null } });
                if (team?.leaderUserId) {
                    await service_1.conversationService.ensureDirect(tenantId, user.id, team.leaderUserId);
                }
            }
        }
        await service_1.conversationService.ensureOwnerGroup(tenantId);
        const list = await service_1.conversationService.listConversationsForUser(tenantId, user);
        res.json(list);
    },
    listMessages: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const user = req.user;
        if (!user)
            throw { status: 401, message: "Unauthorized" };
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const messages = await service_1.conversationService.listMessages(tenantId, req.params.id, user, limit);
        res.json(messages);
    },
    sendMessage: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const user = req.user;
        if (!user)
            throw { status: 401, message: "Unauthorized" };
        const content = req.body?.content ? String(req.body.content) : undefined;
        const contentType = req.body?.contentType ? String(req.body.contentType) : "text";
        const mediaFileId = req.body?.mediaFileId ? String(req.body.mediaFileId) : undefined;
        const message = await service_1.conversationService.sendMessage(tenantId, req.params.id, user, { content, contentType, mediaFileId });
        await (0, activity_1.logActivity)({ tenantId, actorUserId: user.id, action: "conversation.message.sent", entityType: "message", entityId: message.id });
        res.json(message);
    },
    createDirect: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const user = req.user;
        if (!user)
            throw { status: 401, message: "Unauthorized" };
        const targetUserId = String(req.body?.targetUserId || "");
        if (!targetUserId)
            throw { status: 400, message: "المستخدم مطلوب" };
        if (targetUserId === user.id)
            throw { status: 400, message: "غير مسموح" };
        const targetUser = await service_2.coreService.getUserById(tenantId, targetUserId);
        if (!targetUser)
            throw { status: 404, message: "المستخدم غير موجود" };
        const targetRoles = targetUser.roleLinks?.map((link) => link.role.name) || [];
        if (user.roles.includes("owner")) {
            const convo = await service_1.conversationService.ensureDirect(tenantId, user.id, targetUserId);
            res.json(convo);
            return;
        }
        if (user.roles.includes("team_leader")) {
            if (targetRoles.includes("owner")) {
                const convo = await service_1.conversationService.ensureDirect(tenantId, user.id, targetUserId);
                res.json(convo);
                return;
            }
            const leaderTeam = await service_2.coreService.getTeamByLeader(tenantId, user.id);
            if (!leaderTeam)
                throw { status: 400, message: "لا يوجد فريق مرتبط بك" };
            const member = await client_1.prisma.teamMember.findFirst({
                where: { tenantId, teamId: leaderTeam.id, userId: targetUserId, leftAt: null, deletedAt: null }
            });
            if (!member)
                throw { status: 403, message: "غير مصرح" };
            const convo = await service_1.conversationService.ensureDirect(tenantId, user.id, targetUserId);
            res.json(convo);
            return;
        }
        if (user.roles.includes("sales")) {
            if (targetRoles.includes("owner")) {
                const convo = await service_1.conversationService.ensureDirect(tenantId, user.id, targetUserId);
                res.json(convo);
                return;
            }
            const membership = await client_1.prisma.teamMember.findFirst({
                where: { tenantId, userId: user.id, leftAt: null, deletedAt: null },
                select: { teamId: true }
            });
            if (membership?.teamId) {
                const team = await client_1.prisma.team.findFirst({ where: { tenantId, id: membership.teamId, deletedAt: null } });
                if (team?.leaderUserId === targetUserId) {
                    const convo = await service_1.conversationService.ensureDirect(tenantId, user.id, targetUserId);
                    res.json(convo);
                    return;
                }
            }
            throw { status: 403, message: "غير مصرح" };
        }
        const convo = await service_1.conversationService.ensureDirect(tenantId, user.id, targetUserId);
        res.json(convo);
    },
    createTeamGroup: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const user = req.user;
        if (!user)
            throw { status: 401, message: "Unauthorized" };
        const teamId = String(req.body?.teamId || "");
        if (!teamId)
            throw { status: 400, message: "الفريق مطلوب" };
        const convo = await service_1.conversationService.ensureTeamGroup(tenantId, teamId);
        res.json(convo);
    },
    getOwnerGroup: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const user = req.user;
        if (!user)
            throw { status: 401, message: "Unauthorized" };
        const convo = await service_1.conversationService.ensureOwnerGroup(tenantId);
        res.json(convo);
    }
};
