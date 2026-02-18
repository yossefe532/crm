"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("../../prisma/client");
const env_1 = require("../../config/env");
const client_2 = require("@prisma/client");
const password_1 = require("./password");
const rbacSeed_1 = require("./rbacSeed");
const assertJwtConfigured = () => {
    if (!env_1.env.jwtSecret) {
        throw { status: 500, message: "Server misconfigured" };
    }
};
const issueToken = (user) => {
    assertJwtConfigured();
    return jsonwebtoken_1.default.sign(user, env_1.env.jwtSecret, { expiresIn: "7d" });
};
const normalizeEmail = (email) => email.trim().toLowerCase();
const ensureDefaultRoles = async (tenantId) => {
    const roleNames = ["owner", "team_leader", "sales"];
    const existing = await client_1.prisma.role.findMany({ where: { tenantId, name: { in: roleNames }, deletedAt: null } });
    const byName = new Map(existing.map((role) => [role.name, role]));
    const results = [];
    for (const name of roleNames) {
        const found = byName.get(name);
        if (found) {
            results.push({ id: found.id, name: found.name });
            continue;
        }
        const created = await client_1.prisma.role.create({ data: { tenantId, name, scope: "tenant" } });
        results.push({ id: created.id, name: created.name });
    }
    return results;
};
const getRolesForUser = async (tenantId, userId) => {
    const roleLinks = await client_1.prisma.userRole.findMany({
        where: { tenantId, userId, revokedAt: null },
        include: { role: true }
    });
    return roleLinks.length ? roleLinks.map((link) => link.role.name) : ["sales"];
};
exports.authService = {
    login: async (input) => {
        const email = normalizeEmail(input.email);
        const user = await client_1.prisma.user.findFirst({
            where: { email, deletedAt: null, status: "active" }
        });
        if (!user)
            throw { status: 401, message: "بيانات الدخول غير صحيحة" };
        const ok = await (0, password_1.verifyPassword)(input.password, user.passwordHash);
        if (!ok)
            throw { status: 401, message: "بيانات الدخول غير صحيحة" };
        const roles = await getRolesForUser(user.tenantId, user.id);
        await client_1.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        });
        const authUser = user.mustChangePassword ? { id: user.id, tenantId: user.tenantId, roles, forceReset: true } : { id: user.id, tenantId: user.tenantId, roles };
        return { token: issueToken(authUser), user: authUser };
    },
    register: async (input) => {
        const email = normalizeEmail(input.email);
        try {
            const existing = await client_1.prisma.user.findFirst({ where: { email, deletedAt: null } });
            if (existing)
                throw { status: 409, message: "البريد الإلكتروني مستخدم بالفعل" };
            const tenant = await client_1.prisma.tenant.create({
                data: {
                    name: input.tenantName.trim(),
                    timezone: input.timezone || "UTC",
                    status: "active"
                }
            });
            const passwordHash = await (0, password_1.hashPassword)(input.password);
            const user = await client_1.prisma.user.create({
                data: {
                    tenantId: tenant.id,
                    email,
                    phone: input.phone,
                    passwordHash,
                    mustChangePassword: false,
                    status: "active",
                    lastLoginAt: new Date()
                }
            });
            const roles = await ensureDefaultRoles(tenant.id);
            const ownerRole = roles.find((role) => role.name === "owner");
            if (ownerRole) {
                await client_1.prisma.userRole.create({ data: { tenantId: tenant.id, userId: user.id, roleId: ownerRole.id } });
            }
            await (0, rbacSeed_1.seedRbacForTenant)(tenant.id);
            const authUser = { id: user.id, tenantId: user.tenantId, roles: ["owner"] };
            return { token: issueToken(authUser), user: authUser };
        }
        catch (err) {
            if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
                throw { status: 409, message: "البريد الإلكتروني مستخدم بالفعل" };
            }
            if (err instanceof client_2.Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
                throw { status: 409, message: "البريد الإلكتروني مستخدم بالفعل" };
            }
            throw err;
        }
    },
    changePassword: async (authUser, input) => {
        if (!authUser)
            throw { status: 401, message: "Unauthorized" };
        const user = await client_1.prisma.user.findFirst({
            where: { id: authUser.id, tenantId: authUser.tenantId, deletedAt: null, status: "active" }
        });
        if (!user)
            throw { status: 401, message: "Unauthorized" };
        const ok = await (0, password_1.verifyPassword)(input.currentPassword, user.passwordHash);
        if (!ok)
            throw { status: 401, message: "كلمة المرور الحالية غير صحيحة" };
        const passwordHash = await (0, password_1.hashPassword)(input.newPassword);
        await client_1.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash, mustChangePassword: false }
        });
        const roles = await getRolesForUser(user.tenantId, user.id);
        const freshUser = { id: user.id, tenantId: user.tenantId, roles };
        return { token: issueToken(freshUser), user: freshUser };
    },
    updateProfile: async (authUser, input) => {
        if (!authUser)
            throw { status: 401, message: "Unauthorized" };
        const user = await client_1.prisma.user.findFirst({ where: { id: authUser.id, tenantId: authUser.tenantId, deletedAt: null, status: "active" } });
        if (!user)
            throw { status: 401, message: "Unauthorized" };
        const ok = await (0, password_1.verifyPassword)(input.currentPassword, user.passwordHash);
        if (!ok)
            throw { status: 401, message: "كلمة المرور الحالية غير صحيحة" };
        if (input.email) {
            const normalized = normalizeEmail(input.email);
            const exists = await client_1.prisma.user.findFirst({ where: { email: normalized, id: { not: user.id }, deletedAt: null } });
            if (exists)
                throw { status: 409, message: "البريد الإلكتروني مستخدم بالفعل" };
            await client_1.prisma.user.update({ where: { id: user.id }, data: { email: normalized } });
        }
        if (input.phone !== undefined) {
            await client_1.prisma.user.update({ where: { id: user.id }, data: { phone: input.phone } });
        }
        return { status: "ok" };
    },
    me: async (user) => {
        if (!user)
            throw { status: 401, message: "Unauthorized" };
        return user;
    }
};
