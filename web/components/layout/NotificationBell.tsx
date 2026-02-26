"use client"

import { useState, useRef, useEffect } from "react"
import { Bell, Goal, CheckCircle, Info, AlertTriangle, XCircle, AtSign, UserPlus, Clock, Settings } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { goalsService } from "../../lib/services/goalsService"
import { useNotifications, useUnreadCount, useMarkAsRead, useArchiveAll } from "../../lib/hooks/useNotifications"
import { useAuth } from "../../lib/auth/AuthContext"
import { Button } from "../ui/Button"
import { Progress } from "../ui/Progress"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Notification } from "../../lib/types"

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />
    case 'error': return <XCircle className="h-4 w-4 text-rose-500" />
    case 'mention': return <AtSign className="h-4 w-4 text-blue-500" />
    case 'assignment': return <UserPlus className="h-4 w-4 text-indigo-500" />
    case 'reminder': return <Clock className="h-4 w-4 text-orange-500" />
    case 'system': return <Settings className="h-4 w-4 text-slate-500" />
    default: return <Info className="h-4 w-4 text-blue-500" />
  }
}

export const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { token } = useAuth()
  const router = useRouter()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // 1. Fetch Pinned Goal
  const { data: plans } = useQuery({
    queryKey: ["goal_plans"],
    queryFn: () => goalsService.listPlans(token || undefined),
    enabled: !!token,
  })

  const pinnedPlan = plans?.find((p) => p.isPinned)

  const { data: report } = useQuery({
    queryKey: ["goal_report", pinnedPlan?.id],
    queryFn: () => goalsService.report(pinnedPlan?.id || "", token || undefined),
    enabled: !!pinnedPlan,
    refetchInterval: 250, // Real-time update
  })

  // 2. Fetch User Notifications (New System)
  const { data: notificationsData, refetch: refetchNotifications } = useNotifications({ limit: 10 })
  const { data: unreadCountData } = useUnreadCount()
  const { mutate: markAsRead } = useMarkAsRead()
  const { mutate: archiveAll, isPending: isClearing } = useArchiveAll()

  const notifications = notificationsData?.data || []
  const unreadCount = unreadCountData?.count || 0
  
  // Calculate Pinned Goal Progress
  const progressPercent = report ? Math.round(report.periodProgress * 100) : 0
  const isCompleted = progressPercent >= 100

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id)
    }
    
    if (notification.actionUrl) {
      router.push(notification.actionUrl)
      setIsOpen(false)
    } else if (notification.entityType === 'lead' && notification.entityId) {
      router.push(`/leads/${notification.entityId}`)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        className="relative text-base-500 hover:text-brand-600 p-2 h-9 w-9"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {(unreadCount > 0 || pinnedPlan) && (
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute left-0 mt-2 w-80 md:w-96 rounded-xl border border-base-200 bg-white shadow-lg ring-1 ring-black/5 z-50 overflow-hidden"
            style={{ left: "auto", right: "-10px" }} // Align to right
          >
            <div className="flex items-center justify-between border-b border-base-100 px-4 py-3 bg-base-50">
              <h3 className="text-sm font-semibold text-base-900">الإشعارات</h3>
              {pinnedPlan && (
                <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-700/10">
                  هدف مثبت 📌
                </span>
              )}
            </div>

            <div className="max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Pinned Goal Section */}
              {pinnedPlan && report && (
                <div className="p-4 border-b border-brand-100 bg-brand-50/30">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${isCompleted ? "bg-emerald-100 text-emerald-600" : "bg-brand-100 text-brand-600"}`}>
                      {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Goal className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                            <h4 className="text-sm font-bold text-base-900">{pinnedPlan.name}</h4>
                            <p className="text-xs text-base-500">
                                {new Date(pinnedPlan.endsAt).toLocaleDateString("ar-EG")} - ينتهي في
                            </p>
                        </div>
                        <span className={`text-sm font-bold ${isCompleted ? "text-emerald-600" : "text-brand-600"}`}>
                            {progressPercent}%
                        </span>
                      </div>
                      
                      <Progress value={progressPercent} tone={isCompleted ? "success" : "brand"} />
                      
                      <div className="text-xs text-base-600 space-y-1">
                        {report.rows.slice(0, 3).map((row) => (
                            <div key={row.id} className="flex justify-between">
                                <span>{row.metricKey === 'leads_created' ? 'عملاء جدد' : row.metricKey === 'leads_closed' ? 'إغلاقات' : row.metricKey}</span>
                                <span className={row.status === 'success' ? 'text-emerald-600 font-medium' : ''}>
                                    {row.actualValue}/{row.targetValue}
                                </span>
                            </div>
                        ))}
                      </div>

                      <Link 
                        href="/analytics/goals" 
                        className="block text-center text-xs text-brand-600 hover:text-brand-700 font-medium mt-2"
                        onClick={() => setIsOpen(false)}
                      >
                        عرض التفاصيل الكاملة ←
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Regular Notifications */}
              <div className="divide-y divide-base-100">
                <AnimatePresence initial={false}>
                {notifications && notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <motion.div 
                        key={notification.id}
                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                        animate={{ opacity: 1, height: "auto", scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`hover:bg-base-50 transition-colors cursor-pointer ${!notification.isRead ? 'bg-blue-50/30' : ''}`}
                        onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="p-4 flex gap-3">
                        <div className="mt-1 flex-shrink-0">
                             {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <p className={`text-sm ${!notification.isRead ? 'font-semibold text-base-900' : 'font-medium text-base-700'}`}>
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-brand-600" />
                            )}
                          </div>
                          <p className="mt-1 text-xs text-base-500 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-[10px] text-base-400">
                            {new Date(notification.createdAt).toLocaleDateString("ar-EG", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  !pinnedPlan && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="p-8 text-center text-base-500"
                    >
                      <p className="text-sm">لا توجد إشعارات جديدة</p>
                    </motion.div>
                  )
                )}
                </AnimatePresence>
              </div>
            </div>
            
            {(notifications && notifications.length > 0) && (
                <div className="p-3 border-t border-base-100 bg-base-50 text-center flex gap-2">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs flex-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => {
                            if (confirm("هل أنت متأكد من مسح جميع الإشعارات؟")) {
                                archiveAll()
                            }
                        }}
                        disabled={isClearing}
                    >
                        {isClearing ? "جاري المسح..." : "مسح الكل"}
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs flex-1 text-base-600"
                         onClick={() => {
                            router.push('/notifications') // Assuming there is a full page
                            setIsOpen(false)
                        }}
                    >
                        عرض الكل
                    </Button>
                </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
