import { apiClient } from "../api/client"
import { Lead } from "../types"

export const leadService = {
  list: (token?: string, params?: { q?: string }) => {
    const query = params?.q ? `?q=${encodeURIComponent(params.q)}` : ""
    return apiClient.get<{ data: Lead[]; page: number; pageSize: number }>(`/leads${query}`, token)
  },
  get: (id: string, token?: string) => apiClient.get<Lead>(`/leads/${id}`, token),
  create: (payload: Record<string, unknown>, token?: string) => apiClient.post<Lead>("/leads", payload, token),
  listTasks: (token?: string) => apiClient.get<Array<{ id: string; taskType: string; dueAt?: string | null; status: string; lead: Lead }>>("/leads/tasks", token),
  update: (id: string, payload: Partial<Lead>, token?: string) => apiClient.patch<Lead>(`/leads/${id}`, payload, token),
  assign: (id: string, payload: { assignedUserId: string; reason?: string }, token?: string) => apiClient.post<{ id: string }>(`/leads/${id}/assign`, payload, token),
  unassign: (id: string, token?: string) => apiClient.post<Lead>(`/leads/${id}/unassign`, {}, token),
  updateStage: (id: string, stage: string, token?: string) => apiClient.patch<{ code: string }>(`/leads/${id}/stage`, { stage }, token),
  delete: (id: string, token?: string) => apiClient.delete(`/leads/${id}`, token),
  listDeadlines: (token?: string) => apiClient.get<Array<{ id: string; leadId: string; dueAt: string; status: string }>>("/leads/deadlines", token),
  getDeadline: (id: string, token?: string) => apiClient.get<{ dueAt?: string | null; status: string } | null>(`/leads/${id}/deadline`, token),
  listFailures: (leadId?: string, token?: string) => apiClient.get<Array<{ id: string; leadId: string; failureType: string; reason?: string | null; status: string; createdAt: string }>>(`/leads/failures${leadId ? `?leadId=${leadId}` : ""}`, token),
  addCall: (id: string, payload: { durationSeconds?: number; outcome?: string }, token?: string) => apiClient.post<{ id: string }>(`/leads/${id}/calls`, payload, token),
  listClosures: (token?: string) => apiClient.get<Array<{ id: string; leadId: string; amount: number; note?: string | null; closedAt: string }>>("/leads/closures", token),
  close: (id: string, payload: { amount: number; note?: string; address?: string }, token?: string) => apiClient.post(`/leads/${id}/close`, payload, token),
  decideClosure: (closureId: string, payload: { status: "approved" | "rejected" }, token?: string) => apiClient.post(`/leads/closures/${closureId}/decide`, payload, token),
  undoStage: (id: string, token?: string) => apiClient.post(`/leads/${id}/stage/undo`, {}, token),
  fail: (id: string, payload: { reason?: string; failureType: "overdue" | "surrender" }, token?: string) => apiClient.post(`/leads/${id}/fail`, payload, token),
  resolveFailure: (failureId: string, payload: { reason: string }, token?: string) => apiClient.post(`/leads/failures/${failureId}/resolve`, payload, token),
  createMeeting: (leadId: string, payload: { title: string; startsAt: Date; endsAt: Date; status?: string }, token?: string) => {
    const body = {
      leadId,
      title: payload.title,
      startsAt: payload.startsAt.toISOString(),
      endsAt: payload.endsAt.toISOString(),
      status: payload.status
    }
    return apiClient.post<{ id: string }>("/meetings", body, token)
  }
}
