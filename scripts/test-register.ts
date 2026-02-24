
import { authService } from "../src/modules/auth/service"
import { prisma } from "../src/prisma/client"

async function main() {
  const email = `test-owner-${Date.now()}@example.com`
  const password = "Password123!"
  const tenantName = "Test Company"

  console.log(`Attempting to register: ${email}`)

  try {
    const result = await authService.register({
      tenantName,
      email,
      password,
      timezone: "UTC"
    })

    console.log("Registration successful!")
    console.log("User ID:", result.user.id)
    console.log("Tenant ID:", result.user.tenantId)

    // Verify in DB
    const user = await prisma.user.findUnique({ where: { id: result.user.id } })
    console.log("User in DB:", user ? "Found" : "Not Found")

  } catch (e) {
    console.error("Registration failed:", e)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
