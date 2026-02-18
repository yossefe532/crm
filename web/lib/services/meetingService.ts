import { apiClient } from "../api/client"
import { Meeting } from "../types"

export const meetingService = {
  list: (token?: string) => apiClient.get<Meeting[]>("/meetings", token),
  create: (payload: Record<string, unknown>, token?: string) => apiClient.post<Meeting>("/meetings", payload, token),
  updateStatus: (meetingId: string, payload: { status: string }, token?: string) => apiClient.patch<Meeting>(`/meetings/${meetingId}`, payload, token),
  createReminder: (meetingId: string, payload: { scheduledAt: string }, token?: string) => apiClient.post(`/meetings/${meetingId}/reminders`, payload, token),
  sendReminderNow: (meetingId: string) => apiClient.post(`/meetings/${meetingId}/remind-now`, {})
}
