"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireOwner = exports.requirePermission = void 0;
const client_1 = require("../prisma/client");
const requirePermission = (permissionCode) => {
    return async (req, res, next) => {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: "Unauthorized" });
        if (user.roles.includes("owner"))
            return next();
        // Check direct permissions
        let directPermissions = [];
        try {
            directPermissions = await client_1.prisma.userPermission.findMany({
                where: { userId: user.id, tenantId: user.tenantId },
                include: { permission: true }
            });
        }
        catch (error) {
            if (error?.code !== "P2021")
                throw error;
        }
        if (directPermissions.some(p => p.permission.code === permissionCode))
            return next();
        // Check role permissions
        const roleLinks = await client_1.prisma.userRole.findMany({
            where: { userId: user.id, tenantId: user.tenantId, revokedAt: null },
            include: { role: { include: { permissions: { include: { permission: true } } } } }
        });
        const permissions = new Set(roleLinks.flatMap((link) => link.role.permissions.map((p) => p.permission.code)));
        if (!permissions.has(permissionCode)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        return next();
    };
};
exports.requirePermission = requirePermission;
const requireOwner = (req, res, next) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: "Unauthorized" });
    if (user.roles.includes("owner"))
        return next();
    return res.status(403).json({ error: "غير مصرح" });
};
exports.requireOwner = requireOwner;
