
import { PrismaClient } from "@prisma/client"
import { seedRbacForTenant } from "../src/modules/auth/rbacSeed"
import { hashPassword } from "../src/modules/auth/password"

const prisma = new PrismaClient()

async function main() {
  console.log("🚀 Starting production initialization...")

  const email = "y@gmail.com"
  const password = "123456789" // In production, this should be an env var or prompt
  const tenantName = "CRM Doctor Main Tenant"

  // 1. Create Tenant
  console.log("🏢 Creating/Finding Tenant...")
  // Since DB is empty, we create a new one. In future runs, we might want to find existing.
  // For safety, let's try to find first or create.
  let tenant = await prisma.tenant.findFirst({
    where: { name: tenantName }
  })

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        status: "active",
        timezone: "Africa/Cairo" // Assuming Cairo based on context (Arabic)
      }
    })
    console.log(`✅ Tenant created: ${tenant.id}`)
  } else {
    console.log(`ℹ️ Tenant already exists: ${tenant.id}`)
  }

  // 2. Seed RBAC (Roles & Permissions)
  console.log("🛡️ Seeding RBAC...")
  
  // Ensure roles exist before seeding permissions
  const roles = ["owner", "team_leader", "sales"]
  for (const roleName of roles) {
    const existingRole = await prisma.role.findFirst({
      where: {
        tenantId: tenant.id,
        name: roleName
      }
    })

    if (!existingRole) {
      await prisma.role.create({
        data: {
          name: roleName,
          tenantId: tenant.id,
          scope: "tenant"
        }
      })
      console.log(`Role created: ${roleName}`)
    } else {
      console.log(`Role already exists: ${roleName}`)
    }
  }

  await seedRbacForTenant(tenant.id)
  console.log("✅ RBAC seeded successfully.")

  // 3. Create Owner User
  console.log("👤 Creating Owner User...")
  
  const hashedPassword = await hashPassword(password)

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hashedPassword, // Ensure password is correct if user exists
      tenantId: tenant.id
    },
    create: {
      email,
      passwordHash: hashedPassword,
      tenantId: tenant.id,
      status: "active",
      mustChangePassword: false,
      profile: {
        create: {
          firstName: "Admin",
          lastName: "User",
          tenantId: tenant.id
        }
      }
    }
  })
  console.log(`✅ User created/updated: ${user.id} (${user.email})`)

  // 4. Assign Owner Role
  console.log("👑 Assigning Owner Role...")
  const ownerRole = await prisma.role.findFirst({
    where: { 
      tenantId: tenant.id,
      name: "owner" 
    }
  })

  if (!ownerRole) {
    throw new Error("❌ Owner role not found! RBAC seeding might have failed.")
  }

  // Check if user already has this role
  const existingAssignment = await prisma.userRole.findFirst({
    where: {
      userId: user.id,
      roleId: ownerRole.id,
      tenantId: tenant.id
    }
  })

  if (!existingAssignment) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: ownerRole.id,
        tenantId: tenant.id
      }
    })
    console.log("✅ Owner role assigned.")
  } else {
    console.log("ℹ️ User already has Owner role.")
  }

  console.log("\n🎉 Initialization Complete!")
  console.log(`👉 You can now login with: ${email} / ${password}`)
}

main()
  .catch((e) => {
    console.error("❌ Error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
