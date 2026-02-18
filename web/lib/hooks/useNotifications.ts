"use client"

import { useQuery } from "@tanstack/react-query"
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
