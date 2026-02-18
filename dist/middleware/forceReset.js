"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.forceResetMiddleware = void 0;
const allowedPaths = new Set(["/api/auth/change-password"]);
const forceResetMiddleware = (req, res, next) => {
    const user = req.user;
    if (!user?.forceReset)
        return next();
    if (allowedPaths.has(req.path))
        return next();
    return res.status(403).json({ error: "يجب تغيير كلمة المرور أولاً" });
};
exports.forceResetMiddleware = forceResetMiddleware;
