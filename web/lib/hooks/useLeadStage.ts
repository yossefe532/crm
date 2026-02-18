import { useMutation, useQueryClient } from "@tanstack/react-query"
import { leadService } from "../services/leadService"
import { useAuth } from "../auth/AuthContext"

export const useLeadStage = (leadId: string) => {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (stage: string) => leadService.updateStage(leadId, stage, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
    }
  })
}
