"use client"

import { Card } from "../ui/Card"
import { Badge } from "../ui/Badge"
import { useLeadTasks } from "../../lib/hooks/useLeadTasks"

import { ClientDate } from "../ui/ClientDate"

export const TaskList = () => {
  const { data, isLoading, isError } = useLeadTasks()

  return (
    <Card title="إدارة المهام">
      <div className="space-y-3">
        {isLoading && <p className="text-sm text-base-500">جاري تحميل المهام...</p>}
        {isError && <p className="text-sm text-rose-500">تعذر تحميل المهام</p>}
        {(data || []).map((task) => (
          <div key={task.id} className="flex flex-col gap-2 rounded-lg border border-base-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-base-900">{task.taskType}</p>
              <p className="text-xs text-base-500">
                العميل {task.lead?.name || "غير معروف"} • الموعد <ClientDate date={task.dueAt || ""} fallback="غير محدد" />
              </p>
            </div>
            <div className="self-end sm:self-auto">
              <Badge tone={task.status === "done" || task.status === "completed" ? "success" : "warning"}>
                {task.status === "done" || task.status === "completed" ? "مكتمل" : "مفتوح"}
              </Badge>
            </div>
          </div>
        ))}
        {!isLoading && !isError && (data || []).length === 0 && (
          <p className="text-sm text-base-500">لا توجد مهام حالياً</p>
        )}
      </div>
    </Card>
  )
}
