import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = {
  notificationUserSetting: { findUnique: vi.fn() },
  notificationDelivery: { create: vi.fn() },
  notificationQueueItem: {
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  }
}

const ioEmit = vi.fn()

vi.mock("../../prisma/client", () => ({ prisma: prismaMock }))
vi.mock("./pushService", () => ({
  pushService: {
    send: vi.fn(),
    hasActiveSubscription: vi.fn(),
    unsubscribe: vi.fn()
  }
}))
vi.mock("./smsService", () => ({
  smsService: {
    send: vi.fn()
  }
}))
vi.mock("../../socket", () => ({
  getIO: () => ({
    to: () => ({ emit: ioEmit })
  })
}))

describe("notificationService queue + routing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("queues push notification through default routing", async () => {
    const { notificationService } = await import("./service")
    prismaMock.notificationUserSetting.findUnique.mockResolvedValue(null)
    prismaMock.notificationDelivery.create.mockResolvedValue({ id: "n-1", title: "T" })
    prismaMock.notificationQueueItem.create.mockResolvedValue({ id: "q-1" })

    await notificationService.send({
      tenantId: "tenant-1",
      userId: "user-1",
      type: "info",
      title: "تنبيه",
      message: "رسالة"
    })

    expect(prismaMock.notificationDelivery.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.notificationQueueItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: "push",
          eventKey: "notification.info",
          status: "pending"
        })
      })
    )
    expect(ioEmit).toHaveBeenCalledTimes(1)
  })

  it("marks queue item dead then enqueues sms fallback after max retries", async () => {
    const { notificationService } = await import("./service")
    const { pushService } = await import("./pushService")

    prismaMock.notificationQueueItem.findMany.mockResolvedValue([
      { id: "q-1", status: "pending", createdAt: new Date(), nextRetryAt: new Date() }
    ])
    prismaMock.notificationQueueItem.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.notificationQueueItem.findUnique.mockResolvedValue({
      id: "q-1",
      tenantId: "tenant-1",
      userId: "user-1",
      notificationId: "n-1",
      eventKey: "notification.reminder",
      channel: "push",
      fallbackChannel: "sms",
      payload: { title: "T", message: "M", actionUrl: "/x" },
      status: "processing",
      attempts: 2,
      maxAttempts: 3,
      user: { phone: "01000000000" }
    })
    ;(pushService.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ sentCount: 0, attempted: 1, errors: ["No active push subscriptions"] })

    await notificationService.processQueueBatch(10)

    expect(prismaMock.notificationQueueItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "q-1" },
        data: expect.objectContaining({ status: "dead", attempts: 3 })
      })
    )
    expect(prismaMock.notificationQueueItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: "sms",
          maxAttempts: 2,
          status: "pending"
        })
      })
    )
  })
})
