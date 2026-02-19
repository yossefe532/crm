"use client"

import { Card } from "../ui/Card"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Avatar } from "../ui/Avatar"
import { useLead } from "../../lib/hooks/useLead"
import { useUsers } from "../../lib/hooks/useUsers"
import { useState } from "react"
import { CallLogDialog } from "./CallLogDialog"
import { MeetingDialog } from "./MeetingDialog"
import { LeadProgress } from "./LeadProgress"
import { leadService } from "../../lib/services/leadService"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "../../lib/auth/AuthContext"
import { CallLog, Meeting } from "../../lib/types"

export const LeadDetail = ({ leadId, showProgress = true }: { leadId: string; showProgress?: boolean }) => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false)
  const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false)
  const [meetingTitle, setMeetingTitle] = useState("اجتماع جديد")
  const [activeTab, setActiveTab] = useState<"details" | "activity" | "notes">("details")

  const { data: lead, isLoading } = useLead(leadId)
  const { data: users } = useUsers()
  
  const { role } = useAuth() // Get role from auth context

  const STAGES = ["new", "call", "meeting", "site_visit", "closing"]
  const STAGE_LABELS = ["جديد", "مكالمة هاتفية", "اجتماع", "رؤية الموقع", "إغلاق الصفقة"]
  
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      return leadService.update(leadId, { status: newStatus }, token || undefined)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    }
  })

  const deleteLeadMutation = useMutation({
    mutationFn: async () => {
      return leadService.delete(leadId, token || undefined)
    },
    onSuccess: () => {
      window.location.href = "/leads"
    }
  })

  const usersById = new Map((users || []).map((user) => [user.id, user]))
  const stageLabelMap: Record<string, string> = {
    new: "جديد",
    call: "مكالمة هاتفية",
    meeting: "اجتماع",
    site_visit: "رؤية الموقع",
    closing: "إغلاق الصفقة"
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto mb-4"></div>
          <p className="text-base-500">جاري تحميل بيانات العميل...</p>
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-rose-500 font-medium mb-2">تعذر العثور على بيانات العميل</p>
          <p className="text-base-500 text-sm">قد يكون تم حذفه أو ليس لديك صلاحية للوصول إليه</p>
        </div>
      </Card>
    )
  }

  const phoneDigits = (lead.phone || "").replace(/\D/g, "");
  const whatsappLink = phoneDigits ? `https://wa.me/${phoneDigits}` : "";
  const callLink = lead.phone ? `tel:${lead.phone}` : "";

  // Combine logs and meetings for timeline
  const activities = [
    ...(lead.callLogs || []).map(log => ({ ...log, type: 'call' as const, date: new Date(log.callTime) })),
    ...(lead.meetings || []).map(meeting => ({ ...meeting, type: 'meeting' as const, date: new Date(meeting.startsAt) }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-base-200 p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <Avatar 
              name={lead.name} 
              size="lg" 
              className="h-16 w-16 text-xl bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-base-900 dark:text-white">{lead.name}</h1>
                <Badge variant={lead.priority === "high" ? "danger" : lead.priority === "low" ? "success" : "warning"}>
                  {lead.priority === "high" ? "🔥 هام جداً" : lead.priority === "low" ? "منخفض" : "عادي"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-base-500">
                <span className="flex items-center gap-1">
                  <span className="opacity-70">كود:</span>
                  <span className="font-mono font-medium text-base-700 dark:text-base-300">{lead.leadCode}</span>
                </span>
                <span className="hidden sm:inline text-base-300">|</span>
                <span>{lead.profession || "المهنة غير محددة"}</span>
                <span className="hidden sm:inline text-base-300">|</span>
                <span className={lead.phone ? "text-base-700 dark:text-base-300" : "text-base-400"}>
                  {lead.phone || "لا يوجد هاتف"}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {lead.phone && (
              <>
                <Button
                  className="flex-1 md:flex-none bg-emerald-500 hover:bg-emerald-600 text-white border-transparent gap-2"
                  onClick={() => window.open(whatsappLink, "_blank")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                  واتساب
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 md:flex-none gap-2"
                  onClick={() => {
                    if (callLink) window.location.href = callLink
                    setIsCallDialogOpen(true)
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  اتصال
                </Button>
              </>
            )}
            <Button
                  className="flex-1 md:flex-none bg-brand-600 hover:bg-brand-700 text-white border-transparent gap-2"
                  onClick={() => {
                    setMeetingTitle("اجتماع جديد")
                    setIsMeetingDialogOpen(true)
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                  جدولة
                </Button>
                {role === "owner" && (
                  <Button
                    variant="outline"
                    className="flex-1 md:flex-none border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 gap-2"
                    onClick={() => {
                      if (confirm("هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.")) {
                        deleteLeadMutation.mutate()
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    حذف
                  </Button>
                )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-base-200 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab("details")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === "details"
                  ? "bg-white dark:bg-[#111111] text-brand-600 border-b-2 border-brand-600"
                  : "text-base-500 hover:text-base-700 hover:bg-base-50 dark:hover:bg-base-900"
              }`}
            >
              بيانات العميل
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === "activity"
                  ? "bg-white dark:bg-[#111111] text-brand-600 border-b-2 border-brand-600"
                  : "text-base-500 hover:text-base-700 hover:bg-base-50 dark:hover:bg-base-900"
              }`}
            >
              سجل النشاط
              <span className="mr-2 inline-flex items-center justify-center rounded-full bg-base-100 px-2 py-0.5 text-xs text-base-600">
                {activities.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === "notes"
                  ? "bg-white dark:bg-[#111111] text-brand-600 border-b-2 border-brand-600"
                  : "text-base-500 hover:text-base-700 hover:bg-base-50 dark:hover:bg-base-900"
              }`}
            >
              الملاحظات
            </button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[400px]">
            {activeTab === "details" && (
              <div className="grid gap-6">
                <Card title="معلومات التواصل">
                  <dl className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-base-500 mb-1">البريد الإلكتروني</dt>
                      <dd className="text-sm font-medium text-base-900 dark:text-white break-all">{lead.email || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-base-500 mb-1">العنوان</dt>
                      <dd className="text-sm font-medium text-base-900 dark:text-white">{lead.desiredLocation || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-base-500 mb-1">الوظيفة / الجهة</dt>
                      <dd className="text-sm font-medium text-base-900 dark:text-white">{lead.profession || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-base-500 mb-1">مصدر العميل</dt>
                      <dd className="text-sm font-medium text-base-900 dark:text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                        {lead.sourceLabel || "غير محدد"}
                      </dd>
                    </div>
                  </dl>
                </Card>

                <Card title="تفضيلات العميل">
                  <dl className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-base-500 mb-1">الميزانية المتوقعة</dt>
                      <dd className="text-sm font-medium text-base-900 dark:text-white">
                        {lead.budgetMin ? lead.budgetMin.toLocaleString("ar-EG") : "0"} - {lead.budgetMax ? lead.budgetMax.toLocaleString("ar-EG") : "∞"} ج.م
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-base-500 mb-1">نوع العقار المطلوب</dt>
                      <dd className="text-sm font-medium text-base-900 dark:text-white">{lead.propertyType || "أي نوع"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-base-500 mb-1">المنطقة المفضلة</dt>
                      <dd className="text-sm font-medium text-base-900 dark:text-white">{lead.desiredLocation || "غير محدد"}</dd>
                    </div>
                  </dl>
                </Card>
              </div>
            )}

            {activeTab === "activity" && (
              <Card title="سجل المتابعات">
                {activities.length > 0 ? (
                  <div className="relative border-r border-base-200 dark:border-base-800 mr-3 space-y-8 py-2">
                    {activities.map((activity) => (
                      <div key={activity.id} className="relative pr-6">
                        <div className={`absolute -right-1.5 top-1 h-3 w-3 rounded-full border border-base-0 ${
                          activity.type === 'call' ? 'bg-blue-500' : 'bg-purple-500'
                        }`}></div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-medium text-base-900 dark:text-white">
                            {activity.type === 'call' ? '📞 مكالمة هاتفية' : '📅 اجتماع / موعد'}
                          </p>
                          <span className="text-xs text-base-500">
                            {activity.date.toLocaleString("ar-EG", { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div className="text-sm text-base-600 dark:text-base-400 bg-base-50 dark:bg-base-900/50 p-3 rounded-lg">
                          {activity.type === 'call' ? (
                            <>
                              <p>النتيجة: <span className="font-medium">{activity.outcome || "لم تسجل نتيجة"}</span></p>
                              {activity.durationSeconds && <p className="text-xs mt-1">المدة: {Math.round(activity.durationSeconds / 60)} دقيقة</p>}
                            </>
                          ) : (
                            <>
                              <p className="font-medium">{(activity as Meeting).title}</p>
                              <p className="mt-1">الحالة: {(activity as Meeting).status}</p>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-base-400">
                    <p>لا يوجد نشاط مسجل حتى الآن</p>
                    <Button 
                      variant="ghost" 
                      className="mt-2 text-brand-600 hover:text-brand-700"
                      onClick={() => setIsCallDialogOpen(true)}
                    >
                      + تسجيل مكالمة
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {activeTab === "notes" && (
              <Card title="الملاحظات">
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-lg p-4">
                  <p className="text-sm text-base-900 dark:text-base-100 whitespace-pre-wrap leading-relaxed">
                    {lead.notes || "لا توجد ملاحظات مسجلة لهذا العميل."}
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          {showProgress && (
            <Card>
              <h3 className="mb-4 text-sm font-bold text-base-900 dark:text-white">مرحلة العميل</h3>
              <LeadProgress 
                stages={STAGE_LABELS}
                activeIndex={STAGES.indexOf(lead.status)}
                onStageChange={(index) => {
                  const newStatus = STAGES[index]
                  if (newStatus !== lead.status) {
                    updateStatusMutation.mutate(newStatus)
                  }
                }}
              />
            </Card>
          )}

          <Card>
            <h3 className="mb-4 text-sm font-bold text-base-900 dark:text-white">المسؤول عن المتابعة</h3>
            <div className="flex items-center gap-3">
              <Avatar 
                name={usersById.get(lead.assignedUserId || "")?.name || usersById.get(lead.assignedUserId || "")?.email} 
                size="md" 
              />
              <div>
                <p className="text-sm font-medium text-base-900 dark:text-white">
                  {usersById.get(lead.assignedUserId || "")?.name || usersById.get(lead.assignedUserId || "")?.email || "غير مُسند"}
                </p>
                <p className="text-xs text-base-500">
                  {usersById.get(lead.assignedUserId || "")?.email}
                </p>
              </div>
            </div>
            {lead.teamId && (
              <div className="mt-4 pt-4 border-t border-base-100 dark:border-base-800">
                <p className="text-xs text-base-500 mb-1">الفريق</p>
                <Badge variant="outline">فريق المبيعات</Badge>
              </div>
            )}
          </Card>

          <Card>
            <h3 className="mb-4 text-sm font-bold text-base-900 dark:text-white">بيانات النظام</h3>
            <dl className="space-y-3">
              <div className="flex justify-between text-sm">
                <dt className="text-base-500">تاريخ الإضافة</dt>
                <dd className="font-medium text-base-900 dark:text-white">
                  {new Date(lead.createdAt).toLocaleDateString("ar-EG")}
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-base-500">آخر تحديث</dt>
                <dd className="font-medium text-base-900 dark:text-white">
                  {new Date(lead.updatedAt).toLocaleDateString("ar-EG")}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <CallLogDialog
        isOpen={isCallDialogOpen}
        onClose={() => setIsCallDialogOpen(false)}
        leadId={leadId}
        phone={lead.phone || ""}
        currentStage={lead.status}
        onUpdateStage={(newStatus) => updateStatusMutation.mutate(newStatus)}
      />

      <MeetingDialog
        isOpen={isMeetingDialogOpen}
        onClose={() => setIsMeetingDialogOpen(false)}
        leadId={leadId}
        initialTitle={meetingTitle}
      />
    </div>
  )
}
