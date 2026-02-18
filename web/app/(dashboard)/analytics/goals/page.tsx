"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "../../../../lib/auth/AuthContext"
import { useUsers } from "../../../../lib/hooks/useUsers"
import { useTeams } from "../../../../lib/hooks/useTeams"
import { goalsService } from "../../../../lib/services/goalsService"
import { Card } from "../../../../components/ui/Card"
import { Button } from "../../../../components/ui/Button"
import { Badge } from "../../../../components/ui/Badge"
import { Progress } from "../../../../components/ui/Progress"
import { Input } from "../../../../components/ui/Input"
import { Select } from "../../../../components/ui/Select"

const metricLabels: Record<string, string> = {
  leads_created: "عملاء جدد",
  leads_closed: "إغلاقات",
  revenue: "قيمة الإغلاقات",
  meetings: "اجتماعات",
  calls: "مكالمات"
}

export default function GoalsPage() {
  const { role, userId, token } = useAuth()
  const { data: users } = useUsers()
  const { data: teams } = useTeams()
  const queryClient = useQueryClient()
  const [planName, setPlanName] = useState("")
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly")
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [targets, setTargets] = useState<Array<{ subjectType: "user" | "team" | "all"; subjectId: string; metricKey: string; targetValue: string }>>([])
  const [message, setMessage] = useState<string | null>(null)

  const { data: plans } = useQuery({
    queryKey: ["goal_plans"],
    queryFn: () => goalsService.listPlans(token || undefined)
  })

  const { data: report } = useQuery({
    queryKey: ["goal_report", selectedPlanId],
    queryFn: () => goalsService.report(selectedPlanId || "", token || undefined),
    enabled: !!selectedPlanId
  })

  const { data: targetList } = useQuery({
    queryKey: ["goal_targets", selectedPlanId],
    queryFn: () => goalsService.listTargets(selectedPlanId || "", token || undefined),
    enabled: !!selectedPlanId
  })

  const createPlanMutation = useMutation({
    mutationFn: () => goalsService.createPlan({ name: planName, period }, token || undefined),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: ["goal_plans"] })
      setPlanName("")
      setSelectedPlanId(plan.id)
      setIsEditing(true)
    }
  })

  const saveTargetsMutation = useMutation({
    mutationFn: () =>
      goalsService.setTargets(
        selectedPlanId || "",
        targets.map((target) => ({
          subjectType: role === "team_leader" ? "team" : target.subjectType,
          subjectId: role === "team_leader" ? (teamLeaderTeamId || "") : target.subjectId,
          metricKey: target.metricKey,
          targetValue: Number(target.targetValue || 0)
        })),
        token || undefined
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goal_report", selectedPlanId] })
      queryClient.invalidateQueries({ queryKey: ["goal_targets", selectedPlanId] })
      setMessage("تم حفظ الأهداف بنجاح")
      setTimeout(() => setMessage(null), 3000)
      setIsEditing(false)
    },
    onError: () => {
      setMessage("تعذر حفظ الأهداف، تأكد من البيانات")
    }
  })

  const deletePlanMutation = useMutation({
    mutationFn: (planId: string) => goalsService.deletePlan(planId, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goal_plans"] })
      setSelectedPlanId(null)
      setIsEditing(false)
      setMessage("تم حذف الخطة بنجاح")
      setTimeout(() => setMessage(null), 3000)
    }
  })

  const teamLeaderTeamId = useMemo(() => {
    if (role !== "team_leader" || !userId) return null
    return (teams || []).find((team) => team.leaderUserId === userId)?.id || null
  }, [role, teams, userId])

  const visibleRows = useMemo(() => {
    if (!report?.rows) return []
    if (role === "sales" && userId) {
      return report.rows.filter((row) => row.subjectType === "all" || (row.subjectType === "user" && row.subjectId === userId))
    }
    if (role === "team_leader" && userId) {
      if (!teamLeaderTeamId) return []
      const team = (teams || []).find(t => t.id === teamLeaderTeamId)
      const memberIds = new Set((team?.members || []).map(m => m.userId))
      return report.rows.filter((row) => 
        row.subjectType === "all" || 
        (row.subjectType === "team" && row.subjectId === teamLeaderTeamId) ||
        (row.subjectType === "user" && memberIds.has(row.subjectId))
      )
    }
    return report.rows
  }, [report?.rows, role, teamLeaderTeamId, userId, teams])

  useEffect(() => {
    if (!targetList) return
    setTargets(
      targetList.map((target) => ({
        subjectType: target.subjectType,
        subjectId: target.subjectType === "all" ? "all" : target.subjectId,
        metricKey: target.metricKey,
        targetValue: String(target.targetValue)
      }))
    )
  }, [targetList])

  if (!["owner", "team_leader", "sales"].includes(role || "")) {
    return <Card title="الأهداف">غير مصرح لك بالدخول إلى هذه الصفحة</Card>
  }

  return (
    <div className="space-y-6">
      {(role === "owner" || role === "team_leader") && (
        <Card title="إنشاء خطة أهداف">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
            <Input
              className="text-right"
              placeholder="اسم الخطة"
              value={planName}
              onChange={(event) => setPlanName(event.target.value)}
            />
            <Select
              className="text-right"
              value={period}
              onChange={(event) => setPeriod(event.target.value as "weekly" | "monthly")}
            >
              <option value="weekly">أسبوعي</option>
              <option value="monthly">شهري</option>
            </Select>
            <Button
              type="button"
              disabled={!planName.trim() || createPlanMutation.isPending}
              onClick={() => createPlanMutation.mutate()}
            >
              {createPlanMutation.isPending ? "جاري الإنشاء..." : "إنشاء"}
            </Button>
          </div>
          {role === "team_leader" && <p className="mt-3 text-xs text-base-500">قائد الفريق يحدد أهداف فريقه فقط</p>}
        </Card>
      )}

      <Card title="خطط الأهداف">
        <div className="space-y-2">
          {(plans || []).map((plan) => (
              <Button
                key={plan.id}
                variant="outline"
                className={`w-full justify-start text-right font-normal ${selectedPlanId === plan.id ? "border-brand-500 bg-base-50 ring-1 ring-brand-500" : "border-base-200"}`}
                onClick={() => {
                  setSelectedPlanId(plan.id)
                  setIsEditing(false)
                }}
              >
                {plan.name} ({plan.period === "weekly" ? "أسبوعي" : "شهري"})
              </Button>
            ))}
          {(plans || []).length === 0 && <p className="text-sm text-base-500">لا توجد خطط بعد</p>}
        </div>
      </Card>

      {(role === "owner" || role === "team_leader") && selectedPlanId && isEditing && (
        <Card title="إدارة أهداف الخطة">
          <div className="space-y-3">
            {targets.map((target, index) => (
              <div key={`${target.subjectType}-${index}`} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                <Select
                  className="text-right"
                  value={target.subjectType}
                  onChange={(event) => {
                    const next = [...targets]
                    next[index] = { ...next[index], subjectType: event.target.value as "user" | "team" | "all", subjectId: "" }
                    setTargets(next)
                  }}
                  disabled={role === "team_leader"}
                >
                  <option value="all">الكل</option>
                  <option value="user">مندوب</option>
                  <option value="team">فريق</option>
                </Select>
                <Select
                  aria-label="نوع الهدف"
                  className="text-right"
                  value={target.subjectId}
                  onChange={(event) => {
                    const next = [...targets]
                    next[index] = { ...next[index], subjectId: event.target.value }
                    setTargets(next)
                  }}
                  disabled={role === "team_leader" || target.subjectType === "all"}
                >
                  <option value="">اختيار</option>
                  {target.subjectType === "user" &&
                    (users || []).map((user) => (
                      <option key={user.id} value={user.id}>{user.name || user.email}</option>
                    ))}
                  {target.subjectType === "team" &&
                    (teams || []).map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                </Select>
                <Select
                  className="text-right"
                  value={target.metricKey}
                  onChange={(event) => {
                    const next = [...targets]
                    next[index] = { ...next[index], metricKey: event.target.value }
                    setTargets(next)
                  }}
                >
                  {Object.entries(metricLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Select>
                <Input
                  className="text-right"
                  placeholder="القيمة المستهدفة"
                  value={target.targetValue}
                  onChange={(event) => {
                    const next = [...targets]
                    next[index] = { ...next[index], targetValue: event.target.value }
                    setTargets(next)
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setTargets((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                >
                  حذف
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={role === "team_leader" && !teamLeaderTeamId}
                onClick={() =>
                  setTargets((prev) => [
                    ...prev,
                    {
                      subjectType: role === "team_leader" ? "team" : "user",
                      subjectId: role === "team_leader" ? teamLeaderTeamId || "" : "",
                      metricKey: "leads_created",
                      targetValue: ""
                    }
                  ])
                }
              >
                إضافة هدف
              </Button>
              <Button
                type="button"
                isLoading={saveTargetsMutation.isPending}
                disabled={!selectedPlanId || saveTargetsMutation.isPending || (role === "team_leader" && !teamLeaderTeamId)}
                onClick={() => saveTargetsMutation.mutate()}
              >
                {saveTargetsMutation.isPending ? "جاري الحفظ..." : "حفظ وإنهاء"}
              </Button>
              {role === "owner" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-rose-600 hover:bg-rose-50"
                  onClick={() => {
                    if (window.confirm("هل أنت متأكد من حذف هذه الخطة؟")) {
                      deletePlanMutation.mutate(selectedPlanId)
                    }
                  }}
                >
                  حذف الخطة
                </Button>
              )}
            </div>
            {message && (
              <div className={`mt-4 rounded-lg p-3 text-sm ${message.includes("نجاح") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {message}
              </div>
            )}
          </div>
        </Card>
      )}

      {selectedPlanId && report && (
        <Card title="تقرير الأهداف التراكمي">
          <div className="space-y-4">
            {!isEditing && (role === "owner" || role === "team_leader") && (
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => setIsEditing(true)}>
                  تعديل الأهداف
                </Button>
              </div>
            )}
            <Progress value={Math.round(report.periodProgress * 100)} />
                  <div className="space-y-3">
                    {visibleRows.map((row) => {
                      const isCompleted = row.status === "success"
                      return (
                        <div
                          key={row.id}
                          className={`rounded-lg border px-3 py-3 transition-colors ${
                            isCompleted ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500" : "border-base-100"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className={`text-sm font-semibold ${isCompleted ? "text-emerald-900" : "text-base-900"}`}>
                                {metricLabels[row.metricKey] || row.metricKey}
                                {isCompleted && <span className="mr-2 text-xs font-normal text-emerald-600">(مكتمل)</span>}
                              </p>
                              <p className={`text-xs ${isCompleted ? "text-emerald-700" : "text-base-500"}`}>
                                {row.actualValue.toLocaleString("ar-EG")} / {row.targetValue.toLocaleString("ar-EG")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold ${
                                row.status === "success" ? "text-emerald-600" :
                                row.status === "warning" ? "text-amber-600" : "text-rose-600"
                              }`}>
                                {row.ratio >= 1 ? "100%" : `${Math.round(row.ratio * 100)}%`}
                              </span>
                              {row.status === "success" && (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-2">
                            <Progress value={Math.round(row.score)} tone={isCompleted ? "success" : "brand"} />
                          </div>
                        </div>
                      )
                    })}
                    {visibleRows.length === 0 && <p className="text-sm text-base-500">لا توجد أهداف لهذا المستخدم حالياً</p>}
                  </div>
          </div>
        </Card>
      )}
    </div>
  )
}
