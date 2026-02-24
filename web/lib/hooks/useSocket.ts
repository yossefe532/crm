"use client"

import { useEffect, useState } from "react"
import { io, Socket } from "socket.io-client"
import { useAuth } from "../auth/AuthContext"
import { toast } from "react-hot-toast"
import { useQueryClient } from "@tanstack/react-query"
import { Notification } from "../types"

export const useSocket = () => {
  const { userId, tenantId, token } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId || !token) return

    // Connect to the backend
    // Dynamically determine backend URL based on current window location
    // This allows connecting from other devices on the network
    const backendPort = 4000
    const socketUrl = typeof window !== 'undefined' 
        ? `${window.location.protocol}//${window.location.hostname}:${backendPort}`
        : "http://localhost:4000"
    
    const newSocket = io(socketUrl, {
      auth: { token },
      query: { userId, tenantId },
      transports: ["websocket", "polling"],
      path: "/socket.io"
    })

    newSocket.on("connect", () => {
      // console.log("Socket connected")
      // Join rooms if not handled by server automatically on connection
      if (tenantId) newSocket.emit("join_tenant", tenantId)
      if (userId) newSocket.emit("join_user", userId)
    })

    // Legacy notification event
    newSocket.on("notification", (data: { message: string, type?: "success" | "error" | "info" }) => {
      if (data.type === "success") toast.success(data.message)
      else if (data.type === "error") toast.error(data.message)
      else toast(data.message)
    })

    // New notification event
    newSocket.on("notification:new", (notification: Notification) => {
      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] })
      
      // Show toast
      if (notification.type === "success") toast.success(notification.message)
      else if (notification.type === "error") toast.error(notification.message)
      else if (notification.type === "warning") toast(notification.message, { icon: "⚠️" })
      else toast(notification.message, { icon: "🔔" })
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [userId, tenantId, token, queryClient])

  return socket
}
