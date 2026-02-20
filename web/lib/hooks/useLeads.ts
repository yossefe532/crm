import { useQuery } from "@tanstack/react-query"
import { leadService } from "../services/leadService"
import { useAuth } from "../auth/AuthContext"
import { Lead } from "../types"

export const useLeads = (opts?: { query?: string; page?: number; pageSize?: number }) => {
  const { token } = useAuth()
  const q = opts?.query || ""
  const page = opts?.page
  const pageSize = opts?.pageSize

  return useQuery<Lead[]>({
    queryKey: ["leads", q, page || ""],
    queryFn: async () => {
      const response = await leadService.list(
        token || undefined, 
        q || page || pageSize ? { q: q || undefined, page, pageSize } : undefined
      )
      return response.data.map((lead: Lead & { _count?: { callLogs?: number } }) => ({
        ...lead,
        callCount: lead.callCount ?? lead._count?.callLogs ?? 0
      }))
    },
    refetchInterval: 30000,
    staleTime: 10000,
  })
}
