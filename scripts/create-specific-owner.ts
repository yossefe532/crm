
import { authService } from "../src/modules/auth/service"
import { prisma } from "../src/prisma/client"
import { hashPassword } from "../src/modules/auth/password"

async function main() {
  const email = "y@gmail.com"
  const password = "123456789"
  const tenantName = "El Doctor Real Estate"

  console.log(`Processing Owner Account: ${email}`)

  try {
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: { email }
    })

    if (existingUser) {
      console.log("User already exists. Updating password and ensuring Owner role...")
      
      const passwordHash = await hashPassword(password)
      
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { 
          passwordHash,
          status: "active",
          deletedAt: null
        }
      })

      // Ensure Owner Role
      const ownerRole = await prisma.role.findFirst({
        where: { tenantId: existingUser.tenantId, name: "owner" }
      })

      if (ownerRole) {
        const userRole = await prisma.userRole.findFirst({
            where: { userId: existingUser.id, roleId: ownerRole.id }
        })

        if (!userRole) {
             await prisma.userRole.create({
                data: {
                    userId: existingUser.id,
                    roleId: ownerRole.id,
                    tenantId: existingUser.tenantId
                }
             })
             console.log("Owner role assigned.")
        } else {
            console.log("User already has Owner role.")
        }
      }

      console.log("Password updated successfully.")

    } else {
      console.log("Creating new Owner account...")
      const result = await authService.register({
        tenantName,
        email,
        password,
        timezone: "UTC"
      })
      console.log("Account created successfully!")
      console.log("User ID:", result.user.id)
      console.log("Tenant ID:", result.user.tenantId)
    }

  } catch (e) {
    console.error("Operation failed:", e)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
