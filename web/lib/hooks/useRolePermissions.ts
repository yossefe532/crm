import { useQuery } from "@tanstack/react-query"
import { coreService } from "../services/coreService"
import { useAuth } from "../auth/AuthContext"
import { Permission } from "../types"

export const useRolePermissions = (roleId: string) => {
  const { token } = useAuth()
  return useQuery<Permission[]>({
    queryKey: ["role_permissions", roleId],
    queryFn: async () => {
      const rows = await coreService.listRolePermissions(roleId, token || undefined)
      return rows.map((row) => row.permission)
    },
    enabled: Boolean(roleId),
    staleTime: 0,
    refetchInterval: 250
  })
}
