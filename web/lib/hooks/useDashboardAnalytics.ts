import { useQuery } from "@tanstack/react-query"
import { useAuth } from "../auth/AuthContext"
import { analyticsService, DashboardMetrics } from "../services/analyticsService"

export const useDashboardAnalytics = () => {
  const { token } = useAuth()
  return useQuery<DashboardMetrics>({
    queryKey: ["dashboard-analytics"],
    queryFn: async () => {
      const data = await analyticsService.getDashboardMetrics(token || undefined)
      return data
    },
    staleTime: 60000,
    refetchInterval: 30000
  })
}
