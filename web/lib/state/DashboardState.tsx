"use client"

import { createContext, ReactNode, useContext, useMemo, useState } from "react"

type DashboardFilters = {
  teamId?: string
  userId?: string
  dateRange?: { from: string; to: string }
}

type DashboardState = {
  filters: DashboardFilters
  setFilters: (next: DashboardFilters) => void
}

const DashboardContext = createContext<DashboardState | null>(null)

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [filters, setFilters] = useState<DashboardFilters>({})

  const value = useMemo(() => ({ filters, setFilters }), [filters])

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export const useDashboardFilters = () => {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error("DashboardContext missing")
  return ctx
}
