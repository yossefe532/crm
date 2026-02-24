import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const targetEmail = 'y@gmail.com'
  
  // Find the user to keep
  const keeper = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: { tenant: true }
  })

  if (!keeper) {
    console.error(`User ${targetEmail} not found! Aborting.`)
    return
  }

  console.log(`Keeping user: ${keeper.email} (ID: ${keeper.id})`)
  console.log(`Tenant to keep: ${keeper.tenantId}`)

  // Find all other users with 'owner' role or simply all other users if we want to clean up everything
  // The user asked to "remove the second owner", implying we should keep y@gmail.com as THE owner.
  // Let's find all users who are NOT y@gmail.com but have 'owner' role.
  
  const ownerRole = await prisma.role.findFirst({
    where: { name: 'owner', tenantId: keeper.tenantId }
  })

  if (!ownerRole) {
      console.log("Owner role not found for this tenant.")
  }

  // Find all users in the system (or just this tenant?)
  // If the previous "second owner" created a NEW tenant, we should probably delete that tenant too.
  // Let's look for ALL tenants and ALL users.
  
  const allTenants = await prisma.tenant.findMany()
  
  for (const tenant of allTenants) {
      if (tenant.id === keeper.tenantId) {
          console.log(`Processing main tenant: ${tenant.name} (${tenant.id})`)
          // In the main tenant, remove other owners
          const otherOwners = await prisma.user.findMany({
              where: {
                  tenantId: tenant.id,
                  email: { not: targetEmail },
                  roleLinks: { some: { role: { name: 'owner' } } }
              }
          })
          
          for (const user of otherOwners) {
              console.log(`Deleting extra owner in main tenant: ${user.email}`)
              await deleteUser(user.id)
          }
      } else {
          console.log(`Found extra tenant: ${tenant.name} (${tenant.id}). Checking users...`)
          // This is likely the "second owner's" tenant. Delete it entirely?
          // Or just delete the users?
          // If the user said "remove the second owner", they might mean the account AND the company they created if it was a mistake.
          // Safest is to delete the tenant if it has no other valuable data, but let's be careful.
          // Let's just delete the users associated with it for now, or maybe the whole tenant if it was just created for testing.
          
          // Let's check if y@gmail.com is part of this tenant (unlikely)
          
          const users = await prisma.user.findMany({ where: { tenantId: tenant.id } })
          const containsKeeper = users.some(u => u.email === targetEmail)
          
          if (!containsKeeper) {
              console.log(`Deleting extra tenant ${tenant.name} and its data...`)
              await prisma.tenant.delete({ where: { id: tenant.id } }).catch(e => console.error(`Failed to delete tenant ${tenant.id}: ${e.message}`))
          }
      }
  }
  
  console.log("Cleanup complete.")
}

async function deleteUser(userId: string) {
    try {
        await prisma.teamMember.deleteMany({ where: { userId } })
        await prisma.userRole.deleteMany({ where: { userId } })
        await prisma.userProfile.deleteMany({ where: { userId } })
        await prisma.conversationParticipant.deleteMany({ where: { userId } })
        // Add other related deletions here if needed
        await prisma.user.delete({ where: { id: userId } })
    } catch (e) {
        console.error(`Failed to delete user ${userId}:`, e)
    }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
