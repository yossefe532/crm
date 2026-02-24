"use client"

import { useEffect } from "react"
import { useSocket } from "../../lib/hooks/useSocket"
import { usePush } from "../../lib/hooks/usePush"
import { toast } from "sonner"

export const NotificationListener = () => {
  useSocket()
  const { isSubscribed, subscribe } = usePush()

  useEffect(() => {
    // If notification permission is default, ask user to enable it
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        toast("تفعيل الإشعارات", {
          description: "قم بتفعيل الإشعارات لتصلك التنبيهات المهمة خارج الموقع",
          action: {
            label: "تفعيل",
            onClick: () => {
              Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                  subscribe()
                  toast.success("تم تفعيل الإشعارات بنجاح")
                }
              })
            }
          },
          duration: 10000, // Show for longer
        })
      } else if (Notification.permission === "granted" && !isSubscribed) {
        // If already granted but not subscribed (e.g. new browser session or cleared data), try to subscribe
        subscribe()
      }
    }
  }, [isSubscribed, subscribe])

  return null
}
