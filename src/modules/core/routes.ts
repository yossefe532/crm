import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { coreController } from "./controller"
import { requireOwner, requirePermission } from "../../middleware/rbac"

export const router = Router()

router.post("/tenants", asyncHandler(coreController.createTenant))
router.get("/tenants", asyncHandler(coreController.listTenants))

router.post("/users", requirePermission("users.create"), asyncHandler(coreController.createUser))
router.get("/users", requirePermission("users.read"), asyncHandler(coreController.listUsers))
router.get("/users/:userId/audit", requireOwner, requirePermission("users.read"), asyncHandler(coreController.listUserAuditLogs))
router.post("/users/:userId/transfer", requireOwner, requirePermission("users.update"), asyncHandler(coreController.transferUserTeam))
router.post("/users/:userId/promote", requireOwner, requirePermission("users.update"), asyncHandler(coreController.promoteToTeamLeader))
router.post("/user-requests", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader")) return next()
  return requirePermission("user_requests.create")(req, res, next)
}, asyncHandler(coreController.createUserRequest))
router.get("/user-requests", requirePermission("user_requests.read"), asyncHandler(coreController.listUserRequests))
router.post("/user-requests/:requestId/decide", requirePermission("user_requests.decide"), asyncHandler(coreController.decideUserRequest))

router.post("/roles", requireOwner, requirePermission("roles.create"), asyncHandler(coreController.createRole))
router.get("/roles", requireOwner, requirePermission("roles.read"), asyncHandler(coreController.listRoles))
router.get("/permissions", requireOwner, requirePermission("permissions.read"), asyncHandler(coreController.listPermissions))
router.get("/roles/:roleId/permissions", requireOwner, requirePermission("roles.read"), asyncHandler(coreController.listRolePermissions))
router.put("/roles/:roleId/permissions", requireOwner, requirePermission("roles.update"), asyncHandler(coreController.updateRolePermissions))

router.post("/teams", requirePermission("teams.create"), asyncHandler(coreController.createTeam))
router.get("/teams", requirePermission("teams.read"), asyncHandler(coreController.listTeams))
router.delete("/teams/:teamId", requireOwner, requirePermission("teams.delete"), asyncHandler(coreController.deleteTeam))

router.post("/files", requirePermission("files.create"), asyncHandler(coreController.createFile))
router.post("/icons", requirePermission("icons.create"), asyncHandler(coreController.createIcon))
router.get("/icons", requirePermission("icons.read"), asyncHandler(coreController.listIcons))
router.post("/notes", requirePermission("notes.create"), asyncHandler(coreController.createNote))
router.post("/contacts", requirePermission("contacts.create"), asyncHandler(coreController.createContact))
router.get("/contacts", requirePermission("contacts.read"), asyncHandler(coreController.listContacts))
router.post("/finance", requirePermission("finance.create"), asyncHandler(coreController.createFinanceEntry))
router.get("/finance", requirePermission("finance.read"), asyncHandler(coreController.listFinanceEntries))

// Backup & Import (Owner only)
router.get("/backup/export", requireOwner, asyncHandler(coreController.exportBackup))
router.post("/backup/import", requireOwner, asyncHandler(coreController.importBackup))
