import { describe, it, expect, vi, beforeEach } from "vitest"
import { coreController } from "../modules/core/controller"
import { leadController } from "../modules/lead/controller"
import { notificationService } from "../modules/notifications/service"
import { runLeadCountdownJob } from "../jobs/leadCountdownJob"

vi.mock("../config/env", () => ({
  env: {
    ownerPhoneNumber: "+201234567890"
  }
}))

vi.mock("../utils/activity", () => ({
  logActivity: vi.fn(async () => {})
}))

vi.mock("../modules/conversations/service", () => ({
  conversationService: {
    ensureTeamGroup: vi.fn(async () => {}),
    ensureOwnerGroup: vi.fn(async () => {})
  }
}))

vi.mock("../modules/core/service", () => {
  const now = new Date()
  return {
    coreService: {
      createTenant: vi.fn(async (payload: { name?: string; timezone?: string }) => ({ id: "t1", name: payload.name || "Tenant", timezone: payload.timezone || "UTC" })),
      listTenants: vi.fn(async () => [{ id: "t1", name: "Tenant", timezone: "UTC" }]),
      createUser: vi.fn(async (tenantId: string, data: any) => ({
        id: "u-new",
        tenantId,
        email: data.email,
        phone: data.phone,
        status: "active",
        mustChangePassword: !!data.mustChangePassword,
        createdAt: now,
        updatedAt: now
      })),
      getOrCreateRole: vi.fn(async (_tenantId: string, name: string) => ({ id: `role-${name}`, name })),
      assignRole: vi.fn(async () => ({})),
      revokeRole: vi.fn(async () => ({})),
      createTeam: vi.fn(async (tenantId: string, payload: { name: string; leaderUserId: string }) => ({
        id: "team-1",
        tenantId,
        name: payload.name,
        leaderUserId: payload.leaderUserId
      })),
      addTeamMember: vi.fn(async (_tenantId: string, teamId: string, userId: string, role?: string) => ({
        id: "tm-1",
        teamId,
        userId,
        role: role || "member"
      })),
      listUsers: vi.fn(async () => []),
      getTeamByLeader: vi.fn(async (_tenantId: string, leaderUserId: string) => ({ id: "team-1", leaderUserId })),
      getTeamByName: vi.fn(async () => null),
      transferTeamMember: vi.fn(async () => ({ id: "tm-transfer-1" })),
      decideUserRequest: vi.fn(async (tenantId: string, requestId: string, payload: { status: string; decidedBy: string }) => ({
        id: requestId,
        tenantId,
        requestType: "create_sales",
        status: payload.status,
        decidedBy: payload.decidedBy,
        payload: { name: "Sales Two", email: "s2@example.com", phone: "+201234", teamId: "team-1" }
      })),
      createUserRequest: vi.fn(async (tenantId: string, data: any) => ({
        id: "ur-1",
        tenantId,
        requestType: data.requestType,
        payload: data.payload
      })),
      getUserById: vi.fn(async () => ({ id: "u1", roleLinks: [{ role: { name: "sales" } }] })),
      listPermissions: vi.fn(async () => []),
      replaceUserPermissions: vi.fn(async () => {}),
      replaceRolePermissions: vi.fn(async () => {}),
      createFile: vi.fn(async () => ({ id: "file-1" })),
      createIcon: vi.fn(async () => ({ id: "icon-1" })),
      createNote: vi.fn(async () => ({ id: "note-1" })),
      createContact: vi.fn(async () => ({ id: "contact-1" })),
      createFinanceEntry: vi.fn(async () => ({ id: "fin-1" })),
      listFinanceEntries: vi.fn(async () => []),
      listTeams: vi.fn(async () => [{ id: "team-1", name: "Team A", leaderUserId: "tl-1" }])
    }
  }
})

