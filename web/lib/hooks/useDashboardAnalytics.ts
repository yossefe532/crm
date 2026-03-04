import { useQuery } from "@tanstack/react-query"
import { useAuth } from "../auth/AuthContext"
import { analyticsService, DashboardMetrics } from "../services/analyticsService"

export const useDashboardAnalytics = () => {
  const { token, userId } = useAuth()
  return useQuery<DashboardMetrics>({
    queryKey: ["dashboard-analytics", userId || "anonymous"],
    queryFn: async () => {
      const data = await analyticsService.getDashboardMetrics(token || undefined)
      return data
    },
    enabled: !!token,
    staleTime: 0,
    refetchInterval: 30000
  })
}
