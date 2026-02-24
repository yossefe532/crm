import { useQuery } from "@tanstack/react-query"
import { coreService } from "../services/coreService"
import { useAuth } from "../auth/AuthContext"
import { RoleItem } from "../types"

export const useRoles = () => {
  const { token } = useAuth()
  return useQuery<RoleItem[]>({
    queryKey: ["roles"],
    queryFn: async () => coreService.listRoles(token || undefined),
    staleTime: 0,
    refetchInterval: 1000
  })
}
