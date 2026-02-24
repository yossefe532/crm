import { apiClient } from "../api/client"
import { NotificationEvent, Notification } from "../types"

export const notificationService = {
  getVapidKey: () => apiClient.get<{ publicKey: string }>("/notifications/vapid-key"),
  subscribe: (subscription: any) => apiClient.post("/notifications/subscribe", { subscription }),
  testPush: () => apiClient.post("/notifications/test-push", {}),
  broadcast: (target: { type: "all" | "role" | "user" | "users" | "team"; value?: string | string[] }, message: string, channels?: string[], token?: string) =>
    apiClient.post("/notifications/broadcast", { target, message, channels }, token),
  getPolicy: (token?: string) => apiClient.get<{ enabled: boolean; dailyLimit: number; quietHours: { enabled: boolean; start: number; end: number } }>("/notifications/policies", token),
  updatePolicy: (payload: { enabled: boolean; dailyLimit: number; quietHours: { enabled: boolean; start: number; end: number } }, token?: string) =>
    apiClient.put("/notifications/policies", payload, token),
  listEvents: (limit = 10, token?: string) => apiClient.get<NotificationEvent[]>(`/notifications/events?limit=${limit}`, token),
  clearEvents: (token?: string) => apiClient.delete("/notifications/events", token),

  // New User Notification Methods
  list: (params: { page?: number; limit?: number; unreadOnly?: boolean } = {}, token?: string) => 
    apiClient.get<{ data: Notification[]; meta: { total: number; page: number; limit: number; totalPages: number } }>(
      `/notifications?page=${params.page || 1}&limit=${params.limit || 20}&unreadOnly=${params.unreadOnly || false}`, 
      token
    ),
  getUnreadCount: (token?: string) => apiClient.get<{ count: number }>("/notifications/unread-count", token),
  markAllAsRead: (token?: string) => apiClient.patch("/notifications/read-all", {}, token),
  markAsRead: (id: string, token?: string) => apiClient.patch(`/notifications/${id}/read`, {}, token),
  archive: (id: string, token?: string) => apiClient.delete(`/notifications/${id}`, token),
  archiveAll: (token?: string) => apiClient.delete("/notifications", token),
}
