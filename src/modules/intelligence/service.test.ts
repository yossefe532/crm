import { describe, expect, it, vi, beforeEach } from "vitest"
import { intelligenceService } from "./service"

vi.mock("../../prisma/client", () => {
  const prisma = {
    lead: { findFirst: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    deal: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    leadScore: { create: vi.fn() },
    disciplineIndexSnapshot: { create: vi.fn() },
    riskScore: { create: vi.fn() },
    rankingSnapshot: { create: vi.fn() },
    leadActivityLog: { create: vi.fn(), findMany: vi.fn() },
    callLog: { findMany: vi.fn() },
    meeting: { findMany: vi.fn() },
    leadTask: { findMany: vi.fn() },
    leadDeadline: { findMany: vi.fn() },
    meetingRescheduleRequest: { findMany: vi.fn() },
    user: { findMany: vi.fn() }
  }
  return { prisma }
})

vi.mock("../../utils/moduleConfig", () => ({
  getModuleConfig: vi.fn().mockResolvedValue(null)
}))

vi.mock("../../utils/activity", () => ({
  logActivity: vi.fn().mockResolvedValue(null)
}))

describe("intelligence service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("scores a lead with mocked data", async () => {
    const { prisma } = (await import("../../prisma/client")) as any
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
    })
    prisma.lead.count.mockResolvedValue(10)
    prisma.deal.count.mockResolvedValue(2)
    prisma.leadScore.create.mockResolvedValue({ id: "score-1" })
    const result = await intelligenceService.scoreLead("tenant-1", "lead-1")
    expect(result.id).toBe("score-1")
  })

  it("computes reminder priorities", async () => {
    const { prisma } = (await import("../../prisma/client")) as any
    prisma.leadTask.findMany.mockResolvedValue([
      { leadId: "lead-1", assignedUserId: "user-1", dueAt: new Date(), lead: { deals: [{ price: { toNumber: () => 300000 } }] } }
    ])
    prisma.leadDeadline.findMany.mockResolvedValue([])
    prisma.rankingSnapshot.create.mockResolvedValue({ id: "rank-1" })
    const result = await intelligenceService.computeReminderPriorities("tenant-1")
    expect(result.length).toBeGreaterThan(0)
  })

  it("computes performance ranking", async () => {
    const { prisma } = (await import("../../prisma/client")) as any
    prisma.user.findMany.mockResolvedValue([{ id: "user-1" }])
    prisma.lead.findMany.mockResolvedValue([{ id: "lead-1", assignedUserId: "user-1", createdAt: new Date(), updatedAt: new Date() }])
    prisma.deal.findMany.mockResolvedValue([{ leadId: "lead-1", status: "closed", price: { toNumber: () => 500000 }, createdAt: new Date() }])
    prisma.callLog.findMany.mockResolvedValue([])
    prisma.meeting.findMany.mockResolvedValue([])
    prisma.meetingRescheduleRequest.findMany.mockResolvedValue([])
    prisma.rankingSnapshot.create.mockResolvedValue({ id: "rank-2" })
    const rows = await intelligenceService.computePerformanceRanking("tenant-1")
    expect(rows[0].subjectId).toBe("user-1")
  })
})
