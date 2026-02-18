"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.goalsController = void 0;
const service_1 = require("./service");
const service_2 = require("../core/service");
const activity_1 = require("../../utils/activity");
exports.goalsController = {
    createPlan: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const roles = req.user?.roles || [];
        if (!roles.includes("owner") && !roles.includes("team_leader"))
            throw { status: 403, message: "غير مصرح" };
        const name = String(req.body?.name || "").trim();
        const period = String(req.body?.period || "").trim();
        if (!name)
            throw { status: 400, message: "الاسم مطلوب" };
        if (!["weekly", "monthly"].includes(period))
            throw { status: 400, message: "نوع الفترة غير صحيح" };
        if (roles.includes("team_leader") && !req.user?.id)
            throw { status: 403, message: "غير مصرح" };
        const plan = await service_1.goalsService.createPlan(tenantId, { name, period, startsAt: req.body?.startsAt, endsAt: req.body?.endsAt });
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "goal.plan.created", entityType: "goal_plan", entityId: plan.id });
        res.json(plan);
    },
    listPlans: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const plans = await service_1.goalsService.listPlans(tenantId);
        res.json(plans);
    },
    deletePlan: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const planId = String(req.params.planId || "");
        if (!req.user?.roles?.includes("owner"))
            throw { status: 403, message: "غير مصرح" };
        await service_1.goalsService.deletePlan(tenantId, planId);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "goal.plan.deleted", entityType: "goal_plan", entityId: planId });
        res.json({ message: "تم حذف الخطة بنجاح" });
    },
    listTargets: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const planId = String(req.params.planId || "").trim();
        if (!planId)
            throw { status: 400, message: "الخطة مطلوبة" };
        const targets = await service_1.goalsService.listTargets(tenantId, planId);
        res.json(targets);
    },
    setTargets: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const roles = req.user?.roles || [];
        if (!roles.includes("owner") && !roles.includes("team_leader"))
            throw { status: 403, message: "غير مصرح" };
        const planId = String(req.params.planId || "").trim();
        const targets = Array.isArray(req.body?.targets)
            ? req.body.targets
            : [];
        if (!planId)
            throw { status: 400, message: "الخطة مطلوبة" };
        if (roles.includes("team_leader")) {
            const team = await service_2.coreService.getTeamByLeader(tenantId, req.user?.id || "");
            if (!team)
                throw { status: 400, message: "لا يوجد فريق مرتبط بك" };
            const invalid = targets.some((target) => target.subjectType !== "team" || target.subjectId !== team.id);
            if (invalid)
                throw { status: 403, message: "لا يمكن تعيين أهداف إلا لفريقك فقط" };
        }
        const normalized = targets.map((target) => ({
            ...target,
            subjectId: target.subjectType === "all" ? tenantId : target.subjectId
        }));
        const saved = await service_1.goalsService.setTargets(tenantId, planId, normalized);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "goal.targets.updated", entityType: "goal_plan", entityId: planId });
        res.json(saved);
    },
    report: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const planId = String(req.params.planId || "").trim();
        const report = await service_1.goalsService.buildReport(tenantId, planId);
        res.json(report);
    },
    overview: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const period = req.query.period ? String(req.query.period) : "weekly";
        const plan = await service_1.goalsService.getActivePlan(tenantId, period);
        if (!plan) {
            res.json({ plan: null, report: null });
            return;
        }
        const report = await service_1.goalsService.buildReport(tenantId, plan.id);
        res.json({ plan, report });
    }
};
