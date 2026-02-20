import { apiClient } from "../api/client"

export interface DashboardMetrics {
  distribution: Array<{ stage: string; count: number }>
  conversion: { total: number; won: number; rate: number }
  avgTime: Array<{ stage: string; avgHours: number }>
  salesPerformance: Array<{
    userId: string
    name: string
    deals: number
    value: number
    total: number
    conversionRate: number
  }>
  teamPerformance: Array<{
    teamId: string
    teamName: string
    leaderName: string
    deals: number
    value: number
    total: number
    conversionRate: number
  }>
  revenueOverTime: Array<{ name: string; value: number }>
  leadSources: Array<{ name: string; value: number }>
  keyMetrics: Array<{ label: string; value: number; change: number }>
}

export interface TimelineEvent {
  id: string
  type: "stage_change" | "assignment" | "note" | "meeting"
  date: string
  actor?: { id: string; email: string; profile?: { firstName?: string; lastName?: string } }
  details: any
}

export const analyticsService = {
  getDashboardMetrics: (token?: string) => apiClient.get<DashboardMetrics>("/analytics/dashboard", token),
  getLeadTimeline: (leadId: string, token?: string) => apiClient.get<TimelineEvent[]>(`/analytics/leads/${leadId}/timeline`, token),
  getEmployeePerformance: (period?: "weekly" | "monthly", token?: string) =>
    apiClient.get<
      Array<{
        userId: string
        name: string
        points: number
        revenue: number
        breakdown: { calls: number; meetings: number; siteVisits: number; wins: number; fails: number }
      }>
    >(
      `/analytics/employees/performance${period ? `?period=${period}` : ""}`,
      token
    ),
  listDailyMetrics: (params?: { from?: string; to?: string }, token?: string) => {
    const query = new URLSearchParams()
    if (params?.from) query.set("from", params.from)
    if (params?.to) query.set("to", params.to)
    const suffix = query.toString() ? `?${query.toString()}` : ""
    return apiClient.get<Array<{ metricDate: string; leadsCreated: number; leadsClosed: number }>>(`/analytics/metrics/daily${suffix}`, token)
  }
}
