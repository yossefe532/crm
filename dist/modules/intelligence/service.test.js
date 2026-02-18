"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const service_1 = require("./service");
vitest_1.vi.mock("../../prisma/client", () => {
    const prisma = {
        lead: { findFirst: vitest_1.vi.fn(), count: vitest_1.vi.fn(), findMany: vitest_1.vi.fn() },
        deal: { count: vitest_1.vi.fn(), findMany: vitest_1.vi.fn(), findFirst: vitest_1.vi.fn() },
        leadScore: { create: vitest_1.vi.fn() },
        disciplineIndexSnapshot: { create: vitest_1.vi.fn() },
        riskScore: { create: vitest_1.vi.fn() },
        rankingSnapshot: { create: vitest_1.vi.fn() },
        leadActivityLog: { create: vitest_1.vi.fn(), findMany: vitest_1.vi.fn() },
        callLog: { findMany: vitest_1.vi.fn() },
        meeting: { findMany: vitest_1.vi.fn() },
        leadTask: { findMany: vitest_1.vi.fn() },
        leadDeadline: { findMany: vitest_1.vi.fn() },
        meetingRescheduleRequest: { findMany: vitest_1.vi.fn() },
        user: { findMany: vitest_1.vi.fn() }
    };
    return { prisma };
});
vitest_1.vi.mock("../../utils/moduleConfig", () => ({
    getModuleConfig: vitest_1.vi.fn().mockResolvedValue(null)
}));
vitest_1.vi.mock("../../utils/activity", () => ({
    logActivity: vitest_1.vi.fn().mockResolvedValue(null)
}));
(0, vitest_1.describe)("intelligence service", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("scores a lead with mocked data", async () => {
        const { prisma } = (await Promise.resolve().then(() => __importStar(require("../../prisma/client"))));
        prisma.lead.findFirst.mockResolvedValue({
            id: "lead-1",
            tenantId: "tenant-1",
            budgetMin: null,
            budgetMax: { toNumber: () => 800000 },
            propertyType: "residential",
            desiredLocation: "downtown",
            tags: [{ tag: { name: "enterprise" } }],
            tasks: [],
            callLogs: [],
            meetings: [],
            stateHistory: [],
            activities: [],
            extensions: [],
            sourceId: null
        });
        prisma.lead.count.mockResolvedValue(10);
        prisma.deal.count.mockResolvedValue(2);
        prisma.leadScore.create.mockResolvedValue({ id: "score-1" });
        const result = await service_1.intelligenceService.scoreLead("tenant-1", "lead-1");
        (0, vitest_1.expect)(result.id).toBe("score-1");
    });
    (0, vitest_1.it)("computes reminder priorities", async () => {
        const { prisma } = (await Promise.resolve().then(() => __importStar(require("../../prisma/client"))));
        prisma.leadTask.findMany.mockResolvedValue([
            { leadId: "lead-1", assignedUserId: "user-1", dueAt: new Date(), lead: { deals: [{ dealValue: { toNumber: () => 300000 } }] } }
        ]);
        prisma.leadDeadline.findMany.mockResolvedValue([]);
        prisma.rankingSnapshot.create.mockResolvedValue({ id: "rank-1" });
        const result = await service_1.intelligenceService.computeReminderPriorities("tenant-1");
        (0, vitest_1.expect)(result.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)("computes performance ranking", async () => {
        const { prisma } = (await Promise.resolve().then(() => __importStar(require("../../prisma/client"))));
        prisma.user.findMany.mockResolvedValue([{ id: "user-1" }]);
        prisma.lead.findMany.mockResolvedValue([{ id: "lead-1", assignedUserId: "user-1", createdAt: new Date(), updatedAt: new Date() }]);
        prisma.deal.findMany.mockResolvedValue([{ leadId: "lead-1", status: "closed", dealValue: { toNumber: () => 500000 }, createdAt: new Date() }]);
        prisma.callLog.findMany.mockResolvedValue([]);
        prisma.meeting.findMany.mockResolvedValue([]);
        prisma.meetingRescheduleRequest.findMany.mockResolvedValue([]);
        prisma.rankingSnapshot.create.mockResolvedValue({ id: "rank-2" });
        const rows = await service_1.intelligenceService.computePerformanceRanking("tenant-1");
        (0, vitest_1.expect)(rows[0].subjectId).toBe("user-1");
    });
});
