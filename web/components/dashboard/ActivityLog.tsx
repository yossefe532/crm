"use client"

import { Card } from "../ui/Card"
import { useNotifications } from "../../lib/hooks/useNotifications"

export const ActivityLog = () => {
  const { data, isLoading, isError } = useNotifications()

  return (
    <Card title="النشاط اليومي">
      <div className="lux-timeline space-y-3">
        {isLoading && <p className="text-sm text-base-500">جاري تحميل النشاط...</p>}
        {isError && <p className="text-sm text-rose-500">تعذر تحميل النشاط</p>}
        {(data || []).map((item) => {
          const message = (item.payload?.messageAr as string | undefined) || item.eventKey
          return (
            <div key={item.id} className="lux-timeline__item flex flex-col gap-1 rounded-lg border border-base-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-base-900">{message}</p>
              <span className="text-xs text-base-500 whitespace-nowrap">{new Date(item.createdAt).toLocaleTimeString("ar-EG")}</span>
            </div>
          )
        })}
        {!isLoading && !isError && (data || []).length === 0 && (
          <p className="text-sm text-base-500">لا يوجد نشاط اليوم</p>
        )}
      </div>
    </Card>
  )
}
