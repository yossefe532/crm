import { Request, Response } from "express"
import { coreService } from "./service"
import { leadService } from "../lead/service"
import { lifecycleService } from "../lifecycle/service"
import { conversationService } from "../conversations/service"
import { notificationService } from "../notifications/service"
import { prisma } from "../../prisma/client"
import { logActivity } from "../../utils/activity"
import { generateStrongPassword, hashPassword } from "../auth/password"
import { isValidEmail, validatePasswordStrength } from "../auth/validation"

const isOwnerAccount = async (tenantId: string, userId: string) => {
  const ownerRole = await prisma.role.findFirst({ where: { tenantId, name: "owner", deletedAt: null } })
  if (!ownerRole) return false
  const link = await prisma.userRole.findFirst({ where: { tenantId, userId, roleId: ownerRole.id, revokedAt: null } })
  return Boolean(link)
}

export const coreController = {
  createTenant: async (req: Request, res: Response) => {
    const tenant = await coreService.createTenant({ name: req.body.name, timezone: req.body.timezone })
    await logActivity({ tenantId: tenant.id, action: "tenant.created", entityType: "tenant", entityId: tenant.id })
    res.json(tenant)
  },
  listTenants: async (req: Request, res: Response) => {
    const tenants = await coreService.listTenants()
    if (tenants[0]) {
      await logActivity({ tenantId: tenants[0].id, actorUserId: req.user?.id, action: "tenant.listed", entityType: "tenant" })
    }
    res.json(tenants)
  },
  createUser: async (req: Request, res: Response) => {
    let createdUser: any = null;
    try {
      const tenantId = req.user?.tenantId || ""
      const actorRoles = req.user?.roles || []
      const name = String(req.body?.name || "").trim()
      const email = String(req.body?.email || "").trim().toLowerCase()
      const phone = req.body?.phone ? String(req.body.phone).trim() : undefined
      const password = req.body?.password ? String(req.body.password) : ""
      const roleInput = String(req.body?.role || "sales").trim()
       const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleInput)
       let resolvedRole = await prisma.role.findFirst({ 
         where: { 
           tenantId, 
           ...(isUUID ? { OR: [{ id: roleInput }, { name: roleInput }] } : { name: roleInput }),
           deletedAt: null 
         } 
       })
      
      let requestedRole = "";
      if (resolvedRole) {
        requestedRole = resolvedRole.name;
      } else {
        const standardRoles = ["owner", "team_leader", "sales"];
        // Check if it's a standard role name (case insensitive)
        const matchedStandard = standardRoles.find(r => r === roleInput || r === roleInput.toLowerCase());
        if (matchedStandard) {
           requestedRole = matchedStandard;
        } else {
           throw { status: 400, message: "نوع الدور غير صالح" };
        }
      }

      const teamId = req.body?.teamId ? String(req.body.teamId) : undefined
      const teamName = req.body?.teamName ? String(req.body.teamName) : undefined
      if (!tenantId) throw { status: 401, message: "Unauthorized" }
      
      if (!actorRoles.includes("owner") && !actorRoles.includes("team_leader")) throw { status: 403, message: "غير مصرح" }
      
      if (!name) throw { status: 400, message: "الاسم مطلوب" }
      if (!isValidEmail(email)) throw { status: 400, message: "صيغة البريد الإلكتروني غير صحيحة" }

      if (actorRoles.includes("team_leader") && !actorRoles.includes("owner")) {
        if (requestedRole !== "sales") throw { status: 403, message: "يمكن لقائد الفريق إضافة مندوبي مبيعات فقط" }
        const leaderTeam = await coreService.getTeamByLeader(tenantId, req.user?.id || "")
        if (!leaderTeam) throw { status: 400, message: "لا يوجد فريق مرتبط بهذا القائد" }
        
        const payload = { name, email, phone, role: "sales", teamId: leaderTeam.id }
        const request = await coreService.createUserRequest(tenantId, req.user?.id || "", "create_sales", payload)
        
        // Notify Owners
        const owners = await prisma.userRole.findMany({ 
          where: { tenantId, role: { name: "owner" }, revokedAt: null },
          select: { userId: true }
        })
        const recipientIds = [...new Set(owners.map(o => o.userId))]
        
        await notificationService.sendMany(
          recipientIds,
          {
            tenantId,
            title: "طلب إضافة مندوب مبيعات جديد",
            message: `طلب القائد (ID: ${req.user?.id}) إضافة مندوب جديد: ${name}`,
            type: "info",
            entityType: "user_request",
            entityId: request.id,
            actionUrl: `/admin/requests`,
            senderId: req.user?.id
          }
        )

        await logActivity({ tenantId, actorUserId: req.user?.id, action: "user_request.created", entityType: "user_request", entityId: request.id })
        res.status(202).json({ message: "تم إرسال طلب إنشاء المستخدم للموافقة", request })
        return
      }

      // Phone check is now handled in coreService.createUser for consistency
      /*
      if (phone) {
        const existingPhone = await coreService.listUsers(tenantId)
        if (existingPhone.some((user) => user.phone === phone)) {
          throw { status: 409, message: "رقم الهاتف مستخدم بالفعل" }
        }
      }
      */
  
      // Permission check for Owner
      if (actorRoles.includes("owner")) {
        // Prevent owner from creating another owner
        if (requestedRole === 'owner') {
             throw { status: 403, message: "لا يمكن إنشاء حساب مالك آخر. النظام يدعم مالك واحد فقط." }
        }
      }
  
      // Strict validation for Team Leader creation
      if (requestedRole === "team_leader") {
        if (!actorRoles.includes("owner")) throw { status: 403, message: "فقط المالك يمكنه إنشاء قائد فريق" }
        if (!teamName) throw { status: 400, message: "اسم الفريق مطلوب لقائد الفريق" }
      }

      if (requestedRole === "team_leader" && teamName) {
        const existingTeam = await coreService.getTeamByName(tenantId, teamName)
        if (existingTeam) throw { status: 409, message: "اسم الفريق مستخدم بالفعل" }
      }

      let mustChangePassword = true
      let temporaryPassword: string | undefined
      let passwordHash: string
      if (password) {
        const strength = validatePasswordStrength(password)
        if (!strength.ok) throw { status: 400, message: strength.reasons[0] || "كلمة المرور ضعيفة" }
        mustChangePassword = false
        passwordHash = await hashPassword(password)
      } else {
        temporaryPassword = generateStrongPassword()
        passwordHash = await hashPassword(temporaryPassword)
        mustChangePassword = true
      }

      const [firstName, ...lastNameParts] = name ? name.split(" ") : [undefined, []]
      const lastName = lastNameParts.join(" ") || undefined
  
      const user = await coreService.createUser(tenantId, { email, passwordHash, mustChangePassword, phone, firstName, lastName })
      createdUser = user;
      const role = await coreService.getOrCreateRole(tenantId, requestedRole)
      await coreService.assignRole(tenantId, user.id, role.id, req.user?.id)
  
      if (requestedRole === "team_leader" && teamName) {
        const existingTeam = await coreService.getTeamByName(tenantId, teamName)
        if (existingTeam) throw { status: 409, message: "اسم الفريق مستخدم بالفعل" }
        const newTeam = await coreService.createTeam(tenantId, { name: teamName, leaderUserId: user.id })
        await conversationService.ensureTeamGroup(tenantId, newTeam.id)
      }

      if (requestedRole === "sales") {
        const resolvedTeamId = teamId || (await coreService.getTeamByLeader(tenantId, req.user?.id || ""))?.id
        if (resolvedTeamId) {
          await coreService.addTeamMember(tenantId, resolvedTeamId, user.id, "member")
          await conversationService.ensureTeamGroup(tenantId, resolvedTeamId)
        }
      }
      
      if (requestedRole === "team_leader") {
        await conversationService.ensureOwnerGroup(tenantId)
      }

      await logActivity({ tenantId, actorUserId: req.user?.id, action: "user.created", entityType: "user", entityId: user.id })
      
      // 2. Notify Admins/Owners about new user
      // First get owner role id
      const ownerRole = await prisma.role.findFirst({ where: { name: "owner", tenantId } })
      if (ownerRole) {
        const owners = await prisma.userRole.findMany({
          where: { 
            tenantId, 
            roleId: ownerRole.id,
            revokedAt: null 
          },
          select: { userId: true }
        })
        
        if (owners.length > 0) {
          const recipientIds = owners.map(o => o.userId);
          if (recipientIds.length > 0) {
            await notificationService.sendMany(recipientIds, {
              tenantId,
              type: "info",
              title: "مستخدم جديد انضم للنظام 👤",
              message: `تم إنشاء حساب جديد للمستخدم: ${firstName || ""} ${lastName || ""} (${email})`,
              entityType: "user",
              entityId: user.id,
              actionUrl: `/settings/users/${user.id}`,
              senderId: req.user?.id
            }).catch(console.error)
          }
        }
      }

      res.json({
        user: { id: user.id, tenantId: user.tenantId, email: user.email, phone: user.phone, status: user.status, mustChangePassword: user.mustChangePassword, createdAt: user.createdAt, updatedAt: user.updatedAt },
        ...(temporaryPassword ? { temporaryPassword } : {})
      })
    } catch (error: any) {
      console.error("User creation failed:", error)

      // Rollback: Delete created user if exists to prevent stale data (zombie users)
      if (createdUser && createdUser.id) {
        try {
           console.log(`Rolling back creation for user ${createdUser.id}`)
           // We need to delete in reverse order of creation dependencies
           await prisma.teamMember.deleteMany({ where: { userId: createdUser.id } })
           await prisma.userRole.deleteMany({ where: { userId: createdUser.id } })
           await prisma.userProfile.deleteMany({ where: { userId: createdUser.id } })
           // Also clean up any potential conversation/group links if they were created
           await prisma.conversationParticipant.deleteMany({ where: { userId: createdUser.id } })
           await prisma.user.delete({ where: { id: createdUser.id } })
        } catch (rollbackErr) {
           console.error("Rollback failed for user " + createdUser.id, rollbackErr)
        }
      }

      if (error.code === 'P2002') {
         const target = error.meta?.target;
         if (Array.isArray(target)) {
           if (target.includes('email')) throw { status: 409, message: "البريد الإلكتروني مستخدم بالفعل" }
           if (target.includes('phone')) throw { status: 409, message: "رقم الهاتف مستخدم بالفعل" }
         }
         throw { status: 409, message: "بيانات (البريد أو الهاتف) مستخدمة بالفعل" }
      }
      throw error
    }
  },
  listUsers: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    let users = await coreService.listUsers(tenantId)
    
    // Filter for Team Leader & Sales
    const roles = req.user?.roles || []
    if (roles.includes("team_leader") && !roles.includes("owner")) {
       const leaderTeam = await coreService.getTeamByLeader(tenantId, req.user?.id || "")
       if (leaderTeam) {
          const teamMembers = await prisma.teamMember.findMany({
             where: { tenantId, teamId: leaderTeam.id, leftAt: null, deletedAt: null },
             select: { userId: true }
          })
          const memberIds = teamMembers.map(m => m.userId)
          memberIds.push(req.user?.id || "") // Include self
          users = users.filter(u => memberIds.includes(u.id))
       } else {
          users = users.filter(u => u.id === req.user?.id)
       }
    } else if (roles.includes("sales") && !roles.includes("owner") && !roles.includes("team_leader")) {
        users = users.filter(u => u.id === req.user?.id)
    }

    await logActivity({ tenantId, actorUserId: req.user?.id, action: "user.listed", entityType: "user" })
    const payload = users.map((user) => ({
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      phone: user.phone,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      firstName: user.profile?.firstName,
      lastName: user.profile?.lastName,
      name: [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ").trim() || user.email,
      roles: (user.roleLinks || []).map((link) => link.role.name),
      teamsLed: user.teamsLed?.map((team) => ({ id: team.id, name: team.name })) || [],
      teamMemberships: user.teamMembers?.map((member) => ({ teamId: member.teamId, teamName: member.team?.name, role: member.role })) || []
    }))
    res.json(payload)
  },
  listUserAuditLogs: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const limit = req.query.limit ? Number(req.query.limit) : 50
    const logs = await prisma.auditLog.findMany({
      where: { tenantId, userId: req.params.userId },
      orderBy: { createdAt: "desc" },
      take: limit
    })
    res.json(logs)
  },
  listMyActivity: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const limit = req.query.limit ? Number(req.query.limit) : 50
    const logs = await prisma.auditLog.findMany({
      where: { tenantId, userId: req.user?.id },
      orderBy: { createdAt: "desc" },
      take: limit
    })
    res.json(logs)
  },
  updateUser: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const name = req.body.name ? String(req.body.name).trim() : undefined
    const email = req.body.email ? String(req.body.email).trim().toLowerCase() : undefined
    const phone = req.body.phone ? String(req.body.phone).trim() : undefined
    if (await isOwnerAccount(tenantId, req.params.userId)) throw { status: 403, message: "لا يمكن تعديل حساب المالك" }
    
    let firstName: string | undefined
    let lastName: string | undefined
    
    if (name) {
      const parts = name.split(" ")
      firstName = parts[0]
      lastName = parts.slice(1).join(" ") || undefined
    }

    if (phone) {
      const existingPhone = await coreService.listUsers(tenantId)
      if (existingPhone.some((user) => user.phone === phone && user.id !== req.params.userId)) {
        throw { status: 409, message: "رقم الهاتف مستخدم بالفعل" }
      }
    }
    try {
      const updated = await coreService.updateUser(tenantId, req.params.userId, {
        email,
        phone,
        firstName,
        lastName,
        status: req.body?.status ? String(req.body.status) : undefined
      })

      await logActivity({ tenantId, actorUserId: req.user?.id, action: "user.updated", entityType: "user", entityId: updated.id })
      res.json(updated)
    } catch (error: any) {
      if (error.code === 'P2002') {
         const target = error.meta?.target;
         if (Array.isArray(target)) {
           if (target.includes('email')) throw { status: 409, message: "البريد الإلكتروني مستخدم بالفعل" }
           if (target.includes('phone')) throw { status: 409, message: "رقم الهاتف مستخدم بالفعل" }
         }
         throw { status: 409, message: "بيانات (البريد أو الهاتف) مستخدمة بالفعل" }
      }
      throw error
    }
  },
  getUser: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const userId = req.params.userId
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      include: {
        roleLinks: { where: { revokedAt: null }, include: { role: true } },
        profile: true,
        teamMembers: { where: { leftAt: null, deletedAt: null }, include: { team: true } },
        teamsLed: { where: { deletedAt: null } }
      }
    })
    if (!user) {
      res.status(404).json({ message: "User not found" })
      return
    }
    
    const payload = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      phone: user.phone,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      firstName: user.profile?.firstName,
      lastName: user.profile?.lastName,
      name: [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ").trim() || user.email,
      roles: (user.roleLinks || []).map((link) => link.role.name),
      teamsLed: user.teamsLed?.map((team) => ({ id: team.id, name: team.name })) || [],
      teamMemberships: user.teamMembers?.map((member) => ({ teamId: member.teamId, teamName: member.team?.name, role: member.role })) || []
    }
    
    res.json(payload)
  },
  deleteUser: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (req.user?.id === req.params.userId) throw { status: 400, message: "لا يمكن حذف الحساب الحالي" }
    if (await isOwnerAccount(tenantId, req.params.userId)) throw { status: 403, message: "لا يمكن حذف حساب المالك" }
    await coreService.deleteUser(tenantId, req.params.userId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "user.deleted", entityType: "user", entityId: req.params.userId })
    res.json({ status: "ok" })
  },
  resetUserPassword: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const password = req.body?.password ? String(req.body.password) : ""
    if (await isOwnerAccount(tenantId, req.params.userId)) throw { status: 403, message: "لا يمكن تعديل حساب المالك" }
    let passwordHash: string
    let temporaryPassword: string | undefined
    if (password) {
      const strength = validatePasswordStrength(password)
      if (!strength.ok) throw { status: 400, message: strength.reasons[0] || "كلمة المرور ضعيفة" }
      passwordHash = await hashPassword(password)
    } else {
      temporaryPassword = generateStrongPassword()
      passwordHash = await hashPassword(temporaryPassword)
    }
    await coreService.resetPassword(tenantId, req.params.userId, passwordHash, true)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "user.password.reset", entityType: "user", entityId: req.params.userId })
    res.json({ status: "ok", ...(temporaryPassword ? { temporaryPassword } : {}) })
  },
  createRole: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const role = await coreService.createRole(tenantId, { name: req.body.name, scope: req.body.scope })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "role.created", entityType: "role", entityId: role.id })
    res.json(role)
  },
  listRoles: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const roles = await coreService.listRoles(tenantId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "role.listed", entityType: "role" })
    res.json(roles)
  },
  deleteRole: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const roleId = String(req.params.roleId || "").trim()
    await coreService.deleteRole(tenantId, roleId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "role.deleted", entityType: "role", entityId: roleId })
    res.json({ status: "ok" })
  },
  listPermissions: async (_req: Request, res: Response) => {
    const permissions = await coreService.listPermissions()
    res.json(permissions)
  },
  listRolePermissions: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const items = await coreService.listRolePermissions(tenantId, req.params.roleId)
    res.json(items)
  },
  listUserPermissions: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const permissions = await coreService.listUserPermissions(tenantId, req.params.userId)
    res.json(permissions)
  },
  updateUserPermissions: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const permissionIds = Array.isArray(req.body?.permissionIds) ? req.body.permissionIds.map(String) : []
    await coreService.replaceUserPermissions(tenantId, req.params.userId, permissionIds, req.user?.id)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "user.permissions.updated", entityType: "user", entityId: req.params.userId })
    res.json({ status: "ok" })
  },
  updateRolePermissions: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const permissionIds = Array.isArray(req.body?.permissionIds) ? req.body.permissionIds.map(String) : []
    await coreService.replaceRolePermissions(tenantId, req.params.roleId, permissionIds)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "role.permissions.updated", entityType: "role", entityId: req.params.roleId })
    res.json({ status: "ok" })
  },
  createTeam: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const name = String(req.body?.name || "").trim()
    if (!name) throw { status: 400, message: "اسم الفريق مطلوب" }
    const existing = await coreService.getTeamByName(tenantId, name)
    if (existing) throw { status: 409, message: "اسم الفريق مستخدم بالفعل" }
    const team = await coreService.createTeam(tenantId, { name, leaderUserId: req.body.leaderUserId })
    await conversationService.ensureTeamGroup(tenantId, team.id)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "team.created", entityType: "team", entityId: team.id })
    res.json(team)
  },
  listTeams: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const teams = await coreService.listTeams(tenantId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "team.listed", entityType: "team" })
    res.json(teams)
  },
  transferUserTeam: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const userId = String(req.params.userId || "").trim()
    const teamId = String(req.body?.teamId || "").trim()
    if (!userId || !teamId) throw { status: 400, message: "بيانات النقل غير مكتملة" }
    if (await isOwnerAccount(tenantId, userId)) throw { status: 403, message: "لا يمكن تعديل حساب المالك" }
    const team = await coreService.listTeams(tenantId)
    if (!team.some((item) => item.id === teamId)) throw { status: 404, message: "الفريق غير موجود" }
    const user = await coreService.getUserById(tenantId, userId)
    if (!user) throw { status: 404, message: "المستخدم غير موجود" }
    const roleNames = user.roleLinks?.map((link) => link.role.name) || []
    if (roleNames.includes("team_leader")) throw { status: 400, message: "لا يمكن إسناد قائد فريق لفريق آخر" }
    
    const currentMembership = await prisma.teamMember.findFirst({
      where: { tenantId, userId, leftAt: null, deletedAt: null },
      select: { teamId: true }
    })

    const membership = await coreService.transferTeamMember(tenantId, userId, teamId, req.body?.role ? String(req.body.role) : undefined)
    await conversationService.ensureTeamGroup(tenantId, teamId)
    
    if (currentMembership?.teamId && currentMembership.teamId !== teamId) {
      await conversationService.ensureTeamGroup(tenantId, currentMembership.teamId)
    }

    await logActivity({ tenantId, actorUserId: req.user?.id, action: "team.member.transferred", entityType: "team_member", entityId: membership.id, metadata: { userId, teamId } })
    res.json(membership)
  },
  promoteToTeamLeader: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const userId = String(req.params.userId || "").trim()
    const teamName = req.body?.teamName ? String(req.body.teamName).trim() : ""
    const memberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds.map(String) : []
    if (!userId) throw { status: 400, message: "المستخدم مطلوب" }
    if (!teamName) throw { status: 400, message: "اسم الفريق مطلوب" }
    if (await isOwnerAccount(tenantId, userId)) throw { status: 403, message: "لا يمكن تعديل حساب المالك" }
    const user = await coreService.getUserById(tenantId, userId)
    if (!user) throw { status: 404, message: "المستخدم غير موجود" }
    const roleNames = user.roleLinks?.map((link) => link.role.name) || []
    if (roleNames.includes("team_leader")) throw { status: 400, message: "المستخدم قائد فريق بالفعل" }
    const existingLeaderTeam = await coreService.getTeamByLeader(tenantId, userId)
    if (existingLeaderTeam) throw { status: 400, message: "لا يمكن قيادة أكثر من فريق" }
    
    const currentMembership = await prisma.teamMember.findFirst({
      where: { tenantId, userId, leftAt: null, deletedAt: null },
      select: { teamId: true }
    })

    const teamLeaderRole = await coreService.getOrCreateRole(tenantId, "team_leader")
    const salesRole = await coreService.getOrCreateRole(tenantId, "sales")
    await coreService.assignRole(tenantId, userId, teamLeaderRole.id, req.user?.id)
    await coreService.revokeRole(tenantId, userId, salesRole.id)
    const existingTeam = await coreService.getTeamByName(tenantId, teamName)
    if (existingTeam) throw { status: 409, message: "اسم الفريق مستخدم بالفعل" }
    const team = await coreService.createTeam(tenantId, { name: teamName, leaderUserId: userId })
    await coreService.transferTeamMember(tenantId, userId, team.id, "leader")
    await conversationService.ensureTeamGroup(tenantId, team.id)
    await conversationService.ensureOwnerGroup(tenantId)
    
    if (currentMembership?.teamId && currentMembership.teamId !== team.id) {
      await conversationService.ensureTeamGroup(tenantId, currentMembership.teamId)
    }

    if (memberIds.length) {
      const members = await prisma.user.findMany({
        where: { tenantId, id: { in: memberIds }, deletedAt: null },
        include: { roleLinks: { where: { revokedAt: null }, include: { role: true } }, teamMembers: { where: { leftAt: null, deletedAt: null } } }
      })
      for (const member of members) {
        const memberRoles = member.roleLinks?.map((link) => link.role.name) || []
        if (memberRoles.includes("team_leader")) throw { status: 400, message: "لا يمكن إضافة قائد فريق داخل فريق آخر" }
        if (member.teamMembers?.length) {
             // If member is already in another team, we need to transfer them properly
             // This ensures they are removed from the old team and added to the new one
             await coreService.transferTeamMember(tenantId, member.id, team.id, "member")
        } else {
             // If not in any team, just add them
             await coreService.addTeamMember(tenantId, team.id, member.id, "member")
        }
      }
      // Sync again to add members
      await conversationService.ensureTeamGroup(tenantId, team.id)
    }
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "user.promoted", entityType: "user", entityId: userId, metadata: { teamId: team.id } })
    res.json({ status: "ok", team })
  },
  updateTeam: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const teamId = String(req.params.teamId || "").trim()
    const name = String(req.body?.name || "").trim()
    
    if (!teamId) throw { status: 400, message: "معرف الفريق مطلوب" }
    if (!name) throw { status: 400, message: "اسم الفريق مطلوب" }

    // Check permissions: Owner or Team Leader of this team
    const isOwner = req.user?.roles?.includes("owner")
    if (!isOwner) {
      const leaderTeam = await coreService.getTeamByLeader(tenantId, req.user?.id || "")
      if (!leaderTeam || leaderTeam.id !== teamId) {
        throw { status: 403, message: "غير مصرح لك بتعديل هذا الفريق" }
      }
    }

    const existingName = await coreService.getTeamByName(tenantId, name)
    if (existingName && existingName.id !== teamId) throw { status: 409, message: "اسم الفريق مستخدم بالفعل" }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { name }
    })

    await logActivity({ tenantId, actorUserId: req.user?.id, action: "team.updated", entityType: "team", entityId: teamId })
    res.json(updated)
  },

  removeTeamMember: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const teamId = String(req.params.teamId || "").trim()
    const userId = String(req.params.userId || "").trim()

    if (!teamId || !userId) throw { status: 400, message: "بيانات غير مكتملة" }

    // Check permissions
    const isOwner = req.user?.roles?.includes("owner")
    if (!isOwner) {
      const leaderTeam = await coreService.getTeamByLeader(tenantId, req.user?.id || "")
      if (!leaderTeam || leaderTeam.id !== teamId) {
        throw { status: 403, message: "غير مصرح لك بإزالة أعضاء من هذا الفريق" }
      }
    }

    const member = await prisma.teamMember.findFirst({
      where: { tenantId, teamId, userId, leftAt: null, deletedAt: null }
    })

    if (!member) throw { status: 404, message: "العضو غير موجود في الفريق" }
    if (member.role === "leader") throw { status: 400, message: "لا يمكن إزالة قائد الفريق بهذه الطريقة" }

    await coreService.removeTeamMember(tenantId, teamId, userId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "team.member.removed", entityType: "team_member", entityId: member.id })
    res.json({ status: "ok" })
  },

  remindTeamMember: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const teamId = req.params.teamId
    const { userId: memberId, leadId, leadName } = req.body
    
    if (!req.user) throw { status: 401, message: "Unauthorized" }
    if (!memberId || !leadId) throw { status: 400, message: "بيانات ناقصة" }

    await coreService.remindTeamMember(tenantId, teamId, req.user, memberId, leadId, leadName || "Unknown")
    res.json({ status: "ok" })
  },

  demoteTeamLeader: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const userId = String(req.params.userId || "").trim()
    const newLeaderId = req.body?.newLeaderId ? String(req.body.newLeaderId).trim() : undefined

    if (!userId) throw { status: 400, message: "معرف المستخدم مطلوب" }
    if (await isOwnerAccount(tenantId, userId)) throw { status: 403, message: "لا يمكن تنحية المالك" }

    const user = await coreService.getUserById(tenantId, userId)
    if (!user) throw { status: 404, message: "المستخدم غير موجود" }

    const roleNames = user.roleLinks?.map((link) => link.role.name) || []
    if (!roleNames.includes("team_leader")) throw { status: 400, message: "المستخدم ليس قائد فريق" }

    const team = await coreService.getTeamByLeader(tenantId, userId)
    if (!team) throw { status: 400, message: "لا يوجد فريق مرتبط بهذا القائد" }

    // If new leader provided, transfer leadership
    if (newLeaderId) {
      const newLeader = await coreService.getUserById(tenantId, newLeaderId)
      if (!newLeader) throw { status: 404, message: "القائد الجديد غير موجود" }
      
      // Check if new leader is already a leader
      const newLeaderRoles = newLeader.roleLinks?.map((link) => link.role.name) || []
      if (newLeaderRoles.includes("team_leader")) throw { status: 400, message: "القائد الجديد يقود فريقاً بالفعل" }

      // Assign roles
      const teamLeaderRole = await coreService.getOrCreateRole(tenantId, "team_leader")
      const salesRole = await coreService.getOrCreateRole(tenantId, "sales")
      
      // Demote current leader
      await coreService.revokeRole(tenantId, userId, teamLeaderRole.id)
      await coreService.assignRole(tenantId, userId, salesRole.id, req.user?.id)
      
      // Promote new leader
      await coreService.assignRole(tenantId, newLeaderId, teamLeaderRole.id, req.user?.id)
      await coreService.revokeRole(tenantId, newLeaderId, salesRole.id)

      // Update team leadership
      await prisma.team.update({
        where: { id: team.id },
        data: { leaderUserId: newLeaderId }
      })

      // Update team memberships
      await coreService.transferTeamMember(tenantId, userId, team.id, "member")
      await coreService.transferTeamMember(tenantId, newLeaderId, team.id, "leader")

    } else {
      // Just demote (Owner takes over temporarily)
      const teamLeaderRole = await coreService.getOrCreateRole(tenantId, "team_leader")
      const salesRole = await coreService.getOrCreateRole(tenantId, "sales")

      await coreService.revokeRole(tenantId, userId, teamLeaderRole.id)
      await coreService.assignRole(tenantId, userId, salesRole.id, req.user?.id)
      
      const owner = await prisma.user.findFirst({ where: { tenantId, roleLinks: { some: { role: { name: "owner" } } } } })
      if (owner) {
         await prisma.team.update({
           where: { id: team.id },
           data: { leaderUserId: owner.id }
         })
         // Add owner as leader in TeamMember if not already
         const ownerMember = await prisma.teamMember.findFirst({
            where: { tenantId, teamId: team.id, userId: owner.id, leftAt: null }
         })
         if (!ownerMember) {
             await coreService.addTeamMember(tenantId, team.id, owner.id, "leader")
         } else if (ownerMember.role !== "leader") {
             // Update role to leader? Or keep as is?
             // Usually owner has super access anyway, but for clarity let's keep them as is or update.
             // Let's leave it, owner role is powerful enough.
         }
      }
      
      await coreService.transferTeamMember(tenantId, userId, team.id, "member")
    }

    // Sync chat groups
    await conversationService.ensureTeamGroup(tenantId, team.id).catch(console.error)
    await conversationService.ensureOwnerGroup(tenantId).catch(console.error)

    await logActivity({ tenantId, actorUserId: req.user?.id, action: "user.demoted", entityType: "user", entityId: userId })
    res.json({ status: "ok" })
  },

  deleteTeam: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const teamId = String(req.params.teamId || "").trim()
    if (!teamId) throw { status: 400, message: "الفريق مطلوب" }
    await coreService.deleteTeam(tenantId, teamId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "team.deleted", entityType: "team", entityId: teamId })
    res.json({ status: "ok" })
  },
  createFile: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const file = await coreService.createFile(tenantId, { storageKey: req.body.storageKey, filename: req.body.filename, contentType: req.body.contentType, sizeBytes: BigInt(req.body.sizeBytes), createdBy: req.user?.id })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "file.created", entityType: "file", entityId: file.id })
    res.json(file)
  },
  createIcon: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const entityType = String(req.body?.entityType || "").trim()
    const entityId = String(req.body?.entityId || "").trim()
    const url = String(req.body?.url || "").trim()
    const label = req.body?.label ? String(req.body.label) : undefined
    if (!entityType || !entityId || !url) throw { status: 400, message: "بيانات الأيقونة غير مكتملة" }
    const icon = await coreService.createIcon(tenantId, { entityType, entityId, url, label, createdBy: req.user?.id })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "icon.created", entityType: "icon", entityId: icon.id })
    res.json(icon)
  },
  listIcons: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const entityType = req.query.entityType ? String(req.query.entityType) : undefined
    const entityId = req.query.entityId ? String(req.query.entityId) : undefined
    const icons = await coreService.listIcons(tenantId, { entityType, entityId })
    res.json(icons)
  },
  createNote: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const note = await coreService.createNote(tenantId, { entityType: req.body.entityType, entityId: req.body.entityId, body: req.body.body, createdBy: req.user?.id })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "note.created", entityType: "note", entityId: note.id })
    res.json(note)
  },
  createContact: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const contact = await coreService.createContact(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "contact.created", entityType: "contact", entityId: contact.id })
    res.json(contact)
  },
  exportBackup: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!tenantId) throw { status: 401, message: "Unauthorized" }
    const [users, roles, roleLinks, teams, teamMembers, leads, leadStates, conversations, participants, messages, icons, notes, contacts, finance] = await Promise.all([
      prisma.user.findMany({ where: { tenantId, deletedAt: null } }),
      prisma.role.findMany({ where: { tenantId, deletedAt: null } }),
      prisma.userRole.findMany({ where: { tenantId, revokedAt: null } }),
      prisma.team.findMany({ where: { tenantId, deletedAt: null } }),
      prisma.teamMember.findMany({ where: { tenantId, deletedAt: null } }),
      prisma.lead.findMany({ where: { tenantId, deletedAt: null } }),
      prisma.leadStateHistory.findMany({ where: { tenantId } }),
      prisma.conversation.findMany({ where: { tenantId, deletedAt: null } }),
      prisma.conversationParticipant.findMany({ where: { tenantId } }),
      prisma.message.findMany({ where: { tenantId } }),
      prisma.iconAsset.findMany({ where: { tenantId } }),
      prisma.note.findMany({ where: { tenantId } }),
      prisma.contact.findMany({ where: { tenantId } }),
      prisma.financeEntry.findMany({ where: { tenantId } }),
    ])
    const snapshot = {
      tenantId,
      createdAt: new Date().toISOString(),
      users,
      roles,
      roleLinks,
      teams,
      teamMembers,
      leads,
      leadStates,
      conversations,
      participants,
      messages,
      icons,
      notes,
      contacts,
      finance
    }
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "backup.exported", entityType: "tenant" })
    res.json(snapshot)
  },
  importBackup: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!tenantId) throw { status: 401, message: "Unauthorized" }
    const data = req.body?.snapshot || req.body
    if (!data || typeof data !== "object") throw { status: 400, message: "ملف النسخة غير صالح" }
    await prisma.$transaction(async (tx) => {
      const users = Array.isArray(data.users) ? data.users : []
      for (const u of users) {
        if (u.tenantId !== tenantId) continue
        await tx.user.upsert({
          where: { id: u.id },
          update: { email: u.email, phone: u.phone, status: u.status },
          create: { id: u.id, tenantId, email: u.email, phone: u.phone, status: u.status, passwordHash: u.passwordHash, mustChangePassword: u.mustChangePassword || false }
        })
      }
      const teams = Array.isArray(data.teams) ? data.teams : []
      for (const t of teams) {
        if (t.tenantId !== tenantId) continue
        await tx.team.upsert({
          where: { id: t.id },
          update: { name: t.name, leaderUserId: t.leaderUserId },
          create: { id: t.id, tenantId, name: t.name, leaderUserId: t.leaderUserId }
        })
      }
      const leads = Array.isArray(data.leads) ? data.leads : []
      for (const l of leads) {
        if (l.tenantId !== tenantId) continue
        await tx.lead.upsert({
          where: { id: l.id },
          update: { name: l.name, status: l.status, assignedUserId: l.assignedUserId, teamId: l.teamId, phone: l.phone, leadCode: l.leadCode },
          create: { id: l.id, tenantId, name: l.name, status: l.status, assignedUserId: l.assignedUserId, teamId: l.teamId, phone: l.phone, leadCode: l.leadCode }
        })
      }
    })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "backup.imported", entityType: "tenant" })
    res.json({ status: "ok" })
  },
  createUserRequest: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const roles = req.user?.roles || []
    const userId = req.user?.id || ""

    // Handle "create_lead" request (Sales -> Team Leader/Owner)
    if (req.body?.requestType === "create_lead") {
      if (!roles.includes("sales")) throw { status: 403, message: "غير مصرح للمبيعات فقط" }
      const payload = req.body.payload
      if (!payload || !payload.name || !payload.phone) throw { status: 400, message: "بيانات العميل غير مكتملة" }
      
      const request = await coreService.createUserRequest(tenantId, userId, "create_lead", payload)
      await logActivity({ tenantId, actorUserId: userId, action: "user_request.created", entityType: "user_request", entityId: request.id })
      res.json(request)
      return
    }

    // Existing "create_sales" request (Team Leader -> Owner)
    const name = String(req.body?.name || "").trim()
    const email = String(req.body?.email || "").trim().toLowerCase()
    const phone = req.body?.phone ? String(req.body.phone) : undefined
    
    if (!roles.includes("team_leader")) throw { status: 403, message: "غير مصرح" }
    if (!name) throw { status: 400, message: "الاسم مطلوب" }
    if (!isValidEmail(email)) throw { status: 400, message: "صيغة البريد الإلكتروني غير صحيحة" }
    const leaderTeam = await coreService.getTeamByLeader(tenantId, userId)
    if (!leaderTeam) throw { status: 400, message: "لا يوجد فريق مرتبط بهذا القائد" }
    const payload = { name, email, phone, role: "sales", teamId: leaderTeam.id }
    const request = await coreService.createUserRequest(tenantId, userId, "create_sales", payload)
    await logActivity({ tenantId, actorUserId: userId, action: "user_request.created", entityType: "user_request", entityId: request.id })
    res.json(request)
  },
  listUserRequests: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const requests = await coreService.listUserRequests(tenantId)
    const roles = req.user?.roles || []
    const userId = req.user?.id || ""

    let filteredRequests = requests;

    if (roles.includes("owner")) {
      // Owner sees all
    } else if (roles.includes("team_leader")) {
      const leaderTeam = await coreService.getTeamByLeader(tenantId, userId)
      if (leaderTeam) {
        const teamMembers = await prisma.teamMember.findMany({
          where: { tenantId, teamId: leaderTeam.id, leftAt: null, deletedAt: null },
          select: { userId: true }
        })
        const memberIds = teamMembers.map((m) => m.userId)
        filteredRequests = requests.filter((item) => memberIds.includes(item.requestedBy) || item.requestedBy === userId)
      } else {
         filteredRequests = requests.filter((item) => item.requestedBy === userId)
      }
    } else {
       filteredRequests = requests.filter((item) => item.requestedBy === userId)
    }

    let pendingRegistrations: any[] = []
    if (roles.includes("owner")) {
        pendingRegistrations = await coreService.listPendingRegistrations(tenantId)
    }

    res.json({ requests: filteredRequests, pendingRegistrations })
  },
  
  approveRegistration: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!req.user?.roles.includes("owner")) throw { status: 403, message: "غير مصرح" }
    
    const result = await coreService.approveRegistration(tenantId, req.params.userId, req.user.id)
    await logActivity({ tenantId, actorUserId: req.user.id, action: "user.registration.approved", entityType: "user", entityId: result.id })
    res.json(result)
  },

  decideUserRequest: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const roles = req.user?.roles || []
    const userId = req.user?.id || ""
    const status = String(req.body?.status || "").toLowerCase()
    
    if (!status || !["approved", "rejected"].includes(status)) throw { status: 400, message: "قرار غير صالح" }

    // Fetch request first to check permissions
    const request = await prisma.userRequest.findFirst({ where: { id: req.params.requestId, tenantId } })
    if (!request) throw { status: 404, message: "الطلب غير موجود" }

    let allowed = false

    if (roles.includes("owner")) {
      allowed = true
    } else if (roles.includes("team_leader")) {
      // Team leader can only decide on 'create_lead' requests from their team
      if (request.requestType === "create_lead") {
        const leaderTeam = await coreService.getTeamByLeader(tenantId, userId)
        if (leaderTeam) {
           const requesterMembership = await prisma.teamMember.findFirst({
             where: { tenantId, teamId: leaderTeam.id, userId: request.requestedBy, leftAt: null, deletedAt: null }
           })
           if (requesterMembership) allowed = true
        }
      }
    }

    if (!allowed) throw { status: 403, message: "غير مصرح لك باتخاذ قرار بشأن هذا الطلب" }

    let resultData: any = {}

    if (status === "approved") {
      try {
        if (request.requestType === "create_lead") {
          const payload = request.payload as any
          const phone = payload.phone ? String(payload.phone).trim() : ""
          if (!phone) throw { status: 400, message: "رقم الهاتف مطلوب" }
          
          console.log(`Processing create_lead request ${request.id} for phone ${phone}`)

          // Determine the assigned user (default to requester if not specified)
          let assignedUserId = payload.assignedUserId
          if (!assignedUserId) {
            assignedUserId = request.requestedBy
          }

          // Validate assigned user exists
          if (assignedUserId) {
            const assignedUser = await prisma.user.findFirst({ where: { id: assignedUserId, tenantId } })
            if (!assignedUser) {
              console.warn(`Assigned user ${assignedUserId} not found, falling back to requester or unassigned`)
              if (assignedUserId !== request.requestedBy) {
                  assignedUserId = request.requestedBy
              } else {
                  assignedUserId = undefined 
              }
            }
          }

          // Check for existing lead first to avoid Unique Constraint errors
          let lead = await prisma.lead.findFirst({
              where: { tenantId, phone }
          })

          if (lead) {
               // Restore and Update
               console.log(`Lead found for phone ${phone}, updating...`)
               const stages = await lifecycleService.ensureDefaultStages(tenantId)
               const callStage = stages.find((stage) => stage.code === "call")
               const defaultStatus = callStage?.code || "call"
               
               lead = await prisma.lead.update({
                   where: { id: lead.id },
                   data: {
                       deletedAt: null,
                       name: payload.name,
                       email: payload.email || lead.email,
                       status: defaultStatus,
                       assignedUserId: assignedUserId || lead.assignedUserId,
                       teamId: payload.teamId || lead.teamId
                   }
               })
               
               // Add history entry for the reactivation/status reset
               const state = await lifecycleService.getStateByCode(tenantId, defaultStatus)
               if (state) {
                   await prisma.leadStateHistory.create({
                       data: { tenantId, leadId: lead.id, toStateId: state.id, changedBy: userId }
                   })
               }
          } else {
              // Create New
              console.log(`Creating new lead for phone ${phone}`)
              const createPayload = {
                  leadCode: payload.leadCode || `L-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                  name: payload.name || "Unknown Client",
                  phone: phone,
                  email: payload.email,
                  assignedUserId: assignedUserId,
                  // Safely map numeric fields
                  budget: payload.budget ? Number(payload.budget) : undefined,
                  budgetMin: payload.budgetMin ? Number(payload.budgetMin) : undefined,
                  budgetMax: payload.budgetMax ? Number(payload.budgetMax) : undefined,
                  // Map other fields
                  areaOfInterest: payload.areaOfInterest,
                  sourceLabel: payload.sourceLabel,
                  sourceId: payload.sourceId,
                  status: payload.status,
                  priority: payload.priority,
                  desiredLocation: payload.desiredLocation,
                  propertyType: payload.propertyType,
                  profession: payload.profession,
                  notes: payload.notes,
                  teamId: payload.teamId
              }
              
              // Validate numeric fields are valid numbers (not NaN)
              if (createPayload.budget && isNaN(createPayload.budget)) createPayload.budget = undefined;
              if (createPayload.budgetMin && isNaN(createPayload.budgetMin)) createPayload.budgetMin = undefined;
              if (createPayload.budgetMax && isNaN(createPayload.budgetMax)) createPayload.budgetMax = undefined;

              lead = await leadService.createLead(tenantId, createPayload)
          }

          if (assignedUserId && lead) {
                // Ensure assignment is recorded/updated
                if (lead.assignedUserId !== assignedUserId) {
                   await leadService.assignLead(tenantId, lead.id, assignedUserId, userId, "Approved Request", payload.teamId)
                } else {
                   // Even if assigned, ensure history is created if createLead didn't do it (createLead doesn't create LeadAssignment)
                   const assignment = await prisma.leadAssignment.findFirst({ where: { leadId: lead.id, releasedAt: null } })
                   if (!assignment) {
                      await leadService.assignLead(tenantId, lead.id, assignedUserId, userId, "Approved Request", payload.teamId)
                   }
                }
          }
          if (lead) {
              await logActivity({ tenantId, actorUserId: userId, action: "lead.created", entityType: "lead", entityId: lead.id, metadata: { approvedRequestId: request.id, isDuplicateResolved: true } })
              resultData = { createdLead: lead }
          }
        }
      } catch (error: any) {
        console.error("Error approving request (DETAILS):", JSON.stringify(error, Object.getOwnPropertyNames(error)), error.stack)
        throw { status: 500, message: error.message || "حدث خطأ أثناء تنفيذ الطلب" }
      }
    }

    const updatedRequest = await coreService.decideUserRequest(tenantId, req.params.requestId, { status, decidedBy: userId })
    res.json({ request: updatedRequest, ...resultData })
  },
  createFinanceEntry: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const entryType = String(req.body?.entryType || "").toLowerCase()
    const category = String(req.body?.category || "").trim()
    const amount = Number(req.body?.amount)
    const occurredAt = req.body?.occurredAt ? new Date(req.body.occurredAt) : new Date()
    if (!entryType || !["income", "expense"].includes(entryType)) throw { status: 400, message: "نوع العملية غير صالح" }
    if (!category) throw { status: 400, message: "التصنيف مطلوب" }
    if (!Number.isFinite(amount) || amount <= 0) throw { status: 400, message: "القيمة غير صحيحة" }
    const entry = await coreService.createFinanceEntry(tenantId, { entryType, category, amount, note: req.body?.note ? String(req.body.note) : undefined, occurredAt, createdBy: req.user?.id })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "finance.entry.created", entityType: "finance_entry", entityId: entry.id })
    res.json(entry)
  },
  listFinanceEntries: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const entries = await coreService.listFinanceEntries(tenantId)
    res.json(entries)
  },
  listContacts: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const contacts = await coreService.listContacts(tenantId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "contact.listed", entityType: "contact" })
    res.json(contacts)
  },




}
