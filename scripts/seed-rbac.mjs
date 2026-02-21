import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const permissions = [
  { code: "roles.read", description: "Read roles", moduleKey: "roles" },
  { code: "roles.create", description: "Create roles", moduleKey: "roles" },
  { code: "roles.update", description: "Update role permissions", moduleKey: "roles" },
  { code: "permissions.read", description: "Read permissions", moduleKey: "roles" },
  { code: "users.read", description: "Read users", moduleKey: "users" },
  { code: "users.create", description: "Create users", moduleKey: "users" },
  { code: "users.update", description: "Update users", moduleKey: "users" },
  { code: "users.delete", description: "Delete users", moduleKey: "users" },
  { code: "user_requests.create", description: "Create user requests", moduleKey: "users" },
  { code: "user_requests.read", description: "Read user requests", moduleKey: "users" },
  { code: "user_requests.decide", description: "Decide user requests", moduleKey: "users" },
  { code: "teams.read", description: "Read teams", moduleKey: "teams" },
  { code: "leads.read", description: "Read leads", moduleKey: "leads" },
  { code: "leads.create", description: "Create leads", moduleKey: "leads" },
  { code: "leads.update", description: "Update leads", moduleKey: "leads" },
  { code: "leads.delete", description: "Delete leads", moduleKey: "leads" },
  { code: "leads.assign", description: "Assign leads", moduleKey: "leads" },
  { code: "meetings.read", description: "Read meetings", moduleKey: "meetings" },
  { code: "meetings.create", description: "Create meetings", moduleKey: "meetings" },
  { code: "meetings.update", description: "Update meetings", moduleKey: "meetings" },
  { code: "notifications.read", description: "Read notifications", moduleKey: "notifications" },
  { code: "analytics.read", description: "Read analytics", moduleKey: "analytics" },
  { code: "analytics.create", description: "Create analytics", moduleKey: "analytics" },
  { code: "commissions.read", description: "Read commissions", moduleKey: "commissions" },
  { code: "lead_sources.read", description: "Read lead sources", moduleKey: "lead_sources" },
  { code: "lead_sources.create", description: "Create lead sources", moduleKey: "lead_sources" },
  { code: "contacts.read", description: "Read contacts", moduleKey: "contacts" },
  { code: "contacts.create", description: "Create contacts", moduleKey: "contacts" },
  { code: "notes.create", description: "Create notes", moduleKey: "notes" },
  { code: "finance.read", description: "Read finance entries", moduleKey: "finance" },
  { code: "finance.create", description: "Create finance entries", moduleKey: "finance" },
  { code: "conversations.read", description: "Read conversations", moduleKey: "conversations" },
  { code: "conversations.create", description: "Create conversations", moduleKey: "conversations" },
  { code: "messages.read", description: "Read messages", moduleKey: "conversations" },
  { code: "messages.send", description: "Send messages", moduleKey: "conversations" }
]

const rolePermissions = {
  owner: permissions.map((permission) => permission.code),
  team_leader: [
    "users.read",
    "user_requests.create",
    "user_requests.read",
    "teams.read",
    "leads.read",
    "leads.create",
    "leads.update",
    "leads.assign",
    "meetings.read",
    "meetings.create",
    "meetings.update",
    "notifications.read",
    "analytics.read",
    "analytics.create",
    "commissions.read",
    "lead_sources.read",
    "contacts.read",
    "contacts.create",
    "notes.create",
    "conversations.read",
    "conversations.create",
    "messages.read",
    "messages.send"
  ],
  sales: [
    "leads.read",
    "leads.create",
    "leads.update",
    "meetings.read",
    "meetings.create",
    "meetings.update",
    "notifications.read",
    "analytics.read",
    "commissions.read",
    "notes.create",
    "conversations.read",
    "conversations.create",
    "messages.read",
    "messages.send"
  ]
}

const tenantArg = process.argv.find((arg) => arg.startsWith("--tenant="))
const tenantId = tenantArg ? tenantArg.split("=")[1] : undefined

const main = async () => {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description, moduleKey: permission.moduleKey },
      create: { code: permission.code, description: permission.description, moduleKey: permission.moduleKey }
    })
  }

  const tenants = await prisma.tenant.findMany({
    where: tenantId ? { id: tenantId } : { deletedAt: null }
  })

  const permissionRows = await prisma.permission.findMany({
    where: { code: { in: permissions.map((permission) => permission.code) } }
  })
  const permissionByCode = new Map(permissionRows.map((row) => [row.code, row.id]))

  for (const tenant of tenants) {
    const roles = new Map()
    for (const roleName of Object.keys(rolePermissions)) {
      let role = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: roleName, deletedAt: null } })
      if (!role) {
        role = await prisma.role.create({ data: { tenantId: tenant.id, name: roleName, scope: "tenant" } })
      }
      roles.set(roleName, role)
    }

    for (const [roleName, codes] of Object.entries(rolePermissions)) {
      const role = roles.get(roleName)
      if (!role) continue
      const desiredPermissionIds = codes
        .map((code) => permissionByCode.get(code))
        .filter((id) => Boolean(id))
        .map((id) => id)

      const existing = await prisma.rolePermission.findMany({
        where: { tenantId: tenant.id, roleId: role.id },
        select: { permissionId: true }
      })
      const existingSet = new Set(existing.map((row) => row.permissionId))
      const toCreate = desiredPermissionIds
        .filter((id) => !existingSet.has(id))
        .map((permissionId) => ({ tenantId: tenant.id, roleId: role.id, permissionId }))

      if (toCreate.length) {
        await prisma.rolePermission.createMany({ data: toCreate })
      }
    }
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
