import { logger } from "../monitoring/logger"
import { logout } from "../auth/authService"

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

export type ApiError = {
  status: number
  message: string
  details?: Array<{ path?: string; message?: string }>
  payload?: Record<string, unknown>
}

const getCookie = (key: string) => {
  if (typeof document === "undefined") return null
  const prefix = `${encodeURIComponent(key)}=`
  const parts = document.cookie.split(";").map((part) => part.trim())
  const match = parts.find((part) => part.startsWith(prefix))
  if (!match) return null
  const value = match.slice(prefix.length)
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const getStorage = (key: string) => {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const request = async <T>(
  url: string,
  method: HttpMethod,
  body?: unknown,
  token?: string
): Promise<T> => {
  const effectiveToken = token || getCookie("auth_token") || getStorage("auth_token") || undefined
  const effectiveRole = getCookie("auth_role") || getStorage("auth_role") || undefined
  const effectiveUserId = getCookie("auth_user_id") || getStorage("auth_user_id") || undefined
  const effectiveTenantId = getCookie("auth_tenant_id") || getStorage("auth_tenant_id") || undefined

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
        ...(effectiveUserId ? { "x-user-id": effectiveUserId } : {}),
        ...(effectiveTenantId ? { "x-tenant-id": effectiveTenantId } : {}),
        ...(effectiveRole ? { "x-roles": effectiveRole } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    })
  } catch (err) {
    logger.error("api.network_error", { url, method, message: (err as { message?: string })?.message })
    throw { status: 0, message: "تعذر الاتصال بالخادم" } satisfies ApiError
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
      message?: string
      details?: Array<{ path?: string; message?: string }>
    }
    logger.error("api.error", { status: response.status, url, payload })

    if (response.status === 401 && !url.includes("/auth/login")) {
      logout()
      if (typeof window !== "undefined") {
        window.location.href = "/login"
      }
    }

    const message = payload.message || payload.error || "فشل تنفيذ الطلب"
    throw { status: response.status, message, details: payload.details, ...payload } satisfies ApiError
  }
  return (await response.json()) as T
}
