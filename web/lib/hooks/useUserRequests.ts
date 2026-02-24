import { useQuery } from "@tanstack/react-query"
import { useAuth } from "../auth/AuthContext"
import { coreService } from "../services/coreService"
import { UserRequest } from "../types"

export const useUserRequests = () => {
  const { token } = useAuth()
  return useQuery({
    queryKey: ["user_requests"],
    queryFn: async () => coreService.listUserRequests(token || undefined),
    staleTime: 0,
    refetchInterval: 1000
  })
}
