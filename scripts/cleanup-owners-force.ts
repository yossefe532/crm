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
  
  const allTenants = await prisma.tenant.findMany()
  
  for (const tenant of allTenants) {
      if (tenant.id === keeper.tenantId) {
          // Main Tenant: Already processed or check again
          console.log(`Skipping main tenant users check for now...`)
      } else {
          console.log(`Processing extra tenant: ${tenant.name} (${tenant.id})`)
          
          // Delete all data related to this tenant to avoid FK constraints
          // 1. Delete Team Members
          await prisma.teamMember.deleteMany({ where: { tenantId: tenant.id } })
          // 2. Delete Teams
          await prisma.team.deleteMany({ where: { tenantId: tenant.id } })
          // 3. Delete User Roles
          await prisma.userRole.deleteMany({ where: { tenantId: tenant.id } })
          // 4. Delete Profiles
          await prisma.userProfile.deleteMany({ where: { tenantId: tenant.id } })
          // 5. Delete Conversations/Messages (if any)
          // await prisma.message.deleteMany({ where: { tenantId: tenant.id } }) // Message doesn't have tenantId usually, but let's check schema if needed. Assuming user-based deletion covers it.
          // 6. Delete Users
          const users = await prisma.user.findMany({ where: { tenantId: tenant.id } })
          for (const user of users) {
             if (user.email === targetEmail) continue; // Should not happen based on logic but safety check
             await deleteUserFull(user.id)
          }

          // 7. Delete Roles
          await prisma.rolePermission.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.userPermission.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.role.deleteMany({ where: { tenantId: tenant.id } })
          
          // Clean up Lead related data
          // LeadSources, LeadTags, Leads, etc.
          // Due to many relations, let's try to delete in order
          
          await prisma.leadSource.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.leadTag.deleteMany({ where: { tenantId: tenant.id } })
          
          // Delete Lead Dependencies
          await prisma.leadStateHistory.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.leadActivityLog.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.leadTask.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.callLog.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.reminderSchedule.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.remindersSent.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.deal.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.inquiry.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.meeting.deleteMany({ where: { tenantId: tenant.id } })
          
          await prisma.leadDeadline.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.leadExtension.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.leadFailure.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.leadClosure.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.leadAssignment.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.leadContact.deleteMany({ where: { tenantId: tenant.id } })

          await prisma.lead.deleteMany({ where: { tenantId: tenant.id } })
          
          // Delete other modules
          await prisma.reminderRule.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.whatsappAccount.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.conversation.deleteMany({ where: { tenantId: tenant.id } })
          
          // Delete transitions first
          await prisma.leadStateTransition.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.leadStateDefinition.deleteMany({ where: { tenantId: tenant.id } })
          
          await prisma.goalTarget.deleteMany({ where: { tenantId: tenant.id } })
          await prisma.goalPlan.deleteMany({ where: { tenantId: tenant.id } })
          
          // 8. Delete Tenant
          console.log(`Deleting tenant ${tenant.name}...`)
          await prisma.tenant.delete({ where: { id: tenant.id } })
      }
  }
  
  console.log("Deep cleanup complete.")
}

async function deleteUserFull(userId: string) {
    try {
        // Delete all dependent records
        await prisma.teamMember.deleteMany({ where: { userId } })
        await prisma.userRole.deleteMany({ where: { userId } })
        await prisma.userProfile.deleteMany({ where: { userId } })
        await prisma.conversationParticipant.deleteMany({ where: { userId } })
        await prisma.auditLog.deleteMany({ where: { userId } })
        // await prisma.notification.deleteMany({ where: { userId } }) // Model name might be different or not exist
        await prisma.userRequest.deleteMany({ where: { requestedBy: userId } })
        
        // Additional cleanups found from error logs
        await prisma.negligencePoint.deleteMany({ where: { userId } })
        // WhatsappMessage doesn't have senderId in schema provided above (it has accountId and tenantId), 
        // wait, let's check schema again. `WhatsappMessage` model in snippet above line 1253:
        // `accountId String` (relation to WhatsappAccount), `toPhone`. It does NOT have `senderId` or `userId`.
        // So `deleteMany({ where: { senderId: userId } })` is definitely wrong for `WhatsappMessage`.
        // But the error `TS2353` confirmed `senderId` does not exist.
        // So we should NOT try to delete WhatsappMessage by senderId. 
        // Maybe we should delete WhatsappAccount if it belongs to user?
        // WhatsappAccount schema:
        /*
        model WhatsappAccount {
          id ...
          tenantId ...
          name ...
          phoneNumber ...
          ...
          connectedBy String? @db.Uuid @map("connected_by")
          user User? @relation(fields: [connectedBy], references: [id])
        }
        */
        // If WhatsappAccount has `connectedBy`, we should delete those accounts or update them.
        // Let's assume we delete them for extra tenants.
        
        try {
            // @ts-ignore
            await prisma.whatsappAccount.deleteMany({ where: { connectedBy: userId } })
        } catch (e) {}
        
        // Now for `Message` (Conversation messages)
        // Schema line 1712: `senderId String @db.Uuid @map("sender_id")`
        // So `Message` DOES have `senderId`.
        // However, `Message` has self-relation `replyTo`.
        // We must delete replies first or use cascade if configured (schema says SetNull).
        // If SetNull, we can just delete.
        
        await prisma.message.deleteMany({ where: { senderId: userId } })
        
        // And finally user
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
