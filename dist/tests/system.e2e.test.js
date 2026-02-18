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
const controller_1 = require("../modules/core/controller");
const controller_2 = require("../modules/lead/controller");
const service_1 = require("../modules/notifications/service");
const leadCountdownJob_1 = require("../jobs/leadCountdownJob");
vitest_1.vi.mock("../config/env", () => ({
    env: {
        ownerPhoneNumber: "+201234567890"
    }
}));
vitest_1.vi.mock("../utils/activity", () => ({
    logActivity: vitest_1.vi.fn(async () => { })
}));
vitest_1.vi.mock("../modules/conversations/service", () => ({
    conversationService: {
        ensureTeamGroup: vitest_1.vi.fn(async () => { }),
        ensureOwnerGroup: vitest_1.vi.fn(async () => { })
    }
}));
vitest_1.vi.mock("../modules/core/service", () => {
    const now = new Date();
    return {
        coreService: {
            createTenant: vitest_1.vi.fn(async (payload) => ({ id: "t1", name: payload.name || "Tenant", timezone: payload.timezone || "UTC" })),
            listTenants: vitest_1.vi.fn(async () => [{ id: "t1", name: "Tenant", timezone: "UTC" }]),
            createUser: vitest_1.vi.fn(async (tenantId, data) => ({
                id: "u-new",
                tenantId,
                email: data.email,
                phone: data.phone,
                status: "active",
                mustChangePassword: !!data.mustChangePassword,
                createdAt: now,
                updatedAt: now
            })),
            getOrCreateRole: vitest_1.vi.fn(async (_tenantId, name) => ({ id: `role-${name}`, name })),
            assignRole: vitest_1.vi.fn(async () => ({})),
            revokeRole: vitest_1.vi.fn(async () => ({})),
            createTeam: vitest_1.vi.fn(async (tenantId, payload) => ({
                id: "team-1",
                tenantId,
                name: payload.name,
                leaderUserId: payload.leaderUserId
            })),
            addTeamMember: vitest_1.vi.fn(async (_tenantId, teamId, userId, role) => ({
                id: "tm-1",
                teamId,
                userId,
                role: role || "member"
            })),
            listUsers: vitest_1.vi.fn(async () => []),
            getTeamByLeader: vitest_1.vi.fn(async (_tenantId, leaderUserId) => ({ id: "team-1", leaderUserId })),
            getTeamByName: vitest_1.vi.fn(async () => null),
            transferTeamMember: vitest_1.vi.fn(async () => ({ id: "tm-transfer-1" })),
            decideUserRequest: vitest_1.vi.fn(async (tenantId, requestId, payload) => ({
                id: requestId,
                tenantId,
                requestType: "create_sales",
                status: payload.status,
                decidedBy: payload.decidedBy,
                payload: { name: "Sales Two", email: "s2@example.com", phone: "+201234", teamId: "team-1" }
            })),
            createUserRequest: vitest_1.vi.fn(async (tenantId, data) => ({
                id: "ur-1",
                tenantId,
                requestType: data.requestType,
                payload: data.payload
            })),
            getUserById: vitest_1.vi.fn(async () => ({ id: "u1", roleLinks: [{ role: { name: "sales" } }] })),
            listPermissions: vitest_1.vi.fn(async () => []),
            replaceUserPermissions: vitest_1.vi.fn(async () => { }),
            replaceRolePermissions: vitest_1.vi.fn(async () => { }),
            createFile: vitest_1.vi.fn(async () => ({ id: "file-1" })),
            createIcon: vitest_1.vi.fn(async () => ({ id: "icon-1" })),
            createNote: vitest_1.vi.fn(async () => ({ id: "note-1" })),
            createContact: vitest_1.vi.fn(async () => ({ id: "contact-1" })),
            createFinanceEntry: vitest_1.vi.fn(async () => ({ id: "fin-1" })),
            listFinanceEntries: vitest_1.vi.fn(async () => []),
            listTeams: vitest_1.vi.fn(async () => [{ id: "team-1", name: "Team A", leaderUserId: "tl-1" }])
        }
    };
});
vitest_1.vi.mock("../../prisma/client", () => {
    const state = {
        userRequestById: null,
        meetingById: null,
        usersByIds: [],
        overdueDeadlines: []
    };
    const prisma = {
        userRequest: {
            findFirst: vitest_1.vi.fn(async (arg) => {
                const w = arg?.where || {};
                if (state.userRequestById && state.userRequestById.id === w.id && state.userRequestById.tenantId === w.tenantId)
                    return state.userRequestById;
                return null;
            })
        },
        meeting: {
            findUnique: vitest_1.vi.fn(async (arg) => {
                const w = arg?.where || {};
                if (state.meetingById && state.meetingById.id === w.id && state.meetingById.tenantId === w.tenantId)
                    return state.meetingById;
                return null;
            }),
            create: vitest_1.vi.fn(async (arg) => ({ id: "m-created", ...arg.data })),
            findMany: vitest_1.vi.fn(async () => [])
        },
        meetingReminder: {
            create: vitest_1.vi.fn(async (arg) => ({ id: "mr-1", ...arg.data }))
        },
        team: {
            findMany: vitest_1.vi.fn(async () => [])
        },
        teamMember: {
            findMany: vitest_1.vi.fn(async () => []),
            create: vitest_1.vi.fn(async (arg) => ({ id: "tm-created", ...arg.data }))
        },
        user: {
            findUnique: vitest_1.vi.fn(async (arg) => ({ id: arg?.where?.id, phone: "+201000000000" })),
            findMany: vitest_1.vi.fn(async (arg) => {
                const ids = arg?.where?.id?.in || [];
                return state.usersByIds.length ? state.usersByIds.filter((u) => ids.includes(u.id)) : ids.map((id) => ({ id, phone: "+201234567890" }));
            }),
            update: vitest_1.vi.fn(async () => ({}))
        },
        notificationEvent: {
            create: vitest_1.vi.fn(async (arg) => ({ id: "evt-1", ...arg.data })),
            findMany: vitest_1.vi.fn(async () => [])
        },
        notificationDelivery: {
            create: vitest_1.vi.fn(async (arg) => ({ id: "del-1", ...arg.data }))
        },
        lead: {
            findMany: vitest_1.vi.fn(async () => []),
            findFirst: vitest_1.vi.fn(async (arg) => {
                const w = arg?.where || {};
                if (w?.id)
                    return { id: w.id, tenantId: w.tenantId, name: "عميل", leadCode: "LC001", assignedUserId: "sales-1", status: "meeting" };
                return null;
            }),
            update: vitest_1.vi.fn(async () => ({}))
        },
        leadDeadline: {
            findFirst: vitest_1.vi.fn(async () => null),
            create: vitest_1.vi.fn(async (arg) => ({ id: "ld-1", ...arg.data })),
            findMany: vitest_1.vi.fn(async () => state.overdueDeadlines),
            update: vitest_1.vi.fn(async () => ({ id: "ld-overdue" })),
            updateMany: vitest_1.vi.fn(async () => ({ count: 1 }))
        },
        leadStateDefinition: {
            findFirst: vitest_1.vi.fn(async (arg) => ({ id: `state-${arg?.where?.code}`, code: arg?.where?.code, name: arg?.where?.code }))
        },
        leadFailure: {
            findFirst: vitest_1.vi.fn(async () => null),
            create: vitest_1.vi.fn(async (arg) => ({ id: "lf-1", ...arg.data }))
        },
        userRole: {
            findMany: vitest_1.vi.fn(async () => [{ role: { name: "sales" } }])
        },
        auditLog: {
            findMany: vitest_1.vi.fn(async () => [])
        }
    };
    return { prisma, __mockState: state };
});
vitest_1.vi.mock("../prisma/client", () => {
    const state = {
        userRequestById: null,
        meetingById: null,
        usersByIds: [],
        overdueDeadlines: []
    };
    const prisma = {
        userRequest: {
            findFirst: vitest_1.vi.fn(async (arg) => {
                const w = arg?.where || {};
                if (state.userRequestById && state.userRequestById.id === w.id && state.userRequestById.tenantId === w.tenantId)
                    return state.userRequestById;
                return null;
            })
        },
        meeting: {
            findUnique: vitest_1.vi.fn(async (arg) => {
                const w = arg?.where || {};
                if (state.meetingById && state.meetingById.id === w.id && state.meetingById.tenantId === w.tenantId)
                    return state.meetingById;
                return null;
            }),
            create: vitest_1.vi.fn(async (arg) => ({ id: "m-created", ...arg.data })),
            findMany: vitest_1.vi.fn(async () => [])
        },
        meetingReminder: {
            create: vitest_1.vi.fn(async (arg) => ({ id: "mr-1", ...arg.data }))
        },
        team: {
            findMany: vitest_1.vi.fn(async () => [])
        },
        teamMember: {
            findMany: vitest_1.vi.fn(async () => []),
            create: vitest_1.vi.fn(async (arg) => ({ id: "tm-created", ...arg.data }))
        },
        user: {
            findUnique: vitest_1.vi.fn(async (arg) => ({ id: arg?.where?.id, phone: "+201000000000" })),
            findMany: vitest_1.vi.fn(async (arg) => {
                const ids = arg?.where?.id?.in || [];
                return state.usersByIds.length ? state.usersByIds.filter((u) => ids.includes(u.id)) : ids.map((id) => ({ id, phone: "+201234567890" }));
            }),
            update: vitest_1.vi.fn(async () => ({}))
        },
        notificationEvent: {
            create: vitest_1.vi.fn(async (arg) => ({ id: "evt-1", ...arg.data })),
            findMany: vitest_1.vi.fn(async () => [])
        },
        notificationDelivery: {
            create: vitest_1.vi.fn(async (arg) => ({ id: "del-1", ...arg.data }))
        },
        lead: {
            findMany: vitest_1.vi.fn(async () => []),
            findFirst: vitest_1.vi.fn(async (arg) => {
                const w = arg?.where || {};
                if (w?.id)
                    return { id: w.id, tenantId: w.tenantId, name: "عميل", leadCode: "LC001", assignedUserId: "sales-1", status: "meeting" };
                return null;
            }),
            update: vitest_1.vi.fn(async () => ({}))
        },
        leadDeadline: {
            findFirst: vitest_1.vi.fn(async () => null),
            create: vitest_1.vi.fn(async (arg) => ({ id: "ld-1", ...arg.data })),
            findMany: vitest_1.vi.fn(async () => state.overdueDeadlines),
            update: vitest_1.vi.fn(async () => ({ id: "ld-overdue" })),
            updateMany: vitest_1.vi.fn(async () => ({ count: 1 }))
        },
        leadStateDefinition: {
            findFirst: vitest_1.vi.fn(async (arg) => ({ id: `state-${arg?.where?.code}`, code: arg?.where?.code, name: arg?.where?.code }))
        },
        leadFailure: {
            findFirst: vitest_1.vi.fn(async () => null),
            create: vitest_1.vi.fn(async (arg) => ({ id: "lf-1", ...arg.data }))
        },
        userRole: {
            findMany: vitest_1.vi.fn(async () => [{ role: { name: "sales" } }])
        },
        auditLog: {
            findMany: vitest_1.vi.fn(async () => [])
        }
    };
    return { prisma, __mockState: state };
});
vitest_1.vi.mock("../modules/lead/service", () => ({
    leadService: {
        getLeadForUser: vitest_1.vi.fn(async (_tenantId, id, user) => ({ id, tenantId: "t1", name: "عميل", status: "call", assignedUserId: user?.id })),
        deleteLead: vitest_1.vi.fn(async (_tenantId, id) => ({ id, tenantId: "t1", deletedAt: new Date().toISOString() })),
        createFailure: vitest_1.vi.fn(async (_tenantId, data) => ({ id: "fail-1", ...data })),
        createCallLog: vitest_1.vi.fn(async (_tenantId, data) => ({ id: "call-1", ...data })),
        getLead: vitest_1.vi.fn(async (_tenantId, id) => ({ id, tenantId: "t1", name: "عميل" }))
    }
}));
vitest_1.vi.mock("../modules/lifecycle/service", () => ({
    lifecycleService: {
        getStateByCode: vitest_1.vi.fn(async (_tenantId, code) => ({ id: `state-${code}`, code, name: code })),
        transitionLead: vitest_1.vi.fn(async (_tenantId, _leadId, toStateId) => ({ id: toStateId, code: "meeting", name: "meeting" }))
    }
}));
vitest_1.vi.mock("../modules/notifications/pushService", () => ({
    pushService: {
        send: vitest_1.vi.fn(async () => ({}))
    }
}));
vitest_1.vi.mock("../modules/notifications/smsService", () => ({
    smsService: {
        send: vitest_1.vi.fn(async () => ({}))
    }
}));
const makeReqRes = (user, body = {}, params = {}, query = {}) => {
    const req = { user, body, params, query };
    const res = {
        jsonPayload: undefined,
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.jsonPayload = payload;
            return payload;
        }
    };
    return { req, res };
};
(0, vitest_1.describe)("التسجيل والصلاحيات والقيادة", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("إنشاء Team Leader بواسطة المالك وربط الفريق والمجموعات", async () => {
        const owner = { id: "owner-1", tenantId: "t1", roles: ["owner"] };
        const { req, res } = makeReqRes(owner, { name: "Leader One", email: "leader@example.com", role: "team_leader", teamName: "Team A" });
        await controller_1.coreController.createUser(req, res);
        const { conversationService } = await Promise.resolve().then(() => __importStar(require("../modules/conversations/service")));
        const { coreService } = await Promise.resolve().then(() => __importStar(require("../modules/core/service")));
        (0, vitest_1.expect)(res.jsonPayload?.user?.email).toBe("leader@example.com");
        (0, vitest_1.expect)(coreService.createTeam).toHaveBeenCalled();
        (0, vitest_1.expect)(conversationService.ensureOwnerGroup).toHaveBeenCalled();
        (0, vitest_1.expect)(conversationService.ensureTeamGroup).toHaveBeenCalled();
    });
    (0, vitest_1.it)("إنشاء Sales وربطه بالفريق والتحقق من المجموعة", async () => {
        const owner = { id: "owner-1", tenantId: "t1", roles: ["owner"] };
        const { req, res } = makeReqRes(owner, { name: "Sales One", email: "sales@example.com", role: "sales", teamId: "team-1" });
        await controller_1.coreController.createUser(req, res);
        const { conversationService } = await Promise.resolve().then(() => __importStar(require("../modules/conversations/service")));
        const { coreService } = await Promise.resolve().then(() => __importStar(require("../modules/core/service")));
        (0, vitest_1.expect)(res.jsonPayload?.user?.email).toBe("sales@example.com");
        (0, vitest_1.expect)(coreService.addTeamMember).toHaveBeenCalled();
        (0, vitest_1.expect)(conversationService.ensureTeamGroup).toHaveBeenCalled();
    });
    (0, vitest_1.it)("اعتماد طلب إنشاء Sales من المالك", async () => {
        const owner = { id: "owner-1", tenantId: "t1", roles: ["owner"] };
        const { req, res } = makeReqRes(owner, { status: "approved" }, { requestId: "ur-1" });
        const prismaModA = await Promise.resolve().then(() => __importStar(require("../prisma/client")));
        const prismaModB = await Promise.resolve().then(() => __importStar(require("../prisma/client")));
        prismaModA.prisma.userRequest.findFirst.mockResolvedValueOnce({
            id: "ur-1",
            tenantId: "t1",
            requestType: "create_sales",
            requestedBy: "tl-1",
            payload: { name: "Sales Two", email: "s2@example.com", phone: "+201234", teamId: "team-1" }
        });
        prismaModB.prisma.userRequest.findFirst.mockResolvedValueOnce({
            id: "ur-1",
            tenantId: "t1",
            requestType: "create_sales",
            requestedBy: "tl-1",
            payload: { name: "Sales Two", email: "s2@example.com", phone: "+201234", teamId: "team-1" }
        });
        await controller_1.coreController.decideUserRequest(req, res);
        const { coreService } = await Promise.resolve().then(() => __importStar(require("../modules/core/service")));
        (0, vitest_1.expect)(coreService.createUser).toHaveBeenCalled();
        (0, vitest_1.expect)(coreService.assignRole).toHaveBeenCalled();
        (0, vitest_1.expect)(coreService.addTeamMember).toHaveBeenCalled();
        const { conversationService } = await Promise.resolve().then(() => __importStar(require("../modules/conversations/service")));
        (0, vitest_1.expect)(conversationService.ensureTeamGroup).toHaveBeenCalled();
        (0, vitest_1.expect)(res.jsonPayload?.createdUser?.temporaryPassword).toBeDefined();
    });
});
(0, vitest_1.describe)("مراحل العميل والإشعارات والمكالمات والفشل", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("اكتمال مرحلة وإرسال إشعار", async () => {
        const sales = { id: "s1", tenantId: "t1", roles: ["sales"] };
        const { req, res } = makeReqRes(sales, { stage: "meeting" }, { id: "L1" });
        const pubSpy = vitest_1.vi.spyOn(service_1.notificationService, "publishEvent");
        const queueSpy = vitest_1.vi.spyOn(service_1.notificationService, "queueDelivery");
        await controller_2.leadController.updateStage(req, res);
        (0, vitest_1.expect)(res.jsonPayload?.code).toBe("meeting");
        (0, vitest_1.expect)(pubSpy).toHaveBeenCalled();
        (0, vitest_1.expect)(queueSpy).toHaveBeenCalled();
    });
    (0, vitest_1.it)("تسجيل مكالمة للعميل وإشعار المالك", async () => {
        const sales = { id: "s1", tenantId: "t1", roles: ["sales"] };
        const { req, res } = makeReqRes(sales, { outcome: "answered", durationSeconds: 180 }, { id: "L1" });
        const pubSpy = vitest_1.vi.spyOn(service_1.notificationService, "publishEvent");
        const queueSpy = vitest_1.vi.spyOn(service_1.notificationService, "queueDelivery");
        await controller_2.leadController.addCallLog(req, res);
        (0, vitest_1.expect)(res.jsonPayload?.id).toBe("call-1");
        (0, vitest_1.expect)(pubSpy).toHaveBeenCalled();
        (0, vitest_1.expect)(queueSpy).toHaveBeenCalled();
    });
    (0, vitest_1.it)("فشل العميل بالاستسلام وإرسال إشعار", async () => {
        const sales = { id: "s1", tenantId: "t1", roles: ["sales"] };
        const { req, res } = makeReqRes(sales, { failureType: "surrender", reason: "غير مهتم" }, { id: "L1" });
        const pubSpy = vitest_1.vi.spyOn(service_1.notificationService, "publishEvent");
        await controller_2.leadController.failLead(req, res);
        (0, vitest_1.expect)(res.jsonPayload?.id).toBe("fail-1");
        (0, vitest_1.expect)(pubSpy).toHaveBeenCalled();
    });
});
(0, vitest_1.describe)("الاجتماعات والتذكير الفوري", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("إرسال تذكير فوري للاجتماع ودعم Push وSMS", async () => {
        process.env.OWNER_PHONE_NUMBER = "+201234567890";
        const prismaModA = await Promise.resolve().then(() => __importStar(require("../prisma/client")));
        const prismaModB = await Promise.resolve().then(() => __importStar(require("../prisma/client")));
        const meetingObj = {
            id: "m1",
            tenantId: "t1",
            title: "اجتماع تجربة",
            leadId: "L1",
            lead: { id: "L1", name: "عميل" },
            organizer: { id: "s1" }
        };
        prismaModA.prisma.meeting.findUnique.mockResolvedValueOnce(meetingObj);
        prismaModB.prisma.meeting.findUnique.mockResolvedValueOnce(meetingObj);
        const { pushService } = await Promise.resolve().then(() => __importStar(require("../modules/notifications/pushService")));
        const { smsService } = await Promise.resolve().then(() => __importStar(require("../modules/notifications/smsService")));
        const { meetingService } = await Promise.resolve().then(() => __importStar(require("../modules/meeting/service")));
        await meetingService.sendReminderNow("t1", "m1");
        (0, vitest_1.expect)(pushService.send).toHaveBeenCalled();
        (0, vitest_1.expect)(smsService.send).toHaveBeenCalled();
    });
});
(0, vitest_1.describe)("وظيفة مهلة 7 أيام والتنبيه", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("إنشاء المهلة وتنبيه عند تجاوزها وتعطيل البائع", async () => {
        const modA = await Promise.resolve().then(() => __importStar(require("../prisma/client")));
        const modB = await Promise.resolve().then(() => __importStar(require("../prisma/client")));
        modA.prisma.lead.findMany.mockResolvedValue([{ id: "L1", tenantId: "t1", status: "meeting", name: "عميل", leadCode: "LC001", assignedUserId: "s1" }]);
        modA.prisma.leadDeadline.findFirst.mockResolvedValue(null);
        modA.prisma.leadStateDefinition.findFirst.mockResolvedValue({ id: "state-meeting", code: "meeting", name: "مرحلة الاجتماع" });
        modB.prisma.lead.findMany.mockResolvedValue([{ id: "L1", tenantId: "t1", status: "meeting", name: "عميل", leadCode: "LC001", assignedUserId: "s1" }]);
        modB.prisma.leadDeadline.findFirst.mockResolvedValue(null);
        modB.prisma.leadStateDefinition.findFirst.mockResolvedValue({ id: "state-meeting", code: "meeting", name: "مرحلة الاجتماع" });
        const past = new Date(Date.now() - 1000);
        const overdueItem = {
            id: "ld-overdue-1",
            tenantId: "t1",
            leadId: "L1",
            dueAt: past,
            status: "active",
            lead: { id: "L1", tenantId: "t1", name: "عميل", leadCode: "LC001", assignedUserId: "s1" },
            state: { id: "state-meeting", code: "meeting", name: "مرحلة الاجتماع" }
        };
        modA.prisma.leadDeadline.findMany.mockResolvedValue([overdueItem]);
        modB.prisma.leadDeadline.findMany.mockResolvedValue([overdueItem]);
        const pubSpy = vitest_1.vi.spyOn(service_1.notificationService, "publishEvent");
        await (0, leadCountdownJob_1.runLeadCountdownJob)("t1");
        (0, vitest_1.expect)(modB.prisma.leadDeadline.create).toHaveBeenCalled();
        (0, vitest_1.expect)(modB.prisma.leadDeadline.update).toHaveBeenCalled();
        (0, vitest_1.expect)(modB.prisma.user.update).toHaveBeenCalled();
        (0, vitest_1.expect)(pubSpy).toHaveBeenCalled();
    });
});
