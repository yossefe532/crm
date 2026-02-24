
import { PrismaClient } from "@prisma/client"
import { conversationService } from "../src/modules/conversations/service"
import { notificationService } from "../src/modules/notifications/service"

const prisma = new PrismaClient()

// Mock Notification Service
const originalSend = notificationService.send
let lastNotification: any = null
let lastNotificationsMany: any[] = []

notificationService.send = async (data) => {
  console.log("[NOTIFICATION SENT]", JSON.stringify(data, null, 2))
  lastNotification = data
  return originalSend(data)
}

notificationService.sendMany = async (userIds, data: any) => {
  console.log(`[NOTIFICATION SENT MANY] To: ${userIds.join(", ")}`, JSON.stringify(data, null, 2))
  lastNotificationsMany.push({ userIds, data })
  return userIds.map(uid => ({
      id: "mock-id",
      tenantId: "mock-tenant",
      userId: uid,
      type: data.type,
      title: data.title,
      message: data.message,
      isRead: false,
      createdAt: new Date(),
      entityType: data.entityType,
      entityId: data.entityId,
      actionUrl: data.actionUrl,
      senderId: data.senderId,
      sender: null
  })) as any
}

// Mock Socket.IO
const socketPath = "../src/socket"
try {
  const socketModule = require(socketPath)
  // Ensure we don't break existing socket if it exists
  if (!socketModule.getIO) {
      socketModule.getIO = () => ({
        to: (room: string) => ({
          emit: (event: string, data: any) => {
            console.log(`[SOCKET EMIT] Room: ${room}, Event: ${event}, Data:`, JSON.stringify(data, null, 2))
          }
        })
      })
  } else {
      // Wrap existing
      const originalGetIO = socketModule.getIO
      socketModule.getIO = () => {
          try {
              return originalGetIO()
          } catch (e) {
              return {
                  to: (room: string) => ({
                      emit: (event: string, data: any) => {
                          console.log(`[SOCKET EMIT MOCKED] Room: ${room}, Event: ${event}, Data:`, JSON.stringify(data, null, 2))
                      }
                  })
              }
          }
      }
  }
} catch (e) {
  console.warn("Could not mock socket.io", e)
}

async function main() {
  console.log("Starting Conversation Notification Test...")

  // 1. Setup Tenant and Users
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error("No tenant found")
  
  let users = await prisma.user.findMany({ where: { tenantId: tenant.id }, take: 3 })
  let createdUserIds: string[] = []

  if (users.length < 3) {
      console.log("Creating temp user for testing...")
      let role = await prisma.role.findFirst({ where: { tenantId: tenant.id } })
      if (!role) {
          role = await prisma.role.create({
              data: {
                  tenantId: tenant.id,
                  name: "user"
              }
          })
      }
      const tempUser = await prisma.user.create({
          data: {
              tenantId: tenant.id,
              email: `temp-test-${Date.now()}@example.com`,
              passwordHash: "hash",
              roleLinks: { 
                  create: { 
                      tenantId: tenant.id,
                      roleId: role.id
                  } 
              }
          }
      })
      users.push(tempUser)
      createdUserIds.push(tempUser.id)
  }

  const user1 = users[0]
  const user2 = users[1]
  const user3 = users[2] // The one to be added

  console.log(`Using Tenant: ${tenant.id}`)
  console.log(`User1 (Admin): ${user1.id}`)
  console.log(`User2 (Member): ${user2.id}`)
  console.log(`User3 (Target): ${user3.id}`)

  const userPayload = {
      id: user1.id,
      tenantId: tenant.id,
      roles: ["owner"], // Give owner role to bypass permission checks for test
      email: "test@example.com"
  } as any

  try {
      // 2. Test Direct Message Notification
      console.log("\n--- Testing Direct Message ---")
      const convo = await conversationService.ensureDirect(tenant.id, user1.id, user2.id)
      console.log(`Direct Conversation: ${convo.id}`)
      
      lastNotification = null
      await conversationService.sendMessage(tenant.id, convo.id, userPayload, {
          content: "Hello Direct!"
      })
      
      if (lastNotificationsMany.length > 0) {
          console.log("[SUCCESS] Direct Notification Sent (via sendMany)")
      } else if (lastNotification) {
           console.log("[SUCCESS] Direct Notification Sent (via send)")
      } else {
           console.error("[FAILURE] Direct Notification NOT Found")
      }

      // 3. Test Group Creation and Add Participant
      console.log("\n--- Testing Group Add Participant ---")
      // Create group with User1 and User2
      const group = await conversationService.createCustomGroup(tenant.id, userPayload, "Test Group " + Date.now(), [user1.id, user2.id])
      console.log(`Group Created: ${group.id}`)
      
      // Add User3
      lastNotification = null
      console.log(`Adding User3: ${user3.id} to group...`)
      await conversationService.addParticipant(tenant.id, group.id, userPayload, user3.id)
      
      if (lastNotification && lastNotification.userId === user3.id) {
          console.log("[SUCCESS] Add Participant Notification Found")
          console.log("Notification Title:", lastNotification.title)
      } else {
          console.error("[FAILURE] Add Participant Notification NOT Found or Wrong User")
          console.log("Last Notification:", JSON.stringify(lastNotification, null, 2))
      }

      // 4. Test Remove Participant
      console.log("\n--- Testing Remove Participant ---")
      lastNotification = null
      console.log(`Removing User3: ${user3.id} from group...`)
      await conversationService.removeParticipant(tenant.id, group.id, userPayload, user3.id)

      if (lastNotification && lastNotification.userId === user3.id && lastNotification.type === 'warning') {
          console.log("[SUCCESS] Remove Participant Notification Found")
      } else {
          console.error("[FAILURE] Remove Participant Notification NOT Found")
          console.log("Last Notification:", JSON.stringify(lastNotification, null, 2))
      }

  } catch (error) {
      console.error("Test Failed:", error)
  } finally {
      // Cleanup
      if (createdUserIds.length > 0) {
          console.log("Cleaning up temp users...")
          try {
              // Remove participants
              await prisma.conversationParticipant.deleteMany({
                  where: { userId: { in: createdUserIds } }
              })
              // Remove user roles
              await prisma.userRole.deleteMany({
                  where: { userId: { in: createdUserIds } }
              })
              // Remove users
              await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
          } catch (e) {
              console.error("Cleanup failed:", e)
          }
      }
      await prisma.$disconnect()
  }
}

main()
