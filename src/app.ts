import express from "express"
import cors from "cors"
import { authMiddleware } from "./middleware/auth"
import { forceResetMiddleware } from "./middleware/forceReset"
import { errorHandler } from "./middleware/error"
import { router as coreRouter } from "./modules/core/routes"
import { router as userRouter } from "./modules/core/userRoutes"
import { router as leadRouter } from "./modules/lead/routes"
import { router as lifecycleRouter } from "./modules/lifecycle/routes"
import { router as propertyRouter } from "./modules/property/routes"
import { router as meetingRouter } from "./modules/meeting/routes"
import { router as reassignmentRouter } from "./modules/reassignment/routes"
import { router as whatsappRouter } from "./modules/whatsapp/routes"
import { router as reminderRouter } from "./modules/reminder/routes"
import { router as analyticsRouter } from "./modules/analytics/routes"
import { router as commissionRouter } from "./modules/commission/routes"
import { router as blacklistRouter } from "./modules/blacklist/routes"
import { router as notificationRouter } from "./modules/notifications/routes"
import { router as scoringRouter } from "./modules/scoring/routes"
import { router as intelligenceRouter } from "./modules/intelligence/routes"
import { router as authRouter } from "./modules/auth/routes"
import { router as goalsRouter } from "./modules/goals/routes"
import { router as conversationRouter } from "./modules/conversations/routes"
import { router as taskRouter } from "./modules/tasks/routes"

export const createApp = () => {
  const app = express()

  // CORS Configuration
  app.use(cors({
    origin: true, // Allow any origin
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-tenant-id", "x-roles"],
    exposedHeaders: ["Content-Length", "X-Total-Count"]
  }))

  // Handle preflight requests
  app.options("*", cors())

  // Health checks
  app.get("/", (_req, res) => res.send("Server is running"))
  app.get("/health", (_req, res) => res.json({ ok: true }))
  
  app.use(express.json({ limit: "50mb" }))
  app.use(express.urlencoded({ extended: true, limit: "50mb" }))

  // Base API route to prevent 404s
  app.get("/api", (_req, res) => res.json({ 
    status: "online", 
    message: "CRM API is running",
    timestamp: new Date().toISOString()
  }))

  app.get("/api/health", (_req, res) => res.json({ ok: true }))
  app.get("/api/debug-env", (_req, res) => {
    const dbUrl = process.env.DATABASE_URL || "NOT_SET"
    const maskedDbUrl = dbUrl.length > 20 
      ? `${dbUrl.substring(0, 15)}...${dbUrl.substring(dbUrl.length - 10)}` 
      : dbUrl
    res.json({ 
      dbUrl: maskedDbUrl,
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT
    })
  })
  app.use("/api/auth", authRouter)
  app.use(authMiddleware)
  app.use(forceResetMiddleware)

  app.use("/api/core", coreRouter)
  app.use("/api/users", userRouter)
  app.use("/api/leads", leadRouter)
  app.use("/api/lifecycle", lifecycleRouter)
  app.use("/api/properties", propertyRouter)
  app.use("/api/meetings", meetingRouter)
  app.use("/api/reassignment", reassignmentRouter)
  app.use("/api/whatsapp", whatsappRouter)
  app.use("/api/reminders", reminderRouter)
  app.use("/api/analytics", analyticsRouter)
  app.use("/api/commissions", commissionRouter)
  app.use("/api/blacklist", blacklistRouter)
  app.use("/api/notifications", notificationRouter)
  app.use("/api/conversations", conversationRouter)
  app.use("/api/scoring", scoringRouter)
  app.use("/api/intelligence", intelligenceRouter)
  app.use("/api/goals", goalsRouter)
  app.use("/api/tasks", taskRouter)

  app.use(errorHandler)
  return app
}
