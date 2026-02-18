import jwt from "jsonwebtoken"
import { env } from "../config/env"

export type UserPayload = {
  id: string
  tenantId: string
  roles: string[]
  forceReset?: boolean
}

export const parseAuthToken = (token?: string): UserPayload | null => {
  if (!token) return null
  try {
    const payload = jwt.verify(token, env.jwtSecret) as UserPayload
    if (!payload?.id || !payload?.tenantId) return null
    return payload
  } catch {
    return null
  }
}
