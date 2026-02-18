"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const zod_1 = require("zod");
const validate_1 = require("./validate");
(0, vitest_1.describe)("validate middleware", () => {
    (0, vitest_1.it)("returns structured Arabic validation errors", () => {
        const schema = zod_1.z.object({ email: zod_1.z.string().email("صيغة البريد الإلكتروني غير صحيحة") });
        const handler = (0, validate_1.validate)(schema);
        const req = { body: { email: "not-an-email" } };
        const res = { status: vitest_1.vi.fn().mockReturnThis(), json: vitest_1.vi.fn().mockReturnThis() };
        const next = vitest_1.vi.fn();
        handler(req, res, next);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(400);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            error: "خطأ في التحقق من البيانات",
            message: "صيغة البريد الإلكتروني غير صحيحة",
            details: [{ path: "email", message: "صيغة البريد الإلكتروني غير صحيحة" }]
        }));
        (0, vitest_1.expect)(next).not.toHaveBeenCalled();
    });
});
