import { useQuery } from "@tanstack/react-query"
import { apiClient } from "../api/client"
import { useAuth } from "../auth/AuthContext"

export type AuditLogEntry = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  createdAt: string
  metadata: Record<string, unknown> | null
}

export const useActivityLog = () => {
  const { token } = useAuth()
  return useQuery<AuditLogEntry[]>({
    queryKey: ["my-activity"],
    queryFn: async () => apiClient.get<AuditLogEntry[]>("/core/activity?limit=20", token || undefined),
    staleTime: 60000,
    refetchInterval: 30000
  })
}
