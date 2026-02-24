
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const permissionsList = [
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
  { code: "icons.read", description: "Read icons", moduleKey: "icons" },
  { code: "icons.create", description: "Create icons", moduleKey: "icons" },
  { code: "teams.read", description: "Read teams", moduleKey: "teams" },
  { code: "teams.create", description: "Create teams", moduleKey: "teams" },
  { code: "teams.delete", description: "Delete teams", moduleKey: "teams" },
  { code: "leads.read", description: "Read leads", moduleKey: "leads" },
  { code: "leads.create", description: "Create leads", moduleKey: "leads" },
  { code: "leads.update", description: "Update leads", moduleKey: "leads" },
  { code: "leads.assign", description: "Assign leads", moduleKey: "leads" },
  { code: "meetings.read", description: "Read meetings", moduleKey: "meetings" },
  { code: "meetings.create", description: "Create meetings", moduleKey: "meetings" },
  { code: "meetings.update", description: "Update meetings", moduleKey: "meetings" },
  { code: "notifications.read", description: "Read notifications", moduleKey: "notifications" },
  { code: "goals.read", description: "Read goals", moduleKey: "goals" },
  { code: "goals.create", description: "Create goals", moduleKey: "goals" },
  { code: "goals.update", description: "Update goals", moduleKey: "goals" },
  { code: "analytics.read", description: "Read analytics", moduleKey: "analytics" },
  { code: "analytics.create", description: "Create analytics", moduleKey: "analytics" },
  { code: "commissions.read", description: "Read commissions", moduleKey: "commissions" },
  { code: "lead_sources.read", description: "Read lead sources", moduleKey: "lead_sources" },
  { code: "lead_sources.create", description: "Create lead sources", moduleKey: "lead_sources" },
  { code: "contacts.read", description: "Read contacts", moduleKey: "contacts" },
  { code: "contacts.create", description: "Create contacts", moduleKey: "contacts" },
  { code: "finance.read", description: "Read finance entries", moduleKey: "finance" },
  { code: "finance.create", description: "Create finance entries", moduleKey: "finance" },
  { code: "conversations.read", description: "Read conversations", moduleKey: "conversations" },
  { code: "conversations.create", description: "Create conversations", moduleKey: "conversations" },
  { code: "messages.read", description: "Read messages", moduleKey: "conversations" },
  { code: "messages.send", description: "Send messages", moduleKey: "conversations" }
]

const rolePermissionsConfig = {
  owner: permissionsList.map((p) => p.code),
  team_leader: [
    "permissions.read",
    "users.read",
    "users.update",
    "user_requests.create",
    "user_requests.read",
    "icons.read",
    "icons.create",
    "teams.read",
    "teams.delete",
    "leads.read",
    "leads.create",
    "leads.update",
    "leads.assign",
    "meetings.read",
    "meetings.create",
    "meetings.update",
    "notifications.read",
    "goals.read",
    "analytics.read",
    "analytics.create",
    "commissions.read",
    "lead_sources.read",
    "contacts.read",
    "contacts.create",
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
    "goals.read",
    "analytics.read",
    "commissions.read",
    "conversations.read",
    "conversations.create",
    "messages.read",
    "messages.send"
  ]
}

async function main() {
  console.log("Starting role fix...")
  
  // 1. Get Tenant
  const tenant = await prisma.tenant.findFirst({
    where: { deletedAt: null, status: "active" }
  })
  if (!tenant) throw new Error("No active tenant found")
  console.log("Tenant:", tenant.id)

  // 2. Ensure Permissions Exist
  console.log("Upserting permissions...")
  for (const p of permissionsList) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { description: p.description, moduleKey: p.moduleKey },
      create: { code: p.code, description: p.description, moduleKey: p.moduleKey }
    })
  }

  // 3. Ensure Roles Exist
  const rolesToEnsure = ["owner", "team_leader", "sales"]
  for (const roleName of rolesToEnsure) {
    let role = await prisma.role.findFirst({
      where: { tenantId: tenant.id, name: roleName, deletedAt: null }
    })
    
    if (!role) {
      console.log(`Creating role: ${roleName}`)
      role = await prisma.role.create({
        data: {
          tenantId: tenant.id,
          name: roleName,
          scope: "tenant"
        }
      })
    } else {
      console.log(`Role exists: ${roleName}`)
    }

    // 4. Assign Permissions
    const codes = rolePermissionsConfig[roleName] || []
    if (codes.length === 0) continue

    const perms = await prisma.permission.findMany({
      where: { code: { in: codes } }
    })

    // Delete existing permissions for this role to ensure clean slate (or just add missing)
    // To be safe, let's find missing ones
    const existingRolePerms = await prisma.rolePermission.findMany({
      where: { tenantId: tenant.id, roleId: role.id },
      select: { permissionId: true }
    })
    const existingIds = new Set(existingRolePerms.map(rp => rp.permissionId))

    const toAdd = perms.filter(p => !existingIds.has(p.id))
    
    if (toAdd.length > 0) {
      console.log(`Adding ${toAdd.length} permissions to ${roleName}`)
      await prisma.rolePermission.createMany({
        data: toAdd.map(p => ({
          tenantId: tenant.id,
          roleId: role.id,
          permissionId: p.id
        }))
      })
    } else {
      console.log(`Permissions up to date for ${roleName}`)
    }
  }
  
  // 5. Handle "تيم ليدر" - if it exists, maybe migrate users to "team_leader" and delete it?
  // Or just leave it. The user asked for Team Leader and Sales. "team_leader" and "sales" are the system keys.
  // If the user meant they want to SEE "Team Leader", the UI might translate "team_leader".
  // Let's check if there are users in "تيم ليدر"
  const arabicTeamLeader = await prisma.role.findFirst({
    where: { tenantId: tenant.id, name: "تيم ليدر", deletedAt: null }
  })
  
  if (arabicTeamLeader) {
    console.log("Found Arabic 'تيم ليدر' role. Migrating users to 'team_leader'...")
    const teamLeaderRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: "team_leader" } })
    
    if (teamLeaderRole) {
       const userRoles = await prisma.userRole.findMany({
         where: { roleId: arabicTeamLeader.id }
       })
       
       for (const ur of userRoles) {
         // Check if already has team_leader
         const exists = await prisma.userRole.findFirst({
           where: { userId: ur.userId, roleId: teamLeaderRole.id, tenantId: tenant.id }
         })
         if (!exists) {
           await prisma.userRole.create({
             data: {
               tenantId: tenant.id,
               userId: ur.userId,
               roleId: teamLeaderRole.id,
               assignedBy: ur.assignedBy
             }
           })
           console.log(`Migrated user ${ur.userId} to team_leader`)
         }
       }
       
       // Optionally delete the Arabic role or keep it.
       // The user said they were "deleted", implying they want them back.
       // If I created "team_leader", I fulfilled the system requirement.
       // I'll leave the Arabic one for now to avoid data loss if I'm wrong about it being useless.
    }
  }

}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
