import { useQuery } from "@tanstack/react-query"
import { coreService } from "../services/coreService"
import { useAuth } from "../auth/AuthContext"
import { Permission } from "../types"

export const usePermissions = () => {
  const { token } = useAuth()
  return useQuery<Permission[]>({
    queryKey: ["permissions"],
    queryFn: async () => coreService.listPermissions(token || undefined),
    staleTime: 60000
  })
}
