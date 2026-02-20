import { prisma } from "../../prisma/client"
import { conversationService } from "../conversations/service"
import { lifecycleService } from "../lifecycle/service"
import { hashPassword } from "../auth/password"
import { logActivity } from "../../utils/activity"
import { intelligenceService } from "../intelligence/service"

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
  
  updateUser: async (tenantId: string, userId: string, data: { email?: string; phone?: string; status?: string; passwordHash?: string; mustChangePassword?: boolean; firstName?: string; lastName?: string }) => {
    const user = await prisma.user.findFirst({ where: { id: userId, tenantId } })
    if (!user) throw { status: 404, message: "User not found" }
    
    if (data.email && data.email !== user.email) {
      const existing = await prisma.user.findFirst({ where: { tenantId, email: data.email, id: { not: userId } } })
      if (existing) throw { status: 409, message: "Email already in use" }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: data.email,
        phone: data.phone,
        status: data.status,
        passwordHash: data.passwordHash,
        mustChangePassword: data.mustChangePassword,
        updatedAt: new Date()
      }
    })

    if (data.firstName !== undefined || data.lastName !== undefined) {
      const profile = await prisma.userProfile.findUnique({ where: { userId } })
      if (profile) {
        await prisma.userProfile.update({ 
          where: { userId }, 
          data: { 
            firstName: data.firstName ?? profile.firstName, 
            lastName: data.lastName ?? profile.lastName 
          } 
        })
      } else {
        await prisma.userProfile.create({ 
          data: { 
            tenantId, 
            userId, 
            firstName: data.firstName || "", 
            lastName: data.lastName || "" 
          } 
        })
      }
    }

    return updatedUser
  },

  deleteUser: async (tenantId: string, userId: string) => {
    const user = await prisma.user.findFirst({ where: { id: userId, tenantId, deletedAt: null } })
    if (!user) throw { status: 404, message: "User not found" }
    
    const ownerRole = await prisma.role.findFirst({ where: { name: "owner", tenantId } })
    if (ownerRole) {
      const isOwner = await prisma.userRole.findFirst({ where: { tenantId, userId, roleId: ownerRole.id, revokedAt: null } })
      if (isOwner) {
        const otherOwners = await prisma.userRole.count({ 
          where: { 
            tenantId, 
            roleId: ownerRole.id, 
            revokedAt: null, 
            userId: { not: userId } 
          } 
        })
        if (otherOwners === 0) throw { status: 400, message: "Cannot delete the last owner" }
      }
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date(), status: "inactive" } }),
      prisma.lead.updateMany({ where: { assignedUserId: userId, tenantId }, data: { assignedUserId: null } }),
      prisma.teamMember.updateMany({ where: { userId, tenantId, leftAt: null }, data: { leftAt: new Date() } }),
      prisma.userRole.updateMany({ where: { userId, tenantId, revokedAt: null }, data: { revokedAt: new Date() } })
    ])
    
    return { status: "ok" }
  },

  resetPassword: async (tenantId: string, userId: string, passwordHash?: string, mustChangePassword = false) => {
    let newPasswordHash = passwordHash
    let tempPassword
    if (!newPasswordHash) {
      const { generateStrongPassword, hashPassword } = await import("../auth/password")
      tempPassword = generateStrongPassword()
      newPasswordHash = await hashPassword(tempPassword)
      mustChangePassword = true
    }
    await prisma.user.update({
      where: { id: userId, tenantId },
      data: { passwordHash: newPasswordHash, mustChangePassword, updatedAt: new Date() }
    })
    return { temporaryPassword: tempPassword }
  },

  createRole: (tenantId: string, data: { name: string; scope?: string }) =>
    prisma.role.create({ data: { tenantId, name: data.name, scope: data.scope || "tenant" } }),

  revokeRole: (tenantId: string, userId: string, roleId: string) =>
    prisma.userRole.updateMany({
      where: { tenantId, userId, roleId, revokedAt: null },
      data: { revokedAt: new Date() }
    }),

  transferTeamMember: async (tenantId: string, userId: string, teamId: string, role?: string) => {
    await prisma.teamMember.updateMany({
      where: { tenantId, userId, leftAt: null },
      data: { leftAt: new Date() }
    })
    return prisma.teamMember.create({
      data: { tenantId, teamId, userId, role: role || "member" }
    })
  },

  listRoles: (tenantId: string) => prisma.role.findMany({ where: { tenantId, deletedAt: null } }),

  deleteRole: async (tenantId: string, roleId: string) => {
    const role = await prisma.role.findFirst({ where: { id: roleId, tenantId, deletedAt: null } })
    if (!role) throw { status: 404, message: "Role not found" }
    // Check if role is assigned to any user
    const assignedCount = await prisma.userRole.count({ where: { tenantId, roleId, revokedAt: null } })
    if (assignedCount > 0) throw { status: 400, message: "Cannot delete role assigned to users" }
    
    return prisma.role.update({ where: { id: roleId }, data: { deletedAt: new Date() } })
  },

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

  getUserById: (tenantId: string, userId: string) =>
    prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      include: {
        roleLinks: { where: { revokedAt: null }, include: { role: true } },
        profile: true,
        teamMembers: { where: { leftAt: null, deletedAt: null }, include: { team: true } },
        teamsLed: { where: { deletedAt: null } }
      }
    }),

  getTeamByLeader: (tenantId: string, leaderUserId: string) =>
    prisma.team.findFirst({ where: { tenantId, leaderUserId, deletedAt: null } }),

  getTeamByName: (tenantId: string, name: string) =>
    prisma.team.findFirst({ where: { tenantId, name, deletedAt: null } }),

  getOrCreateRole: async (tenantId: string, name: string) => {
    const role = await prisma.role.findFirst({ where: { tenantId, name, deletedAt: null } })
    if (role) return role
    return prisma.role.create({ data: { tenantId, name, scope: "global" } })
  },

  assignRole: (tenantId: string, userId: string, roleId: string, assignedBy?: string) =>
    prisma.userRole.create({ data: { tenantId, userId, roleId, assignedBy } }),

  addTeamMember: (tenantId: string, teamId: string, userId: string, role: string) =>
    prisma.teamMember.create({ data: { tenantId, teamId, userId, role } }),

  createUserRequest: (tenantId: string, userId: string, type: string, payload: any) =>
    prisma.userRequest.create({
      data: {
        tenantId,
        requestedBy: userId,
        requestType: type,
        payload,
        status: "pending"
      }
    }),

  decideUserRequest: async (tenantId: string, requestId: string, data: { status: string; decidedBy: string }) => {
    const request = await prisma.userRequest.findUnique({ where: { id: requestId, tenantId } })
    if (!request) throw { status: 404, message: "Request not found" }
    
    if (request.status !== "pending") throw { status: 400, message: "Request already decided" }

    const updated = await prisma.userRequest.update({
      where: { id: requestId },
      data: { status: data.status, decidedBy: data.decidedBy, decidedAt: new Date() }
    })

    if (data.status === "approved" && request.requestType === "create_lead") {
      const payload = request.payload as any
      
      // Auto-assign to requester
      const assignedUserId = request.requestedBy
      
      // Resolve team
      let teamId = payload.teamId
      if (!teamId && assignedUserId) {
        const membership = await prisma.teamMember.findFirst({ 
          where: { tenantId, userId: assignedUserId, leftAt: null, deletedAt: null },
          select: { teamId: true }
        })
        teamId = membership?.teamId
        
        if (!teamId) {
          const ledTeam = await prisma.team.findFirst({
            where: { tenantId, leaderUserId: assignedUserId, deletedAt: null },
            select: { id: true }
          })
          teamId = ledTeam?.id
        }
      }

      const stages = await lifecycleService.ensureDefaultStages(tenantId)
      const callStage = stages.find((stage) => stage.code === "call")
      const status = payload.status || callStage?.code || "call"
      
      const lead = await prisma.lead.create({
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
      })
      
      const initialState = await lifecycleService.getStateByCode(tenantId, status)
      if (initialState) {
        await prisma.leadStateHistory.create({
          data: {
            tenantId,
            leadId: lead.id,
            toStateId: initialState.id,
            changedBy: request.requestedBy,
            changedAt: new Date()
          }
        })
        await prisma.leadDeadline.create({
          data: {
            tenantId,
            leadId: lead.id,
            stateId: initialState.id,
            dueAt: new Date(Date.now() + 7 * 24 * 3600 * 1000)
        }
      })
      
      // Log creation activity
      await logActivity({
        tenantId,
        actorUserId: request.decidedBy || undefined, // The person who approved it
        action: "lead.created",
        entityType: "lead",
        entityId: lead.id,
        metadata: { source: "request_approval", requestedBy: request.requestedBy }
      })

      // Queue intelligence trigger
      intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: lead.id, userId: lead.assignedUserId || undefined })
    }
  }

  return updated
  },

  createFinanceEntry: (tenantId: string, data: { entryType: string; category: string; amount: number; note?: string; occurredAt: Date; createdBy?: string }) =>
    prisma.financeEntry.create({
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

  listFinanceEntries: (tenantId: string) =>
    prisma.financeEntry.findMany({
      where: { tenantId },
      orderBy: { occurredAt: "desc" },
      include: { creator: { select: { id: true, email: true } } }
    }),

  listUserRequests: (tenantId: string) =>
    prisma.userRequest.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } })
}
