import { useQuery } from "@tanstack/react-query"
import { useAuth } from "../auth/AuthContext"
import { leadService } from "../services/leadService"

export const useLeadDeadlines = () => {
  const { token } = useAuth()
  return useQuery<Array<{ id: string; leadId: string; dueAt: string; status: string }>>({
    queryKey: ["lead_deadlines"],
    queryFn: async () => leadService.listDeadlines(token || undefined),
    staleTime: 30000,
    refetchInterval: 30000
  })
}
