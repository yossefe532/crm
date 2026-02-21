import { logger } from "../monitoring/logger"
import { logout } from "../auth/authService"
import { toast } from "react-hot-toast"

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
  const timeoutMs = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || "20000")
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
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
      , ...(controller ? { signal: controller.signal } : {})
    })
  } catch (err) {
    if (timer) clearTimeout(timer as unknown as number)
    const isAbort = (err as any)?.name === "AbortError"
    const msg = isAbort ? "انتهت مهلة الاتصال بالخادم" : (err as { message?: string })?.message
    logger.error("api.network_error", { url, method, message: (err as { message?: string })?.message })
    if (typeof window !== "undefined") {
      // toast.error(isAbort ? "انتهت مهلة الاتصال بالخادم" : "تعذر الاتصال بالخادم")
      console.error(isAbort ? "انتهت مهلة الاتصال بالخادم" : "تعذر الاتصال بالخادم")
    }
    throw { status: 0, message: msg || "تعذر الاتصال بالخادم" } satisfies ApiError
  }
  if (timer) clearTimeout(timer as unknown as number)

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || ""
    let payload: { error?: string; message?: string; details?: Array<{ path?: string; message?: string }>; rawText?: string } = {}
    if (contentType.includes("application/json")) {
      payload = (await response.json().catch(() => ({}))) as typeof payload
    } else {
      payload.rawText = await response.text().catch(() => "")
    }
    logger.error("api.error", { status: response.status, url, payload, contentType })

    if (response.status === 401 && !url.includes("/auth/login")) {
      logout()
      if (typeof window !== "undefined") {
        window.location.href = "/login"
      }
    }

    const rawText = payload.rawText ? payload.rawText.toLowerCase() : ""
    const vercelFail = rawText.includes("application failed to respond") || rawText.includes("application error")
    const isServerUnavailable = [502, 503, 504].includes(response.status) || vercelFail
    const message = isServerUnavailable
      ? "الخادم غير متاح الآن (Backend Unavailable)"
      : payload.message || payload.error || (payload.rawText ? `خطأ غير معروف: ${payload.rawText.substring(0, 50)}...` : "فشل تنفيذ الطلب")
    
    // Log full error for debugging
    if (vercelFail) {
      console.error("Vercel/Railway Error Page Detected:", payload.rawText)
    }
    
    if (typeof window !== "undefined" && response.status !== 401 && response.status !== 404 && response.status !== 403) {
      // Suppress annoying toasts for connection issues or forbidden access
      if (!message.includes("Application failed") && !message.includes("الخادم غير متاح")) {
         toast.error(message)
      }
    }

    throw { status: response.status, message, details: payload.details, ...payload } satisfies ApiError
  }
  return (await response.json()) as T
}