vi.mock("../../prisma/client", () => {
  const state: any = {
    userRequestById: null,
    meetingById: null,
    usersByIds: [],
    overdueDeadlines: []
  }
  const prisma = {
    userRequest: {
      findFirst: vi.fn(async (arg: any) => {
        const w = arg?.where || {}
        if (state.userRequestById && state.userRequestById.id === w.id && state.userRequestById.tenantId === w.tenantId) return state.userRequestById
        return null
      })
    },
    meeting: {
      findUnique: vi.fn(async (arg: any) => {
        const w = arg?.where || {}
        if (state.meetingById && state.meetingById.id === w.id && state.meetingById.tenantId === w.tenantId) return state.meetingById
        return null
      }),
      create: vi.fn(async (arg: any) => ({ id: "m-created", ...arg.data })),
      findMany: vi.fn(async () => [])
    },
    meetingReminder: {
      create: vi.fn(async (arg: any) => ({ id: "mr-1", ...arg.data }))
    },
    team: {
      findMany: vi.fn(async () => [])
    },
    teamMember: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async (arg: any) => ({ id: "tm-created", ...arg.data }))
    },
    user: {
      findUnique: vi.fn(async (arg: any) => ({ id: arg?.where?.id, phone: "+201000000000" })),
      findMany: vi.fn(async (arg: any) => {
        const ids: string[] = arg?.where?.id?.in || []
        return state.usersByIds.length ? state.usersByIds.filter((u: any) => ids.includes(u.id)) : ids.map((id) => ({ id, phone: "+201234567890" }))
      }),
      update: vi.fn(async () => ({}))
    },
    notificationEvent: {
      create: vi.fn(async (arg: any) => ({ id: "evt-1", ...arg.data })),
      findMany: vi.fn(async () => [])
    },
    notificationDelivery: {
      create: vi.fn(async (arg: any) => ({ id: "del-1", ...arg.data }))
    },
    lead: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async (arg: any) => {
        const w = arg?.where || {}
        if (w?.id) return { id: w.id, tenantId: w.tenantId, name: "عميل", leadCode: "LC001", assignedUserId: "sales-1", status: "meeting" }
        return null
      }),
      update: vi.fn(async () => ({}))
    },
    leadDeadline: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (arg: any) => ({ id: "ld-1", ...arg.data })),
      findMany: vi.fn(async () => state.overdueDeadlines),
      update: vi.fn(async () => ({ id: "ld-overdue" })),
      updateMany: vi.fn(async () => ({ count: 1 }))
    },
    leadStateDefinition: {
      findFirst: vi.fn(async (arg: any) => ({ id: `state-${arg?.where?.code}`, code: arg?.where?.code, name: arg?.where?.code }))
    },
    leadFailure: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (arg: any) => ({ id: "lf-1", ...arg.data }))
    },
    userRole: {
      findMany: vi.fn(async () => [{ role: { name: "sales" } }])
    },
    auditLog: {
      findMany: vi.fn(async () => [])
    }
  }
  return { prisma, __mockState: state }
})

