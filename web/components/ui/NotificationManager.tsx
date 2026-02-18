"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "../../lib/auth/AuthContext"
import { usePush } from "../../lib/hooks/usePush"

export const NotificationManager = () => {
  const { token, userId } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const { isSubscribed, subscribe } = usePush()

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return
    
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      
      if (result === "granted") {
        // Subscribe to push if not subscribed
        if (!isSubscribed) {
          await subscribe()
        }
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error)
    }
  }, [isSubscribed, subscribe])

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    setPermission(Notification.permission)
    if (Notification.permission === "default" && userId) {
      requestPermission()
    }
  }, [userId, requestPermission])

  // No need for manual SW registration here; usePush handles it

  // Render a permission request banner if permission is default and user is logged in
  if (permission === "default" && userId) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-brand-200 bg-white p-4 shadow-lg dark:border-brand-800 dark:bg-base-900 md:left-auto md:right-4 md:w-96">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-brand-100 p-2 text-brand-600 dark:bg-brand-900/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          </div>
          <div className="flex-1">
            <h4 className="mb-1 font-semibold text-base-900">تفعيل الإشعارات</h4>
            <p className="mb-3 text-sm text-base-600">احصل على تنبيهات فورية للمحادثات والمهام الجديدة حتى خارج الموقع.</p>
            <div className="flex gap-2">
              <button 
                onClick={requestPermission}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
              >
                سماح
              </button>
              <button 
                onClick={() => setPermission("denied")}
                className="rounded-md bg-base-100 px-3 py-1.5 text-xs font-medium text-base-700 hover:bg-base-200 transition-colors"
              >
                لاحقاً
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
