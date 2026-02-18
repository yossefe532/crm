import { useQuery } from "@tanstack/react-query"
import { coreService } from "../services/coreService"
import { useAuth } from "../auth/AuthContext"
import { Team } from "../types"

export const useTeams = () => {
  const { token } = useAuth()
  return useQuery<Team[]>({
    queryKey: ["teams"],
    queryFn: async () => coreService.listTeams(token || undefined),
    staleTime: 60000
  })
}
