import { useQuery } from "@tanstack/react-query"
import { meetingService } from "../services/meetingService"
import { useAuth } from "../auth/AuthContext"
import { Meeting } from "../types"

export const useMeetings = () => {
  const { token } = useAuth()
  return useQuery<Meeting[]>({
    queryKey: ["meetings"],
    queryFn: async () => meetingService.list(token || undefined),
    refetchInterval: 60000, // Auto-refetch every 1 minute
    staleTime: 30000,       // Consider data stale after 30 seconds
  })
}
