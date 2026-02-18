
import { prisma } from "../src/prisma/client"
import jwt from "jsonwebtoken"
import { env } from "../src/config/env"

async function main() {
  const email = "mohamed@gmail.com" // Or any active user
  const user = await prisma.user.findFirst({
    where: { email, status: "active" },
    include: { tenant: true }
  })

  if (!user) {
    console.error("User not found or inactive")
    process.exit(1)
  }

  // Get roles
  const roleLinks = await prisma.userRole.findMany({
    where: { userId: user.id, revokedAt: null },
    include: { role: true }
  })
  const roles = roleLinks.map(r => r.role.name)
  if (roles.length === 0) roles.push("sales")

  const payload = {
    id: user.id,
    tenantId: user.tenantId,
    roles,
    forceReset: user.mustChangePassword
  }

  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" })
  console.log("Token:", token)
  console.log("Payload:", payload)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
