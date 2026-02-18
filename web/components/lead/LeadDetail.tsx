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

export const LeadDetail = ({ leadId, showProgress = true }: { leadId: string; showProgress?: boolean }) => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false)
  const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false)
  const [meetingTitle, setMeetingTitle] = useState("اجتماع جديد")
  const { data: lead, isLoading } = useLead(leadId)
  const { data: users } = useUsers()
  
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

  const usersById = new Map((users || []).map((user) => [user.id, user]))
  const stageLabelMap: Record<string, string> = {
    new: "جديد",
    call: "مكالمة هاتفية",
    meeting: "اجتماع",
    site_visit: "رؤية الموقع",
    closing: "إغلاق الصفقة"
  }

  if (isLoading) {
    return <Card title="تفاصيل العميل">جاري تحميل التفاصيل...</Card>
  }

  if (!lead) {
    return <Card title="تفاصيل العميل">تعذر تحميل بيانات العميل</Card>
  }

  const phoneDigits = (lead.phone || "").replace(/\D/g, "");
  const whatsappLink = phoneDigits ? `https://wa.me/${phoneDigits}` : "";
  const callLink = lead.phone ? `tel:${lead.phone}` : "";

  return (
    <div className="space-y-6">
      {showProgress && (
        <Card>
          <div className="mb-6">
            <h3 className="mb-4 text-lg font-bold text-base-900">مراحل العميل</h3>
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
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card title="تفاصيل العميل">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{lead.priority === "high" ? "أولوية عالية" : lead.priority === "low" ? "أولوية منخفضة" : "أولوية عادية"}</Badge>
            <Badge tone="warning">المرحلة الحالية: {stageLabelMap[lead.status] || lead.status}</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-base-500">الاسم</p>
              <p className="text-sm font-medium text-base-900">{lead.name}</p>
            </div>
            <div>
              <p className="text-xs text-base-500">رقم الهاتف</p>
              <p className="text-sm font-medium text-base-900">{lead.phone || "غير متوفر"}</p>
            </div>
            <div>
              <p className="text-xs text-base-500">البريد الإلكتروني</p>
              <p className="text-sm font-medium text-base-900">{lead.email || "غير متوفر"}</p>
            </div>
            <div>
              <p className="text-xs text-base-500">المسؤول</p>
              <div className="flex items-center gap-2 mt-1">
                <Avatar 
                  name={usersById.get(lead.assignedUserId || "")?.name || usersById.get(lead.assignedUserId || "")?.email} 
                  size="sm" 
                />
                <p className="text-sm font-medium text-base-900">
                  {usersById.get(lead.assignedUserId || "")?.name || usersById.get(lead.assignedUserId || "")?.email || "غير مُسند"}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-base-500">المهنة</p>
              <p className="text-sm font-medium text-base-900">{lead.profession || "غير محددة"}</p>
            </div>
            <div>
              <p className="text-xs text-base-500">المصدر</p>
              <p className="text-sm font-medium text-base-900">{lead.sourceLabel || "غير محدد"}</p>
            </div>
          </div>
          {lead.phone && (
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-emerald-500 hover:bg-emerald-600 text-black border-transparent"
                onClick={() => window.open(whatsappLink, "_blank")}
              >
                تواصل واتساب
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (callLink) window.location.href = callLink
                  setIsCallDialogOpen(true)
                }}
              >
                اتصال هاتفي
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                onClick={() => {
                  setMeetingTitle("اجتماع جديد")
                  setIsMeetingDialogOpen(true)
                }}
              >
                جدولة اجتماع
              </Button>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white border-transparent"
                onClick={() => {
                  setMeetingTitle("زيارة موقع")
                  setIsMeetingDialogOpen(true)
                }}
              >
                زيارة موقع
              </Button>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-base-500">كود العميل</p>
              <p className="text-sm font-medium text-base-900">{lead.leadCode}</p>
            </div>
            <div>
              <p className="text-xs text-base-500">تاريخ الإنشاء</p>
              <p className="text-sm font-medium text-base-900">{new Date(lead.createdAt).toLocaleString("ar-EG")}</p>
            </div>
          </div>
        </div>
      </Card>
      <Card title="ملخص العميل">
        <div className="space-y-4">
          <div className="rounded-lg border border-base-100 px-3 py-2">
            <p className="text-xs text-base-500">الميزانية المتوقعة</p>
            <p className="text-sm font-medium text-base-900">
              {lead.budgetMin ? lead.budgetMin.toLocaleString("ar-EG") : "—"} - {lead.budgetMax ? lead.budgetMax.toLocaleString("ar-EG") : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-base-100 px-3 py-2">
            <p className="text-xs text-base-500">المنطقة المفضلة</p>
            <p className="text-sm font-medium text-base-900">{lead.desiredLocation || "غير محددة"}</p>
          </div>
          <div className="rounded-lg border border-base-100 px-3 py-2">
            <p className="text-xs text-base-500">نوع العقار</p>
            <p className="text-sm font-medium text-base-900">{lead.propertyType || "غير محدد"}</p>
          </div>
          <div className="rounded-lg border border-base-100 px-3 py-2">
            <p className="text-xs text-base-500">ملاحظات</p>
            <p className="text-sm font-medium text-base-900">{lead.notes || "لا توجد ملاحظات"}</p>
          </div>
          <p className="text-xs text-base-500">رقم العميل: {lead.id}</p>
        </div>
      </Card>
    </div>

      {lead.callLogs && lead.callLogs.length > 0 && (
        <Card title="سجل المكالمات">
          <div className="space-y-3">
            {lead.callLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg border border-base-100 p-3">
                <div>
                  <p className="text-sm font-medium text-base-900">
                    {log.outcome === "answered" ? "تم الرد" :
                     log.outcome === "no_answer" ? "لم يتم الرد" :
                     log.outcome === "busy" ? "مشغول" :
                     log.outcome === "wrong_number" ? "رقم خاطئ" : log.outcome}
                  </p>
                  <p className="text-xs text-base-500">
                    {new Date(log.callTime).toLocaleString("ar-EG")} - {log.caller?.name || "مستخدم"}
                  </p>
                </div>
                <div className="text-xs font-medium text-base-900">
                  {log.durationSeconds ? `${log.durationSeconds} ثانية` : ""}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {lead.phone && (
        <CallLogDialog
          isOpen={isCallDialogOpen}
          onClose={() => setIsCallDialogOpen(false)}
          leadId={lead.id}
          phone={lead.phone}
        />
      )}

      <MeetingDialog
        isOpen={isMeetingDialogOpen}
        onClose={() => setIsMeetingDialogOpen(false)}
        leadId={lead.id}
        initialTitle={meetingTitle}
      />
    </div>
  )
}
