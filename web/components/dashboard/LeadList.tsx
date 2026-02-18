"use client"

import { useMemo, useState } from "react"
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

export const LeadList = () => {
  const { data, isLoading, isError } = useLeads()
  const { data: users } = useUsers()
  const { data: deadlines } = useLeadDeadlines()
  const { data: teams } = useTeams()
  const { role, token, userId } = useAuth()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [teamFilter, setTeamFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("all")
  const [assignmentTargets, setAssignmentTargets] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const stageLabelMap: Record<string, string> = {
    new: "جديد",
    call: "مكالمة هاتفية",
    meeting: "اجتماع",
    site_visit: "رؤية الموقع",
    closing: "إغلاق الصفقة"
  }
  const usersById = new Map((users || []).map((user) => [user.id, user]))
  const deadlinesByLead = new Map((deadlines || []).map((item) => [item.leadId, item]))

  const filteredLeads = useMemo(() => {
    const base = (data || []).filter((lead) => {
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
      return base.filter((lead) => {
        // Strict visibility: 
        // 1. Lead assigned to me
        // 2. Lead in one of my teams
        // 3. Lead assigned to a member of my team (even if teamId is missing on lead) - this is handled by backend but good to have here
        if (lead.assignedUserId === userId) return true
        if (lead.teamId && myTeamIds.has(lead.teamId)) return true
        return false
      })
    }
    return base
  }, [data, role, teamFilter, teams, userFilter, userId])

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
    mutationFn: (payload: { id: string; stage: string }) => leadService.updateStage(payload.id, payload.stage),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["lead", variables.id] })
    }
  })

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
        {role === "owner" && (
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
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
          </div>
        )}
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
                <Badge>{stageLabelMap[lead.status] || lead.status}</Badge>
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
                readOnly={!(role === "sales" && lead.assignedUserId === userId)}
                onStageChange={() => router.push(`/leads/${lead.id}`)}
              />
              {(role === "sales" && lead.assignedUserId === userId) && (
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
                المهلة المتبقية: {(() => {
                  const dueAt = new Date(deadlinesByLead.get(lead.id)?.dueAt || "")
                  const diff = Math.max(0, dueAt.getTime() - Date.now())
                  const hours = Math.floor(diff / 3600000)
                  const days = Math.floor(hours / 24)
                  const remainingHours = hours % 24
                  return `${days} يوم ${remainingHours} ساعة`
                })()}
              </div>
            )}
          </div>
        ))}
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
