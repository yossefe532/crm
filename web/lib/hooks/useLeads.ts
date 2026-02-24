import { useQuery } from "@tanstack/react-query"
import { leadService } from "../services/leadService"
import { useAuth } from "../auth/AuthContext"
import { Lead } from "../types"

export const useLeads = (opts?: { query?: string; page?: number; pageSize?: number; status?: string; assignment?: string }) => {
  const { token } = useAuth()
  const q = opts?.query || ""
  const page = opts?.page
  const pageSize = opts?.pageSize
  const status = opts?.status
  const assignment = opts?.assignment

  return useQuery<Lead[]>({
    queryKey: ["leads", q, page || 1, pageSize || 20, status || "all", assignment || "all"],
    queryFn: async () => {
      const response = await leadService.list(
        token || undefined, 
        q || page || pageSize || status || assignment ? { q: q || undefined, page, pageSize, status, assignment } : undefined
      )
      return response.data.map((lead: Lead & { _count?: { callLogs?: number } }) => ({
        ...lead,
        callCount: lead.callCount ?? lead._count?.callLogs ?? 0
      }))
    },
    refetchInterval: 1000, // Refresh every second
    staleTime: 0,
  })
}
