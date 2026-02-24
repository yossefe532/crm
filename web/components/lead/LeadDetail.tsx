"use client"

import { Card } from "../ui/Card"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Avatar } from "../ui/Avatar"
import { Input } from "../ui/Input"
import { useLead } from "../../lib/hooks/useLead"
import { useUsers } from "../../lib/hooks/useUsers"
import { useTeams } from "../../lib/hooks/useTeams"
import { useState } from "react"
import { CallLogDialog } from "./CallLogDialog"
import { MeetingDialog } from "./MeetingDialog"
import { MeetingOutcomeDialog } from "./MeetingOutcomeDialog"
import { SiteVisitDialog } from "./SiteVisitDialog"
import { LeadProgress } from "./LeadProgress"
import { leadService } from "../../lib/services/leadService"
import { Meeting } from "../../lib/types"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "../../lib/auth/AuthContext"
import { ConfirmationModal } from "../ui/ConfirmationModal"
import { useRouter } from "next/navigation"
import { ClosureModal } from "./ClosureModal"
import { FailureModal } from "./FailureModal"
import { StageTransitionModal } from "./StageTransitionModal"
import { Countdown } from "./Countdown"
import { ExtensionRequestModal } from "./ExtensionRequestModal"
import { DealSubmissionModal } from "./DealSubmissionModal"

import { Modal } from "../ui/Modal"

