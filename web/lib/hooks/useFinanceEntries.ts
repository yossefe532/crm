import { useQuery } from "@tanstack/react-query"
import { useAuth } from "../auth/AuthContext"
import { coreService } from "../services/coreService"
import { FinanceEntry } from "../types"

export const useFinanceEntries = () => {
  const { token } = useAuth()
  return useQuery<FinanceEntry[]>({
    queryKey: ["finance_entries"],
    queryFn: async () => coreService.listFinanceEntries(token || undefined),
    staleTime: 0,
    refetchInterval: 1000
  })
}
