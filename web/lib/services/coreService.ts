import { apiClient } from "../api/client"
import { Permission, RoleItem, Team, User } from "../types"

export const coreService = {
  listUsers: (token?: string) => apiClient.get<User[]>("/core/users", token),
  listTeams: (token?: string) => apiClient.get<Team[]>("/core/teams", token),
  listRoles: (token?: string) => apiClient.get<RoleItem[]>("/core/roles", token),
  createRole: (payload: { name: string; scope?: string }, token?: string) =>
    apiClient.post<RoleItem>("/core/roles", payload, token),
  deleteRole: (roleId: string, token?: string) =>
    apiClient.delete(`/core/roles/${roleId}`, token),
  listPermissions: (token?: string) => apiClient.get<Permission[]>("/core/permissions", token),
  listRolePermissions: (roleId: string, token?: string) => apiClient.get<Array<{ permission: Permission }>>(`/core/roles/${roleId}/permissions`, token),
  updateRolePermissions: (roleId: string, permissionIds: string[], token?: string) =>
    apiClient.put<{ status: string }>(`/core/roles/${roleId}/permissions`, { permissionIds }, token),
  listUserPermissions: (userId: string, token?: string) =>
    apiClient.get<{ rolePermissions: Permission[]; directPermissions: Permission[] }>(`/users/${userId}/permissions`, token),
  updateUserPermissions: (userId: string, permissionIds: string[], token?: string) =>
    apiClient.post<{ status: string }>(`/users/${userId}/permissions`, { permissionIds }, token),
  updateUser: (userId: string, payload: { name?: string; email?: string; phone?: string; status?: string }, token?: string) =>
    apiClient.put(`/users/${userId}`, payload, token),
  deleteUser: (userId: string, token?: string) =>
    apiClient.delete(`/users/${userId}`, token),
  resetUserPassword: (userId: string, payload: { password?: string }, token?: string) =>
    apiClient.post<{ status: string; temporaryPassword?: string }>(`/users/${userId}/reset-password`, payload, token),
  transferUserTeam: (userId: string, payload: { teamId: string; role?: string }, token?: string) =>
    apiClient.post(`/core/users/${userId}/transfer`, payload, token),
  promoteUser: (userId: string, payload: { teamName?: string; memberIds?: string[] }, token?: string) =>
    apiClient.post(`/core/users/${userId}/promote`, payload, token),
  deleteTeam: (teamId: string, token?: string) =>
    apiClient.delete(`/core/teams/${teamId}`, token),
  listUserAudit: (userId: string, token?: string) =>
    apiClient.get<Array<{ id: string; action: string; entityType: string; entityId?: string | null; createdAt: string }>>(`/core/users/${userId}/audit`, token),
  createUser: (payload: { name: string; email: string; phone?: string; password?: string; role: string; teamId?: string; teamName?: string }, token?: string) =>
    apiClient.post<{ user: User; temporaryPassword?: string }>("/core/users", payload, token),
  createUserRequest: (payload: { name?: string; email?: string; phone?: string; teamId?: string; requestType?: string; payload?: any }, token?: string) =>
    apiClient.post<{ id: string; status: string }>("/core/user-requests", payload, token),
  listUserRequests: (token?: string) =>
    apiClient.get<Array<{ id: string; status: string; requestType: string; payload: any; createdAt: string; requester?: User }>>("/core/user-requests", token),
  decideUserRequest: (requestId: string, status: "approved" | "rejected", token?: string) =>
    apiClient.post(`/core/user-requests/${requestId}/decide`, { status }, token),
  listFinanceEntries: (token?: string) =>
    apiClient.get<Array<{ id: string; entryType: string; category: string; amount: number; note?: string | null; occurredAt: string }>>("/core/finance", token),
  createFinanceEntry: (payload: { entryType: "income" | "expense"; category: string; amount: number; note?: string; occurredAt?: string }, token?: string) =>
    apiClient.post("/core/finance", payload, token),
  updateFinanceEntry: (id: string, payload: { entryType?: "income" | "expense"; category?: string; amount?: number; note?: string; occurredAt?: string }, token?: string) =>
    apiClient.put(`/core/finance/${id}`, payload, token),
  deleteFinanceEntry: (id: string, token?: string) =>
    apiClient.delete(`/core/finance/${id}`, token),
  createNote: (payload: { entityType: string; entityId: string; body: string }, token?: string) =>
    apiClient.post("/core/notes", payload, token),
  exportBackup: (token?: string) =>
    apiClient.get<any>("/core/backup/export", token),
  importBackup: (snapshot: any, token?: string) =>
    apiClient.post<{ status: string }>("/core/backup/import", { snapshot }, token)
}
