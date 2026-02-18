import { apiClient } from "../api/client"
import { Conversation, Message } from "../types"

export const conversationService = {
  list: (token?: string) => apiClient.get<Conversation[]>("/conversations", token),
  listMessages: (conversationId: string, token?: string) =>
    apiClient.get<Message[]>(`/conversations/${conversationId}/messages`, token),
  sendMessage: (conversationId: string, payload: { content?: string; contentType?: string; mediaFileId?: string }, token?: string) =>
    apiClient.post<Message>(`/conversations/${conversationId}/messages`, payload, token),
  createDirect: (targetUserId: string, token?: string) =>
    apiClient.post<Conversation>("/conversations/direct", { targetUserId }, token),
  createTeamGroup: (teamId: string, token?: string) =>
    apiClient.post<Conversation>("/conversations/team", { teamId }, token),
  getOwnerGroup: (token?: string) =>
    apiClient.get<Conversation>("/conversations/owner-group", token)
}
