import { prisma } from "../../prisma/client"
import { conversationService } from "../conversations/service"

export const coreService = {
  createTenant: (data: { name: string; timezone?: string }) =>
    prisma.tenant.create({ data: { name: data.name, timezone: data.timezone || "UTC" } }),

  listTenants: () => prisma.tenant.findMany(),

  createUser: async (tenantId: string, data: { email: string; passwordHash: string; mustChangePassword: boolean; phone?: string; firstName?: string; lastName?: string }) => {
    const user = await prisma.user.create({ data: { tenantId, email: data.email, passwordHash: data.passwordHash, mustChangePassword: data.mustChangePassword, phone: data.phone } })
    if (data.firstName || data.lastName) {
      await prisma.userProfile.create({ data: { tenantId, userId: user.id, firstName: data.firstName, lastName: data.lastName } })
    }
    return user
  },

  listUsers: (tenantId: string) =>
    prisma.user.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        roleLinks: { where: { revokedAt: null }, include: { role: true } },
        profile: true,
        teamMembers: { where: { leftAt: null, deletedAt: null }, include: { team: true } },
        teamsLed: { where: { deletedAt: null } }
      }
    }),

  createRole: (tenantId: string, data: { name: string; scope?: string }) =>
    prisma.role.create({ data: { tenantId, name: data.name, scope: data.scope || "tenant" } }),

  listRoles: (tenantId: string) => prisma.role.findMany({ where: { tenantId, deletedAt: null } }),

  listPermissions: () => prisma.permission.findMany({ orderBy: { code: "asc" } }),

  listRolePermissions: (tenantId: string, roleId: string) =>
    prisma.rolePermission.findMany({ where: { tenantId, roleId }, include: { permission: true } }),

  listUserPermissions: async (tenantId: string, userId: string) => {
    const roleLinks = await prisma.userRole.findMany({
      where: { tenantId, userId, revokedAt: null },
      include: { role: { include: { permissions: { include: { permission: true } } } } }
    })
    let directPermissions: Array<{ permission: { id: string; code: string; description: string | null; moduleKey: string | null } }> = []
    try {
      directPermissions = await prisma.userPermission.findMany({
        where: { tenantId, userId },
        include: { permission: true }
      })
    } catch (error: any) {
      if (error?.code !== "P2021") throw error
    }

    const rolePerms = roleLinks.flatMap(link => link.role.permissions.map(rp => rp.permission))
    const directPerms = directPermissions.map(dp => dp.permission)

    return { rolePermissions: rolePerms, directPermissions: directPerms }
  },

  replaceUserPermissions: async (tenantId: string, userId: string, permissionIds: string[], grantedBy?: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.tenantId !== tenantId) throw { status: 404, message: "User not found" }

    const permissions = await prisma.permission.findMany({ where: { id: { in: permissionIds } } })
    const validIds = new Set(permissions.map(p => p.id))

    return prisma.$transaction(async (tx) => {
      try {
        await tx.userPermission.deleteMany({ where: { tenantId, userId } })
      } catch (error: any) {
        if (error?.code !== "P2021") throw error
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
          })
        } catch (error: any) {
          if (error?.code !== "P2021") throw error
        }
      }
    })
  },

  replaceRolePermissions: async (tenantId: string, roleId: string, permissionIds: string[]) => {
    const role = await prisma.role.findFirst({ where: { id: roleId, tenantId, deletedAt: null } })
    if (!role) throw { status: 404, message: "Role not found" }
    const permissions = await prisma.permission.findMany({ where: { id: { in: permissionIds } } })
    const permissionSet = new Set(permissions.map((permission) => permission.id))
    await prisma.rolePermission.deleteMany({ where: { tenantId, roleId } })
    if (!permissionSet.size) return []
    const created = await prisma.rolePermission.createMany({
      data: Array.from(permissionSet).map((permissionId) => ({ tenantId, roleId, permissionId }))
    })
    return created
  },

  createTeam: (tenantId: string, data: { name: string; leaderUserId?: string }) =>
    prisma.team.create({ data: { tenantId, name: data.name, leaderUserId: data.leaderUserId } }),

  listTeams: (tenantId: string) =>
    prisma.team.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        leader: { include: { profile: true } },
        members: { where: { leftAt: null, deletedAt: null }, include: { user: { include: { profile: true } } } },
        leads: { where: { deletedAt: null }, select: { id: true, assignedUserId: true } }
      }
    }),
  deleteTeam: async (tenantId: string, teamId: string) => {
    const team = await prisma.team.findUnique({ where: { id: teamId } })
    
    await prisma.teamMember.updateMany({ where: { tenantId, teamId, leftAt: null, deletedAt: null }, data: { leftAt: new Date() } })
    
    await prisma.lead.updateMany({ where: { tenantId, teamId }, data: { teamId: null } })
    await prisma.conversation.updateMany({ where: { tenantId, entityType: "team", entityId: teamId }, data: { deletedAt: new Date() } })
    
    if (team?.leaderUserId) {
      const otherTeams = await prisma.team.count({ where: { leaderUserId: team.leaderUserId, id: { not: teamId }, deletedAt: null, tenantId } })
      if (otherTeams === 0) {
        const salesRole = await prisma.role.findFirst({ where: { name: "sales", tenantId } })
        const tlRole = await prisma.role.findFirst({ where: { name: "team_leader", tenantId } })
        
        if (salesRole && tlRole) {
          await prisma.userRole.updateMany({ 
            where: { tenantId, userId: team.leaderUserId, roleId: tlRole.id, revokedAt: null },
            data: { revokedAt: new Date() } 
          })
          const hasSales = await prisma.userRole.findFirst({ 
            where: { tenantId, userId: team.leaderUserId, roleId: salesRole.id, revokedAt: null } 
          })
          if (!hasSales) {
            await prisma.userRole.create({ data: { tenantId, userId: team.leaderUserId, roleId: salesRole.id } })
          }
        }
      }
    }

    return prisma.team.update({ where: { id: teamId, tenantId }, data: { deletedAt: new Date(), status: "inactive" } })
  },

  createFile: (tenantId: string, data: { storageKey: string; filename: string; contentType: string; sizeBytes: bigint; createdBy?: string }) =>
    prisma.file.create({ data: { tenantId, storageKey: data.storageKey, filename: data.filename, contentType: data.contentType, sizeBytes: data.sizeBytes, createdBy: data.createdBy } }),

  createIcon: (tenantId: string, data: { entityType: string; entityId: string; url: string; label?: string; createdBy?: string }) =>
    prisma.iconAsset.create({ data: { tenantId, entityType: data.entityType, entityId: data.entityId, url: data.url, label: data.label, createdBy: data.createdBy } }),

  listIcons: (tenantId: string, filters?: { entityType?: string; entityId?: string }) =>
    prisma.iconAsset.findMany({
      where: { tenantId, ...(filters?.entityType ? { entityType: filters.entityType } : {}), ...(filters?.entityId ? { entityId: filters.entityId } : {}) },
      orderBy: { createdAt: "desc" }
    }),

  createNote: (tenantId: string, data: { entityType: string; entityId: string; body: string; createdBy?: string }) =>
    prisma.note.create({ data: { tenantId, entityType: data.entityType, entityId: data.entityId, body: data.body, createdBy: data.createdBy } }),

  createContact: (tenantId: string, data: { firstName?: string; lastName?: string; primaryEmail?: string; primaryPhone?: string }) =>
    prisma.contact.create({ data: { tenantId, firstName: data.firstName, lastName: data.lastName, primaryEmail: data.primaryEmail, primaryPhone: data.primaryPhone } }),

  listContacts: (tenantId: string) => prisma.contact.findMany({ where: { tenantId, deletedAt: null } }),

  getOrCreateRole: async (tenantId: string, name: string) => {
    const existing = await prisma.role.findFirst({ where: { tenantId, name, deletedAt: null } })
    if (existing) return existing
    return prisma.role.create({ data: { tenantId, name, scope: "tenant" } })
  },

  assignRole: async (tenantId: string, userId: string, roleId: string, assignedBy?: string) => {
    const result = await prisma.userRole.create({ data: { tenantId, userId, roleId, assignedBy } })
    const role = await prisma.role.findUnique({ where: { id: roleId } })
    if (role && (role.name === "owner" || role.name === "team_leader")) {
      await conversationService.ensureOwnerGroup(tenantId)
    }
    return result
  },

  addTeamMember: async (tenantId: string, teamId: string, userId: string, role?: string) => {
    const currentCount = await prisma.teamMember.count({ where: { teamId, leftAt: null, deletedAt: null } })
    if (currentCount >= 10) throw { status: 400, message: "Team is full (max 10 members)" }
    const result = await prisma.teamMember.create({ data: { tenantId, teamId, userId, role: role || "member" } })
    await conversationService.ensureTeamGroup(tenantId, teamId)
    return result
  },

  transferTeamMember: async (tenantId: string, userId: string, teamId: string, role?: string) => {
    const oldMemberships = await prisma.teamMember.findMany({ where: { tenantId, userId, leftAt: null, deletedAt: null } })
    await prisma.teamMember.updateMany({ where: { tenantId, userId, leftAt: null, deletedAt: null }, data: { leftAt: new Date() } })
    const result = await prisma.teamMember.create({ data: { tenantId, teamId, userId, role: role || "member" } })
    
    await conversationService.ensureTeamGroup(tenantId, teamId)
    for (const old of oldMemberships) {
      await conversationService.ensureTeamGroup(tenantId, old.teamId)
    }
    return result
  },

  revokeRole: async (tenantId: string, userId: string, roleId: string) => {
    const result = await prisma.userRole.updateMany({ where: { tenantId, userId, roleId, revokedAt: null }, data: { revokedAt: new Date() } })
    const role = await prisma.role.findUnique({ where: { id: roleId } })
    if (role && (role.name === "owner" || role.name === "team_leader")) {
      await conversationService.ensureOwnerGroup(tenantId)
    }
    return result
  },

  getTeamByLeader: (tenantId: string, leaderUserId: string) =>
    prisma.team.findFirst({ where: { tenantId, leaderUserId, deletedAt: null } }),
  getTeamByName: (tenantId: string, name: string) =>
    prisma.team.findFirst({ where: { tenantId, name, deletedAt: null } }),

  getUserById: (tenantId: string, userId: string) =>
    prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      include: {
        roleLinks: { where: { revokedAt: null }, include: { role: true } },
        profile: true
      }
    }),

  updateUser: async (tenantId: string, userId: string, data: { email?: string; phone?: string; firstName?: string; lastName?: string; status?: string }) => {
    const { firstName, lastName, ...userData } = data
    const user = await prisma.user.update({
      where: { id: userId, tenantId },
      data: userData
    })
    
    if (firstName !== undefined || lastName !== undefined) {
      const profileData: any = {}
      if (firstName !== undefined) profileData.firstName = firstName
      if (lastName !== undefined) profileData.lastName = lastName
      
      await prisma.userProfile.upsert({
        where: { userId },
        create: { tenantId, userId, ...profileData },
        update: profileData
      })
    }
    return user
  },

  deleteUser: (tenantId: string, userId: string) =>
    prisma.user.update({
      where: { id: userId, tenantId },
      data: { deletedAt: new Date() }
    }),
  resetUserPassword: (tenantId: string, userId: string, passwordHash: string, mustChangePassword: boolean) =>
    prisma.user.update({ where: { id: userId, tenantId }, data: { passwordHash, mustChangePassword } }),

  createUserRequest: (tenantId: string, data: { requestedBy: string; requestType: string; payload: any }) =>
    prisma.userRequest.create({ data: { tenantId, requestedBy: data.requestedBy, requestType: data.requestType, payload: data.payload } }),

  listUserRequests: (tenantId: string) =>
    prisma.userRequest.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, include: { requester: true, decider: true } }),

  decideUserRequest: (tenantId: string, requestId: string, data: { status: string; decidedBy: string }) =>
    prisma.userRequest.update({ where: { id: requestId, tenantId }, data: { status: data.status, decidedBy: data.decidedBy, decidedAt: new Date() } }),

  createFinanceEntry: (tenantId: string, data: { entryType: string; category: string; amount: number; note?: string; occurredAt: Date; createdBy?: string }) =>
    prisma.financeEntry.create({ data: { tenantId, entryType: data.entryType, category: data.category, amount: data.amount, note: data.note, occurredAt: data.occurredAt, createdBy: data.createdBy } }),

  listFinanceEntries: (tenantId: string) =>
    prisma.financeEntry.findMany({ where: { tenantId }, orderBy: { occurredAt: "desc" }, include: { creator: true } })
}
