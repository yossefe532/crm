import { apiClient } from "../api/client"
import { NotificationEvent } from "../types"

export const notificationService = {
  getVapidKey: () => apiClient.get<{ publicKey: string }>("/notifications/vapid-key"),
  subscribe: (subscription: any) => apiClient.post("/notifications/subscribe", { subscription }),
  broadcast: (target: { type: "all" | "role" | "user" | "users" | "team"; value?: string | string[] }, message: string, channels?: string[]) =>
    apiClient.post("/notifications/broadcast", { target, message, channels }),
  getPolicy: (token?: string) => apiClient.get<{ enabled: boolean; dailyLimit: number; quietHours: { enabled: boolean; start: number; end: number } }>("/notifications/policies", token),
  updatePolicy: (payload: { enabled: boolean; dailyLimit: number; quietHours: { enabled: boolean; start: number; end: number } }, token?: string) =>
    apiClient.put("/notifications/policies", payload, token),
  listEvents: (limit = 10, token?: string) => apiClient.get<NotificationEvent[]>(`/notifications/events?limit=${limit}`, token)
}
