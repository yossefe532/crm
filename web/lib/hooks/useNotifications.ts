"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "../auth/AuthContext"
import { notificationService } from "../services/notificationService"
import { NotificationEvent } from "../types"

export const useNotifications = () => {
  const { token } = useAuth()
  return useQuery<NotificationEvent[]>({
    queryKey: ["notifications"],
    queryFn: async () => notificationService.listEvents(20, token || undefined),
    staleTime: 30000,
    refetchInterval: 60000
  })
}

export const useClearNotifications = () => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => notificationService.clearEvents(token || undefined),
    onSuccess: () => {
      // Optimistically clear the list
      queryClient.setQueryData(["notifications"], [])
      // Also invalidate to be sure
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    }
  })
}
