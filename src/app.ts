import express from "express"
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

export const createApp = () => {
  const app = express()

  // CORS Middleware - MUST be first
  app.use((req, res, next) => {
    const origin = req.headers.origin
    
    // Allow any origin that connects (Reflection)
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin)
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*")
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS, POST, PUT, DELETE, PATCH")
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-id, x-tenant-id, x-roles")
    res.setHeader("Access-Control-Allow-Credentials", "true")

    if (req.method === "OPTIONS") {
      return res.status(200).end()
    }
    next()
  })

  // Health checks
  app.get("/", (_req, res) => res.send("Server is running"))
  app.get("/health", (_req, res) => res.json({ ok: true }))
  
  app.use(express.json({ limit: "2mb" }))
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

  app.use(errorHandler)
  return app
}
