"use client"

import { useEffect, useRef } from "react"
import { io, Socket } from "socket.io-client"
import { useAuth } from "../auth/AuthContext"
import { toast } from "react-hot-toast"

export const useSocket = () => {
  const { userId, tenantId, token } = useAuth()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!userId || !token) return

    // Connect to the backend
    // Assuming backend is at same host or configured via env
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api"
    const socketUrl = baseUrl.replace("/api", "")
    
    // Check if socket is already connected
    if (socketRef.current?.connected) return

    socketRef.current = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      path: "/socket.io"
    })

    socketRef.current.on("connect", () => {
      // console.log("Socket connected")
      // Join rooms
      if (tenantId) socketRef.current?.emit("join_tenant", tenantId)
      if (userId) socketRef.current?.emit("join_user", userId)
    })

    socketRef.current.on("notification", (data: { message: string, type?: "success" | "error" | "info" }) => {
      if (data.type === "success") toast.success(data.message)
      else if (data.type === "error") toast.error(data.message)
      else toast(data.message)
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [userId, tenantId, token])

  return socketRef.current
}
