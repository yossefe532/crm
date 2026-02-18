"use client"

import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { useNotifications } from "../../lib/hooks/useNotifications"
import { usePush } from "../../lib/hooks/usePush"

export const NotificationsPanel = () => {
  const { isSubscribed, subscribe } = usePush()
  const { data, isLoading, isError } = useNotifications()

  return (
    <Card 
      title={
        <span className="notify-title">
          الإشعارات
          <span className="notify-dot" aria-hidden="true" />
        </span>
      }
      actions={!isSubscribed ? <Button onClick={subscribe}>تفعيل التنبيهات</Button> : <span className="text-sm text-green-600">التنبيهات مفعلة</span>}
    >
      <div className="space-y-3">
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
              <p className="text-xs text-base-500">{new Date(event.createdAt).toLocaleString("ar-EG")}</p>
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
