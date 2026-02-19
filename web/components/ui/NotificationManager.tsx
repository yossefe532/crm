"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "../../lib/auth/AuthContext"
import { usePush } from "../../lib/hooks/usePush"

export const NotificationManager = () => {
  const { token, userId } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const { isSubscribed, subscribe } = usePush()
  const [deviceId, setDeviceId] = useState<string | null>(null)

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
        try {
          const id = deviceId || ""
          if (id) localStorage.setItem("notif_device_id", id)
        } catch {}
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error)
    }
  }, [isSubscribed, subscribe, deviceId])

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    setPermission(Notification.permission)
    if (Notification.permission === "default" && userId) {
      requestPermission()
    }
  }, [userId, requestPermission])

  // Device fingerprint (IP + UA) to detect new device
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    const run = async () => {
      try {
        const ua = navigator.userAgent
        let ip = "unknown"
        try {
          const res = await fetch("https://api.ipify.org?format=json")
          const data = await res.json()
          ip = data.ip || "unknown"
        } catch {}
        const id = `${ua}|${ip}`
        setDeviceId(id)
        let prev: string | null = null
        try {
          prev = localStorage.getItem("notif_device_id")
        } catch {}
        if (prev !== id && Notification.permission === "default" && userId) {
          // New device or IP change: ask permission
          await requestPermission()
        }
      } catch {}
    }
    run()
  }, [userId, requestPermission])

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

  const [isDeniedBannerVisible, setIsDeniedBannerVisible] = useState(false)

  useEffect(() => {
    let dismissed: string | null = null
    try {
      dismissed = localStorage.getItem("notification_denied_dismissed")
    } catch {}
    if (permission === "denied" && !dismissed) {
      setIsDeniedBannerVisible(true)
    }
  }, [permission])

  const dismissDeniedBanner = () => {
    setIsDeniedBannerVisible(false)
    try {
      localStorage.setItem("notification_denied_dismissed", "true")
    } catch {}
  }

  // If denied, show a hint banner to enable notifications from browser settings
  if (permission === "denied" && userId && isDeniedBannerVisible) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-rose-200 bg-white p-4 shadow-lg dark:border-rose-800 dark:bg-base-900 md:left-auto md:right-4 md:w-96">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-rose-100 p-2 text-rose-600 dark:bg-rose-900/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div className="flex-1">
            <h4 className="mb-1 font-semibold text-base-900">الإشعارات معطلة</h4>
            <p className="mb-3 text-sm text-base-600">لتفعيل الإشعارات، افتح إعدادات المتصفح واسمح للإشعارات لهذا الموقع.</p>
            <div className="flex gap-2">
              <button 
                onClick={dismissDeniedBanner}
                className="rounded-md bg-base-100 px-3 py-1.5 text-xs font-medium text-base-700 hover:bg-base-200 transition-colors"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
