import { apiClient } from "../api/client"
import { Conversation, Message } from "../types"

export const conversationService = {
  list: (token?: string) => apiClient.get<Conversation[]>("/conversations", token),
  listMessages: (conversationId: string, token?: string) =>
    apiClient.get<Message[]>(`/conversations/${conversationId}/messages`, token),
  sendMessage: (conversationId: string, payload: { content?: string; contentType?: string; mediaFileId?: string; replyToId?: string }, token?: string) =>
    apiClient.post<Message>(`/conversations/${conversationId}/messages`, payload, token),
  createDirect: (targetUserId: string, token?: string) =>
    apiClient.post<Conversation>("/conversations/direct", { targetUserId }, token),
  createTeamGroup: (teamId: string, token?: string) =>
    apiClient.post<Conversation>("/conversations/team", { teamId }, token),
  getOwnerGroup: (token?: string) =>
    apiClient.get<Conversation>("/conversations/owner-group", token),
  createGroup: (title: string, participants: string[], token?: string) =>
    apiClient.post<Conversation>("/conversations/group", { title, participants }, token),
  markAsRead: (conversationId: string, token?: string) =>
    apiClient.post<{ success: boolean }>(`/conversations/${conversationId}/read`, {}, token),
  addParticipant: (conversationId: string, userId: string, token?: string) =>
    apiClient.post<{ success: boolean }>(`/conversations/${conversationId}/participants`, { userId }, token),
  removeParticipant: (conversationId: string, userId: string, token?: string) =>
    apiClient.delete<{ success: boolean }>(`/conversations/${conversationId}/participants/${userId}`, token),
  editMessage: (messageId: string, content: string, token?: string) =>
    apiClient.put<Message>(`/conversations/messages/${messageId}`, { content }, token),
  deleteMessage: (messageId: string, token?: string) =>
    apiClient.delete<{ success: boolean }>(`/conversations/messages/${messageId}`, token)
}
