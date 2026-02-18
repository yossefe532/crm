import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Find owner via roleLinks
  const owner = await prisma.user.findFirst({
    where: {
      roleLinks: {
        some: {
          role: {
            name: "owner"
          }
        }
      }
    }
  })

  if (!owner) {
    console.error("No owner found")
    process.exit(1)
  }

  const tenantId = owner.tenantId
  const randomPhone = "010" + Math.floor(Math.random() * 100000000).toString().padStart(8, "0")
  const randomName = "Test Lead " + Math.floor(Math.random() * 1000)
  const leadCode = "L-" + Date.now()

  console.log(`Creating lead for tenant ${tenantId} with phone ${randomPhone}...`)

  try {
    const lead = await prisma.lead.create({
      data: {
        tenantId,
        leadCode,
        name: randomName,
        phone: randomPhone,
        status: "new",
        sourceLabel: "manual", // Fixed field name
        priority: "normal"
      }
    })
    console.log("Lead created successfully:", lead.id)
  } catch (error) {
    console.error("Failed to create lead:", error)
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