vi.mock("../prisma/client", () => {
  const state: any = {
    userRequestById: null,
    meetingById: null,
    usersByIds: [],
    overdueDeadlines: []
  }
  const prisma = {
    userRequest: {
      findFirst: vi.fn(async (arg: any) => {
        const w = arg?.where || {}
        if (state.userRequestById && state.userRequestById.id === w.id && state.userRequestById.tenantId === w.tenantId) return state.userRequestById
        return null
      })
    },
    meeting: {
      findUnique: vi.fn(async (arg: any) => {
        const w = arg?.where || {}
        if (state.meetingById && state.meetingById.id === w.id && state.meetingById.tenantId === w.tenantId) return state.meetingById
        return null
      }),
      create: vi.fn(async (arg: any) => ({ id: "m-created", ...arg.data })),
      findMany: vi.fn(async () => [])
    },
    meetingReminder: {
      create: vi.fn(async (arg: any) => ({ id: "mr-1", ...arg.data }))
    },
    team: {
      findMany: vi.fn(async () => [])
    },
    teamMember: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async (arg: any) => ({ id: "tm-created", ...arg.data }))
    },
    user: {
      findUnique: vi.fn(async (arg: any) => ({ id: arg?.where?.id, phone: "+201000000000" })),
      findMany: vi.fn(async (arg: any) => {
        const ids: string[] = arg?.where?.id?.in || []
        return state.usersByIds.length ? state.usersByIds.filter((u: any) => ids.includes(u.id)) : ids.map((id) => ({ id, phone: "+201234567890" }))
      }),
      update: vi.fn(async () => ({}))
    },
    notificationEvent: {
      create: vi.fn(async (arg: any) => ({ id: "evt-1", ...arg.data })),
      findMany: vi.fn(async () => [])
    },
    notificationDelivery: {
      create: vi.fn(async (arg: any) => ({ id: "del-1", ...arg.data }))
    },
    lead: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async (arg: any) => {
        const w = arg?.where || {}
        if (w?.id) return { id: w.id, tenantId: w.tenantId, name: "عميل", leadCode: "LC001", assignedUserId: "sales-1", status: "meeting" }
        return null
      }),
      update: vi.fn(async () => ({}))
    },
    leadDeadline: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (arg: any) => ({ id: "ld-1", ...arg.data })),
      findMany: vi.fn(async () => state.overdueDeadlines),
      update: vi.fn(async () => ({ id: "ld-overdue" })),
      updateMany: vi.fn(async () => ({ count: 1 }))
    },
    leadStateDefinition: {
      findFirst: vi.fn(async (arg: any) => ({ id: `state-${arg?.where?.code}`, code: arg?.where?.code, name: arg?.where?.code }))
    },
    leadFailure: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (arg: any) => ({ id: "lf-1", ...arg.data }))
    },
    userRole: {
      findMany: vi.fn(async () => [{ role: { name: "sales" } }])
    },
    auditLog: {
      findMany: vi.fn(async () => [])
    }
  }
  return { prisma, __mockState: state }
})

vi.mock("../modules/lead/service", () => ({
  leadService: {
    getLeadForUser: vi.fn(async (_tenantId: string, id: string, user: any) => ({ id, tenantId: "t1", name: "عميل", status: "call", assignedUserId: user?.id })),
    deleteLead: vi.fn(async (_tenantId: string, id: string) => ({ id, tenantId: "t1", deletedAt: new Date().toISOString() })),
    createFailure: vi.fn(async (_tenantId: string, data: any) => ({ id: "fail-1", ...data })),
    createCallLog: vi.fn(async (_tenantId: string, data: any) => ({ id: "call-1", ...data })),
    getLead: vi.fn(async (_tenantId: string, id: string) => ({ id, tenantId: "t1", name: "عميل" }))
  }
}))

vi.mock("../modules/lifecycle/service", () => ({
  lifecycleService: {
    getStateByCode: vi.fn(async (_tenantId: string, code: string) => ({ id: `state-${code}`, code, name: code })),
    transitionLead: vi.fn(async (_tenantId: string, _leadId: string, toStateId: string) => ({ id: toStateId, code: "meeting", name: "meeting" }))
  }
}))

vi.mock("../modules/notifications/pushService", () => ({
  pushService: {
    send: vi.fn(async () => ({}))
  }
}))

vi.mock("../modules/notifications/smsService", () => ({
  smsService: {
    send: vi.fn(async () => ({}))
  }
}))

const makeReqRes = (user: any, body: any = {}, params: any = {}, query: any = {}) => {
  const req: any = { user, body, params, query }
  const res: any = {
    jsonPayload: undefined as any,
    statusCode: 200,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: any) {
      this.jsonPayload = payload
      return payload
    }
  }
  return { req, res }
}

