import { notificationService } from "../modules/notifications/service"

export const runNotificationQueueJob = async () => {
  try {
    return await notificationService.processQueueBatch(200)
  } catch (error) {
    console.error("Notification queue job failed", error)
    throw error
  }
}
