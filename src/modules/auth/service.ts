import jwt from "jsonwebtoken"
import { prisma } from "../../prisma/client"
import { env } from "../../config/env"
import { Prisma } from "@prisma/client"
import { hashPassword, verifyPassword } from "./password"
import { seedRbacForTenant } from "./rbacSeed"
import { cache } from "../../utils/cache"

type AuthUser = { id: string; tenantId: string; roles: string[]; forceReset?: boolean }
type AuthResult = { token: string; user: AuthUser }

const assertJwtConfigured = () => {
  if (!env.jwtSecret) {
    throw { status: 500, message: "Server misconfigured" }
  }
}

const issueToken = (user: AuthUser) => {
  assertJwtConfigured()
  return jwt.sign(user, env.jwtSecret, { expiresIn: "7d" })
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const ensureDefaultRoles = async (tenantId: string) => {
  const roleNames = ["owner", "team_leader", "sales"]
  const existing = await prisma.role.findMany({ where: { tenantId, name: { in: roleNames }, deletedAt: null } })
  const byName = new Map(existing.map((role) => [role.name, role]))
  const results = [] as Array<{ id: string; name: string }>
  for (const name of roleNames) {
    const found = byName.get(name)
    if (found) {
      results.push({ id: found.id, name: found.name })
      continue
    }
    const created = await prisma.role.create({ data: { tenantId, name, scope: "tenant" } })
    results.push({ id: created.id, name: created.name })
  }
  return results
}

const getRolesForUser = async (tenantId: string, userId: string) => {
  const cacheKey = `auth:roles:${tenantId}:${userId}`
  const cached = await cache.get(cacheKey)
  if (cached) return cached

  const roleLinks = await prisma.userRole.findMany({
    where: { tenantId, userId, revokedAt: null },
    include: { role: true }
  })
  const roles = roleLinks.length ? roleLinks.map((link) => link.role.name) : ["sales"]
  
  // Cache for 10 minutes to reduce DB load during login bursts
  await cache.set(cacheKey, roles, 600)
  return roles
}

export const authService = {
  getSetupStatus: async () => {
    const tenant = await prisma.tenant.findFirst({ where: { deletedAt: null } })
    if (!tenant) return { hasOwner: false }
    
    // Find owner
    const ownerRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: "owner" } })
    if (!ownerRole) return { hasOwner: false }
    
    const ownerLink = await prisma.userRole.findFirst({ where: { tenantId: tenant.id, roleId: ownerRole.id } })
    if (!ownerLink) return { hasOwner: false }
    
    const owner = await prisma.user.findUnique({ where: { id: ownerLink.userId } })
    return { 
      hasOwner: true, 
      ownerName: "المالك", // We could fetch profile name if needed
      ownerPhone: owner?.phone,
      tenantName: tenant.name
    }
  },

  login: async (input: { email: string; password: string }): Promise<AuthResult> => {
    const email = normalizeEmail(input.email)
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null, status: "active" }
    })
    if (!user) throw { status: 401, message: "بيانات الدخول غير صحيحة" }
    const ok = await verifyPassword(input.password, user.passwordHash)
    if (!ok) throw { status: 401, message: "بيانات الدخول غير صحيحة" }

    // Run role fetching and last login update in parallel for speed
    const [roles] = await Promise.all([
      getRolesForUser(user.tenantId, user.id),
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      })
    ])

    const authUser: AuthUser = user.mustChangePassword ? { id: user.id, tenantId: user.tenantId, roles, forceReset: true } : { id: user.id, tenantId: user.tenantId, roles }
    return { token: issueToken(authUser), user: authUser }
  },

  register: async (input: { tenantName: string; timezone?: string; email: string; password: string; phone?: string; role?: string; teamName?: string }): Promise<AuthResult & { isPending?: boolean; ownerPhone?: string }> => {
    const email = normalizeEmail(input.email)
    try {
      const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } })
      if (existing) throw { status: 409, message: "البريد الإلكتروني مستخدم بالفعل" }

      // Check if system is already initialized (has an owner)
      const setupStatus = await authService.getSetupStatus()
      
      if (setupStatus.hasOwner) {
         // Join Request Mode
         const tenant = await prisma.tenant.findFirst({ where: { name: setupStatus.tenantName } })
         if (!tenant) throw { status: 500, message: "System Error: Tenant not found" }

         const passwordHash = await hashPassword(input.password)
         
         // Create INACTIVE user
         const user = await prisma.user.create({
           data: {
             tenantId: tenant.id,
             email,
             phone: input.phone,
             passwordHash,
             mustChangePassword: false, // Will set to true on approval if needed
             status: "inactive",
             lastLoginAt: null
           }
         })

         // Assign Requested Role (but user is inactive so effectively no access)
         const requestedRole = input.role === "team_leader" ? "team_leader" : "sales"
         const roles = await ensureDefaultRoles(tenant.id)
         const roleObj = roles.find(r => r.name === requestedRole)
         
         if (roleObj) {
           await prisma.userRole.create({ data: { tenantId: tenant.id, userId: user.id, roleId: roleObj.id } })
         }

         // Create Profile
         await prisma.userProfile.create({
            data: {
                tenantId: tenant.id,
                userId: user.id,
                firstName: input.email.split("@")[0], // Default name
            }
         })

         // If Team Leader and Team Name provided, store it temporarily?
         // We can use `UserRequest` logic later, or just put it in a Note for the owner.
         if (input.teamName && requestedRole === "team_leader") {
            await prisma.note.create({
                data: {
                    tenantId: tenant.id,
                    content: `Requested Team Name: ${input.teamName}`,
                    relatedTo: "user_request",
                    relatedId: user.id
                }
            })
         }

         return { 
             token: "", 
             user: { id: user.id, tenantId: tenant.id, roles: [requestedRole] }, 
             isPending: true,
             ownerPhone: setupStatus.ownerPhone || undefined
         }
      }

      // First Time Setup (Owner Mode)
      const tenant = await prisma.tenant.create({
        data: {
          name: input.tenantName.trim(),
          timezone: input.timezone || "UTC",
          status: "active"
        }
      })

      const passwordHash = await hashPassword(input.password)
      const user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email,
          phone: input.phone,
          passwordHash,
          mustChangePassword: false,
          status: "active",
          lastLoginAt: new Date()
        }
      })

      const roles = await ensureDefaultRoles(tenant.id)
      const ownerRole = roles.find((role) => role.name === "owner")
      if (ownerRole) {
        await prisma.userRole.create({ data: { tenantId: tenant.id, userId: user.id, roleId: ownerRole.id } })
      }
      await seedRbacForTenant(tenant.id)

      const authUser: AuthUser = { id: user.id, tenantId: user.tenantId, roles: ["owner"] }
      return { token: issueToken(authUser), user: authUser }
    } catch (err) {
      const fs = require('fs');
      fs.writeFileSync('register_error.log', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      console.error("Registration error:", err);

      if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
        throw { status: 409, message: "البريد الإلكتروني مستخدم بالفعل" }
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw { status: 409, message: "البريد الإلكتروني مستخدم بالفعل" }
      }
      throw err
    }
  },

  changePassword: async (authUser: AuthUser | undefined | null, input: { currentPassword: string; newPassword: string }): Promise<AuthResult> => {
    if (!authUser) throw { status: 401, message: "Unauthorized" }
    const user = await prisma.user.findFirst({
      where: { id: authUser.id, tenantId: authUser.tenantId, deletedAt: null, status: "active" }
    })
    if (!user) throw { status: 401, message: "Unauthorized" }
    const ok = await verifyPassword(input.currentPassword, user.passwordHash)
    if (!ok) throw { status: 400, message: "كلمة المرور الحالية غير صحيحة. إذا كنت مسجلاً من جلسة قديمة بعد تغيير كلمة المرور، قم بتسجيل الخروج ثم تسجيل الدخول بكلمة المرور الأخيرة." }

    const passwordHash = await hashPassword(input.newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false }
    })

    const roles = await getRolesForUser(user.tenantId, user.id)
    const freshUser: AuthUser = { id: user.id, tenantId: user.tenantId, roles }
    return { token: issueToken(freshUser), user: freshUser }
  },
  updateProfile: async (authUser: AuthUser | undefined | null, input: { currentPassword: string; email?: string; phone?: string }) => {
    if (!authUser) throw { status: 401, message: "Unauthorized" }
    const user = await prisma.user.findFirst({ where: { id: authUser.id, tenantId: authUser.tenantId, deletedAt: null, status: "active" } })
    if (!user) throw { status: 401, message: "Unauthorized" }
    const ok = await verifyPassword(input.currentPassword, user.passwordHash)
    if (!ok) throw { status: 400, message: "كلمة المرور الحالية غير صحيحة. إذا كنت مسجلاً من جلسة قديمة بعد تغيير كلمة المرور، قم بتسجيل الخروج ثم تسجيل الدخول بكلمة المرور الأخيرة." }
    if (input.email) {
      const normalized = normalizeEmail(input.email)
      const exists = await prisma.user.findFirst({ where: { email: normalized, id: { not: user.id }, deletedAt: null } })
      if (exists) throw { status: 409, message: "البريد الإلكتروني مستخدم بالفعل" }
      await prisma.user.update({ where: { id: user.id }, data: { email: normalized } })
    }
    if (input.phone !== undefined) {
      await prisma.user.update({ where: { id: user.id }, data: { phone: input.phone } })
    }
    return { status: "ok" }
  },

  updateCredentials: async (
    authUser: AuthUser | undefined | null,
    input: { currentPassword: string; email?: string; phone?: string; newPassword?: string }
  ): Promise<AuthResult & { status?: string }> => {
    if (!authUser) throw { status: 401, message: "Unauthorized" }

    const user = await prisma.user.findFirst({
      where: { id: authUser.id, tenantId: authUser.tenantId, deletedAt: null, status: "active" }
    })
    if (!user) throw { status: 401, message: "Unauthorized" }

    const ok = await verifyPassword(input.currentPassword, user.passwordHash)
    if (!ok) throw { status: 400, message: "كلمة المرور الحالية غير صحيحة. إذا كنت مسجلاً من جلسة قديمة بعد تغيير كلمة المرور، قم بتسجيل الخروج ثم تسجيل الدخول بكلمة المرور الأخيرة." }

    const nextEmail = input.email ? normalizeEmail(input.email) : undefined
    if (nextEmail) {
      const exists = await prisma.user.findFirst({ where: { email: nextEmail, id: { not: user.id }, deletedAt: null } })
      if (exists) throw { status: 409, message: "البريد الإلكتروني مستخدم بالفعل" }
    }

    const nextPasswordHash = input.newPassword ? await hashPassword(input.newPassword) : undefined

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          ...(nextEmail ? { email: nextEmail } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(nextPasswordHash ? { passwordHash: nextPasswordHash, mustChangePassword: false } : {})
        }
      })
    })

    const roles = await getRolesForUser(user.tenantId, user.id)
    const freshUser: AuthUser = { id: user.id, tenantId: user.tenantId, roles }
    return { token: issueToken(freshUser), user: freshUser }
  },

  me: async (user: AuthUser | undefined | null) => {
    if (!user) throw { status: 401, message: "Unauthorized" }
    return user
  }
}
