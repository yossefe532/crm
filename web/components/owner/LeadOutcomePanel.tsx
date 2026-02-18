"use client"

import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { useAuth } from "../../lib/auth/AuthContext"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { leadService } from "../../lib/services/leadService"
import { useLeads } from "../../lib/hooks/useLeads"
import { useLeadFailures } from "../../lib/hooks/useLeadFailures"
import { useLeadClosures } from "../../lib/hooks/useLeadClosures"
import { useUsers } from "../../lib/hooks/useUsers"

export const LeadOutcomePanel = () => {
  const { role, token } = useAuth()
  const { data: leads } = useLeads()
  const { data: failures } = useLeadFailures()
  const { data: closures } = useLeadClosures()
  const { data: users } = useUsers()
  const queryClient = useQueryClient()
  const leadsById = new Map((leads || []).map((lead) => [lead.id, lead]))
  const usersById = new Map((users || []).map((user) => [user.id, user]))
  const decideMutation = useMutation({
    mutationFn: (payload: { closureId: string; status: "approved" | "rejected" }) => leadService.decideClosure(payload.closureId, { status: payload.status }, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead_closures"] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    }
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card title="اعتماد الصفقات">
        <div className="space-y-3">
          {(closures || []).filter((closure) => closure.status === "pending").map((closure) => (
            <div key={closure.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-100 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-base-900">{leadsById.get(closure.leadId)?.name || "عميل"}</p>
                <p className="text-xs text-base-500">{new Date(closure.closedAt).toLocaleDateString("ar-EG")}</p>
                <p className="text-xs text-base-500">قيمة الإغلاق: {closure.amount.toLocaleString("ar-EG")}</p>
                {closure.address && <p className="text-xs text-base-500">عنوان الإغلاق: {closure.address}</p>}
              </div>
              {role === "owner" && (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => decideMutation.mutate({ closureId: closure.id, status: "approved" })}>
                    نجحت
                  </Button>
                  <Button variant="ghost" onClick={() => decideMutation.mutate({ closureId: closure.id, status: "rejected" })}>
                    فشلت
                  </Button>
                </div>
              )}
            </div>
          ))}
          {(closures || []).filter((closure) => closure.status === "pending").length === 0 && (
            <p className="text-sm text-base-500">لا توجد صفقات معلقة</p>
          )}
        </div>
      </Card>
      <Card title="الصفقات الناجحة">
        <div className="space-y-3">
          {(closures || []).filter((closure) => closure.status === "approved" || !closure.status).map((closure) => (
            <div key={closure.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-100 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-base-900">{leadsById.get(closure.leadId)?.name || "عميل"}</p>
                <p className="text-xs text-base-500">{new Date(closure.closedAt).toLocaleDateString("ar-EG")}</p>
              </div>
              <div className="text-sm font-medium text-base-900">{closure.amount.toLocaleString("ar-EG")}</div>
              {closure.address && <p className="text-xs text-base-500">عنوان الإغلاق: {closure.address}</p>}
            </div>
          ))}
          {(closures || []).filter((closure) => closure.status === "approved" || !closure.status).length === 0 && <p className="text-sm text-base-500">لا توجد صفقات ناجحة بعد</p>}
        </div>
      </Card>
      <Card title="الصفقات الفاشلة">
        <div className="space-y-3">
          {(failures || []).map((failure) => (
            <div key={failure.id} className="rounded-lg border border-base-100 px-3 py-2">
              <p className="text-sm font-semibold text-base-900">{leadsById.get(failure.leadId)?.name || "عميل"}</p>
              <p className="text-xs text-base-500">{failure.reason || "بانتظار السبب"}</p>
              {failure.failedBy && (
                <p className="text-xs text-base-500">
                  فشل بواسطة: {usersById.get(failure.failedBy)?.name || usersById.get(failure.failedBy)?.email || failure.failedBy}
                </p>
              )}
            </div>
          ))}
          {(failures || []).length === 0 && <p className="text-sm text-base-500">لا توجد صفقات فاشلة</p>}
        </div>
      </Card>
    </div>
  )
}
