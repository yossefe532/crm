import { apiClient } from "../api/client"

export const commissionService = {
  ledger: (token?: string) => apiClient.get<Record<string, unknown>>("/commissions/ledger", token)
}
