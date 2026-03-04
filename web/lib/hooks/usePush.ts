"use client"

import { useEffect, useState, useCallback } from "react"
import { notificationService } from "../services/notificationService"

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export const usePush = () => {
  const [isSubscribed, setIsSubscribed] = useState(false)

  const refreshStatus = useCallback(async () => {
    if (!("serviceWorker" in navigator && "PushManager" in window)) {
      setIsSubscribed(false)
      return
    }
    const registration = await navigator.serviceWorker.register("/sw.js")
    const localSubscription = await registration.pushManager.getSubscription()
    const serverStatus = await notificationService.getSubscriptionStatus().catch(() => ({ isSubscribed: false }))
    setIsSubscribed(Boolean(localSubscription) && Boolean(serverStatus?.isSubscribed))
  }, [])

  useEffect(() => {
    if (!("serviceWorker" in navigator && "PushManager" in window)) return
    const onMessage = (event: MessageEvent) => {
      if (event.data && (event.data.type === "PLAY_SOUND" || event.data.type === "PUSH_RECEIVED")) {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3")
        audio.play().catch(() => null)
        window.dispatchEvent(new CustomEvent("push-notification", { detail: event.data.payload }))
      }
    }
    navigator.serviceWorker.addEventListener("message", onMessage)
    refreshStatus().catch(() => null)
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage)
    }
  }, [refreshStatus])

  const subscribe = async () => {
    if (!("serviceWorker" in navigator)) return

    try {
      const registration = await navigator.serviceWorker.ready
      const { publicKey } = await notificationService.getVapidKey()
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      })

      await notificationService.subscribe(subscription)
      await refreshStatus()
    } catch {
      return
    }
  }

  const unsubscribe = async () => {
    if (!("serviceWorker" in navigator)) return
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      setIsSubscribed(false)
      return
    }
    await notificationService.unsubscribe(subscription.endpoint).catch(() => null)
    await subscription.unsubscribe().catch(() => null)
    await refreshStatus()
  }

  return { isSubscribed, subscribe, unsubscribe, refreshStatus }
}
