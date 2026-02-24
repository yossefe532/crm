"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { useNotifications, useArchiveAll, useMarkAsRead, useUnreadCount } from "../../lib/hooks/useNotifications"
import { usePush } from "../../lib/hooks/usePush"
import { ClientDate } from "../ui/ClientDate"
import { Notification } from "../../lib/types"
import { Info, CheckCircle, AlertTriangle, XCircle, AtSign, UserPlus, Clock, Settings, Bell } from "lucide-react"

const getNotificationIcon = (type: string) => {
  if (!type) return <Info className="h-5 w-5 text-blue-500" />
  switch (type) {
    case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />
    case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />
    case 'error': return <XCircle className="h-5 w-5 text-rose-500" />
    case 'mention': return <AtSign className="h-5 w-5 text-blue-500" />
    case 'assignment': return <UserPlus className="h-5 w-5 text-indigo-500" />
    case 'reminder': return <Clock className="h-5 w-5 text-orange-500" />
    case 'system': return <Settings className="h-5 w-5 text-slate-500" />
    default: return <Info className="h-5 w-5 text-blue-500" />
  }
}

import { notificationService } from "../../lib/services/notificationService"
import { toast } from "sonner"

export const NotificationsPanel = ({ fullPage = false }: { fullPage?: boolean }) => {
  const router = useRouter()
  const { isSubscribed, subscribe } = usePush()
  const { data: notificationsData, isLoading, isError } = useNotifications()
  const { data: unreadCountData } = useUnreadCount()
  const { mutate: archiveAll, isPending: isClearing } = useArchiveAll()
  const { mutate: markAsRead } = useMarkAsRead()
  const [mounted, setMounted] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleTestPush = async () => {
    try {
      setIsTesting(true)
      await notificationService.testPush()
      toast.success("تم إرسال الإشعار التجريبي")
    } catch (error) {
      toast.error("فشل إرسال الإشعار التجريبي")
    } finally {
      setIsTesting(false)
    }
  }

  const notifications = Array.isArray(notificationsData?.data) ? notificationsData.data.filter(n => n && n.id) : []
  const unreadCount = unreadCountData?.count || 0

  if (!mounted) return null

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id)
    }
    
    if (notification.actionUrl) {
      router.push(notification.actionUrl)
    } else if (notification.entityType === 'lead' && notification.entityId) {
      router.push(`/leads/${notification.entityId}`)
    }
  }

  return (
    <Card 
      title={
        <span className="notify-title flex items-center gap-2">
          <Bell className="h-5 w-5 text-base-500" />
          الإشعارات
          {unreadCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white animate-pulse">{unreadCount}</span>}
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          {!isSubscribed ? (
            <Button size="sm" onClick={subscribe}>تفعيل التنبيهات</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleTestPush} disabled={isTesting}>
              {isTesting ? "جاري الإرسال..." : "تجربة الإشعار"}
            </Button>
          )}
          {notifications.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                if (confirm("هل أنت متأكد من مسح جميع الإشعارات؟")) {
                  archiveAll()
                }
              }} 
              disabled={isClearing}
              className="text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50"
            >
              {isClearing ? "جاري المسح..." : "مسح الكل"}
            </Button>
          )}
        </div>
      }
    >
      <div className={`space-y-3 overflow-y-auto pr-1 custom-scrollbar ${fullPage ? '' : 'max-h-[400px]'}`}>
        {isLoading && <p className="text-sm text-base-500">جاري تحميل الإشعارات...</p>}
        {isError && <p className="text-sm text-rose-500">تعذر تحميل الإشعارات</p>}
        {notifications.map((notification) => {
          return (
            <div 
                key={notification.id} 
                className={`notify-card rounded-lg px-3 py-2 ${!notification.isRead ? 'bg-blue-50/50' : ''} hover:bg-base-50 transition-colors cursor-pointer relative group border-b border-base-100 last:border-0`}
                onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex gap-3 items-start">
                <div className="mt-0.5 flex-shrink-0 opacity-80">
                    {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <p className={`text-sm ${!notification.isRead ? 'font-semibold text-base-900' : 'font-medium text-base-700'} line-clamp-1`}>
                            {notification.title}
                        </p>
                        {!notification.isRead && (
                            <span className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        )}
                    </div>
                    <p className="text-xs text-base-600 mt-1 line-clamp-2 leading-relaxed">{notification.message}</p>
                    
                    <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-2">
                            {notification.sender && (
                                <span className="text-[10px] text-base-500 bg-base-100 px-1.5 py-0.5 rounded-full">
                                    {notification.sender.profile?.firstName || notification.sender.email}
                                </span>
                            )}
                            <ClientDate 
                                date={notification.createdAt} 
                                className="text-[10px] text-base-400"
                            />
                        </div>
                    </div>
                </div>
              </div>
            </div>
          )
        })}
        {!isLoading && !isError && notifications.length === 0 && (
          <p className="text-sm text-base-500 text-center py-4">لا توجد إشعارات حالياً</p>
        )}
      </div>
    </Card>
  )
}
