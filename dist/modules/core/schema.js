"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = exports.createUserSchema = void 0;
const zod_1 = require("zod");
exports.createUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "الاسم مطلوب"),
    email: zod_1.z.string().email("صيغة البريد الإلكتروني غير صحيحة"),
    phone: zod_1.z.string().optional().or(zod_1.z.literal("")),
    password: zod_1.z.string().optional(),
    role: zod_1.z.enum(["team_leader", "sales"], { message: "نوع الدور غير صالح" }),
    teamId: zod_1.z.string().uuid().optional(),
    teamName: zod_1.z.string().optional()
});
exports.updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    email: zod_1.z.string().email("صيغة البريد الإلكتروني غير صحيحة").optional(),
    phone: zod_1.z.string().optional().or(zod_1.z.literal("")),
    status: zod_1.z.string().optional()
});
