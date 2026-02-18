"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const service_1 = require("./service");
const validation_1 = require("./validation");
exports.authController = {
    login: async (req, res) => {
        const email = String(req.body?.email || "");
        const password = String(req.body?.password || "");
        if (!(0, validation_1.isValidEmail)(email))
            throw { status: 400, message: "صيغة البريد الإلكتروني غير صحيحة" };
        if (!password)
            throw { status: 400, message: "كلمة المرور مطلوبة" };
        const result = await service_1.authService.login({ email, password });
        res.json(result);
    },
    register: async (req, res) => {
        const tenantName = String(req.body?.tenantName || "").trim();
        const timezone = req.body?.timezone ? String(req.body.timezone) : undefined;
        const email = String(req.body?.email || "");
        const password = String(req.body?.password || "");
        const phone = req.body?.phone ? String(req.body.phone) : undefined;
        if (!tenantName)
            throw { status: 400, message: "اسم الشركة/العميل مطلوب" };
        if (!(0, validation_1.isValidEmail)(email))
            throw { status: 400, message: "صيغة البريد الإلكتروني غير صحيحة" };
        const strength = (0, validation_1.validatePasswordStrength)(password);
        if (!strength.ok)
            throw { status: 400, message: strength.reasons[0] || "كلمة المرور ضعيفة" };
        const result = await service_1.authService.register({ tenantName, timezone, email, password, phone });
        res.json(result);
    },
    me: async (req, res) => {
        if (req.user?.forceReset)
            throw { status: 403, message: "يجب تغيير كلمة المرور أولاً" };
        const result = await service_1.authService.me(req.user);
        res.json({ user: result });
    },
    changePassword: async (req, res) => {
        const currentPassword = String(req.body?.currentPassword || "");
        const newPassword = String(req.body?.newPassword || "");
        const confirmPassword = String(req.body?.confirmPassword || "");
        if (!currentPassword)
            throw { status: 400, message: "كلمة المرور الحالية مطلوبة" };
        if (!newPassword)
            throw { status: 400, message: "كلمة المرور الجديدة مطلوبة" };
        if (newPassword !== confirmPassword)
            throw { status: 400, message: "تأكيد كلمة المرور غير مطابق" };
        const strength = (0, validation_1.validatePasswordStrength)(newPassword);
        if (!strength.ok)
            throw { status: 400, message: strength.reasons[0] || "كلمة المرور ضعيفة" };
        const result = await service_1.authService.changePassword(req.user, { currentPassword, newPassword });
        res.json(result);
    },
    updateProfile: async (req, res) => {
        const currentPassword = String(req.body?.currentPassword || "");
        const email = req.body?.email ? String(req.body.email) : undefined;
        const phone = req.body?.phone ? String(req.body.phone) : undefined;
        if (!currentPassword)
            throw { status: 400, message: "كلمة المرور الحالية مطلوبة" };
        if (email && !(0, validation_1.isValidEmail)(email))
            throw { status: 400, message: "صيغة البريد الإلكتروني غير صحيحة" };
        const result = await service_1.authService.updateProfile(req.user, { currentPassword, email, phone });
        res.json(result);
    }
};
