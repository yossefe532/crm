import { useQuery } from "@tanstack/react-query"
import { leadService } from "../services/leadService"
import { useAuth } from "../auth/AuthContext"
import { Lead } from "../types"

export const useLeads = (query?: string) => {
  const { token } = useAuth()
  return useQuery<Lead[]>({
    queryKey: ["leads", query || ""],
    queryFn: async () => {
      const response = await leadService.list(token || undefined, query ? { q: query } : undefined)
      return response.data.map((lead: Lead & { _count?: { callLogs?: number } }) => ({
        ...lead,
        callCount: lead.callCount ?? lead._count?.callLogs ?? 0
      }))
    },
    staleTime: 60000
  })
}
