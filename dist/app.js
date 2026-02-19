"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = require("./middleware/auth");
const forceReset_1 = require("./middleware/forceReset");
const error_1 = require("./middleware/error");
const routes_1 = require("./modules/core/routes");
const userRoutes_1 = require("./modules/core/userRoutes");
const routes_2 = require("./modules/lead/routes");
const routes_3 = require("./modules/lifecycle/routes");
const routes_4 = require("./modules/property/routes");
const routes_5 = require("./modules/meeting/routes");
const routes_6 = require("./modules/reassignment/routes");
const routes_7 = require("./modules/whatsapp/routes");
const routes_8 = require("./modules/reminder/routes");
const routes_9 = require("./modules/analytics/routes");
const routes_10 = require("./modules/commission/routes");
const routes_11 = require("./modules/blacklist/routes");
const routes_12 = require("./modules/notifications/routes");
const routes_13 = require("./modules/scoring/routes");
const routes_14 = require("./modules/intelligence/routes");
const routes_15 = require("./modules/auth/routes");
const routes_16 = require("./modules/goals/routes");
const routes_17 = require("./modules/conversations/routes");
const createApp = () => {
    const app = (0, express_1.default)();
    app.use((req, res, next) => {
        const origin = req.headers.origin;
        const allowedOrigins = new Set([
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            process.env.FRONTEND_URL, // السماح لرابط الفرونت إند من المتغيرات البيئية
            process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined // السماح لرابط فيرسيل التلقائي
        ].filter(Boolean));
        // إذا لم يكن هناك origin (مثل Postman) أو كان الـ origin مسموحاً به
        if (!origin || allowedOrigins.has(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin || "*");
        }
        // للتسهيل في مرحلة التطوير، إذا أردت السماح للجميع (غير مستحسن للإنتاج الدقيق لكن مفيد للتجربة الأولية)
        // يمكن تفعيل السطر التالي وإلغاء الشرط السابق
        // res.setHeader("Access-Control-Allow-Origin", origin || "*")
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-user-id, x-tenant-id, x-roles");
        if (req.method === "OPTIONS") {
            return res.status(204).end();
        }
        next();
    });
    app.use(express_1.default.json({ limit: "2mb" }));
    app.get("/api/health", (_req, res) => res.json({ ok: true }));
    app.get("/api/debug-env", (_req, res) => {
        const dbUrl = process.env.DATABASE_URL || "NOT_SET";
        const maskedDbUrl = dbUrl.length > 20
            ? `${dbUrl.substring(0, 15)}...${dbUrl.substring(dbUrl.length - 10)}`
            : dbUrl;
        res.json({
            dbUrl: maskedDbUrl,
            nodeEnv: process.env.NODE_ENV,
            port: process.env.PORT
        });
    });
    app.use("/api/auth", routes_15.router);
    app.use(auth_1.authMiddleware);
    app.use(forceReset_1.forceResetMiddleware);
    app.use("/api/core", routes_1.router);
    app.use("/api/users", userRoutes_1.router);
    app.use("/api/leads", routes_2.router);
    app.use("/api/lifecycle", routes_3.router);
    app.use("/api/properties", routes_4.router);
    app.use("/api/meetings", routes_5.router);
    app.use("/api/reassignment", routes_6.router);
    app.use("/api/whatsapp", routes_7.router);
    app.use("/api/reminders", routes_8.router);
    app.use("/api/analytics", routes_9.router);
    app.use("/api/commissions", routes_10.router);
    app.use("/api/blacklist", routes_11.router);
    app.use("/api/notifications", routes_12.router);
    app.use("/api/conversations", routes_17.router);
    app.use("/api/scoring", routes_13.router);
    app.use("/api/intelligence", routes_14.router);
    app.use("/api/goals", routes_16.router);
    app.use(error_1.errorHandler);
    return app;
};
exports.createApp = createApp;
