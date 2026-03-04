import { useDashboardAnalytics } from "./useDashboardAnalytics"
import { PerformanceMetric } from "../types"

export const useMetrics = () => {
  const { data, isLoading, isError } = useDashboardAnalytics()

  const metrics: PerformanceMetric[] = data?.keyMetrics?.map(m => ({
    label: m.label,
    value: String(m.value),
    change: `${m.change > 0 ? "+" : ""}${m.change}%`
  })) || []

  return { data: metrics, isLoading, isError }
}