describe("التسجيل والصلاحيات والقيادة", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("إنشاء Team Leader بواسطة المالك وربط الفريق والمجموعات", async () => {
    const owner = { id: "owner-1", tenantId: "t1", roles: ["owner"] }
    const { req, res } = makeReqRes(owner, { name: "Leader One", email: "leader@example.com", role: "team_leader", teamName: "Team A" })

    await coreController.createUser(req, res)

    const { conversationService } = await import("../modules/conversations/service")
    const { coreService } = await import("../modules/core/service")
    expect(res.jsonPayload?.user?.email).toBe("leader@example.com")
    expect(coreService.createTeam).toHaveBeenCalled()
    expect(conversationService.ensureOwnerGroup).toHaveBeenCalled()
    expect(conversationService.ensureTeamGroup).toHaveBeenCalled()
  })

  it("إنشاء Sales وربطه بالفريق والتحقق من المجموعة", async () => {
    const owner = { id: "owner-1", tenantId: "t1", roles: ["owner"] }
    const { req, res } = makeReqRes(owner, { name: "Sales One", email: "sales@example.com", role: "sales", teamId: "team-1" })
    await coreController.createUser(req, res)
    const { conversationService } = await import("../modules/conversations/service")
    const { coreService } = await import("../modules/core/service")
    expect(res.jsonPayload?.user?.email).toBe("sales@example.com")
    expect(coreService.addTeamMember).toHaveBeenCalled()
    expect(conversationService.ensureTeamGroup).toHaveBeenCalled()
  })

  it("اعتماد طلب إنشاء Sales من المالك", async () => {
    const owner = { id: "owner-1", tenantId: "t1", roles: ["owner"] }
    const { req, res } = makeReqRes(owner, { status: "approved" }, { requestId: "ur-1" })
    const prismaModA: any = await import("../prisma/client")
    const prismaModB: any = await import("../prisma/client")
    prismaModA.prisma.userRequest.findFirst.mockResolvedValueOnce({
      id: "ur-1",
      tenantId: "t1",
      requestType: "create_sales",
      requestedBy: "tl-1",
      payload: { name: "Sales Two", email: "s2@example.com", phone: "+201234", teamId: "team-1" }
    })
    prismaModB.prisma.userRequest.findFirst.mockResolvedValueOnce({
      id: "ur-1",
      tenantId: "t1",
      requestType: "create_sales",
      requestedBy: "tl-1",
      payload: { name: "Sales Two", email: "s2@example.com", phone: "+201234", teamId: "team-1" }
    })
    await coreController.decideUserRequest(req, res)
    const { coreService } = await import("../modules/core/service")
    expect(coreService.createUser).toHaveBeenCalled()
    expect(coreService.assignRole).toHaveBeenCalled()
    expect(coreService.addTeamMember).toHaveBeenCalled()
    const { conversationService } = await import("../modules/conversations/service")
    expect(conversationService.ensureTeamGroup).toHaveBeenCalled()
    expect(res.jsonPayload?.createdUser?.temporaryPassword).toBeDefined()
  })
})

describe("مراحل العميل والإشعارات والمكالمات والفشل", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("اكتمال مرحلة وإرسال إشعار", async () => {
    const sales = { id: "s1", tenantId: "t1", roles: ["sales"] }
    const { req, res } = makeReqRes(sales, { stage: "meeting" }, { id: "L1" })
    const pubSpy = vi.spyOn(notificationService, "publishEvent")
    const queueSpy = vi.spyOn(notificationService, "queueDelivery")
    await leadController.updateStage(req, res)
    expect(res.jsonPayload?.code).toBe("meeting")
    expect(pubSpy).toHaveBeenCalled()
    expect(queueSpy).toHaveBeenCalled()
  })

  it("تسجيل مكالمة للعميل وإشعار المالك", async () => {
    const sales = { id: "s1", tenantId: "t1", roles: ["sales"] }
    const { req, res } = makeReqRes(sales, { outcome: "answered", durationSeconds: 180 }, { id: "L1" })
    const pubSpy = vi.spyOn(notificationService, "publishEvent")
    const queueSpy = vi.spyOn(notificationService, "queueDelivery")
    await leadController.addCallLog(req, res)
    expect(res.jsonPayload?.id).toBe("call-1")
    expect(pubSpy).toHaveBeenCalled()
    expect(queueSpy).toHaveBeenCalled()
  })

  it("فشل العميل بالاستسلام وإرسال إشعار", async () => {
    const sales = { id: "s1", tenantId: "t1", roles: ["sales"] }
    const { req, res } = makeReqRes(sales, { failureType: "surrender", reason: "غير مهتم" }, { id: "L1" })
    const pubSpy = vi.spyOn(notificationService, "publishEvent")
    await leadController.failLead(req, res)
    expect(res.jsonPayload?.id).toBe("fail-1")
    expect(pubSpy).toHaveBeenCalled()
  })
})