export const LeadDetail = ({ leadId, showProgress = true }: { leadId: string; showProgress?: boolean }) => {
  const { token, role, userId } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false)
  const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false)
  const [isMeetingOutcomeDialogOpen, setIsMeetingOutcomeDialogOpen] = useState(false)
  const [isSiteVisitDialogOpen, setIsSiteVisitDialogOpen] = useState(false)
  const [isCallCheckModalOpen, setIsCallCheckModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false)
  const [isFailureModalOpen, setIsFailureModalOpen] = useState(false)
  const [isStageTransitionModalOpen, setIsStageTransitionModalOpen] = useState(false)
  const [meetingTitle, setMeetingTitle] = useState("اجتماع جديد")
  const [activeTab, setActiveTab] = useState<"details" | "activity" | "notes">("details")
  const [pendingStage, setPendingStage] = useState<string | null>(null)
  const [targetStage, setTargetStage] = useState<string | null>(null)
  const [nextAction, setNextAction] = useState<string | null>(null)
  const [pendingMeeting, setPendingMeeting] = useState<Meeting | undefined>(undefined)

  const [isEditPhoneOpen, setIsEditPhoneOpen] = useState(false)
  const [newPhone, setNewPhone] = useState("")
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false)
  const [isDealModalOpen, setIsDealModalOpen] = useState(false)

  const { data: lead, isLoading } = useLead(leadId)
  const isOwnerAssignedToOther = !isLoading && lead && (role === 'owner' || role === 'team_leader') && !!lead.assignedUserId && lead.assignedUserId !== userId
  const { data: users } = useUsers()
  const { data: teams } = useTeams()
  
  // Backend: call, meeting, site_visit, deal, won, lost
  // Frontend STAGES: new, call, meeting, site_visit, deal
  const STAGES = ["new", "call", "meeting", "site_visit", "deal"]
  const STAGE_LABELS = ["جديد", "مكالمة هاتفية", "اجتماع", "رؤية الموقع", "إغلاق الصفقة"]

  // Calculate remaining time
  const TIMER_DAYS = lead?.isTimerExtended ? 10 : 7
  const startDate = lead?.timerStartDate ? new Date(lead.timerStartDate) : null
  let hoursRemaining = 0
  if (startDate) {
    const now = new Date()
    const endDate = new Date(startDate.getTime() + TIMER_DAYS * 24 * 60 * 60 * 1000)
    const diff = endDate.getTime() - now.getTime()
    hoursRemaining = Math.max(0, Math.floor(diff / (1000 * 60 * 60)))
  }

  const advanceStageMutation = useMutation({
    mutationFn: async () => {
      return leadService.advanceStage(leadId, token || undefined)
    },
    onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
        // If advanced to deal/closing, maybe show confetti?
    },
    onError: (error: any) => {
        alert(error.response?.data?.message || "لا يمكن الانتقال للمرحلة التالية. تأكد من إكمال المتطلبات.")
    }
  })
  
  const updatePhoneMutation = useMutation({
    mutationFn: async () => {
        // 1. Update Phone
        await leadService.update(leadId, { phone: newPhone }, token || undefined)
        // 2. Add log to clear "Wrong Number" status
        await leadService.addCall(leadId, { 
            outcome: "answered", 
            durationSeconds: 0 
        }, token || undefined)
        // 3. Add note
        const currentNotes = lead?.notes || ""
        await leadService.update(leadId, { 
            notes: currentNotes + `\n[تحديث]: تم تغيير الرقم بواسطة المالك من ${lead?.phone} إلى ${newPhone}` 
        }, token || undefined)
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
        setIsEditPhoneOpen(false)
    }
  })

  const unassignMutation = useMutation({
    mutationFn: async () => {
        return leadService.unassign(leadId, token || undefined)
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
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

  const updateStageMutation = useMutation({
    mutationFn: async (data: { stage: string, answers?: any }) => {
        return leadService.updateStage(leadId, data.stage, data.answers, token || undefined)
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
        queryClient.invalidateQueries({ queryKey: ["leads"] })
    }
  })

  const handleStageChange = (index: number) => {
    // Strict flow: Disable manual stage jumping via progress bar
    // Just show details or do nothing
    return;
  }

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
  
  // Check if the lead is marked as wrong number
  const isWrongNumber = lead.isWrongNumber

  // Combine logs and meetings for timeline
  const activities = [
    ...(lead.callLogs || []).map(log => ({ ...log, type: 'call' as const, date: new Date(log.callTime) })),
    ...(lead.meetings || []).map(meeting => ({ ...meeting, type: 'meeting' as const, date: new Date(meeting.startsAt) }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  const assignedUser = usersById.get(lead.assignedUserId || "")
  const assignedTeam = lead.teamId ? teamsById.get(lead.teamId) : null

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Wrong Number Alert for Owner */}
      {isWrongNumber && role === 'owner' && (
        <div className="bg-rose-50 border border-rose-100 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse-slow shadow-sm">
            <div className="flex items-center gap-3">
                <div className="bg-rose-100 p-2.5 rounded-full">
                    <span className="text-xl">📞</span>
                </div>
                <div>
                    <h3 className="font-bold text-rose-900">تنبيه: رقم هاتف خاطئ</h3>
                    <p className="text-sm text-rose-700 mt-1">
                        أبلغ المندوب أن هذا الرقم ({lead.phone}) خاطئ. يرجى اتخاذ إجراء فوري.
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
                <Button 
                    variant="danger" 
                    className="flex-1 md:flex-none bg-rose-600 hover:bg-rose-700 text-white border-transparent shadow-sm"
                    onClick={() => {
                        setNewPhone(lead.phone || "")
                        setIsEditPhoneOpen(true)
                    }}
                >
                    تصحيح الرقم
                </Button>
                <Button 
                    variant="outline"
                    className="flex-1 md:flex-none border-rose-200 text-rose-700 hover:bg-rose-100"
                    onClick={() => unassignMutation.mutate()}
                    disabled={unassignMutation.isPending}
                >
                    {unassignMutation.isPending ? "جاري السحب..." : "سحب العميل"}
                </Button>
                 <Button 
                    variant="ghost"
                    className="flex-1 md:flex-none text-rose-600 hover:bg-rose-100"
                    onClick={() => setIsDeleteModalOpen(true)}
                >
                    حذف
                </Button>
            </div>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-base-200 p-4 md:p-6 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-brand-300"></div>
        
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-6">
          <div className="flex items-start gap-3 md:gap-5 min-w-0">
            <div className="relative shrink-0">
                <Avatar 
                name={lead.name} 
                size="lg" 
                className="h-16 w-16 md:h-20 md:w-20 text-xl md:text-2xl bg-brand-50 text-brand-600 border-2 border-white shadow-md"
                />
                <span className={`absolute bottom-0 right-0 w-4 h-4 md:w-5 md:h-5 rounded-full border-2 border-white ${
                    lead.priority === 'high' ? 'bg-red-500' : 
                    lead.priority === 'low' ? 'bg-green-500' : 'bg-yellow-500'
                }`} title={`أولوية: ${lead.priority === 'high' ? 'عالية' : lead.priority === 'low' ? 'منخفضة' : 'عادية'}`}></span>
            </div>
            
            <div className="space-y-1.5 md:space-y-2 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <h1 className="text-xl md:text-3xl font-bold text-base-900 dark:text-white tracking-tight break-words">{lead.name}</h1>
                <Badge variant={lead.priority === "high" ? "danger" : lead.priority === "low" ? "success" : "warning"} className="px-1.5 py-0.5 md:px-2 md:py-1 text-xs">
                  {lead.priority === "high" ? "🔥 هام جداً" : lead.priority === "low" ? "منخفض" : "عادي"}
                </Badge>
                {lead.leadCode && (
                  <Badge variant="outline" className="font-mono text-[10px] md:text-xs">#{lead.leadCode}</Badge>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-base-500">
                <span className="flex items-center gap-1.5 bg-base-50 dark:bg-base-900 px-2 py-1 rounded-md max-w-full truncate">
                   <span className="opacity-70 shrink-0">💼</span>
                   <span className="truncate">{lead.profession || "المهنة غير محددة"}</span>
                </span>
                <div className="flex items-center gap-2 max-w-full">
                    <span className="flex items-center gap-1.5 bg-base-50 dark:bg-base-900 px-2 py-1 rounded-md max-w-full truncate">
                    <span className="opacity-70 shrink-0">📞</span>
                    <span className={`truncate ${lead.phone ? (isWrongNumber ? "text-rose-600 font-bold line-through decoration-2" : "text-base-900 dark:text-white font-medium") : "text-base-400"}`}>
                        {lead.phone || "لا يوجد هاتف"}
                    </span>
                    {isWrongNumber && <span className="text-[10px] md:text-xs text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full font-bold shrink-0">⚠️ رقم خاطئ</span>}
                    </span>
                    {role === 'owner' && (
                        <button 
                            className="text-xs text-brand-600 hover:text-brand-700 underline"
                            onClick={() => {
                                setNewPhone(lead.phone || "")
                                setIsEditPhoneOpen(true)
                            }}
                        >
                            تعديل
                        </button>
                    )}
                </div>
                {lead.email && (
                    <span className="flex items-center gap-1.5 bg-base-50 dark:bg-base-900 px-2 py-1 rounded-md max-w-full truncate">
                        <span className="opacity-70 shrink-0">📧</span>
                        <span className="text-base-900 dark:text-white truncate">{lead.email}</span>
                    </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto mt-2 md:mt-0 shrink-0">
            {lead.phone && !isOwnerAssignedToOther && (
              <div className="flex gap-2">
                <a 
                  href={`https://wa.me/${lead.phone.replace(/\D/g, "").replace(/^0/, "20")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm btn-ghost gap-2 text-emerald-600 hover:bg-emerald-50"
                >
                  <span className="w-5 h-5 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                  </span>
                  واتساب
                </a>
                <a 
                   href={`tel:${lead.phone}`}
                   onClick={() => setIsCallDialogOpen(true)}
                   className="btn btn-sm btn-ghost gap-2 text-blue-600 hover:bg-blue-50"
                 >
                  <span className="w-5 h-5 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </span>
                  اتصال
                </a>
              </div>
            )}
            {!isOwnerAssignedToOther && (
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
            )}
            {(lead.status === 'meeting' || lead.status === 'site_visit') && !isOwnerAssignedToOther && (
                <Button
                    variant="outline"
                    className="flex-1 md:flex-none border-blue-300 text-blue-700 hover:bg-blue-50 gap-2"
                    onClick={() => setIsSiteVisitDialogOpen(true)}
                >
                    <span className="w-4 h-4 flex items-center justify-center">📅</span>
                    جدولة زيارة موقع
                </Button>
            )}
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

      <Modal isOpen={isCallCheckModalOpen} onClose={() => setIsCallCheckModalOpen(false)} title="تأكيد المكالمة">
        <div className="space-y-4">
          <p className="text-base-900">هل قمت بإجراء مكالمة هاتفية مع العميل قبل هذا الاجتماع؟</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => {
                setIsCallCheckModalOpen(false)
                setIsMeetingOutcomeDialogOpen(true)
            }}>لا، متابعة للاجتماع</Button>
            <Button onClick={() => {
                setIsCallCheckModalOpen(false)
                setIsCallDialogOpen(true)
                setNextAction('open_meeting_outcome')
            }}>نعم، تسجيل المكالمة أولاً</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isEditPhoneOpen} onClose={() => setIsEditPhoneOpen(false)} title="تعديل رقم الهاتف">
        <div className="space-y-4">
            <p className="text-sm text-base-500">
                يرجى إدخال الرقم الصحيح. سيتم تسجيل هذا التغيير في سجل النشاطات.
            </p>
            <Input
                label="رقم الهاتف الجديد"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                dir="ltr"
            />
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setIsEditPhoneOpen(false)}>إلغاء</Button>
                <Button onClick={() => updatePhoneMutation.mutate()} disabled={updatePhoneMutation.isPending || !newPhone}>
                    {updatePhoneMutation.isPending ? "جاري التحديث..." : "حفظ الرقم الجديد"}
                </Button>
            </div>
        </div>
      </Modal>

      <CallLogDialog
        isOpen={isCallDialogOpen}
        onClose={() => setIsCallDialogOpen(false)}
        leadId={leadId}
        phone={lead.phone || ""}
        onSuccess={(outcome, notes) => {
            if (nextAction === 'open_meeting_outcome') {
                setNextAction(null)
                setIsMeetingOutcomeDialogOpen(true)
                return
            }
            if (pendingStage && STAGES.indexOf(pendingStage) > STAGES.indexOf(lead.status)) {
                // Map outcomes to Arabic values expected by backend
                const outcomeMap: Record<string, string> = {
                    "answered": "تم الرد",
                    "no_answer": "لم يتم الرد",
                    "busy": "مشغول",
                    "wrong_number": "رقم خاطئ",
                    "refused": "رفض / غير مهتم"
                }
                
                const arabicOutcome = outcomeMap[outcome] || outcome

                if (pendingStage === 'call') {
                     updateStageMutation.mutate({ 
                         stage: 'call', 
                         answers: { outcome: arabicOutcome, notes: notes || "" } 
                     })
                     setPendingStage(null)
                } else {
                     // If target is beyond call (e.g. user clicked Meeting but triggered call dialog first?)
                     // This logic might need review if we allow skipping.
                     // But for now, if we are just completing the Call stage requirements:
                     setTargetStage(pendingStage)
                     setIsStageTransitionModalOpen(true)
                     setPendingStage(null)
                }
            }
        }}
      />

      <MeetingDialog
        isOpen={isMeetingDialogOpen}
        onClose={() => setIsMeetingDialogOpen(false)}
        leadId={leadId}
        initialTitle={meetingTitle}
      />

      <MeetingOutcomeDialog
        isOpen={isMeetingOutcomeDialogOpen}
        onClose={() => setIsMeetingOutcomeDialogOpen(false)}
        leadId={leadId}
        meeting={pendingMeeting}
        onSuccess={() => {
            if (pendingStage && STAGES.indexOf(pendingStage) > STAGES.indexOf(lead.status)) {
                setTargetStage(pendingStage)
                setIsStageTransitionModalOpen(true)
                setPendingStage(null)
            }
        }}
      />

      <SiteVisitDialog
        isOpen={isSiteVisitDialogOpen}
        onClose={() => setIsSiteVisitDialogOpen(false)}
        leadId={leadId}
        // SiteVisitDialog handles transition internally
      />

      <StageTransitionModal
        isOpen={isStageTransitionModalOpen}
        onClose={() => setIsStageTransitionModalOpen(false)}
        leadId={leadId}
        targetStage={targetStage || ""}
        currentStage={lead?.status || ""}
      />

      <ExtensionRequestModal 
        isOpen={isExtensionModalOpen} 
        onClose={() => setIsExtensionModalOpen(false)} 
        leadId={leadId} 
      />

      <DealSubmissionModal 
        isOpen={isDealModalOpen} 
        onClose={() => setIsDealModalOpen(false)} 
        leadId={leadId} 
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
                onStageChange={handleStageChange}
                readOnly={(role === 'owner' || role === 'team_leader') && !!lead.assignedUserId && lead.assignedUserId !== userId}
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

    </div>
  )
}
