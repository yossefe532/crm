"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const auth_1 = require("../utils/auth");
const client_1 = require("../prisma/client");
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    const payload = (0, auth_1.parseAuthToken)(token);
    if (payload) {
        ;
        req.user = payload;
        const user = await client_1.prisma.user.findFirst({ where: { tenantId: payload.tenantId, id: payload.id } });
        if (!user || user.status !== "active") {
            const allowPaths = req.path.startsWith("/api/leads/failures");
            if (!allowPaths) {
                return res.status(403).json({ error: "الحساب موقوف مؤقتًا" });
            }
        }
        return next();
    }
    if (process.env.NODE_ENV === "production") {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const fallbackUserId = req.headers["x-user-id"];
    const fallbackTenantId = req.headers["x-tenant-id"];
    const fallbackRoles = req.headers["x-roles"]?.split(",").filter(Boolean) || [];
    if (fallbackUserId && fallbackTenantId) {
        const user = { id: fallbackUserId, tenantId: fallbackTenantId, roles: fallbackRoles };
        ;
        req.user = user;
        const existing = await client_1.prisma.user.findFirst({ where: { tenantId: fallbackTenantId, id: fallbackUserId } });
        if (!existing || existing.status !== "active") {
            const allowPaths = req.path.startsWith("/api/leads/failures");
            if (!allowPaths) {
                return res.status(403).json({ error: "الحساب موقوف مؤقتًا" });
            }
        }
        return next();
    }
    res.status(401).json({ error: "Unauthorized" });
};
exports.authMiddleware = authMiddleware;
