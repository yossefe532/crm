import { apiClient } from "../api/client"

export const aiService = {
  suggestions: (token?: string) => apiClient.get<Record<string, unknown>>("/ai/suggestions", token),
  templates: (token?: string) => apiClient.get<Record<string, unknown>>("/ai/templates", token)
}
