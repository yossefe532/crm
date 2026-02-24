
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { email: "y@gmail.com" }
  })
  console.log("Users found:", users.length)
  users.forEach(u => {
    console.log(`User: ${u.email}, ID: ${u.id}, Hash: ${u.passwordHash.substring(0, 20)}..., Status: ${u.status}`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
