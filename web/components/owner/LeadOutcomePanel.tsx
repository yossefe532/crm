"use client"

import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"
import { useAuth } from "../../lib/auth/AuthContext"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { leadService } from "../../lib/services/leadService"
import { coreService } from "../../lib/services/coreService"
import { useLeads } from "../../lib/hooks/useLeads"
import { useLeadFailures } from "../../lib/hooks/useLeadFailures"
import { useLeadClosures } from "../../lib/hooks/useLeadClosures"
import { useUsers } from "../../lib/hooks/useUsers"
import { useState } from "react"

export const LeadOutcomePanel = () => {
  const { role, token } = useAuth()
  const { data: leads } = useLeads()
  const { data: failures } = useLeadFailures()
  const { data: closures } = useLeadClosures()
  const { data: users } = useUsers()
  const queryClient = useQueryClient()
  const [editingClosureId, setEditingClosureId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState<string>("")
  const [reassigningFailureId, setReassigningFailureId] = useState<string | null>(null)

  const leadsById = new Map((leads || []).map((lead) => [lead.id, lead]))
  const usersById = new Map((users || []).map((user) => [user.id, user]))

  const decideMutation = useMutation({
    mutationFn: (payload: { closureId: string; status: "approved" | "rejected"; amount?: number }) => 
      leadService.decideClosure(payload.closureId, { status: payload.status, amount: payload.amount }, token || undefined),
    onSuccess: async (data, variables) => {
      if (variables.status === "approved") {
        const closure = closures?.find(c => c.id === variables.closureId)
        if (closure) {
          const amount = variables.amount || closure.amount
          try {
            await coreService.createFinanceEntry({
              entryType: "income",
              category: "sales",
              amount: Number(amount),
              note: `إغلاق صفقة: ${leadsById.get(closure.leadId)?.name || "عميل"}`,
              occurredAt: new Date().toISOString()
            }, token || undefined)
          } catch (e) {
            console.error("Failed to create finance entry", e)
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ["lead_closures"] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["finance_entries"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-analytics"] })
      setEditingClosureId(null)
    }
  })

  const reassignMutation = useMutation({
    mutationFn: (payload: { leadId: string; userId: string }) => 
      leadService.assign(payload.leadId, { assignedUserId: payload.userId }, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["lead_failures"] })
      setReassigningFailureId(null)
    }
  })

  const archiveMutation = useMutation({
    mutationFn: (leadId: string) => leadService.updateStage(leadId, "archived", token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["lead_failures"] })
    }
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card title="اعتماد الصفقات">
        <div className="space-y-3">
          {(closures || []).filter((closure) => closure.status === "pending").map((closure) => (
            <div key={closure.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-100 px-3 py-2">
              <div className="flex-1">
                <p className="text-sm font-semibold text-base-900">{leadsById.get(closure.leadId)?.name || "عميل"}</p>
                <p className="text-xs text-base-500">{new Date(closure.closedAt).toLocaleDateString("ar-EG")}</p>
                {editingClosureId === closure.id ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input 
                      value={editAmount} 
                      onChange={(e) => setEditAmount(e.target.value)} 
                      type="number"
                      className="w-32 h-8 text-sm"
                      placeholder="المبلغ"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-base-500">قيمة الإغلاق: {Number(closure.amount).toLocaleString("ar-EG")}</p>
                    {role === "owner" && (
                      <button 
                        className="text-xs text-primary-600 hover:underline"
                        onClick={() => { setEditingClosureId(closure.id); setEditAmount(String(closure.amount)) }}
                      >
                        تعديل
                      </button>
                    )}
                  </div>
                )}
                {closure.address && <p className="text-xs text-base-500">عنوان الإغلاق: {closure.address}</p>}
                {closure.note && <p className="text-xs text-base-500 italic">&quot;{closure.note}&quot;</p>}
              </div>
              {role === "owner" && (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="secondary" 
                    onClick={() => decideMutation.mutate({ 
                      closureId: closure.id, 
                      status: "approved",
                      amount: editingClosureId === closure.id ? Number(editAmount) : undefined
                    })}
                  >
                    اعتماد
                  </Button>
                  <Button variant="ghost" onClick={() => decideMutation.mutate({ closureId: closure.id, status: "rejected" })}>
                    رفض
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
              {role === "owner" && (
                <div className="mt-2 flex items-center gap-2">
                   {reassigningFailureId === failure.id ? (
                     <div className="flex items-center gap-1">
                       <select 
                         className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                         onChange={(e) => {
                           if (e.target.value) {
                             reassignMutation.mutate({ leadId: failure.leadId, userId: e.target.value })
                           }
                         }}
                         defaultValue=""
                         autoFocus
                         onBlur={() => setReassigningFailureId(null)}
                       >
                         <option value="" disabled>اختر مستخدم</option>
                         {(users || []).map(u => (
                           <option key={u.id} value={u.id}>{u.name || u.email}</option>
                         ))}
                       </select>
                       <Button variant="ghost" size="sm" onClick={() => setReassigningFailureId(null)}>x</Button>
                     </div>
                   ) : (
                     <Button variant="outline" size="sm" onClick={() => setReassigningFailureId(failure.id)}>إعادة تعيين</Button>
                   )}
                   <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => archiveMutation.mutate(failure.leadId)}>أرشيف</Button>
                </div>
              )}
            </div>
          ))}
          {(failures || []).length === 0 && <p className="text-sm text-base-500">لا توجد صفقات فاشلة</p>}
        </div>
      </Card>
    </div>
  )
}
