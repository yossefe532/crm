"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreService = void 0;
const client_1 = require("../../prisma/client");
const service_1 = require("../conversations/service");
exports.coreService = {
    createTenant: (data) => client_1.prisma.tenant.create({ data: { name: data.name, timezone: data.timezone || "UTC" } }),
    listTenants: () => client_1.prisma.tenant.findMany(),
    createUser: async (tenantId, data) => {
        const user = await client_1.prisma.user.create({ data: { tenantId, email: data.email, passwordHash: data.passwordHash, mustChangePassword: data.mustChangePassword, phone: data.phone } });
        if (data.firstName || data.lastName) {
            await client_1.prisma.userProfile.create({ data: { tenantId, userId: user.id, firstName: data.firstName, lastName: data.lastName } });
        }
        return user;
    },
    listUsers: (tenantId) => client_1.prisma.user.findMany({
        where: { tenantId, deletedAt: null },
        include: {
            roleLinks: { where: { revokedAt: null }, include: { role: true } },
            profile: true,
            teamMembers: { where: { leftAt: null, deletedAt: null }, include: { team: true } },
            teamsLed: { where: { deletedAt: null } }
        }
    }),
    createRole: (tenantId, data) => client_1.prisma.role.create({ data: { tenantId, name: data.name, scope: data.scope || "tenant" } }),
    listRoles: (tenantId) => client_1.prisma.role.findMany({ where: { tenantId, deletedAt: null } }),
    listPermissions: () => client_1.prisma.permission.findMany({ orderBy: { code: "asc" } }),
    listRolePermissions: (tenantId, roleId) => client_1.prisma.rolePermission.findMany({ where: { tenantId, roleId }, include: { permission: true } }),
    listUserPermissions: async (tenantId, userId) => {
        const roleLinks = await client_1.prisma.userRole.findMany({
            where: { tenantId, userId, revokedAt: null },
            include: { role: { include: { permissions: { include: { permission: true } } } } }
        });
        let directPermissions = [];
        try {
            directPermissions = await client_1.prisma.userPermission.findMany({
                where: { tenantId, userId },
                include: { permission: true }
            });
        }
        catch (error) {
            if (error?.code !== "P2021")
                throw error;
        }
        const rolePerms = roleLinks.flatMap(link => link.role.permissions.map(rp => rp.permission));
        const directPerms = directPermissions.map(dp => dp.permission);
        return { rolePermissions: rolePerms, directPermissions: directPerms };
    },
    replaceUserPermissions: async (tenantId, userId, permissionIds, grantedBy) => {
        const user = await client_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.tenantId !== tenantId)
            throw { status: 404, message: "User not found" };
        const permissions = await client_1.prisma.permission.findMany({ where: { id: { in: permissionIds } } });
        const validIds = new Set(permissions.map(p => p.id));
        return client_1.prisma.$transaction(async (tx) => {
            try {
                await tx.userPermission.deleteMany({ where: { tenantId, userId } });
            }
            catch (error) {
                if (error?.code !== "P2021")
                    throw error;
            }
            if (validIds.size > 0) {
                try {
                    await tx.userPermission.createMany({
                        data: Array.from(validIds).map(permissionId => ({
                            tenantId,
                            userId,
                            permissionId,
                            grantedBy
                        }))
                    });
                }
                catch (error) {
                    if (error?.code !== "P2021")
                        throw error;
                }
            }
        });
    },
    replaceRolePermissions: async (tenantId, roleId, permissionIds) => {
        const role = await client_1.prisma.role.findFirst({ where: { id: roleId, tenantId, deletedAt: null } });
        if (!role)
            throw { status: 404, message: "Role not found" };
        const permissions = await client_1.prisma.permission.findMany({ where: { id: { in: permissionIds } } });
        const permissionSet = new Set(permissions.map((permission) => permission.id));
        await client_1.prisma.rolePermission.deleteMany({ where: { tenantId, roleId } });
        if (!permissionSet.size)
            return [];
        const created = await client_1.prisma.rolePermission.createMany({
            data: Array.from(permissionSet).map((permissionId) => ({ tenantId, roleId, permissionId }))
        });
        return created;
    },
    createTeam: (tenantId, data) => client_1.prisma.team.create({ data: { tenantId, name: data.name, leaderUserId: data.leaderUserId } }),
    listTeams: (tenantId) => client_1.prisma.team.findMany({
        where: { tenantId, deletedAt: null },
        include: {
            leader: { include: { profile: true } },
            members: { where: { leftAt: null, deletedAt: null }, include: { user: { include: { profile: true } } } },
            leads: { where: { deletedAt: null }, select: { id: true, assignedUserId: true } }
        }
    }),
    deleteTeam: async (tenantId, teamId) => {
        const team = await client_1.prisma.team.findUnique({ where: { id: teamId } });
        await client_1.prisma.teamMember.updateMany({ where: { tenantId, teamId, leftAt: null, deletedAt: null }, data: { leftAt: new Date() } });
        await client_1.prisma.lead.updateMany({ where: { tenantId, teamId }, data: { teamId: null } });
        await client_1.prisma.conversation.updateMany({ where: { tenantId, entityType: "team", entityId: teamId }, data: { deletedAt: new Date() } });
        if (team?.leaderUserId) {
            const otherTeams = await client_1.prisma.team.count({ where: { leaderUserId: team.leaderUserId, id: { not: teamId }, deletedAt: null, tenantId } });
            if (otherTeams === 0) {
                const salesRole = await client_1.prisma.role.findFirst({ where: { name: "sales", tenantId } });
                const tlRole = await client_1.prisma.role.findFirst({ where: { name: "team_leader", tenantId } });
                if (salesRole && tlRole) {
                    await client_1.prisma.userRole.updateMany({
                        where: { tenantId, userId: team.leaderUserId, roleId: tlRole.id, revokedAt: null },
                        data: { revokedAt: new Date() }
                    });
                    const hasSales = await client_1.prisma.userRole.findFirst({
                        where: { tenantId, userId: team.leaderUserId, roleId: salesRole.id, revokedAt: null }
                    });
                    if (!hasSales) {
                        await client_1.prisma.userRole.create({ data: { tenantId, userId: team.leaderUserId, roleId: salesRole.id } });
                    }
                }
            }
        }
        return client_1.prisma.team.update({ where: { id: teamId, tenantId }, data: { deletedAt: new Date(), status: "inactive" } });
    },
    createFile: (tenantId, data) => client_1.prisma.file.create({ data: { tenantId, storageKey: data.storageKey, filename: data.filename, contentType: data.contentType, sizeBytes: data.sizeBytes, createdBy: data.createdBy } }),
    createIcon: (tenantId, data) => client_1.prisma.iconAsset.create({ data: { tenantId, entityType: data.entityType, entityId: data.entityId, url: data.url, label: data.label, createdBy: data.createdBy } }),
    listIcons: (tenantId, filters) => client_1.prisma.iconAsset.findMany({
        where: { tenantId, ...(filters?.entityType ? { entityType: filters.entityType } : {}), ...(filters?.entityId ? { entityId: filters.entityId } : {}) },
        orderBy: { createdAt: "desc" }
    }),
    createNote: (tenantId, data) => client_1.prisma.note.create({ data: { tenantId, entityType: data.entityType, entityId: data.entityId, body: data.body, createdBy: data.createdBy } }),
    createContact: (tenantId, data) => client_1.prisma.contact.create({ data: { tenantId, firstName: data.firstName, lastName: data.lastName, primaryEmail: data.primaryEmail, primaryPhone: data.primaryPhone } }),
    listContacts: (tenantId) => client_1.prisma.contact.findMany({ where: { tenantId, deletedAt: null } }),
    getOrCreateRole: async (tenantId, name) => {
        const existing = await client_1.prisma.role.findFirst({ where: { tenantId, name, deletedAt: null } });
        if (existing)
            return existing;
        return client_1.prisma.role.create({ data: { tenantId, name, scope: "tenant" } });
    },
    assignRole: async (tenantId, userId, roleId, assignedBy) => {
        const result = await client_1.prisma.userRole.create({ data: { tenantId, userId, roleId, assignedBy } });
        const role = await client_1.prisma.role.findUnique({ where: { id: roleId } });
        if (role && (role.name === "owner" || role.name === "team_leader")) {
            await service_1.conversationService.ensureOwnerGroup(tenantId);
        }
        return result;
    },
    addTeamMember: async (tenantId, teamId, userId, role) => {
        const currentCount = await client_1.prisma.teamMember.count({ where: { teamId, leftAt: null, deletedAt: null } });
        if (currentCount >= 10)
            throw { status: 400, message: "Team is full (max 10 members)" };
        const result = await client_1.prisma.teamMember.create({ data: { tenantId, teamId, userId, role: role || "member" } });
        await service_1.conversationService.ensureTeamGroup(tenantId, teamId);
        return result;
    },
    transferTeamMember: async (tenantId, userId, teamId, role) => {
        const oldMemberships = await client_1.prisma.teamMember.findMany({ where: { tenantId, userId, leftAt: null, deletedAt: null } });
        await client_1.prisma.teamMember.updateMany({ where: { tenantId, userId, leftAt: null, deletedAt: null }, data: { leftAt: new Date() } });
        const result = await client_1.prisma.teamMember.create({ data: { tenantId, teamId, userId, role: role || "member" } });
        await service_1.conversationService.ensureTeamGroup(tenantId, teamId);
        for (const old of oldMemberships) {
            await service_1.conversationService.ensureTeamGroup(tenantId, old.teamId);
        }
        return result;
    },
    revokeRole: async (tenantId, userId, roleId) => {
        const result = await client_1.prisma.userRole.updateMany({ where: { tenantId, userId, roleId, revokedAt: null }, data: { revokedAt: new Date() } });
        const role = await client_1.prisma.role.findUnique({ where: { id: roleId } });
        if (role && (role.name === "owner" || role.name === "team_leader")) {
            await service_1.conversationService.ensureOwnerGroup(tenantId);
        }
        return result;
    },
    getTeamByLeader: (tenantId, leaderUserId) => client_1.prisma.team.findFirst({ where: { tenantId, leaderUserId, deletedAt: null } }),
    getTeamByName: (tenantId, name) => client_1.prisma.team.findFirst({ where: { tenantId, name, deletedAt: null } }),
    getUserById: (tenantId, userId) => client_1.prisma.user.findFirst({
        where: { id: userId, tenantId, deletedAt: null },
        include: {
            roleLinks: { where: { revokedAt: null }, include: { role: true } },
            profile: true
        }
    }),
    updateUser: async (tenantId, userId, data) => {
        const { firstName, lastName, ...userData } = data;
        const user = await client_1.prisma.user.update({
            where: { id: userId, tenantId },
            data: userData
        });
        if (firstName !== undefined || lastName !== undefined) {
            const profileData = {};
            if (firstName !== undefined)
                profileData.firstName = firstName;
            if (lastName !== undefined)
                profileData.lastName = lastName;
            await client_1.prisma.userProfile.upsert({
                where: { userId },
                create: { tenantId, userId, ...profileData },
                update: profileData
            });
        }
        return user;
    },
    deleteUser: (tenantId, userId) => client_1.prisma.user.update({
        where: { id: userId, tenantId },
        data: { deletedAt: new Date() }
    }),
    resetUserPassword: (tenantId, userId, passwordHash, mustChangePassword) => client_1.prisma.user.update({ where: { id: userId, tenantId }, data: { passwordHash, mustChangePassword } }),
    createUserRequest: (tenantId, data) => client_1.prisma.userRequest.create({ data: { tenantId, requestedBy: data.requestedBy, requestType: data.requestType, payload: data.payload } }),
    listUserRequests: (tenantId) => client_1.prisma.userRequest.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, include: { requester: true, decider: true } }),
    decideUserRequest: (tenantId, requestId, data) => client_1.prisma.userRequest.update({ where: { id: requestId, tenantId }, data: { status: data.status, decidedBy: data.decidedBy, decidedAt: new Date() } }),
    createFinanceEntry: (tenantId, data) => client_1.prisma.financeEntry.create({ data: { tenantId, entryType: data.entryType, category: data.category, amount: data.amount, note: data.note, occurredAt: data.occurredAt, createdBy: data.createdBy } }),
    listFinanceEntries: (tenantId) => client_1.prisma.financeEntry.findMany({ where: { tenantId }, orderBy: { occurredAt: "desc" }, include: { creator: true } })
};
