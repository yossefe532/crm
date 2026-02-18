"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignLeadSchema = exports.updateLeadSchema = exports.createLeadSchema = void 0;
const zod_1 = require("zod");
exports.createLeadSchema = zod_1.z.object({
    leadCode: zod_1.z.string().optional(),
    name: zod_1.z.string().min(1, "Name is required"),
    phone: zod_1.z.string().min(8, "Phone number is too short"),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal("")),
    sourceId: zod_1.z.string().uuid().optional(),
    priority: zod_1.z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
    budget: zod_1.z.number().min(0).optional(),
    budgetMin: zod_1.z.number().min(0).optional(),
    budgetMax: zod_1.z.number().min(0).optional(),
    propertyType: zod_1.z.string().optional(),
    areaOfInterest: zod_1.z.string().optional(),
    desiredLocation: zod_1.z.string().optional(),
    assignedUserId: zod_1.z.string().uuid().optional(),
    teamId: zod_1.z.string().uuid().optional()
});
exports.updateLeadSchema = exports.createLeadSchema.partial().extend({
    status: zod_1.z.string().optional(),
    assignedUserId: zod_1.z.string().uuid().optional(),
    teamId: zod_1.z.string().uuid().optional()
});
exports.assignLeadSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    teamId: zod_1.z.string().uuid().optional()
});
