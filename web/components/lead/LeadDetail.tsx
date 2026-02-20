"use client"

import { Card } from "../ui/Card"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Avatar } from "../ui/Avatar"
import { useLead } from "../../lib/hooks/useLead"
import { useUsers } from "../../lib/hooks/useUsers"
import { useTeams } from "../../lib/hooks/useTeams"
import { useState } from "react"
import { CallLogDialog } from "./CallLogDialog"
import { MeetingDialog } from "./MeetingDialog"
import { LeadProgress } from "./LeadProgress"
import { leadService } from "../../lib/services/leadService"
import { Meeting } from "../../lib/types"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "../../lib/auth/AuthContext"
import { ConfirmationModal } from "../ui/ConfirmationModal"
import { useRouter } from "next/navigation"
import { ClosureModal } from "./ClosureModal"
import { FailureModal } from "./FailureModal"

export const LeadDetail = ({ leadId, showProgress = true }: { leadId: string; showProgress?: boolean }) => {
  const { token, role } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false)
  const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false)
  const [isFailureModalOpen, setIsFailureModalOpen] = useState(false)
  const [meetingTitle, setMeetingTitle] = useState("اجتماع جديد")
  const [activeTab, setActiveTab] = useState<"details" | "activity" | "notes">("details")

  const { data: lead, isLoading } = useLead(leadId)
  const { data: users } = useUsers()
  const { data: teams } = useTeams()
  
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
      router.push("/leads")
    }
  })

  const usersById = new Map((users || []).map((user) => [user.id, user]))
  const teamsById = new Map((teams || []).map((team) => [team.id, team]))

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

  const assignedUser = usersById.get(lead.assignedUserId || "")
  const assignedTeam = lead.teamId ? teamsById.get(lead.teamId) : null

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Card */}
      <div className="bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-base-200 p-6 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-brand-300"></div>
        
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="relative">
                <Avatar 
                name={lead.name} 
                size="lg" 
                className="h-20 w-20 text-2xl bg-brand-50 text-brand-600 border-2 border-white shadow-md"
                />
                <span className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-white ${
                    lead.priority === 'high' ? 'bg-red-500' : 
                    lead.priority === 'low' ? 'bg-green-500' : 'bg-yellow-500'
                }`} title={`أولوية: ${lead.priority === 'high' ? 'عالية' : lead.priority === 'low' ? 'منخفضة' : 'عادية'}`}></span>
            </div>
            
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-base-900 dark:text-white tracking-tight">{lead.name}</h1>
                <Badge variant={lead.priority === "high" ? "danger" : lead.priority === "low" ? "success" : "warning"} className="px-2 py-1">
                  {lead.priority === "high" ? "🔥 هام جداً" : lead.priority === "low" ? "منخفض" : "عادي"}
                </Badge>
                {lead.leadCode && (
                  <Badge variant="outline" className="font-mono text-xs">#{lead.leadCode}</Badge>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-base-500">
                <span className="flex items-center gap-1.5 bg-base-50 dark:bg-base-900 px-2 py-1 rounded-md">
                   <span className="opacity-70">💼</span>
                   <span>{lead.profession || "المهنة غير محددة"}</span>
                </span>
                <span className="flex items-center gap-1.5 bg-base-50 dark:bg-base-900 px-2 py-1 rounded-md">
                   <span className="opacity-70">📞</span>
                   <span className={lead.phone ? "text-base-900 dark:text-white font-medium" : "text-base-400"}>
                    {lead.phone || "لا يوجد هاتف"}
                   </span>
                </span>
                {lead.email && (
                    <span className="flex items-center gap-1.5 bg-base-50 dark:bg-base-900 px-2 py-1 rounded-md">
                        <span className="opacity-70">📧</span>
                        <span className="text-base-900 dark:text-white">{lead.email}</span>
                    </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto mt-2 md:mt-0">
            {lead.phone && (
              <>
                <Button
                  className="flex-1 md:flex-none bg-[#25D366] hover:bg-[#128C7E] text-white border-transparent gap-2 shadow-sm"
                  onClick={() => window.open(whatsappLink, "_blank")}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
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
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  اتصال
                </Button>
              </>
            )}
            <Button
                  className="flex-1 md:flex-none bg-brand-600 hover:bg-brand-700 text-white border-transparent gap-2 shadow-sm"
                  onClick={() => {
                    setMeetingTitle("اجتماع جديد")
                    setIsMeetingDialogOpen(true)
                  }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  جدولة
                </Button>
                {role === "owner" && (
                  <Button
                    variant="outline"
                    className="flex-1 md:flex-none border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 gap-2"
                    onClick={() => setIsDeleteModalOpen(true)}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    حذف
                  </Button>
                )}
          </div>
        </div>
      </div>
      
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => deleteLeadMutation.mutate()}
        title="تأكيد حذف العميل"
        description="هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف العميل"
        variant="danger"
      />

      <ClosureModal
        isOpen={isClosureModalOpen}
        onClose={() => setIsClosureModalOpen(false)}
        lead={lead}
      />

      <FailureModal
        isOpen={isFailureModalOpen}
        onClose={() => setIsFailureModalOpen(false)}
        lead={lead}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Tabs */}
          <div className="bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-base-200 p-1 flex gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab("details")}
              className={`flex-1 min-w-[120px] px-4 py-2.5 text-sm font-medium rounded-lg transition-all text-center ${
                activeTab === "details"
                  ? "bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:ring-brand-800"
                  : "text-base-500 hover:text-base-700 hover:bg-base-50 dark:hover:bg-base-900"
              }`}
            >
              📋 بيانات العميل
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={`flex-1 min-w-[120px] px-4 py-2.5 text-sm font-medium rounded-lg transition-all text-center ${
                activeTab === "activity"
                  ? "bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:ring-brand-800"
                  : "text-base-500 hover:text-base-700 hover:bg-base-50 dark:hover:bg-base-900"
              }`}
            >
              📅 سجل النشاط
              {activities.length > 0 && (
                <span className="mr-2 inline-flex items-center justify-center rounded-full bg-brand-200 px-1.5 py-0.5 text-[10px] text-brand-800">
                  {activities.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className={`flex-1 min-w-[120px] px-4 py-2.5 text-sm font-medium rounded-lg transition-all text-center ${
                activeTab === "notes"
                  ? "bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-200 dark:bg-brand-900/30 dark:text-brand-300 dark:ring-brand-800"
                  : "text-base-500 hover:text-base-700 hover:bg-base-50 dark:hover:bg-base-900"
              }`}
            >
              📝 الملاحظات
            </button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[400px]">
            {activeTab === "details" && (
              <div className="grid gap-6 animate-fadeIn">
                <Card title="معلومات التواصل والموقع">
                  <dl className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
                    <div className="group">
                      <dt className="text-xs font-semibold text-base-400 mb-1.5 uppercase tracking-wider">البريد الإلكتروني</dt>
                      <dd className="text-sm font-medium text-base-900 dark:text-white break-all flex items-center gap-2">
                         {lead.email ? (
                            <>
                                <a href={`mailto:${lead.email}`} className="hover:text-brand-600 hover:underline">{lead.email}</a>
                            </>
                         ) : <span className="text-base-300 italic">غير متوفر</span>}
                      </dd>
                    </div>
                    <div className="group">
                      <dt className="text-xs font-semibold text-base-400 mb-1.5 uppercase tracking-wider">العنوان / المنطقة</dt>
                      <dd className="text-sm font-medium text-base-900 dark:text-white flex items-center gap-2">
                         <span className="text-base-400">📍</span>
                         {lead.desiredLocation || <span className="text-base-300 italic">غير محدد</span>}
                      </dd>
                    </div>
                    <div className="group">
                      <dt className="text-xs font-semibold text-base-400 mb-1.5 uppercase tracking-wider">الوظيفة / الجهة</dt>
                      <dd className="text-sm font-medium text-base-900 dark:text-white">
                        {lead.profession || <span className="text-base-300 italic">غير محدد</span>}
                      </dd>
                    </div>
                    <div className="group">
                      <dt className="text-xs font-semibold text-base-400 mb-1.5 uppercase tracking-wider">مصدر العميل</dt>
                      <dd className="text-sm font-medium text-base-900 dark:text-white flex items-center gap-2">
                  <Badge variant="outline" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {lead.sourceLabel || "غير محدد"}
                  </Badge>
                </dd>
                    </div>
                  </dl>
                </Card>

                <Card title="تفضيلات ومتطلبات العميل">
                  <dl className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/20">
                      <dt className="text-xs font-semibold text-emerald-600 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                        <span>💰</span> الميزانية المتوقعة
                      </dt>
                      <dd className="text-lg font-bold text-base-900 dark:text-white">
                        {lead.budgetMin ? lead.budgetMin.toLocaleString("ar-EG") : "0"} 
                        <span className="mx-2 text-base-300">-</span> 
                        {lead.budgetMax ? lead.budgetMax.toLocaleString("ar-EG") : "∞"} 
                        <span className="text-xs font-normal text-base-500 mr-1">ج.م</span>
                      </dd>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/20">
                      <dt className="text-xs font-semibold text-blue-600 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                        <span>🏠</span> نوع العقار المطلوب
                      </dt>
                      <dd className="text-lg font-bold text-base-900 dark:text-white">
                        {lead.propertyType || "أي نوع"}
                      </dd>
                    </div>
                  </dl>
                </Card>
              </div>
            )}

            {activeTab === "activity" && (
              <Card title="سجل المتابعات والنشاطات">
                {activities.length > 0 ? (
                  <div className="relative border-r-2 border-base-100 dark:border-base-800 mr-4 space-y-8 py-2">
                    {activities.map((activity) => (
                      <div key={activity.id} className="relative pr-8 group">
                        <div className={`absolute -right-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-white dark:border-[#111111] shadow-sm z-10 ${
                          activity.type === 'call' ? 'bg-blue-500' : 'bg-purple-500'
                        }`}></div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <p className={`text-sm font-bold ${activity.type === 'call' ? 'text-blue-600' : 'text-purple-600'}`}>
                            {activity.type === 'call' ? '📞 مكالمة هاتفية' : '📅 اجتماع / موعد'}
                          </p>
                          <span className="text-xs text-base-400 font-mono bg-base-50 px-2 py-0.5 rounded-md">
                            {activity.date.toLocaleString("ar-EG", { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        
                        <div className="text-sm text-base-700 dark:text-base-300 bg-white dark:bg-base-900 border border-base-200 dark:border-base-800 p-4 rounded-xl shadow-sm group-hover:shadow-md transition-shadow">
                          {activity.type === 'call' ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-base-400 uppercase">النتيجة:</span>
                                    <span className="font-medium">{activity.outcome || "لم تسجل نتيجة"}</span>
                                </div>
                              {activity.durationSeconds && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-base-400 uppercase">المدة:</span>
                                    <span className="font-mono text-xs">{Math.round(activity.durationSeconds / 60)} دقيقة</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="font-bold text-base-900 dark:text-white">{(activity as Meeting).title}</p>
                              <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-base-400 uppercase">الحالة:</span>
                                  <Badge variant={(activity as Meeting).status === 'completed' ? 'success' : 'outline'}>
                                    {(activity as Meeting).status}
                                  </Badge>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-base-50/50 rounded-xl border border-dashed border-base-200">
                    <div className="w-16 h-16 bg-base-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl opacity-50">📅</span>
                    </div>
                    <p className="text-base-500 font-medium">لا يوجد نشاط مسجل حتى الآن</p>
                    <p className="text-xs text-base-400 mt-1 mb-4">ابدأ بتسجيل أول تفاعل مع هذا العميل</p>
                    <Button 
                      variant="outline" 
                      className="text-brand-600 hover:text-brand-700 border-brand-200 hover:border-brand-300"
                      onClick={() => setIsCallDialogOpen(true)}
                    >
                      + تسجيل مكالمة
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {activeTab === "notes" && (
              <Card title="الملاحظات الشخصية">
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start gap-3 mb-4">
                        <span className="text-2xl">📝</span>
                        <div>
                            <h4 className="font-bold text-amber-800 dark:text-amber-500">ملاحظات هامة</h4>
                            <p className="text-xs text-amber-600/70">هذه الملاحظات خاصة ولا تظهر للعميل</p>
                        </div>
                    </div>
                  <p className="text-sm text-base-900 dark:text-base-100 whitespace-pre-wrap leading-loose">
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
              <h3 className="mb-4 text-sm font-bold text-base-900 dark:text-white flex items-center gap-2">
                <span>📊</span>
                مرحلة العميل
              </h3>
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
            <h3 className="mb-4 text-sm font-bold text-base-900 dark:text-white flex items-center gap-2">
                <span>👤</span>
                المسؤول عن المتابعة
            </h3>
            <div className="flex items-center gap-3 p-3 bg-base-50 dark:bg-base-900 rounded-lg border border-base-100 dark:border-base-800">
              <Avatar 
                name={assignedUser?.name || assignedUser?.email} 
                size="md" 
                className="bg-white border shadow-sm"
              />
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-base-900 dark:text-white truncate">
                  {assignedUser?.name || assignedUser?.email || "غير مُسند"}
                </p>
                <p className="text-xs text-base-500 truncate">
                  {assignedUser?.email}
                </p>
              </div>
            </div>
            
            {assignedTeam && (
              <div className="mt-4 pt-4 border-t border-base-100 dark:border-base-800">
                <p className="text-xs text-base-500 mb-2 font-semibold">الفريق التابع له</p>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                    <span className="text-sm font-medium">{assignedTeam.name}</span>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h3 className="mb-4 text-sm font-bold text-base-900 dark:text-white flex items-center gap-2">
                <span>ℹ️</span>
                بيانات النظام
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between text-sm py-2 border-b border-base-100 dark:border-base-800 last:border-0">
                <dt className="text-base-500">تاريخ الإضافة</dt>
                <dd className="font-medium text-base-900 dark:text-white dir-ltr">
                  {new Date(lead.createdAt).toLocaleDateString("ar-EG")}
                </dd>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-base-100 dark:border-base-800 last:border-0">
                <dt className="text-base-500">آخر تحديث</dt>
                <dd className="font-medium text-base-900 dark:text-white dir-ltr">
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
