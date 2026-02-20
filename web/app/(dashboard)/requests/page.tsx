"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { coreService } from "../../../lib/services/coreService"
import { useAuth } from "../../../lib/auth/AuthContext"
import { Card } from "../../../components/ui/Card"
import { Button } from "../../../components/ui/Button"
import { Badge } from "../../../components/ui/Badge"
import { Avatar } from "../../../components/ui/Avatar"
import { format } from "date-fns"
import { ar } from "date-fns/locale"

export default function RequestsPage() {
  const { token, role, userId } = useAuth()
  const queryClient = useQueryClient()
  const [processingId, setProcessingId] = useState<string | null>(null)

  const { data: requests, isLoading } = useQuery({
    queryKey: ["user-requests"],
    queryFn: () => coreService.listUserRequests(token || undefined),
    enabled: !!token
  })

  const decideMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      setProcessingId(id)
      try {
        await coreService.decideUserRequest(id, status, token || undefined)
      } finally {
        setProcessingId(null)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-requests"] })
    },
  })

  // Filter requests based on role
  const pendingRequests = (requests || []).filter(
    (req) => req.status === "pending" && (role === "owner" || role === "team_leader" ? req.requestType === "create_lead" : req.requester?.id === userId)
  )

  const isApprover = role === "owner" || role === "team_leader"

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-base-900 dark:text-white">{isApprover ? "طلبات الموافقة" : "طلباتي"}</h1>
        <Badge variant="outline">{pendingRequests.length} {isApprover ? "قيد الانتظار" : "طلبات"}</Badge>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-base-100" />
          ))}
        </div>
      ) : pendingRequests.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-base-100 p-4">
              <svg className="h-8 w-8 text-base-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-base-900">لا توجد طلبات معلقة</h3>
            <p className="mt-1 text-sm text-base-500">{isApprover ? "جميع الطلبات تمت معالجتها" : "لم تقم بإرسال أي طلبات بعد"}</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pendingRequests.map((req) => (
            <Card key={req.id} className="relative overflow-hidden">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar 
                    name={req.requester?.name || req.requester?.email || "?"} 
                    src={req.requester?.profile?.avatar}
                  />
                  <div>
                    <p className="font-medium text-base-900">{req.requester?.name || req.requester?.email}</p>
                    <p className="text-xs text-base-500">
                      {format(new Date(req.createdAt), "PP p", { locale: ar })}
                    </p>
                  </div>
                </div>
                <Badge variant={req.status === 'pending' ? 'warning' : req.status === 'approved' ? 'success' : 'danger'}>
                  {req.status === 'pending' ? 'قيد الانتظار' : req.status === 'approved' ? 'مقبول' : 'مرفوض'}
                </Badge>
              </div>

              <div className="mb-6 space-y-2 rounded-lg bg-base-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-base-500">اسم العميل:</span>
                  <span className="font-medium text-base-900">{req.payload.name}</span>
                </div>
                {req.payload.phone && (
                  <div className="flex justify-between">
                    <span className="text-base-500">الهاتف:</span>
                    <span className="font-medium text-base-900" dir="ltr">{req.payload.phone}</span>
                  </div>
                )}
                {req.payload.notes && (
                  <div className="mt-2 border-t border-base-200 pt-2">
                    <p className="mb-1 text-xs text-base-500">ملاحظات:</p>
                    <p className="text-base-700">{req.payload.notes}</p>
                  </div>
                )}
              </div>

              {isApprover && req.status === 'pending' && (
                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={processingId === req.id}
                    onClick={() => decideMutation.mutate({ id: req.id, status: "approved" })}
                  >
                    {processingId === req.id ? "جاري المعالجة..." : "قبول"}
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    disabled={processingId === req.id}
                    onClick={() => decideMutation.mutate({ id: req.id, status: "rejected" })}
                  >
                    رفض
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
