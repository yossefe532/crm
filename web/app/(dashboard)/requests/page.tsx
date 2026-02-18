"use client"

import { useAuth } from "../../../lib/auth/AuthContext"
import { useUserRequests } from "../../../lib/hooks/useUserRequests"
import { useUsers } from "../../../lib/hooks/useUsers"
import { coreService } from "../../../lib/services/coreService"
import { Card } from "../../../components/ui/Card"
import { Button } from "../../../components/ui/Button"
import { Badge } from "../../../components/ui/Badge"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { ar } from "date-fns/locale"

export default function RequestsPage() {
  const { role, userId } = useAuth()
  const { data: requests, isLoading } = useUserRequests()
  const { data: users } = useUsers()
  const queryClient = useQueryClient()

  const decideMutation = useMutation({
    mutationFn: (payload: { requestId: string; status: "approved" | "rejected" }) =>
      coreService.decideUserRequest(payload.requestId, payload.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_requests"] })
    }
  })

  if (isLoading) {
    return <div className="p-8 text-center">جاري التحميل...</div>
  }

  const pendingRequests = requests?.filter((r) => r.status === "pending") || []
  const historyRequests = requests?.filter((r) => r.status !== "pending") || []
  const userMap = new Map((users || []).map((u) => [u.id, u.name || u.email]))

  const renderPayload = (type: string, payload: any) => {
    if (type === "create_sales") {
      return (
        <div className="text-sm">
          <div className="font-semibold">موظف مبيعات جديد</div>
          <div>الاسم: {payload.name}</div>
          <div>البريد: {payload.email}</div>
          {payload.phone && <div>الهاتف: {payload.phone}</div>}
          {payload.teamId && <div>الفريق: {payload.teamId}</div>}
        </div>
      )
    }
    if (type === "create_lead") {
      return (
        <div className="text-sm">
          <div className="font-semibold">عميل جديد</div>
          <div>الاسم: {payload.name}</div>
          <div>الهاتف: {payload.phone}</div>
          {payload.email && <div>البريد: {payload.email}</div>}
          {payload.budget && <div>الميزانية: {payload.budget}</div>}
        </div>
      )
    }
    return <pre className="text-xs">{JSON.stringify(payload, null, 2)}</pre>
  }

  const canApprove = (request: any) => {
    if (role === "owner") return true
    if (role === "team_leader" && request.requestType === "create_lead") return true
    return false
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">مركز الطلبات</h1>

      {/* Pending Requests */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">الطلبات المعلقة</h2>
        {pendingRequests.length === 0 ? (
          <p className="text-gray-500">لا يوجد طلبات معلقة</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[700px] text-right">
                <thead>
                  <tr className="border-b border-base-200 text-sm text-base-500">
                    <th className="pb-3 pr-4">نوع الطلب</th>
                    <th className="pb-3 px-4">مقدم الطلب</th>
                    <th className="pb-3 px-4">التفاصيل</th>
                    <th className="pb-3 px-4">التاريخ</th>
                    <th className="pb-3 pl-4">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((req) => (
                    <tr key={req.id} className="border-b border-base-100 last:border-0 hover:bg-base-50">
                      <td className="py-3 pr-4">
                        <Badge variant={req.requestType === "create_sales" ? "info" : "warning"}>
                          {req.requestType === "create_sales" ? "إضافة مستخدم" : "إضافة عميل"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm font-medium">
                        {userMap.get(req.requestedBy) || req.requestedBy}
                      </td>
                      <td className="py-3 px-4">{renderPayload(req.requestType, req.payload)}</td>
                      <td className="py-3 px-4 text-sm text-base-500">
                        {format(new Date(req.createdAt), "dd MMM yyyy", { locale: ar })}
                      </td>
                      <td className="py-3 pl-4">
                        {canApprove(req) && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => decideMutation.mutate({ requestId: req.id, status: "approved" })}
                              disabled={decideMutation.isPending}
                            >
                              موافق
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => decideMutation.mutate({ requestId: req.id, status: "rejected" })}
                              disabled={decideMutation.isPending}
                            >
                              رفض
                            </Button>
                          </div>
                        )}
                        {!canApprove(req) && <span className="text-sm text-gray-400">بانتظار الموافقة</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="md:hidden space-y-4">
              {pendingRequests.map((req) => (
                <div key={req.id} className="border border-base-200 rounded-lg p-4 space-y-3 bg-base-50">
                  <div className="flex justify-between items-start">
                    <Badge variant={req.requestType === "create_sales" ? "info" : "warning"}>
                      {req.requestType === "create_sales" ? "إضافة مستخدم" : "إضافة عميل"}
                    </Badge>
                    <span className="text-xs text-base-500">
                      {format(new Date(req.createdAt), "dd MMM yyyy", { locale: ar })}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-base-900">
                      مقدم الطلب: {userMap.get(req.requestedBy) || req.requestedBy}
                    </p>
                    <div className="bg-base-0 p-3 rounded-md border border-base-100">
                      {renderPayload(req.requestType, req.payload)}
                    </div>
                  </div>

                  {canApprove(req) ? (
                    <div className="flex gap-2 pt-2 border-t border-base-200">
                      <Button
                        className="flex-1"
                        size="sm"
                        variant="primary"
                        onClick={() => decideMutation.mutate({ requestId: req.id, status: "approved" })}
                        disabled={decideMutation.isPending}
                      >
                        موافق
                      </Button>
                      <Button
                        className="flex-1"
                        size="sm"
                        variant="danger"
                        onClick={() => decideMutation.mutate({ requestId: req.id, status: "rejected" })}
                        disabled={decideMutation.isPending}
                      >
                        رفض
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm text-center text-gray-400 pt-2 border-t border-base-200">
                      بانتظار الموافقة
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Request History */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">سجل الطلبات</h2>
        {historyRequests.length === 0 ? (
          <p className="text-gray-500">لا يوجد سجل طلبات</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[700px] text-right">
                <thead>
                  <tr className="border-b border-base-200 text-sm text-base-500">
                    <th className="pb-3 pr-4">نوع الطلب</th>
                    <th className="pb-3 px-4">مقدم الطلب</th>
                    <th className="pb-3 px-4">التفاصيل</th>
                    <th className="pb-3 px-4">الحالة</th>
                    <th className="pb-3 px-4">تم بواسطة</th>
                    <th className="pb-3 pl-4">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRequests.map((req) => (
                    <tr key={req.id} className="border-b border-base-100 last:border-0 hover:bg-base-50">
                      <td className="py-3 pr-4">
                        <Badge variant="outline">
                          {req.requestType === "create_sales" ? "إضافة مستخدم" : "إضافة عميل"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {req.requester?.name || (req.requestedBy ? (userMap.get(req.requestedBy) || req.requestedBy) : "-")}
                      </td>
                      <td className="py-3 px-4">{renderPayload(req.requestType, req.payload)}</td>
                      <td className="py-3 px-4">
                        <Badge variant={req.status === "approved" ? "success" : "danger"}>
                          {req.status === "approved" ? "تمت الموافقة" : "مرفوض"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {req.decidedBy ? (userMap.get(req.decidedBy) || req.decidedBy) : "-"}
                      </td>
                      <td className="py-3 pl-4 text-sm text-base-500">
                        {format(new Date(req.createdAt), "dd MMM yyyy", { locale: ar })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-4">
              {historyRequests.map((req) => (
                <div key={req.id} className="border border-base-200 rounded-lg p-4 space-y-3 bg-base-50">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline">
                      {req.requestType === "create_sales" ? "إضافة مستخدم" : "إضافة عميل"}
                    </Badge>
                    <Badge variant={req.status === "approved" ? "success" : "danger"}>
                      {req.status === "approved" ? "تمت الموافقة" : "مرفوض"}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-base-700">
                      <span className="font-semibold">مقدم الطلب:</span>{" "}
                      {req.requester?.name || (req.requestedBy ? (userMap.get(req.requestedBy) || req.requestedBy) : "-")}
                    </p>
                    <div className="bg-base-0 p-3 rounded-md border border-base-100">
                      {renderPayload(req.requestType, req.payload)}
                    </div>
                    <div className="flex justify-between text-xs text-base-500 pt-2 border-t border-base-200">
                      <span>بواسطة: {req.decidedBy ? (userMap.get(req.decidedBy) || req.decidedBy) : "-"}</span>
                      <span>{format(new Date(req.createdAt), "dd MMM yyyy", { locale: ar })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
