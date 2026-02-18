import { useQuery } from "@tanstack/react-query"
import { useAuth } from "../auth/AuthContext"
import { leadService } from "../services/leadService"
import { LeadClosure } from "../types"

export const useLeadClosures = () => {
  const { token } = useAuth()
  return useQuery<LeadClosure[]>({
    queryKey: ["lead_closures"],
    queryFn: async () => leadService.listClosures(token || undefined),
    staleTime: 30000
  })
}
