"use client"

import { useMemo, useState, useEffect } from "react"
import { useQueryClient, useMutation } from "@tanstack/react-query"
import { useLeads } from "../../lib/hooks/useLeads"
import { Badge } from "../ui/Badge"
import { Card } from "../ui/Card"
import { Progress } from "../ui/Progress"
import { Select } from "../ui/Select"
import { Button } from "../ui/Button"
import { Avatar } from "../ui/Avatar"
import { stageProgressMap } from "../../lib/utils/leadUtils"
import { useUsers } from "../../lib/hooks/useUsers"
import { useLeadDeadlines } from "../../lib/hooks/useLeadDeadlines"
import { useTeams } from "../../lib/hooks/useTeams"
import { useAuth } from "../../lib/auth/AuthContext"
import { leadService } from "../../lib/services/leadService"

import { StageProgress } from "../lead/StageProgress"
import { StageControls } from "../lead/StageControls"
import { useRouter } from "next/navigation"
import { Modal } from "../ui/Modal"
import { LeadDetail } from "../lead/LeadDetail"
import { STAGE_LABELS } from "../../lib/constants"

import { ExportButton } from "../ui/ExportButton"

export const LeadList = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const { data, isLoading, isError } = useLeads({ page, pageSize })

  const { data: users } = useUsers()
  const { data: deadlines } = useLeadDeadlines()
  const { data: teams } = useTeams()
  const { role, token, userId } = useAuth()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [teamFilter, setTeamFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all") // "all" | "wrong_number" | "new" | ...
  const [assignmentTargets, setAssignmentTargets] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)

  const usersById = new Map((users || []).map((user) => [user.id, user]))
  const deadlinesByLead = new Map((deadlines || []).map((item) => [item.leadId, item]))

  const filteredLeads = useMemo(() => {
    const base = (data || []).filter((lead) => {
      if (statusFilter !== "all") {
        if (statusFilter === "wrong_number") {
            if (!lead.isWrongNumber) return false
        } else if (lead.status !== statusFilter) {
            return false
        }
      }
      
      if (teamFilter !== "all" && (lead.teamId || "unassigned") !== teamFilter) return false
      if (userFilter !== "all") {
        if (userFilter === "unassigned") return !lead.assignedUserId
        return lead.assignedUserId === userFilter
      }
      return true
    })
    if (role === "sales") {
      return base.filter((lead) => lead.assignedUserId === userId)
    }
    if (role === "team_leader") {
      const myTeams = (teams || []).filter((item) => item.leaderUserId === userId)
      const myTeamIds = new Set(myTeams.map(t => t.id))
      const myMemberIds = new Set<string>()
      myTeams.forEach(t => t.members?.forEach(m => myMemberIds.add(m.userId)))

      return base.filter((lead) => {
        // Strict visibility: 
        // 1. Lead assigned to me
        // 2. Lead in one of my teams
        // 3. Lead assigned to a member of my team (even if teamId is missing on lead)
        if (lead.assignedUserId === userId) return true
        if (lead.teamId && myTeamIds.has(lead.teamId)) return true
        if (lead.assignedUserId && myMemberIds.has(lead.assignedUserId)) return true
        return false
      })
    }
    return base
  }, [data, role, teamFilter, teams, userFilter, userId, statusFilter])

  const assignMutation = useMutation({
    mutationFn: (payload: { leadId: string; userId: string }) =>
      leadService.assign(payload.leadId, { assignedUserId: payload.userId }, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      setMessage("تم تعيين العميل بنجاح")
    }
  })

  const unassignMutation = useMutation({
    mutationFn: (leadId: string) => leadService.unassign(leadId, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      setMessage("تم سحب العميل بنجاح")
    }
  })

  const stageMutation = useMutation({
    mutationFn: (payload: { id: string; stage: string }) => leadService.updateStage(payload.id, payload.stage, token || undefined),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["lead", variables.id] })
    }
  })

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Card title="إدارة العملاء المحتملين">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 border rounded-lg bg-base-50 animate-pulse">
              <div className="h-10 w-10 bg-base-200 rounded-full" />
              <div className="flex-1 px-4 space-y-2">
                <div className="h-4 w-32 bg-base-200 rounded" />
                <div className="h-3 w-24 bg-base-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card title="إدارة العملاء المحتملين">
      <div className="space-y-4">
        {isLoading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-base-100 p-4 bg-base-0">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 w-1/3 rounded bg-base-200" />
                  <div className="h-3 w-1/4 rounded bg-base-200" />
                  <div className="h-2 w-1/2 rounded bg-base-200" />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            <Select
              className="w-full sm:w-auto"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">كل الحالات</option>
              <option value="wrong_number">رقم خاطئ ⚠️</option>
              <option value="new">جديد</option>
              <option value="call">مكالمة هاتفية</option>
              <option value="meeting">اجتماع</option>
              <option value="site_visit">رؤية الموقع</option>
              <option value="closing">إغلاق الصفقة</option>
            </Select>

            {role === "owner" && (
              <>
              <Select
                className="w-full sm:w-auto"
                value={teamFilter}
                onChange={(event) => setTeamFilter(event.target.value)}
              >
                <option value="all">كل الفرق</option>
                <option value="unassigned">بدون فريق</option>
                {(teams || []).map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </Select>
              <Select
                containerClassName="w-full sm:w-auto"
                value={userFilter}
                onChange={(event) => setUserFilter(event.target.value)}
              >
                <option value="all">كل المستخدمين</option>
                <option value="unassigned">غير مُسند</option>
                {(users || []).map((user) => (
                  <option key={user.id} value={user.id}>{user.name || user.email}</option>
                ))}
              </Select>
              </>
            )}
          </div>
          <ExportButton 
             data={filteredLeads} 
             filename="leads_report" 
             headers={["الاسم", "رقم الهاتف", "الحالة", "كود العميل", "أقل ميزانية", "أعلى ميزانية", "الملاحظات"]}
             keys={["name", "phone", "status", "leadCode", "budgetMin", "budgetMax", "notes"]}
           />
        </div>
        {isLoading && <p className="text-sm text-base-500">جاري تحميل العملاء...</p>}
        {isError && <p className="text-sm text-rose-500">تعذر تحميل العملاء</p>}
        {message && <p className="text-sm text-emerald-600">{message}</p>}
        {filteredLeads.map((lead) => (
          <div key={lead.id} className="rounded-xl border border-base-100 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p 
                  className="text-sm font-semibold text-base-900 cursor-pointer hover:text-brand-600 transition-colors"
                  onClick={() => setSelectedLeadId(lead.id)}
                >
                  {lead.name}
                </p>
                {lead.isWrongNumber && (
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 mr-2 text-xs">
                    رقم خاطئ ⚠️
                  </Badge>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-xs text-base-500">مُسند إلى:</p>
                  {lead.assignedUserId ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar
                        size="xs"
                        name={usersById.get(lead.assignedUserId)?.name || usersById.get(lead.assignedUserId)?.email}
                      />
                      <span className="text-xs font-medium text-base-700">
                        {usersById.get(lead.assignedUserId)?.name || usersById.get(lead.assignedUserId)?.email}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-base-400">غير مُسند</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge>{STAGE_LABEL_MAP[lead.status] || lead.status}</Badge>
              </div>
            </div>
            {(role === "owner" || role === "team_leader") && (
              <div className="mt-4 flex flex-col sm:flex-row flex-wrap items-center gap-3">
                <Select
                  containerClassName="w-full sm:w-auto"
                  value={assignmentTargets[lead.id] ?? lead.assignedUserId ?? ""}
                  onChange={(event) => {
                    const val = event.target.value
                    setAssignmentTargets((prev) => ({ ...prev, [lead.id]: val }))
                    if (val && val !== lead.assignedUserId) {
                      assignMutation.mutate({ leadId: lead.id, userId: val })
                    }
                  }}
                >
                  <option value="">
                    {lead.assignedUserId 
                      ? usersById.get(lead.assignedUserId)?.name || usersById.get(lead.assignedUserId)?.email 
                      : "إسناد لمندوب"}
                  </option>
                  {(users || [])
                    .filter((u) => {
                      if (role === "owner") return true
                      if (role === "team_leader") {
                        const myTeams = (teams || []).filter(t => t.leaderUserId === userId)
                        const myTeamMemberIds = new Set(myTeams.flatMap(t => (t.members || []).map(m => m.userId)))
                        return myTeamMemberIds.has(u.id) || u.id === userId
                      }
                      return false
                    })
                    .map((u) => (
                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                </Select>
              </div>
            )}
            <div className="mt-4">
              <StageProgress
                stage={lead.status}
                readOnly={!(role === "owner" || role === "team_leader" || (role === "sales" && lead.assignedUserId === userId))}
                onStageChange={() => router.push(`/leads/${lead.id}`)}
              />
              {(role === "owner" || role === "team_leader" || (role === "sales" && lead.assignedUserId === userId)) && (
                <div className="mt-2">
                  <StageControls
                    currentStage={lead.status}
                    disabled={stageMutation.isPending}
                    onStageChange={(next) => {
                      stageMutation.mutate({ id: lead.id, stage: next })
                      router.push(`/leads/${lead.id}`)
                    }}
                  />
                </div>
              )}
            </div>
            {deadlinesByLead.get(lead.id)?.dueAt && (
              <div className="mt-3 text-xs text-base-500">
                المهلة المتبقية: <ClientDate 
                  date={deadlinesByLead.get(lead.id)?.dueAt || ""}
                  formatter={(d) => {
                    const diff = Math.max(0, d.getTime() - Date.now())
                    const hours = Math.floor(diff / 3600000)
                    const days = Math.floor(hours / 24)
                    const remainingHours = hours % 24
                    return `${days} يوم ${remainingHours} ساعة`
                  }}
                />
              </div>
            )}
          </div>
        ))}

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-base-500">عدد العناصر في الصفحة</span>
            <Select
              value={String(pageSize)}
              onChange={(e) => {
                const next = Number(e.target.value)
                setPageSize(next)
                setPage(1)
              }}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              onClick={() => setPage((p) => Math.max(1, p - 1))} 
              disabled={page <= 1 || isLoading}
            >
              السابق
            </Button>
            <span className="text-xs text-base-500">صفحة {page}</span>
            <Button 
              variant="ghost" 
              onClick={() => setPage((p) => p + 1)} 
              disabled={(data || []).length < pageSize || isLoading}
            >
              التالي
            </Button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={!!selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        title="تفاصيل العميل"
        size="2xl"
      >
        {selectedLeadId && <LeadDetail leadId={selectedLeadId} />}
      </Modal>
    </Card>
  )
}
