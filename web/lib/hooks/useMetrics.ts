import { useQuery } from "@tanstack/react-query"
import { useAuth } from "../auth/AuthContext"
import { analyticsService } from "../services/analyticsService"
import { PerformanceMetric } from "../types"

export const useMetrics = () => {
  const { token } = useAuth()
  return useQuery<PerformanceMetric[]>({
    queryKey: ["metrics"],
    queryFn: async () => {
      const rows = await analyticsService.listDailyMetrics(undefined, token || undefined)
      if (!Array.isArray(rows)) return []
      const leadsCreated = rows.reduce((sum, row) => sum + (row.leadsCreated || 0), 0)
      const leadsClosed = rows.reduce((sum, row) => sum + (row.leadsClosed || 0), 0)
      return [
        { label: "عملاء جدد", value: leadsCreated.toLocaleString("ar-EG") },
        { label: "صفقات مغلقة", value: leadsClosed.toLocaleString("ar-EG") }
      ]
    },
    staleTime: 60000,
    refetchInterval: 30000
  })
}
