"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreService = void 0;
const client_1 = require("../../prisma/client");
const service_1 = require("../lifecycle/service");
const activity_1 = require("../../utils/activity");
const service_2 = require("../intelligence/service");
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
    updateUser: async (tenantId, userId, data) => {
        const user = await client_1.prisma.user.findFirst({ where: { id: userId, tenantId } });
        if (!user)
            throw { status: 404, message: "User not found" };
        if (data.email && data.email !== user.email) {
            const existing = await client_1.prisma.user.findFirst({ where: { tenantId, email: data.email, id: { not: userId } } });
            if (existing)
                throw { status: 409, message: "Email already in use" };
        }
        const updatedUser = await client_1.prisma.user.update({
            where: { id: userId },
            data: {
                email: data.email,
                phone: data.phone,
                status: data.status,
                passwordHash: data.passwordHash,
                mustChangePassword: data.mustChangePassword,
                updatedAt: new Date()
            }
        });
        if (data.firstName !== undefined || data.lastName !== undefined) {
            const profile = await client_1.prisma.userProfile.findUnique({ where: { userId } });
            if (profile) {
                await client_1.prisma.userProfile.update({
                    where: { userId },
                    data: {
                        firstName: data.firstName ?? profile.firstName,
                        lastName: data.lastName ?? profile.lastName
                    }
                });
            }
            else {
                await client_1.prisma.userProfile.create({
                    data: {
                        tenantId,
                        userId,
                        firstName: data.firstName || "",
                        lastName: data.lastName || ""
                    }
                });
            }
        }
        return updatedUser;
    },
    deleteUser: async (tenantId, userId) => {
        const user = await client_1.prisma.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } });
        if (!user)
            throw { status: 404, message: "User not found" };
        const ownerRole = await client_1.prisma.role.findFirst({ where: { name: "owner", tenantId } });
        if (ownerRole) {
            const isOwner = await client_1.prisma.userRole.findFirst({ where: { tenantId, userId, roleId: ownerRole.id, revokedAt: null } });
            if (isOwner) {
                const otherOwners = await client_1.prisma.userRole.count({
                    where: {
                        tenantId,
                        roleId: ownerRole.id,
                        revokedAt: null,
                        userId: { not: userId }
                    }
                });
                if (otherOwners === 0)
                    throw { status: 400, message: "Cannot delete the last owner" };
            }
        }
        await client_1.prisma.$transaction([
            client_1.prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date(), status: "inactive" } }),
            client_1.prisma.lead.updateMany({ where: { assignedUserId: userId, tenantId }, data: { assignedUserId: null } }),
            client_1.prisma.teamMember.updateMany({ where: { userId, tenantId, leftAt: null }, data: { leftAt: new Date() } }),
            client_1.prisma.userRole.updateMany({ where: { userId, tenantId, revokedAt: null }, data: { revokedAt: new Date() } })
        ]);
        return { status: "ok" };
    },
    resetPassword: async (tenantId, userId, passwordHash, mustChangePassword = false) => {
        let newPasswordHash = passwordHash;
        let tempPassword;
        if (!newPasswordHash) {
            const { generateStrongPassword, hashPassword } = await Promise.resolve().then(() => __importStar(require("../auth/password")));
            tempPassword = generateStrongPassword();
            newPasswordHash = await hashPassword(tempPassword);
            mustChangePassword = true;
        }
        await client_1.prisma.user.update({
            where: { id: userId, tenantId },
            data: { passwordHash: newPasswordHash, mustChangePassword, updatedAt: new Date() }
        });
        return { temporaryPassword: tempPassword };
    },
    createRole: (tenantId, data) => client_1.prisma.role.create({ data: { tenantId, name: data.name, scope: data.scope || "tenant" } }),
    revokeRole: (tenantId, userId, roleId) => client_1.prisma.userRole.updateMany({
        where: { tenantId, userId, roleId, revokedAt: null },
        data: { revokedAt: new Date() }
    }),
    transferTeamMember: async (tenantId, userId, teamId, role) => {
        await client_1.prisma.teamMember.updateMany({
            where: { tenantId, userId, leftAt: null },
            data: { leftAt: new Date() }
        });
        return client_1.prisma.teamMember.create({
            data: { tenantId, teamId, userId, role: role || "member" }
        });
    },
    listRoles: (tenantId) => client_1.prisma.role.findMany({ where: { tenantId, deletedAt: null } }),
    deleteRole: async (tenantId, roleId) => {
        const role = await client_1.prisma.role.findFirst({ where: { id: roleId, tenantId, deletedAt: null } });
        if (!role)
            throw { status: 404, message: "Role not found" };
        // Check if role is assigned to any user
        const assignedCount = await client_1.prisma.userRole.count({ where: { tenantId, roleId, revokedAt: null } });
        if (assignedCount > 0)
            throw { status: 400, message: "Cannot delete role assigned to users" };
        return client_1.prisma.role.update({ where: { id: roleId }, data: { deletedAt: new Date() } });
    },
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
    getUserById: (tenantId, userId) => client_1.prisma.user.findFirst({
        where: { id: userId, tenantId, deletedAt: null },
        include: {
            roleLinks: { where: { revokedAt: null }, include: { role: true } },
            profile: true,
            teamMembers: { where: { leftAt: null, deletedAt: null }, include: { team: true } },
            teamsLed: { where: { deletedAt: null } }
        }
    }),
    getTeamByLeader: (tenantId, leaderUserId) => client_1.prisma.team.findFirst({ where: { tenantId, leaderUserId, deletedAt: null } }),
    getTeamByName: (tenantId, name) => client_1.prisma.team.findFirst({ where: { tenantId, name, deletedAt: null } }),
    getOrCreateRole: async (tenantId, name) => {
        const role = await client_1.prisma.role.findFirst({ where: { tenantId, name, deletedAt: null } });
        if (role)
            return role;
        return client_1.prisma.role.create({ data: { tenantId, name, scope: "global" } });
    },
    assignRole: (tenantId, userId, roleId, assignedBy) => client_1.prisma.userRole.create({ data: { tenantId, userId, roleId, assignedBy } }),
    addTeamMember: (tenantId, teamId, userId, role) => client_1.prisma.teamMember.create({ data: { tenantId, teamId, userId, role } }),
    createUserRequest: (tenantId, userId, type, payload) => client_1.prisma.userRequest.create({
        data: {
            tenantId,
            requestedBy: userId,
            requestType: type,
            payload,
            status: "pending"
        }
    }),
    decideUserRequest: async (tenantId, requestId, data) => {
        const request = await client_1.prisma.userRequest.findUnique({ where: { id: requestId, tenantId } });
        if (!request)
            throw { status: 404, message: "Request not found" };
        if (request.status !== "pending")
            throw { status: 400, message: "Request already decided" };
        const updated = await client_1.prisma.userRequest.update({
            where: { id: requestId },
            data: { status: data.status, decidedBy: data.decidedBy, decidedAt: new Date() }
        });
        if (data.status === "approved" && request.requestType === "create_lead") {
            const payload = request.payload;
            // Auto-assign to requester
            const assignedUserId = request.requestedBy;
            // Resolve team
            let teamId = payload.teamId;
            if (!teamId && assignedUserId) {
                const membership = await client_1.prisma.teamMember.findFirst({
                    where: { tenantId, userId: assignedUserId, leftAt: null, deletedAt: null },
                    select: { teamId: true }
                });
                teamId = membership?.teamId;
                if (!teamId) {
                    const ledTeam = await client_1.prisma.team.findFirst({
                        where: { tenantId, leaderUserId: assignedUserId, deletedAt: null },
                        select: { id: true }
                    });
                    teamId = ledTeam?.id;
                }
            }
            const stages = await service_1.lifecycleService.ensureDefaultStages(tenantId);
            const callStage = stages.find((stage) => stage.code === "call");
            const status = payload.status || callStage?.code || "call";
            const lead = await client_1.prisma.lead.create({
                data: {
                    tenantId,
                    leadCode: payload.leadCode || `L-${Date.now()}`,
                    name: payload.name,
                    phone: payload.phone,
                    email: payload.email,
                    budget: payload.budget ? Number(payload.budget) : undefined,
                    status,
                    sourceId: payload.sourceId,
                    assignedUserId,
                    teamId,
                    notes: payload.notes
                }
            });
            const initialState = await service_1.lifecycleService.getStateByCode(tenantId, status);
            if (initialState) {
                await client_1.prisma.leadStateHistory.create({
                    data: {
                        tenantId,
                        leadId: lead.id,
                        toStateId: initialState.id,
                        changedBy: request.requestedBy,
                        changedAt: new Date()
                    }
                });
                await client_1.prisma.leadDeadline.create({
                    data: {
                        tenantId,
                        leadId: lead.id,
                        stateId: initialState.id,
                        dueAt: new Date(Date.now() + 7 * 24 * 3600 * 1000)
                    }
                });
                // Log creation activity
                await (0, activity_1.logActivity)({
                    tenantId,
                    actorUserId: request.decidedBy || undefined, // The person who approved it
                    action: "lead.created",
                    entityType: "lead",
                    entityId: lead.id,
                    metadata: { source: "request_approval", requestedBy: request.requestedBy }
                });
                // Queue intelligence trigger
                service_2.intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: lead.id, userId: lead.assignedUserId || undefined });
            }
        }
        return updated;
    },
    createFinanceEntry: (tenantId, data) => client_1.prisma.financeEntry.create({
        data: {
            tenantId,
            entryType: data.entryType,
            category: data.category,
            amount: data.amount,
            note: data.note,
            occurredAt: data.occurredAt,
            createdBy: data.createdBy
        }
    }),
    listFinanceEntries: (tenantId) => client_1.prisma.financeEntry.findMany({
        where: { tenantId },
        orderBy: { occurredAt: "desc" },
        include: { creator: { select: { id: true, email: true } } }
    }),
    listUserRequests: (tenantId) => client_1.prisma.userRequest.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } })
};
