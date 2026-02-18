import jwt from "jsonwebtoken"
import { prisma } from "../../prisma/client"
import { env } from "../../config/env"
import { Prisma } from "@prisma/client"
import { hashPassword, verifyPassword } from "./password"
import { seedRbacForTenant } from "./rbacSeed"

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
  const roleLinks = await prisma.userRole.findMany({
    where: { tenantId, userId, revokedAt: null },
    include: { role: true }
  })
  return roleLinks.length ? roleLinks.map((link) => link.role.name) : ["sales"]
}

export const authService = {
  login: async (input: { email: string; password: string }): Promise<AuthResult> => {
    const email = normalizeEmail(input.email)
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null, status: "active" }
    })
    if (!user) throw { status: 401, message: "بيانات الدخول غير صحيحة" }
    const ok = await verifyPassword(input.password, user.passwordHash)
    if (!ok) throw { status: 401, message: "بيانات الدخول غير صحيحة" }

    const roles = await getRolesForUser(user.tenantId, user.id)

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    const authUser: AuthUser = user.mustChangePassword ? { id: user.id, tenantId: user.tenantId, roles, forceReset: true } : { id: user.id, tenantId: user.tenantId, roles }
    return { token: issueToken(authUser), user: authUser }
  },

  register: async (input: { tenantName: string; timezone?: string; email: string; password: string; phone?: string }): Promise<AuthResult> => {
    const email = normalizeEmail(input.email)
    try {
      const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } })
      if (existing) throw { status: 409, message: "البريد الإلكتروني مستخدم بالفعل" }

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
    if (!ok) throw { status: 401, message: "كلمة المرور الحالية غير صحيحة" }

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
    if (!ok) throw { status: 401, message: "كلمة المرور الحالية غير صحيحة" }
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

  me: async (user: AuthUser | undefined | null) => {
    if (!user) throw { status: 401, message: "Unauthorized" }
    return user
  }
}
