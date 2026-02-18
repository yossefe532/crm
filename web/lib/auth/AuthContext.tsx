"use client"

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react"
import { getAuthSession, loginWithToken, logout } from "./authService"

type Role = "owner" | "team_leader" | "sales"

type AuthState = {
  token: string | null
  role: Role | null
  userId: string | null
  tenantId: string | null
  forceReset: boolean
  isLoading: boolean
}

type AuthContextValue = AuthState & {
  signIn: (payload: { token: string; role: Role; userId: string; tenantId: string; forceReset?: boolean }) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({ token: null, role: null, userId: null, tenantId: null, forceReset: false, isLoading: true })

  useEffect(() => {
    const session = getAuthSession()
    if (session) {
      setState({ ...session, isLoading: false })
    } else {
      setState((prev) => ({ ...prev, isLoading: false }))
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn: (payload) => {
        loginWithToken(payload)
        setState({ ...payload, forceReset: Boolean(payload.forceReset), isLoading: false })
      },
      signOut: () => {
        logout()
        setState({ token: null, role: null, userId: null, tenantId: null, forceReset: false, isLoading: false })
      }
    }),
    [state]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("AuthContext missing")
  return ctx
}
