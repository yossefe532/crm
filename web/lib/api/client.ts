import { request } from "./httpClient"
export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_DIRECT_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "/api"
export const apiClient = {
  get: <T>(path: string, token?: string) => request<T>(`${apiBaseUrl}${path}`, "GET", undefined, token),
  post: <T>(path: string, body: unknown, token?: string) => request<T>(`${apiBaseUrl}${path}`, "POST", body, token),
  patch: <T>(path: string, body: unknown, token?: string) => request<T>(`${apiBaseUrl}${path}`, "PATCH", body, token),
  put: <T>(path: string, body: unknown, token?: string) => request<T>(`${apiBaseUrl}${path}`, "PUT", body, token),
  delete: <T>(path: string, token?: string) => request<T>(`${apiBaseUrl}${path}`, "DELETE", undefined, token)
}
