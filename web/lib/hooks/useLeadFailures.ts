import { useQuery } from "@tanstack/react-query"
import { useAuth } from "../auth/AuthContext"
import { leadService } from "../services/leadService"
import { LeadFailure } from "../types"

export const useLeadFailures = (leadId?: string) => {
  const { token } = useAuth()
  return useQuery<LeadFailure[]>({
    queryKey: ["lead_failures", leadId],
    queryFn: async () => leadService.listFailures(leadId, token || undefined),
    staleTime: 0,
    refetchInterval: 1000
  })
}
