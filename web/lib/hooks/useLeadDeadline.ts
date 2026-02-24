import { useQuery } from "@tanstack/react-query"
import { useAuth } from "../auth/AuthContext"
import { leadService } from "../services/leadService"
import { LeadDeadline } from "../types"

export const useLeadDeadline = (leadId: string) => {
  const { token } = useAuth()
  return useQuery<LeadDeadline | null>({
    queryKey: ["lead_deadline", leadId],
    queryFn: async () => leadService.getDeadline(leadId, token || undefined) as Promise<LeadDeadline | null>,
    enabled: Boolean(leadId),
    staleTime: 0,
    refetchInterval: 1000
  })
}