describe("الاجتماعات والتذكير الفوري", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("إرسال تذكير فوري للاجتماع ودعم Push وSMS", async () => {
    process.env.OWNER_PHONE_NUMBER = "+201234567890"
    const prismaModA: any = await import("../prisma/client")
    const prismaModB: any = await import("../prisma/client")
    const meetingObj = {
      id: "m1",
      tenantId: "t1",
      title: "اجتماع تجربة",
      leadId: "L1",
      lead: { id: "L1", name: "عميل" },
      organizer: { id: "s1" }
    }
    prismaModA.prisma.meeting.findUnique.mockResolvedValueOnce(meetingObj)
    prismaModB.prisma.meeting.findUnique.mockResolvedValueOnce(meetingObj)
    const { pushService } = await import("../modules/notifications/pushService")
    const { smsService } = await import("../modules/notifications/smsService")
    const { meetingService } = await import("../modules/meeting/service")
    await meetingService.sendReminderNow("t1", "m1")
    expect(pushService.send).toHaveBeenCalled()
    expect(smsService.send).toHaveBeenCalled()
  })
})

describe("وظيفة مهلة 7 أيام والتنبيه", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("إنشاء المهلة وتنبيه عند تجاوزها وتعطيل البائع", async () => {
    const modA: any = await import("../prisma/client")
    const modB: any = await import("../prisma/client")
    modA.prisma.lead.findMany.mockResolvedValue([{ id: "L1", tenantId: "t1", status: "meeting", name: "عميل", leadCode: "LC001", assignedUserId: "s1" }])
    modA.prisma.leadDeadline.findFirst.mockResolvedValue(null)
    modA.prisma.leadStateDefinition.findFirst.mockResolvedValue({ id: "state-meeting", code: "meeting", name: "مرحلة الاجتماع" })
    modB.prisma.lead.findMany.mockResolvedValue([{ id: "L1", tenantId: "t1", status: "meeting", name: "عميل", leadCode: "LC001", assignedUserId: "s1" }])
    modB.prisma.leadDeadline.findFirst.mockResolvedValue(null)
    modB.prisma.leadStateDefinition.findFirst.mockResolvedValue({ id: "state-meeting", code: "meeting", name: "مرحلة الاجتماع" })
    const past = new Date(Date.now() - 1000)
    const overdueItem = {
      id: "ld-overdue-1",
      tenantId: "t1",
      leadId: "L1",
      dueAt: past,
      status: "active",
      lead: { id: "L1", tenantId: "t1", name: "عميل", leadCode: "LC001", assignedUserId: "s1" },
      state: { id: "state-meeting", code: "meeting", name: "مرحلة الاجتماع" }
    }
    modA.prisma.leadDeadline.findMany.mockResolvedValue([overdueItem])
    modB.prisma.leadDeadline.findMany.mockResolvedValue([overdueItem])
    const pubSpy = vi.spyOn(notificationService, "publishEvent")
    await runLeadCountdownJob("t1")
    expect(modB.prisma.leadDeadline.create).toHaveBeenCalled()
    expect(modB.prisma.leadDeadline.update).toHaveBeenCalled()
    expect(modB.prisma.user.update).toHaveBeenCalled()
    expect(pubSpy).toHaveBeenCalled()
  })
})
