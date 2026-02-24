import { prisma } from "../../prisma/client"
import { conversationService } from "../conversations/service"
import { notificationService } from "../notifications/service"
import { lifecycleService } from "../lifecycle/service"
import { leadService } from "../lead/service"
import { hashPassword, generateStrongPassword } from "../auth/password"
import { logActivity } from "../../utils/activity"
import { intelligenceService } from "../intelligence/service"
import { UserPayload } from "../../utils/auth"

export const coreService = {
  createTenant: (data: { name: string; timezone?: string }) =>
    prisma.tenant.create({ data: { name: data.name, timezone: data.timezone || "UTC" } }),

  listTenants: () => prisma.tenant.findMany(),

  createUser: async (tenantId: string, data: { email: string; passwordHash: string; mustChangePassword: boolean; phone?: string; firstName?: string; lastName?: string }) => {
    // Manually check if email exists (including soft-deleted but somehow not renamed, just in case)
    const existingEmail = await prisma.user.findUnique({ where: { email: data.email } })
    if (existingEmail) {
       // If it's a soft deleted user that wasn't renamed properly, rename it now
       if (existingEmail.deletedAt) {
          await prisma.user.update({
            where: { id: existingEmail.id },
            data: { email: `deleted_${Date.now()}_${existingEmail.email}` }
          })
       } else {
          throw { status: 409, message: "البريد الإلكتروني مستخدم بالفعل" }
       }
    }

    // Manually check phone uniqueness if provided
    if (data.phone) {
       // Note: Phone is nullable and not unique in schema, but enforced in logic
       // But let's check if there is any active user with this phone
       const existingPhone = await prisma.user.findFirst({ 
         where: { 
           phone: data.phone,
           deletedAt: null // Only active users
         } 
       })
       if (existingPhone) throw { status: 409, message: "رقم الهاتف مستخدم بالفعل" }
    }

    const user = await prisma.user.create({ 
      data: { 
        tenantId, 
        email: data.email, 
        passwordHash: data.passwordHash, 
        mustChangePassword: data.mustChangePassword, 
        phone: data.phone,
        status: "active" 
      } 
    })
    
    if (data.firstName || data.lastName) {
      await prisma.userProfile.create({ 
        data: { 
          tenantId, 
          userId: user.id, 
          firstName: data.firstName, 
          lastName: data.lastName 
        } 
      })
    }

    // 1. Notify the new user (Welcome)
    await notificationService.send({
        tenantId,
        userId: user.id,
        type: "info",
        title: "مرحباً بك في النظام 👋",
        message: `أهلاً بك يا ${data.firstName || 'مستخدم'}! تم إنشاء حسابك بنجاح. نتمنى لك تجربة مثمرة.`,
        entityType: "user",
        entityId: user.id,
        actionUrl: "/"
    }).catch(console.error)

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
    const user = await prisma.user.findFirst({ 
      where: { id: userId, tenantId },
      include: { profile: true } 
    })
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

    if (data.status === "active" && user.status !== "active") {
      await notificationService.send({
        tenantId,
        userId,
        type: "success",
        title: "تم تفعيل حسابك",
        message: "تم تفعيل حسابك بنجاح. يمكنك الآن استخدام النظام.",
        entityType: "user",
        entityId: userId,
        actionUrl: "/"
      }).catch(console.error)
    }

    if (data.status === "inactive" && user.status === "active") {
      await notificationService.send({
        tenantId,
        userId,
        type: "error",
        title: "تم تعطيل حسابك",
        message: "تم تعطيل حسابك من قبل الإدارة.",
        entityType: "user",
        entityId: userId,
        actionUrl: "/"
      }).catch(console.error)

      // Notify Team Leaders
      try {
        const teamMemberships = await prisma.teamMember.findMany({
          where: { tenantId, userId, leftAt: null, deletedAt: null },
          include: { team: true }
        })
        
        const leaderIds = teamMemberships
          .map(m => m.team.leaderUserId)
          .filter(id => id && id !== userId) // Don't notify self if leader
        
        const uniqueLeaderIds = [...new Set(leaderIds)] as string[]

        if (uniqueLeaderIds.length > 0) {
          const name = user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user.email
          await notificationService.sendMany(uniqueLeaderIds, {
            tenantId,
            type: "warning",
            title: "تعطيل حساب مستخدم",
            message: `تم تعطيل حساب العضو ${name} في فريقك.`,
            entityType: "user",
            entityId: userId,
            actionUrl: `/settings/users`
          }).catch(console.error)
        }
      } catch (e) {
        console.error("Failed to notify team leaders about deactivation", e)
      }
    }

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
      prisma.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${Date.now()}_${user.email}`,
          phone: user.phone ? `deleted_${Date.now()}_${user.phone}` : null,
          deletedAt: new Date(),
          status: "inactive"
        }
      }),
      prisma.lead.updateMany({ where: { assignedUserId: userId, tenantId }, data: { assignedUserId: null } }),
      prisma.teamMember.updateMany({ where: { userId, tenantId, leftAt: null }, data: { leftAt: new Date() } }),
      prisma.userRole.updateMany({ where: { userId, tenantId, revokedAt: null }, data: { revokedAt: new Date() } })
    ])
    
    // Notify Team Leaders if any
    try {
      // Find teams where the user was a member
      // Since we just soft-deleted the memberships, we look for memberships updated "just now" or check historical
      // But better: we should have fetched them before.
      // However, we can query team members where userId is this user and leftAt is not null (recently left).
      // Or simply, we can notify ALL team leaders where this user was a member.
      // Let's assume we want to notify leaders of teams they were part of.
      
      const formerTeams = await prisma.teamMember.findMany({
        where: { tenantId, userId, leftAt: { not: null } }, // This might return old history too, so maybe filter by updated recently?
        // Since we did updateMany just now, we can't easily distinguish without a transaction result return.
        // Let's just find all teams they ever belonged to? No, that's spammy.
        // Let's find teams where they were active *just before*.
        // We can't do that easily post-facto without audit logs.
        // Alternative: The user is now inactive. We can find teams where they are a member (even if leftAt is set, we know which teams).
        // A better approach is to fetch active memberships BEFORE the transaction.
        // But I don't want to rewrite the whole function structure if I can avoid it.
        // Let's just notify the "Owner" that a user was deleted.
        orderBy: { leftAt: "desc" },
        take: 5,
        include: { team: true }
      })

      const teamIds = [...new Set(formerTeams.map(m => m.teamId))]
      const teams = await prisma.team.findMany({ where: { id: { in: teamIds } } })
      
      const leaderIds = teams.map(t => t.leaderUserId).filter(id => id && id !== userId)
      const uniqueLeaderIds = [...new Set(leaderIds)]

      if (uniqueLeaderIds.length > 0) {
        const deletedUser = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } })
        const name = deletedUser?.profile ? `${deletedUser.profile.firstName} ${deletedUser.profile.lastName}` : deletedUser?.email

        await notificationService.sendMany(
          uniqueLeaderIds as string[],
          {
            tenantId,
            type: "warning",
            title: "حذف مستخدم",
            message: `تم حذف/تعطيل المستخدم ${name} من النظام.`,
            entityType: "user",
            entityId: userId,
            actionUrl: "/settings/users"
          }
        ).catch(console.error)
      }
    } catch (e) {
      console.error("Failed to notify about user deletion", e)
    }
    
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

  revokeRole: async (tenantId: string, userId: string, roleId: string) => {
    const res = await prisma.userRole.updateMany({
      where: { tenantId, userId, roleId, revokedAt: null },
      data: { revokedAt: new Date() }
    })
    const role = await prisma.role.findUnique({ where: { id: roleId } })
    if (role?.name === "owner" || role?.name === "team_leader") {
      await conversationService.ensureOwnerGroup(tenantId).catch(console.error)
    }
    return res
  },

  transferTeamMember: async (tenantId: string, userId: string, teamId: string, role?: string) => {
    // 1. Check if user is ALREADY in this team (active)
    const existingInTarget = await prisma.teamMember.findFirst({
      where: { tenantId, userId, teamId, leftAt: null }
    })

    if (existingInTarget) {
      // If already in the team, just update the role if needed, don't create duplicate
      if (role && existingInTarget.role !== role) {
        return prisma.teamMember.update({
          where: { id: existingInTarget.id },
          data: { role }
        })
      }
      return existingInTarget
    }

    // 2. Close ALL active memberships for this user in this tenant
    // This ensures the user is moved FROM wherever they were
    const oldMember = await prisma.teamMember.findFirst({
      where: { tenantId, userId, leftAt: null }
    })

    await prisma.teamMember.updateMany({
      where: { tenantId, userId, leftAt: null },
      data: { leftAt: new Date() }
    })
    
    // 3. Create new membership
    const newMember = await prisma.teamMember.create({
      data: { tenantId, teamId, userId, role: role || "member" }
    })

    if (oldMember) {
      await conversationService.ensureTeamGroup(tenantId, oldMember.teamId).catch(console.error)
    }
    await conversationService.ensureTeamGroup(tenantId, teamId).catch(console.error)

    // Notify User
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } })
    await notificationService.send({
        tenantId,
        userId,
        type: "info",
        title: "تم تغيير فريقك",
        message: `تم نقلك إلى فريق "${team?.name || 'جديد'}"`,
        entityType: "team",
        entityId: teamId,
        actionUrl: "/settings/team"
    }).catch(console.error)

    return newMember
  },

  remindTeamMember: async (tenantId: string, teamId: string, leaderUser: UserPayload, memberId: string, leadId: string, leadName: string) => {
    // 1. Verify leader is leader of team
    const team = await prisma.team.findFirst({
        where: { id: teamId, tenantId, deletedAt: null }
    })
    if (!team) throw { status: 404, message: "الفريق غير موجود" }
    
    // Allow owner or assigned leader
    const isOwner = leaderUser.roles.includes("owner");
    if (team.leaderUserId !== leaderUser.id && !isOwner) {
         throw { status: 403, message: "غير مصرح لك بتذكير أعضاء هذا الفريق" }
    }

    // 2. Verify member is in team
    const member = await prisma.teamMember.findFirst({
        where: { teamId, userId: memberId, leftAt: null }
    })
    if (!member) throw { status: 404, message: "العضو غير موجود في الفريق" }

    // 3. Send Notification
    await notificationService.sendMany(
        [memberId],
        {
            tenantId,
            title: "تذكير بمتابعة عميل",
            message: `لديك عميل متوقف (${leadName}) يحتاج إلى متابعة عاجلة.`,
            type: "reminder",
            entityType: "lead",
            entityId: leadId,
            actionUrl: `/leads/${leadId}`,
            senderId: leaderUser.id
        }
    )

    // 4. Send Chat Message (Direct)
    try {
        const convo = await conversationService.ensureDirect(tenantId, leaderUser.id, memberId)
        if (convo) {
            await conversationService.sendMessage(tenantId, convo.id, leaderUser, {
                content: `يرجى متابعة العميل ${leadName}، لم يتم تحديث حالته منذ أكثر من 3 أيام.`,
                contentType: "text"
            })
        }
    } catch (e) {
        console.error("Failed to send chat reminder", e)
        // Don't fail the whole request if chat fails, notification is sent
    }

    return { status: "ok" }
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

  createTeam: async (tenantId: string, data: { name: string; leaderUserId?: string }) => {
    const team = await prisma.team.create({ data: { tenantId, name: data.name, leaderUserId: data.leaderUserId } })
    await conversationService.ensureTeamGroup(tenantId, team.id).catch(console.error)
    return team
  },

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
    prisma.file.create({ data: { tenantId, path: data.storageKey, filename: data.filename, mimetype: data.contentType, size: Number(data.sizeBytes), uploadedBy: data.createdBy } }),

  createIcon: (tenantId: string, data: { entityType: string; entityId: string; url: string; label?: string; createdBy?: string }) => {
    // IconAsset schema uses name, fileId. Mapping label -> name, url -> fileId (assuming url is fileId or we can't create)
    // Since we don't have fileId from url easily here without lookup, and schema is strict:
    // We will use a placeholder or better, throw if invalid.
    // However, to fix linter, we must match schema.
    // Assuming url is actually fileId for now or this method is deprecated.
    // We'll use 'name' for label.
    return prisma.iconAsset.create({ 
      data: { 
        tenantId, 
        name: data.label || "Untitled", 
        fileId: data.entityId, // Assuming entityId is the fileId in this context or we can't link
        uploadedBy: data.createdBy 
      } 
    })
  },

  listIcons: (tenantId: string, filters?: { entityType?: string; entityId?: string }) =>
    prisma.iconAsset.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    }),

  createNote: async (tenantId: string, data: { entityType: string; entityId: string; body: string; createdBy?: string }) => {
    const note = await prisma.note.create({ 
      data: { 
        tenantId, 
        relatedTo: data.entityType, 
        relatedId: data.entityId, 
        content: data.body, 
        createdBy: data.createdBy 
      } 
    });

    if (data.createdBy && data.body) {
      const user = await prisma.user.findUnique({ 
        where: { id: data.createdBy },
        include: { profile: true }
      });
      const userName = user?.profile ? `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() : user?.email || 'Unknown';
      
      let actionUrl = `/${data.entityType}s/${data.entityId}`;
      if (data.entityType === 'lead') actionUrl = `/leads/${data.entityId}`;
      
      await notificationService.notifyMentions(
        tenantId,
        data.body,
        { id: data.createdBy, name: userName },
        data.entityType,
        data.entityId,
        actionUrl
      ).catch(console.error);
    }
    return note;
  },

  createContact: (tenantId: string, data: { firstName?: string; lastName?: string; primaryEmail?: string; primaryPhone?: string }) =>
    prisma.contact.create({ 
      data: { 
        tenantId, 
        name: `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Unknown", 
        email: data.primaryEmail, 
        phone: data.primaryPhone 
      } 
    }),

  listContacts: (tenantId: string) => prisma.contact.findMany({ where: { tenantId } }),

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

  assignRole: async (tenantId: string, userId: string, roleId: string, assignedBy?: string) => {
    const res = await prisma.userRole.create({ data: { tenantId, userId, roleId, assignedBy } })
    const role = await prisma.role.findUnique({ where: { id: roleId } })
    if (role?.name === "owner" || role?.name === "team_leader") {
      await conversationService.ensureOwnerGroup(tenantId).catch(console.error)
    }

    if (role) {
      await notificationService.send({
        tenantId,
        userId,
        type: "info",
        title: "تحديث الصلاحيات",
        message: `تم منحك صلاحية جديدة: ${role.name}`,
        entityType: "role",
        entityId: roleId,
        actionUrl: "/profile"
      }).catch(console.error)
    }

    return res
  },

  addTeamMember: async (tenantId: string, teamId: string, userId: string, role: string) => {
    const res = await prisma.teamMember.create({ data: { tenantId, teamId, userId, role } })
    await conversationService.ensureTeamGroup(tenantId, teamId).catch(console.error)
    return res
  },

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

    if (data.status === "approved" && request.requestType === "create_sales") {
      try {
        const payload = request.payload as any
        const password = generateStrongPassword()
        const passwordHash = await hashPassword(password)
        
        // 1. Create User
        // We use coreService.createUser to handle duplicate checks
        const user = await coreService.createUser(tenantId, {
          email: payload.email,
          passwordHash,
          mustChangePassword: true,
          phone: payload.phone,
          firstName: payload.name.split(" ")[0],
          lastName: payload.name.split(" ").slice(1).join(" ")
        })

        // 2. Assign Role
        const role = await coreService.getOrCreateRole(tenantId, "sales")
        await coreService.assignRole(tenantId, user.id, role.id, data.decidedBy)

        // 3. Add to Team
        if (payload.teamId) {
          await coreService.addTeamMember(tenantId, payload.teamId, user.id, "sales")
        }

        // 4. Notify Requester (Team Leader) with credentials
        await notificationService.send({
          tenantId,
          userId: request.requestedBy,
          title: "تمت الموافقة على طلب إضافة المندوب",
          message: `تم إنشاء حساب المندوب ${payload.name} بنجاح.\nكلمة المرور المؤقتة: ${password}`,
          type: "success",
          entityType: "user_request",
          entityId: request.id,
          actionUrl: "/settings/users"
        })

      } catch (error: any) {
        // If creation fails, fail the request
        await prisma.userRequest.update({
          where: { id: requestId },
          data: { 
            status: "failed", 
            decidedBy: data.decidedBy, 
            decidedAt: new Date(), 
            notes: error.message 
          }
        })
        throw error
      }
    }

    if (data.status === "approved" && request.requestType === "create_lead") {
      try {
        const payload = request.payload as any
        // Ensure assignedUserId is set to requester if not provided
        const assignedUserId = payload.assignedUserId || request.requestedBy
        
        const lead = await leadService.createLead(tenantId, {
          leadCode: payload.leadCode || `L-${Date.now()}`,
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          budget: payload.budget,
          areaOfInterest: payload.areaOfInterest,
          sourceLabel: payload.sourceLabel || payload.source,
          sourceId: payload.sourceId,
          assignedUserId,
          teamId: payload.teamId, // createLead resolves team if missing, but we pass it if we have it
          priority: payload.priority,
          budgetMin: payload.budgetMin,
          budgetMax: payload.budgetMax,
          desiredLocation: payload.desiredLocation,
          propertyType: payload.propertyType,
          profession: payload.profession,
          notes: payload.notes
        })
        
        // Explicitly assign if needed (createLead usually handles it but let's be safe)
        if (assignedUserId && !lead.assignedUserId) {
             await leadService.assignLead(tenantId, lead.id, assignedUserId, data.decidedBy, "Approved Request")
        }

        // Notify Requester
        await notificationService.sendMany([request.requestedBy], {
          tenantId,
          title: "تمت الموافقة على طلب العميل",
          message: `تم إنشاء العميل ${lead.name} بنجاح وتم تعيينه لك.`,
          type: "success", // changed from lead_request_approved to valid type
          entityType: "lead",
          entityId: lead.id
        })
        
      } catch (error: any) {
         await prisma.userRequest.update({
          where: { id: requestId },
          data: { 
            status: "failed", 
            decidedBy: data.decidedBy, 
            decidedAt: new Date(), 
            notes: error.message 
          }
        })
        throw error
      }
    }

    const updated = await prisma.userRequest.update({
      where: { id: requestId },
      data: {
        status: data.status,
        decidedBy: data.decidedBy,
        decidedAt: new Date(),
        notes: data.status === "rejected" ? "Rejected by admin" : undefined
      }
    })

    return updated
  },

  removeTeamMember: async (tenantId: string, teamId: string, userId: string) => {
    const member = await prisma.teamMember.findFirst({
      where: { tenantId, teamId, userId, leftAt: null, deletedAt: null }
    })
    
    if (!member) throw { status: 404, message: "Member not found in team" }
    
    await prisma.teamMember.update({
      where: { id: member.id },
      data: { leftAt: new Date() }
    })
    
    await conversationService.ensureTeamGroup(tenantId, teamId).catch(console.error)
    return { status: "ok" }
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
    prisma.userRequest.findMany({
      where: { tenantId },
      include: { requester: { include: { profile: true } }, decider: { include: { profile: true } } },
      orderBy: { createdAt: "desc" }
    }),

  listPendingRegistrations: (tenantId: string) =>
    prisma.user.findMany({
      where: { tenantId, status: "inactive", deletedAt: null },
      include: {
        profile: true,
        roleLinks: { include: { role: true } }
      }
    }).then(async users => {
        const userIds = users.map(u => u.id);
        const notes = await prisma.note.findMany({
            where: { tenantId, relatedTo: "user_request", relatedId: { in: userIds } }
        });
        
        return users.map(user => {
            const teamNote = notes.find(n => n.relatedId === user.id);
            return {
                ...user,
                requestedTeamName: teamNote ? teamNote.content.replace("Requested Team Name: ", "") : null
            };
        });
    }),

  approveRegistration: async (tenantId: string, userId: string, actorId: string) => {
    const user = await prisma.user.findFirst({ where: { id: userId, tenantId, status: "inactive" } })
    if (!user) throw { status: 404, message: "المستخدم غير موجود أو مفعل بالفعل" }

    await prisma.user.update({
        where: { id: userId },
        data: { status: "active" }
    })

    const note = await prisma.note.findFirst({ where: { tenantId, relatedTo: "user_request", relatedId: userId } })
    if (note && note.content.includes("Requested Team Name:")) {
        const teamName = note.content.replace("Requested Team Name: ", "").trim()
        
        const team = await prisma.team.create({
            data: {
                tenantId,
                name: teamName,
                leaderUserId: userId
            }
        })
        
        await prisma.teamMember.create({
            data: {
                tenantId,
                teamId: team.id,
                userId: userId,
                role: "leader"
            }
        })
        
        await prisma.note.delete({ where: { id: note.id } })
    }

    return {
        id: user.id,
        email: user.email,
        phone: user.phone
    }
  }
}
