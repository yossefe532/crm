export const loginWithToken = (payload: { token: string; role: string; userId: string; tenantId: string; forceReset?: boolean }) => {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem("auth_token", payload.token)
    localStorage.setItem("auth_role", payload.role)
    localStorage.setItem("auth_user_id", payload.userId)
    localStorage.setItem("auth_tenant_id", payload.tenantId)
    localStorage.setItem("auth_force_reset", payload.forceReset ? "true" : "false")
  } catch {
  }
  try {
    document.cookie = `auth_token=${encodeURIComponent(payload.token)}; path=/`
    document.cookie = `auth_role=${encodeURIComponent(payload.role)}; path=/`
    document.cookie = `auth_user_id=${encodeURIComponent(payload.userId)}; path=/`
    document.cookie = `auth_tenant_id=${encodeURIComponent(payload.tenantId)}; path=/`
    document.cookie = `auth_force_reset=${encodeURIComponent(payload.forceReset ? "true" : "false")}; path=/`
  } catch {
  }
}

type Role = "owner" | "team_leader" | "sales"

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

export const getAuthSession = () => {
  if (typeof window === "undefined") return null
  const token = getCookie("auth_token") || (() => {
    try {
      return localStorage.getItem("auth_token")
    } catch {
      return null
    }
  })()
  const role = getCookie("auth_role") || (() => {
    try {
      return localStorage.getItem("auth_role")
    } catch {
      return null
    }
  })()
  const userId = getCookie("auth_user_id") || (() => {
    try {
      return localStorage.getItem("auth_user_id")
    } catch {
      return null
    }
  })()
  const tenantId = getCookie("auth_tenant_id") || (() => {
    try {
      return localStorage.getItem("auth_tenant_id")
    } catch {
      return null
    }
  })()
  const forceReset = (getCookie("auth_force_reset") || (() => {
    try {
      return localStorage.getItem("auth_force_reset")
    } catch {
      return null
    }
  })()) === "true"
  const normalizedRole = role && (role === "owner" || role === "team_leader" || role === "sales") ? (role as Role) : null
  if (!token || !normalizedRole || !userId || !tenantId) return null
  return { token, role: normalizedRole, userId, tenantId, forceReset }
}

export const logout = () => {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_role")
    localStorage.removeItem("auth_user_id")
    localStorage.removeItem("auth_tenant_id")
    localStorage.removeItem("auth_force_reset")
  } catch {
  }
  try {
    document.cookie = "auth_token=; path=/; max-age=0"
    document.cookie = "auth_role=; path=/; max-age=0"
    document.cookie = "auth_user_id=; path=/; max-age=0"
    document.cookie = "auth_tenant_id=; path=/; max-age=0"
    document.cookie = "auth_force_reset=; path=/; max-age=0"
  } catch {
  }
}
