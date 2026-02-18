"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const forceReset_1 = require("./forceReset");
(0, vitest_1.describe)("forceResetMiddleware", () => {
    (0, vitest_1.it)("blocks access when user.forceReset is true", () => {
        const req = { user: { id: "u1", tenantId: "t1", roles: ["sales"], forceReset: true }, path: "/api/leads" };
        const res = { status: vitest_1.vi.fn().mockReturnThis(), json: vitest_1.vi.fn().mockReturnThis() };
        const next = vitest_1.vi.fn();
        (0, forceReset_1.forceResetMiddleware)(req, res, next);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(403);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({ error: "يجب تغيير كلمة المرور أولاً" });
        (0, vitest_1.expect)(next).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("allows access to change-password path when user.forceReset is true", () => {
        const req = { user: { id: "u1", tenantId: "t1", roles: ["sales"], forceReset: true }, path: "/api/auth/change-password" };
        const res = { status: vitest_1.vi.fn().mockReturnThis(), json: vitest_1.vi.fn().mockReturnThis() };
        const next = vitest_1.vi.fn();
        (0, forceReset_1.forceResetMiddleware)(req, res, next);
        (0, vitest_1.expect)(next).toHaveBeenCalled();
    });
    (0, vitest_1.it)("allows access when user.forceReset is false", () => {
        const req = { user: { id: "u1", tenantId: "t1", roles: ["sales"] }, path: "/api/leads" };
        const res = { status: vitest_1.vi.fn().mockReturnThis(), json: vitest_1.vi.fn().mockReturnThis() };
        const next = vitest_1.vi.fn();
        (0, forceReset_1.forceResetMiddleware)(req, res, next);
        (0, vitest_1.expect)(next).toHaveBeenCalled();
    });
});
