"use client"

import { Card } from "../ui/Card"
import { useActivityLog } from "../../lib/hooks/useActivityLog"
import { ClientDate } from "../ui/ClientDate"

export const ActivityLog = () => {
  const { data, isLoading, isError } = useActivityLog()

  const actionMap: Record<string, string> = {
    "lead.created": "إضافة عميل جديد",
    "lead.updated": "تحديث بيانات عميل",
    "lead.assigned": "تعيين عميل",
    "lead.viewed": "عرض تفاصيل عميل",
    "lead.listed": "عرض قائمة العملاء",
    "call.created": "تسجيل مكالمة",
    "meeting.created": "جدولة اجتماع",
    "task.created": "إنشاء مهمة",
    "note.created": "إضافة ملاحظة",
    "user.login": "تسجيل دخول"
  }

  return (
    <Card title="النشاط اليومي">
      <div className="lux-timeline space-y-3">
        {isLoading && <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-base-200 animate-pulse rounded" />
          ))}
        </div>}
        {isError && <p className="text-sm text-rose-500">تعذر تحميل النشاط</p>}
        {(data || []).map((item) => {
          const message = actionMap[item.action] || item.action
          return (
            <div key={item.id} className="lux-timeline__item flex flex-col gap-1 rounded-lg border border-base-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-base-900">{message}</p>
              <ClientDate 
                date={item.createdAt} 
                formatter={(d) => d.toLocaleTimeString("ar-EG")}
                className="text-xs text-base-500 whitespace-nowrap"
              />
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
