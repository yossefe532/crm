"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { coreService } from "../../../lib/services/coreService"
import { useAuth } from "../../../lib/auth/AuthContext"
import { Card } from "../../../components/ui/Card"
import { Button } from "../../../components/ui/Button"
import { Badge } from "../../../components/ui/Badge"
import { Avatar } from "../../../components/ui/Avatar"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { CheckCircle, XCircle, Clock, UserPlus, FileText, ArrowLeft, ArrowRight, UserCheck, MessageSquare } from "lucide-react"
import { toast } from "react-hot-toast"

export default function RequestsPage() {
  const { token, role, userId } = useAuth()
  const queryClient = useQueryClient()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"registrations" | "incoming" | "outgoing">("registrations")
  const [createdUserCredentials, setCreatedUserCredentials] = useState<{ email: string; password?: string; phone?: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["user-requests"],
    queryFn: () => coreService.listUserRequests(token || undefined),
    enabled: !!token
  })

  // Handle new API structure
  const requests = useMemo(() => {
      if (!data) return []
      if (Array.isArray(data)) return data // Fallback if API returns array
      return data.requests || []
  }, [data])

  const pendingRegistrations = useMemo(() => {
      if (!data || Array.isArray(data)) return []
      return data.pendingRegistrations || []
  }, [data])

  const decideMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      setProcessingId(id)
      try {
        const response = await coreService.decideUserRequest(id, status, token || undefined)
        return response
      } finally {
        setProcessingId(null)
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user-requests"] })
      toast.success("تم تحديث حالة الطلب بنجاح")
      
      const result = data as any
      if (result?.createdUser?.temporaryPassword) {
        setCreatedUserCredentials({
          email: result.createdUser.email,
          password: result.createdUser.temporaryPassword
        })
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "حدث خطأ أثناء معالجة الطلب")
    }
  })

  const approveRegistrationMutation = useMutation({
    mutationFn: async (userId: string) => {
        setProcessingId(userId)
        try {
            return await coreService.approveRegistration(userId, token || undefined)
        } finally {
            setProcessingId(null)
        }
    },
    onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["user-requests"] })
        toast.success("تم قبول المستخدم بنجاح")
        
        // Open WhatsApp
        if (data.phone) {
            const message = `مرحباً بك في فريق العمل! 
تم قبول طلب انضمامك بنجاح.
البريد الإلكتروني: ${data.email}
يمكنك الآن تسجيل الدخول.`
            const url = `https://wa.me/${data.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
            window.open(url, '_blank')
        } else {
            toast("لم يتم العثور على رقم هاتف للمستخدم", { icon: "⚠️" })
        }
    },
    onError: (err: any) => {
        toast.error(err?.message || "فشل قبول المستخدم")
    }
  })

  // Filter requests logic
  const { incomingRequests, outgoingRequests } = useMemo(() => {
    const all = requests || []
    const incoming: typeof all = []
    const outgoing: typeof all = []

    all.forEach(req => {
      // Outgoing: Requests I created
      if (req.requester?.id === userId) {
        outgoing.push(req)
      }
      
      // Incoming: Requests I can approve
      let isActionable = false
      if (role === "owner") {
        isActionable = req.status === "pending"
      } else if (role === "team_leader") {
        isActionable = req.status === "pending" && req.requestType === "create_lead"
      }

      if (isActionable) {
        incoming.push(req)
      }
    })

    return { incomingRequests: incoming, outgoingRequests: outgoing }
  }, [requests, userId, role])

  const displayedList = useMemo(() => {
      if (activeTab === "registrations") return pendingRegistrations
      if (activeTab === "incoming") return incomingRequests
      return outgoingRequests
  }, [activeTab, pendingRegistrations, incomingRequests, outgoingRequests])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="warning" className="flex items-center gap-1"><Clock className="w-3 h-3" /> قيد الانتظار</Badge>
      case "approved": return <Badge variant="success" className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> مقبول</Badge>
      case "rejected": return <Badge variant="danger" className="flex items-center gap-1"><XCircle className="w-3 h-3" /> مرفوض</Badge>
      case "failed": return <Badge variant="danger" className="flex items-center gap-1"><XCircle className="w-3 h-3" /> فشل</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case "create_sales": return <span className="flex items-center gap-1"><UserPlus className="w-3 h-3" /> إضافة مندوب</span>
      case "create_lead": return <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> إضافة عميل</span>
      default: return type
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base-900 dark:text-white">إدارة الطلبات</h1>
          <p className="text-sm text-base-500">متابعة واعتماد الطلبات المعلقة</p>
        </div>
        
        <div className="flex rounded-lg bg-base-100 p-1">
          {role === "owner" && (
            <button
                onClick={() => setActiveTab("registrations")}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === "registrations" 
                    ? "bg-white text-primary-600 shadow-sm dark:bg-base-800 dark:text-primary-400" 
                    : "text-base-500 hover:text-base-700 dark:hover:text-base-300"
                }`}
            >
                طلبات الانضمام
                {pendingRegistrations.length > 0 && <Badge variant="danger" className="ml-1 text-xs">{pendingRegistrations.length}</Badge>}
            </button>
          )}
          <button
            onClick={() => setActiveTab("incoming")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
              activeTab === "incoming" 
                ? "bg-white text-primary-600 shadow-sm dark:bg-base-800 dark:text-primary-400" 
                : "text-base-500 hover:text-base-700 dark:hover:text-base-300"
            }`}
          >
            الطلبات الواردة
            {incomingRequests.length > 0 && <Badge variant="outline" className="ml-1 text-xs">{incomingRequests.length}</Badge>}
          </button>
          <button
            onClick={() => setActiveTab("outgoing")}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
              activeTab === "outgoing" 
                ? "bg-white text-primary-600 shadow-sm dark:bg-base-800 dark:text-primary-400" 
                : "text-base-500 hover:text-base-700 dark:hover:text-base-300"
            }`}
          >
            طلباتي
            <Badge variant="outline" className="ml-1 text-xs">{outgoingRequests.length}</Badge>
          </button>
        </div>
      </div>

      {/* Success Modal */}
      {createdUserCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-base-900 border border-emerald-100">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mx-auto">
              <CheckCircle className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-center text-lg font-bold text-base-900 dark:text-white">تم قبول الطلب بنجاح</h3>
            <p className="mb-6 text-center text-sm text-base-500">تم إنشاء حساب المستخدم الجديد. يرجى حفظ البيانات التالية:</p>
            
            <div className="space-y-4 rounded-lg bg-base-50 p-4 border border-base-200">
              <div className="flex justify-between items-center border-b border-base-200 pb-2">
                <span className="text-sm text-base-500">البريد الإلكتروني:</span>
                <span className="font-mono font-medium text-base-900 select-all">{createdUserCredentials.email}</span>
              </div>
              {createdUserCredentials.password && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-base-500">كلمة المرور:</span>
                    <span className="font-mono font-bold text-emerald-600 select-all bg-white px-2 py-1 rounded border border-base-200">
                    {createdUserCredentials.password}
                    </span>
                  </div>
              )}
            </div>

            <Button onClick={() => setCreatedUserCredentials(null)} className="mt-6 w-full" variant="primary">
              إغلاق
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-base-100" />
          ))}
        </div>
      ) : displayedList.length === 0 ? (
        <Card className="border-dashed border-base-300 bg-base-50/50">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-base-100 p-4">
              {activeTab === "registrations" ? (
                <UserPlus className="h-8 w-8 text-base-400" />
              ) : activeTab === "incoming" ? (
                <CheckCircle className="h-8 w-8 text-base-400" />
              ) : (
                <FileText className="h-8 w-8 text-base-400" />
              )}
            </div>
            <h3 className="text-lg font-medium text-base-900">
              {activeTab === "registrations" ? "لا توجد طلبات انضمام جديدة" : activeTab === "incoming" ? "لا توجد طلبات معلقة" : "لم تقم بإنشاء أي طلبات"}
            </h3>
            <p className="mt-1 text-sm text-base-500">
              {activeTab === "registrations" ? "عندما يقوم شخص بالتسجيل، سيظهر طلبه هنا" : activeTab === "incoming" ? "جميع الطلبات الواردة تمت معالجتها" : "ستظهر طلباتك هنا عند إنشائها"}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeTab === "registrations" ? (
                // Registration Cards
                (displayedList as any[]).map((user) => (
                    <Card key={user.id} className="group relative overflow-hidden transition-all hover:shadow-md border-base-200 hover:border-primary-200">
                        <div className="p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <Avatar src={user.profile?.avatar} fallback={(user.profile?.firstName?.[0] || user.email[0]).toUpperCase()} className="h-10 w-10 bg-primary-50 text-primary-600" />
                                    <div>
                                        <h3 className="font-semibold text-base-900">{user.profile?.firstName || user.email.split('@')[0]}</h3>
                                        <p className="text-xs text-base-500">{user.email}</p>
                                    </div>
                                </div>
                                <Badge variant="warning">قيد المراجعة</Badge>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex items-center gap-2 text-sm text-base-600">
                                    <Clock className="w-4 h-4 text-base-400" />
                                    <span>منذ {format(new Date(user.createdAt), "dd MMMM", { locale: ar })}</span>
                                </div>
                                {user.phone && (
                                    <div className="flex items-center gap-2 text-sm text-base-600">
                                        <span className="w-4 h-4 flex items-center justify-center text-xs font-bold text-base-400">#</span>
                                        <span dir="ltr">{user.phone}</span>
                                    </div>
                                )}
                                {user.requestedTeamName && (
                                    <div className="flex items-center gap-2 text-sm text-base-600">
                                        <span className="text-xs font-bold text-base-400">Team:</span>
                                        <span>{user.requestedTeamName}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-sm text-base-600">
                                    <span className="text-xs font-bold text-base-400">Role:</span>
                                    <span>{(user.roleLinks?.[0]?.role?.name === "team_leader" ? "قائد فريق" : "مندوب مبيعات") || "غير محدد"}</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button 
                                    className="flex-1 gap-2" 
                                    variant="primary" 
                                    size="sm"
                                    disabled={processingId === user.id}
                                    onClick={() => approveRegistrationMutation.mutate(user.id)}
                                >
                                    {processingId === user.id ? "جاري المعالجة..." : (
                                        <>
                                            <UserCheck className="w-4 h-4" />
                                            قبول وإعلام
                                        </>
                                    )}
                                </Button>
                                {user.phone && (
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className="text-[#25D366] hover:bg-[#25D366]/10 hover:border-[#25D366]"
                                        onClick={() => window.open(`https://wa.me/${user.phone.replace(/\D/g, '')}`, '_blank')}
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>
                ))
            ) : (
                // Existing Requests Cards
                (displayedList as any[]).map((req) => (
                    <Card key={req.id} className="group relative overflow-hidden transition-all hover:shadow-md border-base-200 hover:border-primary-200">
                    <div className="p-5">
                        <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <Avatar src={req.requester?.profile?.avatar} fallback={req.requester?.email?.[0]?.toUpperCase()} className="h-10 w-10 bg-base-100 text-base-600" />
                            <div>
                            <h3 className="font-semibold text-base-900">{req.requester?.profile?.firstName || "مستخدم"}</h3>
                            <p className="text-xs text-base-500">{getRequestTypeLabel(req.requestType)}</p>
                            </div>
                        </div>
                        {getStatusBadge(req.status)}
                        </div>

                        <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-2 text-sm text-base-600">
                            <Clock className="w-4 h-4 text-base-400" />
                            <span>{format(new Date(req.createdAt), "dd MMMM yyyy", { locale: ar })}</span>
                        </div>
                        {req.payload && (
                            <div className="rounded-lg bg-base-50 p-3 text-xs text-base-600">
                            {Object.entries(req.payload).map(([key, val]) => (
                                key !== "password" && (
                                <div key={key} className="flex justify-between py-1 border-b border-base-200 last:border-0">
                                    <span className="text-base-400">{key}:</span>
                                    <span className="font-medium">{String(val)}</span>
                                </div>
                                )
                            ))}
                            </div>
                        )}
                        </div>

                        <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        {activeTab === "incoming" && req.status === "pending" && (
                            <>
                            <Button 
                                className="flex-1" 
                                variant="primary" 
                                size="sm"
                                disabled={processingId === req.id}
                                onClick={() => decideMutation.mutate({ id: req.id, status: "approved" })}
                            >
                                {processingId === req.id ? "جاري..." : "قبول"}
                            </Button>
                            <Button 
                                className="flex-1" 
                                variant="danger" 
                                size="sm"
                                disabled={processingId === req.id}
                                onClick={() => decideMutation.mutate({ id: req.id, status: "rejected" })}
                            >
                                رفض
                            </Button>
                            </>
                        )}
                        </div>
                    </div>
                    </Card>
                ))
            )}
        </div>
      )}
    </div>
  )
}