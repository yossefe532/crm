import { useQuery } from "@tanstack/react-query"
import { coreService } from "../services/coreService"
import { useAuth } from "../auth/AuthContext"
import { User } from "../types"

export const useUsers = () => {
  const { token } = useAuth()
  return useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => coreService.listUsers(token || undefined),
    staleTime: 60000
  })
}
