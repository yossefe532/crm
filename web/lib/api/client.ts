import { request } from "./httpClient"
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"
export const apiClient = {
  get: <T>(path: string, token?: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`
    return request<T>(`${apiBaseUrl}${normalizedPath}`, "GET", undefined, token)
  },
  post: <T>(path: string, body: unknown, token?: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`
    return request<T>(`${apiBaseUrl}${normalizedPath}`, "POST", body, token)
  },
  patch: <T>(path: string, body: unknown, token?: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`
    return request<T>(`${apiBaseUrl}${normalizedPath}`, "PATCH", body, token)
  },
  put: <T>(path: string, body: unknown, token?: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`
    return request<T>(`${apiBaseUrl}${normalizedPath}`, "PUT", body, token)
  },
  delete: <T>(path: string, token?: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`
    return request<T>(`${apiBaseUrl}${normalizedPath}`, "DELETE", undefined, token)
  }
}
