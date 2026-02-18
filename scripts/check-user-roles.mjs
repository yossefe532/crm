import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const email = "y@gmail.com"
  console.log(`Looking for user with email: ${email}`)

  const user = await prisma.user.findFirst({
    where: { email },
    include: {
      roleLinks: {
        include: {
          role: true
        }
      }
    }
  })

  if (!user) {
    console.error("User not found!")
    return
  }

  console.log("User found:", user.id)
  console.log("Tenant:", user.tenantId)
  console.log("Role Links:", JSON.stringify(user.roleLinks, null, 2))

  if (user.roleLinks.length === 0) {
    console.log("WARNING: User has no roles!")
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
