"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    console.error("API Error:", err);
    const status = err?.status || 500;
    const message = err?.message || "حدث خطأ في الخادم";
    const details = err?.details;
    if (details) {
        res.status(status).json({ error: message, message, details });
        return;
    }
    res.status(status).json({ error: message, message });
};
exports.errorHandler = errorHandler;
