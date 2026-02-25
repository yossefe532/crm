"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "../auth/AuthContext"
import { notificationService } from "../services/notificationService"
import { Notification } from "../types"

export const useNotifications = (params: { page?: number; limit?: number; unreadOnly?: boolean } = {}) => {
  const { token } = useAuth()
  return useQuery({
    queryKey: ["notifications", params],
    queryFn: async () => notificationService.list(params, token || undefined),
    enabled: !!token,
    staleTime: 0,
    refetchInterval: 250,
  })
}

export const useUnreadCount = () => {
  const { token } = useAuth()
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => notificationService.getUnreadCount(token || undefined),
    enabled: !!token,
    refetchInterval: 250 // Refresh every 250ms
  })
}

export const useMarkAsRead = () => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => notificationService.markAsRead(id, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] })
    }
  })
}

export const useMarkAllAsRead = () => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => notificationService.markAllAsRead(token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] })
    }
  })
}

export const useArchiveNotification = () => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => notificationService.archive(id, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] })
    }
  })
}

export const useArchiveAll = () => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => notificationService.archiveAll(token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] })
    }
  })
}
