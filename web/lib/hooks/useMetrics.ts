import { useDashboardAnalytics } from "./useDashboardAnalytics"
import { PerformanceMetric } from "../types"

export const useMetrics = () => {
  const { data, isLoading, isError } = useDashboardAnalytics()

  const metrics: PerformanceMetric[] = data?.keyMetrics?.map(m => ({
    label: m.label,
    value: m.value.toLocaleString("ar-EG"),
    change: m.change
  })) || []

  return { data: metrics, isLoading, isError }
}
