
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    include: { tenant: true },
    orderBy: { createdAt: "desc" },
    take: 5
  })

  console.log("Recent Users:")
  users.forEach(u => {
    console.log(`- ID: ${u.id}`)
    console.log(`  Email: ${u.email}`)
    console.log(`  Tenant: ${u.tenant.name} (${u.tenantId})`)
    console.log(`  Created: ${u.createdAt}`)
    console.log(`  Status: ${u.status}`)
    console.log(`  Password Hash: ${u.passwordHash ? "Present" : "Missing"}`)
    console.log("---")
  })
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
