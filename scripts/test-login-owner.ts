
import { authService } from "../src/modules/auth/service"
import { prisma } from "../src/prisma/client"

async function main() {
  const email = "y@gmail.com"
  const password = "123456789"

  console.log(`Attempting login for: ${email}`)

  try {
    const result = await authService.login({
      email,
      password
    })

    console.log("Login successful!")
    console.log("Token generated:", result.token ? "Yes" : "No")
    console.log("User Role:", result.user.roles)
    console.log("Tenant ID:", result.user.tenantId)

  } catch (e) {
    console.error("Login failed:", e)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
