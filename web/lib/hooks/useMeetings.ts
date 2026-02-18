import { useQuery } from "@tanstack/react-query"
import { meetingService } from "../services/meetingService"
import { useAuth } from "../auth/AuthContext"
import { Meeting } from "../types"

export const useMeetings = () => {
  const { token } = useAuth()
  return useQuery<Meeting[]>({
    queryKey: ["meetings"],
    queryFn: async () => meetingService.list(token || undefined),
    staleTime: 60000
  })
}
