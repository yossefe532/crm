"use client"

import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { useNotifications, useClearNotifications } from "../../lib/hooks/useNotifications"
import { usePush } from "../../lib/hooks/usePush"
import { ClientDate } from "../ui/ClientDate"

export const NotificationsPanel = () => {
  const { isSubscribed, subscribe } = usePush()
  const { data, isLoading, isError } = useNotifications()
  const { mutate: clearNotifications, isPending: isClearing } = useClearNotifications()

  return (
    <Card 
      title={
        <span className="notify-title flex items-center gap-2">
          الإشعارات
          {data && data.length > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">{data.length}</span>}
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          {!isSubscribed ? (
            <Button size="sm" onClick={subscribe}>تفعيل التنبيهات</Button>
          ) : (
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">نشط</span>
          )}
          {data && data.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => clearNotifications()} 
              disabled={isClearing}
              className="text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50"
            >
              {isClearing ? "جاري المسح..." : "مسح الكل"}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
        {isLoading && <p className="text-sm text-base-500">جاري تحميل الإشعارات...</p>}
        {isError && <p className="text-sm text-rose-500">تعذر تحميل الإشعارات</p>}
        {(data || []).map((event) => {
          const payload = event.payload as Record<string, unknown>
          const message = (payload?.messageAr as string | undefined) || event.eventKey
          const sender = payload?.senderName as string | undefined
          return (
            <div key={event.id} className="notify-card rounded-lg px-3 py-2">
              <p className="text-sm font-medium text-base-900">{message}</p>
              {sender && <p className="text-xs text-base-500">اللي بعت: {sender}</p>}
              <ClientDate 
                date={event.createdAt} 
                className="text-xs text-base-500"
              />
            </div>
          )
        })}
        {!isLoading && !isError && (data || []).length === 0 && (
          <p className="text-sm text-base-500">لا توجد إشعارات حالياً</p>
        )}
      </div>
    </Card>
  )
}
