import { useQuery } from "@tanstack/react-query"
import { leadService } from "../services/leadService"
import { useAuth } from "../auth/AuthContext"
import { Lead } from "../types"

export const useLead = (leadId: string) => {
  const { token } = useAuth()
  return useQuery<Lead>({
    queryKey: ["lead", leadId],
    queryFn: async () => leadService.get(leadId, token || undefined),
    enabled: Boolean(leadId),
    staleTime: 0,
    refetchInterval: 250
  })
}
