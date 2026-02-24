import { apiClient } from "../api/client"

export type AuthUser = {
  id: string
  tenantId: string
  roles: string[]
  forceReset?: boolean
}

export type AuthResult = {
  token: string
  user: AuthUser
}

export const authApi = {
  getSetupStatus: () => apiClient.get<{ hasOwner: boolean; ownerName?: string; ownerPhone?: string; tenantName?: string }>("/auth/setup-status"),
  login: (payload: { email: string; password: string }) => apiClient.post<AuthResult>("/auth/login", payload),
  register: (payload: { tenantName?: string; timezone?: string; email: string; password: string; phone?: string; role?: string; teamName?: string }) =>
    apiClient.post<AuthResult & { isPending?: boolean; ownerPhone?: string }>("/auth/register", payload),
  me: (token?: string) => apiClient.get<{ user: AuthUser }>("/auth/me", token),
  changePassword: (payload: { currentPassword: string; newPassword: string; confirmPassword: string }, token?: string) =>
    apiClient.post<AuthResult>("/auth/change-password", payload, token),
  updateProfile: (payload: { currentPassword: string; email?: string; phone?: string }, token?: string) =>
    apiClient.post<{ status: string }>("/auth/update-profile", payload, token)
}
