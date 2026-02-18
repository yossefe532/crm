"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { LeadDetail } from "../../../../components/lead/LeadDetail"
import { ActivityTimeline } from "../../../../components/lead/ActivityTimeline"
import { StageProgress } from "../../../../components/lead/StageProgress"
import { Card } from "../../../../components/ui/Card"
import { Button } from "../../../../components/ui/Button"
import { Input } from "../../../../components/ui/Input"
import { Select } from "../../../../components/ui/Select"
import { Textarea } from "../../../../components/ui/Textarea"
import { useLeadStage } from "../../../../lib/hooks/useLeadStage"
import { useLead } from "../../../../lib/hooks/useLead"
import { useUsers } from "../../../../lib/hooks/useUsers"
import { useLeadDeadline } from "../../../../lib/hooks/useLeadDeadline"
import { useLeadFailures } from "../../../../lib/hooks/useLeadFailures"
import { leadService } from "../../../../lib/services/leadService"
import { coreService } from "../../../../lib/services/coreService"
import { useAuth } from "../../../../lib/auth/AuthContext"
import { meetingService } from "../../../../lib/services/meetingService"

export default function LeadDetailPage() {
  const params = useParams()
  const leadId = params.id as string

  const stageMutation = useLeadStage(leadId)
  const { data: lead, isLoading: isLeadLoading, error: leadError } = useLead(leadId)
  const { data: users } = useUsers()
  const { data: deadline } = useLeadDeadline(leadId)
  const { data: failures } = useLeadFailures(leadId)
  const { token, role, userId } = useAuth()
  const [assignedUserId, setAssignedUserId] = useState("")
  const [assignReason, setAssignReason] = useState("")
  const [stageInsight, setStageInsight] = useState("")
  const [stageDetails, setStageDetails] = useState("")
  const [failureReason, setFailureReason] = useState("")
  const [closeAmount, setCloseAmount] = useState("")
  const [closeNote, setCloseNote] = useState("")
  const [closeAddress, setCloseAddress] = useState("")
  const [callOutcome, setCallOutcome] = useState("")
  const [callDuration, setCallDuration] = useState("")
  const [meetingTitle, setMeetingTitle] = useState("")
  const [meetingStartsAt, setMeetingStartsAt] = useState("")
  const [meetingEndsAt, setMeetingEndsAt] = useState("")
  const [showSurrender, setShowSurrender] = useState(false)
  const [activeStage, setActiveStage] = useState<"call" | "meeting" | "site_visit" | "closing" | null>(null)
  const [siteVisitDate, setSiteVisitDate] = useState("")
  const [siteVisitDetails, setSiteVisitDetails] = useState("")
  const [siteVisitLocations, setSiteVisitLocations] = useState("")
  const [siteVisitImpressions, setSiteVisitImpressions] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const meetingRef = useRef<HTMLDivElement | null>(null)
  const router = useRouter()
  const queryClient = useQueryClient()

  const assignMutation = useMutation({
    mutationFn: () => leadService.assign(leadId, { assignedUserId, reason: assignReason || undefined }, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      setMessage("تم تعيين العميل بنجاح")
    }
  })

  const noteMutation = useMutation({
    mutationFn: (body: string) =>
      coreService.createNote(
        {
          entityType: "lead",
          entityId: leadId,
          body
        },
        token || undefined
      ),
    onSuccess: () => {
      setStageInsight("")
      setStageDetails("")
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
      queryClient.invalidateQueries({ queryKey: ["lead_deadline", leadId] })
      queryClient.invalidateQueries({ queryKey: ["lead-timeline", leadId] })
    }
  })

  const callMutation = useMutation({
    mutationFn: () => leadService.addCall(leadId, { durationSeconds: callDuration ? Number(callDuration) : undefined, outcome: callOutcome || undefined }, token || undefined),
    onSuccess: () => {
      setCallOutcome("")
      setCallDuration("")
      queryClient.invalidateQueries({ queryKey: ["lead-timeline", leadId] })
    }
  })

  const meetingMutation = useMutation({
    mutationFn: () => meetingService.create({ leadId, title: meetingTitle, startsAt: meetingStartsAt, endsAt: meetingEndsAt, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, token || undefined),
    onSuccess: () => {
      setMeetingTitle("")
      setMeetingStartsAt("")
      setMeetingEndsAt("")
      queryClient.invalidateQueries({ queryKey: ["meetings"] })
    }
  })

  const failMutation = useMutation({
    mutationFn: () => leadService.fail(leadId, { failureType: "surrender", reason: failureReason }, token || undefined),
    onSuccess: () => {
      setFailureReason("")
      setShowSurrender(false)
      setMessage("تم سحب العميل وإرسال سبب الفشل إلى الإدارة")
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["lead_failures", leadId] })
    }
  })

  const closeMutation = useMutation({
    mutationFn: (note: string) => leadService.close(leadId, { amount: Number(closeAmount), note, address: closeAddress }, token || undefined),
    onSuccess: () => {
      setCloseAmount("")
      setCloseNote("")
      setCloseAddress("")
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    }
  })

  const pendingFailure = useMemo(() => (failures || []).find((item) => item.status === "pending"), [failures])

  const resolveFailureMutation = useMutation({
    mutationFn: (reason: string) => leadService.resolveFailure(pendingFailure?.id || "", { reason }, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead_failures", leadId] })
      setMessage("تم حفظ سبب الفشل")
    }
  })

  const stageOrder = ["call", "meeting", "site_visit", "closing"] as const
  const currentStage = stageOrder.includes((lead?.status || "call") as typeof stageOrder[number])
    ? ((lead?.status || "call") as typeof stageOrder[number])
    : "call"
  const currentStageIndex = stageOrder.indexOf(currentStage)
  const canOperateStages = Boolean(lead?.assignedUserId) && lead?.assignedUserId === userId

  useEffect(() => {
    if (!canOperateStages) {
      setActiveStage(null)
      return
    }
    setActiveStage(currentStage)
  }, [currentStage, canOperateStages])

  const assignableUsers = (users || []).filter((user) => {
    if (user.status !== "active") return false
    const roles = user.roles || []
    if (roles.includes("owner")) return false
    if (role === "owner") return roles.includes("team_leader") || roles.includes("sales")
    if (role === "team_leader") return roles.includes("sales")
    return false
  })

  if (isLeadLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg font-medium text-base-900">جاري تحميل بيانات العميل...</div>
          <div className="text-sm text-base-500">يرجى الانتظار</div>
        </div>
      </div>
    )
  }

  if (leadError || !lead) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg font-medium text-red-600">تعذر تحميل بيانات العميل</div>
          <div className="text-sm text-base-500">تأكد من الاتصال بالإنترنت أو صلاحيات الوصول</div>
          <Button className="mt-4" onClick={() => router.push("/leads")}>
            العودة للقائمة
          </Button>
        </div>
      </div>
    )
  }

  const toLocalInput = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, "0")
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  const prepareMeetingDefaults = () => {
    const now = new Date()
    const start = new Date(now.getTime() + 60 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    setMeetingTitle(`اجتماع متابعة ${lead?.name || ""}`.trim())
    setMeetingStartsAt(toLocalInput(start))
    setMeetingEndsAt(toLocalInput(end))
  }

  const openStage = (stageKey: string) => {
    if (!stageOrder.includes(stageKey as typeof stageOrder[number])) {
      return
    }
    const resolvedStage = stageKey as typeof stageOrder[number]
    if (!canOperateStages) {
      setMessage("لا يمكن تنفيذ المراحل إلا بواسطة المندوب المكلف")
      return
    }
    const targetIndex = stageOrder.indexOf(resolvedStage)
    if (targetIndex !== currentStageIndex) {
      setMessage("لا يمكن فتح هذه المرحلة قبل إتمام المرحلة السابقة")
      return
    }
    setMessage(null)
    setActiveStage(resolvedStage)
    if (resolvedStage === "meeting") {
      prepareMeetingDefaults()
      meetingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const saveCallStage = async () => {
    if (!callOutcome.trim()) {
      setMessage("نتيجة المكالمة مطلوبة")
      return
    }
    if (!stageInsight.trim() || !stageDetails.trim()) {
      setMessage("يجب كتابة الانطباع والتفاصيل قبل الحفظ")
      return
    }
    await callMutation.mutateAsync()
    await noteMutation.mutateAsync(
      `مرحلة: مكالمة هاتفية\nنتيجة المكالمة: ${callOutcome}\nمدة المكالمة: ${callDuration || "غير محددة"}\nانطباع: ${stageInsight}\nتفاصيل: ${stageDetails}`
    )
    await stageMutation.mutateAsync("meeting")
    prepareMeetingDefaults()
    setActiveStage("meeting")
    setMessage("تم حفظ المكالمة وفتح مرحلة الاجتماع")
  }

  const saveMeetingStage = async () => {
    if (!meetingTitle || !meetingStartsAt || !meetingEndsAt) {
      setMessage("يرجى إدخال بيانات الاجتماع")
      return
    }
    await meetingMutation.mutateAsync()
    await noteMutation.mutateAsync(
      `مرحلة: اجتماع\nعنوان الاجتماع: ${meetingTitle}\nموعد البداية: ${meetingStartsAt}\nموعد النهاية: ${meetingEndsAt}`
    )
    await stageMutation.mutateAsync("site_visit")
    setActiveStage("site_visit")
    setMessage("تم حفظ الاجتماع وفتح مرحلة رؤية الموقع")
  }

  const saveSiteVisitStage = async () => {
    if (!siteVisitDate || !siteVisitLocations.trim() || !siteVisitImpressions.trim() || !siteVisitDetails.trim()) {
      setMessage("يرجى إدخال بيانات رؤية الموقع كاملة")
      return
    }
    await noteMutation.mutateAsync(
      `مرحلة: رؤية الموقع\nتاريخ الزيارة: ${siteVisitDate}\nالأماكن التي تمت زيارتها: ${siteVisitLocations}\nانطباع العميل: ${siteVisitImpressions}\nتفاصيل إضافية: ${siteVisitDetails}`
    )
    await stageMutation.mutateAsync("closing")
    setSiteVisitDate("")
    setSiteVisitLocations("")
    setSiteVisitImpressions("")
    setSiteVisitDetails("")
    setActiveStage("closing")
    setMessage("تم حفظ زيارة الموقع وفتح مرحلة الإغلاق")
  }

  const saveClosingStage = async () => {
    if (!closeAmount || Number(closeAmount) <= 0) {
      setMessage("أدخل قيمة الإغلاق بشكل صحيح")
      return
    }
    if (!closeAddress.trim()) {
      setMessage("عنوان العقار مطلوب")
      return
    }
    const finalNote = `تاريخ الإغلاق: ${new Date().toLocaleString("ar-EG")}\nعنوان العقار: ${closeAddress}\nتفاصيل الإغلاق: ${closeNote || "بدون"}`
    await noteMutation.mutateAsync(`مرحلة: إغلاق الصفقة\n${finalNote}`)
    await closeMutation.mutateAsync(closeNote || "")
    setMessage("تم إرسال الصفقة للأرشيف بانتظار اعتماد المالك")
  }

  return (
    <div className="space-y-6">
      <Card title="حالة العميل">
        <div className="flex flex-col gap-4">
          <StageProgress
            stage={lead?.status || "call"}
            onStageChange={(stage) => openStage(stage)}
            readOnly={!canOperateStages}
          />
        </div>
      </Card>
      {!canOperateStages && (
        <Card title="تنبيه المراحل">
          لا يمكن تنفيذ المراحل إلا بواسطة المندوب المكلف. يمكنك فقط نقل العميل أو حذفه حسب الصلاحيات.
        </Card>
      )}
      {activeStage === "call" && (
        <Card title="مرحلة المكالمة الهاتفية">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="نتيجة المكالمة"
              className="text-right"
              placeholder="مثال: تم الاتفاق مبدئياً"
              value={callOutcome}
              onChange={(event) => setCallOutcome(event.target.value)}
            />
            <Input
              label="مدة المكالمة (ثواني)"
              type="number"
              className="text-right"
              placeholder="مثال: 120"
              value={callDuration}
              onChange={(event) => setCallDuration(event.target.value)}
            />
            <Input
              label="انطباع مختصر"
              className="sm:col-span-2 text-right"
              placeholder="مثال: عميل مهتم جداً"
              value={stageInsight}
              onChange={(event) => setStageInsight(event.target.value)}
            />
            <Textarea
              label="التفاصيل الكاملة"
              className="sm:col-span-2 min-h-[120px] text-right"
              placeholder="اكتب تفاصيل المكالمة هنا..."
              value={stageDetails}
              onChange={(event) => setStageDetails(event.target.value)}
            />
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Button className="w-full sm:w-auto" type="button" disabled={callMutation.isPending || stageMutation.isPending} onClick={saveCallStage}>
              {callMutation.isPending ? "جاري الحفظ..." : "حفظ المكالمة"}
            </Button>
            <Button className="w-full sm:w-auto" type="button" variant="secondary" onClick={() => setActiveStage(null)}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}
      {activeStage === "meeting" && (
        <div ref={meetingRef}>
          <Card title="مرحلة الاجتماع">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="عنوان الاجتماع"
                className="text-right"
                placeholder="مثال: اجتماع مناقشة العرض"
                value={meetingTitle}
                onChange={(event) => setMeetingTitle(event.target.value)}
              />
              <Input
                label="تاريخ البدء"
                type="datetime-local"
                className="text-right"
                value={meetingStartsAt}
                onChange={(event) => setMeetingStartsAt(event.target.value)}
              />
              <Input
                label="تاريخ الانتهاء"
                type="datetime-local"
                className="text-right"
                value={meetingEndsAt}
                onChange={(event) => setMeetingEndsAt(event.target.value)}
              />
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <Button className="w-full sm:w-auto" type="button" disabled={meetingMutation.isPending || stageMutation.isPending} onClick={saveMeetingStage}>
                {meetingMutation.isPending ? "جاري الحفظ..." : "حفظ الاجتماع"}
              </Button>
              <Button className="w-full sm:w-auto" type="button" variant="secondary" onClick={() => router.push("/meetings")}>
                فتح تبويب الاجتماعات
              </Button>
              <Button className="w-full sm:w-auto" type="button" variant="secondary" onClick={() => setActiveStage(null)}>
                إلغاء
              </Button>
            </div>
          </Card>
        </div>
      )}
      {activeStage === "site_visit" && (
        <Card title="مرحلة رؤية الموقع">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="تاريخ الزيارة"
              type="date"
              className="text-right"
              value={siteVisitDate}
              onChange={(event) => setSiteVisitDate(event.target.value)}
            />
            <Input
              label="الأماكن التي تمت زيارتها"
              className="text-right"
              placeholder="مثال: المشروع أ، الوحدة ب"
              value={siteVisitLocations}
              onChange={(event) => setSiteVisitLocations(event.target.value)}
            />
            <Textarea
              label="انطباع العميل"
              className="sm:col-span-2 min-h-[120px] text-right"
              placeholder="اكتب انطباع العميل عن الأماكن..."
              value={siteVisitImpressions}
              onChange={(event) => setSiteVisitImpressions(event.target.value)}
            />
            <Textarea
              label="تفاصيل إضافية"
              className="sm:col-span-2 min-h-[120px] text-right"
              placeholder="أي تفاصيل أخرى..."
              value={siteVisitDetails}
              onChange={(event) => setSiteVisitDetails(event.target.value)}
            />
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Button className="w-full sm:w-auto" type="button" disabled={stageMutation.isPending || noteMutation.isPending} onClick={saveSiteVisitStage}>
              حفظ الزيارة
            </Button>
            <Button className="w-full sm:w-auto" type="button" variant="secondary" onClick={() => setActiveStage(null)}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}
      {activeStage === "closing" && (
        <Card title="مرحلة الإغلاق">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="قيمة الإغلاق"
              type="number"
              className="text-right"
              placeholder="0.00"
              value={closeAmount}
              onChange={(event) => setCloseAmount(event.target.value)}
            />
            <Input
              label="عنوان العقار"
              className="text-right"
              placeholder="عنوان المكان المباع"
              value={closeAddress}
              onChange={(event) => setCloseAddress(event.target.value)}
            />
            <Textarea
              label="ملاحظات الإغلاق"
              className="sm:col-span-2 min-h-[120px] text-right"
              placeholder="تفاصيل إضافية..."
              value={closeNote}
              onChange={(event) => setCloseNote(event.target.value)}
            />
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Button className="w-full sm:w-auto" type="button" disabled={closeMutation.isPending} onClick={saveClosingStage}>
              {closeMutation.isPending ? "جاري الإغلاق..." : "حفظ الإغلاق"}
            </Button>
            <Button className="w-full sm:w-auto" type="button" variant="secondary" onClick={() => setActiveStage(null)}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}
      {(role === "sales" || role === "team_leader") && (
        <Card title="استسلام عن العميل">
          <div className="space-y-3">
            {!showSurrender && (
              <Button type="button" variant="secondary" onClick={() => setShowSurrender(true)}>
                استسلام
              </Button>
            )}
            {showSurrender && (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  setMessage(null)
                  if (!failureReason.trim()) {
                    setMessage("سبب الفشل مطلوب")
                    return
                  }
                  failMutation.mutate()
                }}
              >
                <Textarea
                  className="text-right"
                  placeholder="اكتب سبب فشل الصفقة"
                  value={failureReason}
                  onChange={(event) => setFailureReason(event.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={failMutation.isPending}>
                    {failMutation.isPending ? "جاري الإرسال..." : "تأكيد الاستسلام"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowSurrender(false)}>
                    إلغاء
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Card>
      )}
      {deadline?.dueAt && (
        <Card title="مهلة العميل">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-base-600">آخر موعد لإنهاء المرحلة الحالية</span>
            <span className="font-medium text-base-900">{new Date(deadline.dueAt).toLocaleString("ar-EG")}</span>
          </div>
        </Card>
      )}
      {pendingFailure && pendingFailure.status === "pending" && role === "sales" && (
        <Card title="سبب الفشل المطلوب">
          <form
            className="grid gap-3 md:grid-cols-[2fr_auto]"
            onSubmit={(event) => {
              event.preventDefault()
              setMessage(null)
              if (!failureReason.trim()) {
                setMessage("سبب الفشل مطلوب")
                return
              }
              resolveFailureMutation.mutate(failureReason)
            }}
          >
            <Input
              className="text-right"
              placeholder="اكتب سبب الفشل لفتح الحساب"
              value={failureReason}
              onChange={(event) => setFailureReason(event.target.value)}
            />
            <Button type="submit" disabled={resolveFailureMutation.isPending}>
              {resolveFailureMutation.isPending ? "جاري الحفظ..." : "حفظ السبب"}
            </Button>
          </form>
        </Card>
      )}
      {(role === "owner" || role === "team_leader") && (
        <Card title="تعيين العميل لمندوب">
          <form
            className="grid gap-4 md:grid-cols-[1fr_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault()
              setMessage(null)
              if (!assignedUserId) {
                setMessage("اختر مندوبًا للتعيين")
                return
              }
              assignMutation.mutate()
            }}
          >
            <Select
              aria-label="المندوب"
              title="المندوب"
              className="text-right"
              value={assignedUserId}
              onChange={(event) => setAssignedUserId(event.target.value)}
            >
              <option value="">اختر المندوب</option>
              {assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </Select>
            <Input
              aria-label="سبب التعيين"
              title="سبب التعيين"
              className="text-right"
              placeholder="سبب التعيين (اختياري)"
              value={assignReason}
              onChange={(event) => setAssignReason(event.target.value)}
            />
            <Button type="submit" disabled={assignMutation.isPending} aria-label="تعيين" title="تعيين">
              {assignMutation.isPending ? "جاري التعيين..." : "تعيين"}
            </Button>
          </form>
          {message && <p className="mt-3 text-sm text-base-700">{message}</p>}
        </Card>
      )}
      <LeadDetail leadId={leadId} showProgress={false} />
      <ActivityTimeline leadId={leadId} />
    </div>
  )
}
