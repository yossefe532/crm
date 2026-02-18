"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
const validate = (schema) => (req, res, next) => {
    try {
        req.body = schema.parse(req.body);
        next();
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const issues = error.issues
                || error.errors
                || [];
            const details = issues.map((item) => ({
                path: item.path.join("."),
                message: item.message
            }));
            return res.status(400).json({
                error: "خطأ في التحقق من البيانات",
                message: details[0]?.message || "بيانات غير صالحة",
                details
            });
        }
        next(error);
    }
};
exports.validate = validate;
