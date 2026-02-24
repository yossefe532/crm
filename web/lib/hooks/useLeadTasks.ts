"use client"

import { useQuery } from "@tanstack/react-query"
import { leadService } from "../services/leadService"
import { useAuth } from "../auth/AuthContext"
import { Lead } from "../types"

type LeadTask = { id: string; taskType: string; dueAt?: string | null; status: string; lead: Lead }

export const useLeadTasks = () => {
  const { token } = useAuth()
  return useQuery<LeadTask[]>({
    queryKey: ["lead_tasks"],
    queryFn: async () => leadService.listTasks(token || undefined),
    staleTime: 0,
    refetchInterval: 1000
  })
}
