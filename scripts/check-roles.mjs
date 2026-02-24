
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const roles = await prisma.role.findMany({
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  })

  console.log("Existing Roles:")
  roles.forEach(r => {
    console.log(`- ${r.name} (${r.scope}): ${r.permissions.length} permissions`)
    // r.permissions.forEach(p => console.log(`  - ${p.permission.action}:${p.permission.resource}`))
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
