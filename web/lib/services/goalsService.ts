import { apiClient } from "../api/client"

export type GoalPlan = {
  id: string
  name: string
  period: "weekly" | "monthly"
  startsAt: string
  endsAt: string
  status: string
}

export type GoalTarget = {
  id: string
  subjectType: "user" | "team" | "all"
  subjectId: string
  metricKey: string
  targetValue: number
}

export type GoalReportRow = {
  id: string
  subjectType: "user" | "team" | "all"
  subjectId: string
  metricKey: string
  targetValue: number
  actualValue: number
  ratio: number
  score: number
  status: "success" | "warning" | "danger"
  rating: string
}

export const goalsService = {
  createPlan: (payload: { name: string; period: "weekly" | "monthly"; startsAt?: string; endsAt?: string }, token?: string) =>
    apiClient.post<GoalPlan>("/goals/plans", payload, token),
  listPlans: (token?: string) => apiClient.get<GoalPlan[]>("/goals/plans", token),
  deletePlan: (planId: string, token?: string) => apiClient.delete(`/goals/plans/${planId}`, token),
  listTargets: (planId: string, token?: string) => apiClient.get<GoalTarget[]>(`/goals/plans/${planId}/targets`, token),
  setTargets: (planId: string, targets: Array<{ subjectType: "user" | "team" | "all"; subjectId: string; metricKey: string; targetValue: number }>, token?: string) =>
    apiClient.post<GoalTarget[]>(`/goals/plans/${planId}/targets`, { targets }, token),
  report: (planId: string, token?: string) =>
    apiClient.get<{ plan: GoalPlan; periodProgress: number; rows: GoalReportRow[] }>(`/goals/plans/${planId}/report`, token),
  overview: (period: "weekly" | "monthly", token?: string) =>
    apiClient.get<{ plan: GoalPlan | null; report: { plan: GoalPlan; periodProgress: number; rows: GoalReportRow[] } | null }>(`/goals/overview?period=${period}`, token)
}
