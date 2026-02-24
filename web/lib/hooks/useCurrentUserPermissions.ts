import { useQuery } from "@tanstack/react-query"
import { coreService } from "../services/coreService"
import { useAuth } from "../auth/AuthContext"
import { Permission } from "../types"

export const useCurrentUserPermissions = () => {
  const { token, userId, role } = useAuth()
  
  return useQuery<{ rolePermissions: Permission[]; directPermissions: Permission[] }>({
    queryKey: ["user-permissions", userId],
    queryFn: async () => {
      if (!userId) return { rolePermissions: [], directPermissions: [] }
      return coreService.listUserPermissions(userId, token || undefined)
    },
    enabled: !!userId && !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export const useHasPermission = (permissionCode: string) => {
  const { data: permissions } = useCurrentUserPermissions()
  const { role } = useAuth()
  
  if (role === 'owner') return true
  
  if (!permissions) return false
  
  const hasRolePermission = permissions.rolePermissions.some(p => p.code === permissionCode)
  const hasDirectPermission = permissions.directPermissions.some(p => p.code === permissionCode)
  
  return hasRolePermission || hasDirectPermission
}
