import { apiClient } from "../api/client"

export const intelligenceService = {
  performanceRanking: (token?: string) => apiClient.post<{ rows: Array<{ subjectId: string; subjectType: string; score: number }> }>("/intelligence/rankings/performance", {}, token),
  revenueForecast: (token?: string) => apiClient.post<{ monthly: Array<{ period: string; expected: number; weighted: number }> }>("/intelligence/forecast", {}, token)
}
