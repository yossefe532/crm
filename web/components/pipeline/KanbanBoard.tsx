"use client"

import { useMemo } from "react"
import { Card } from "../ui/Card"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Lead } from "../../lib/types"
import { useLeads } from "../../lib/hooks/useLeads"
import { useUsers } from "../../lib/hooks/useUsers"
import { useTeams } from "../../lib/hooks/useTeams"
import { useAuth } from "../../lib/auth/AuthContext"
import { notificationService } from "../../lib/services/notificationService"
import { useMutation } from "@tanstack/react-query"
import Link from "next/link"

const stageLabels: Record<string, string> = {
  new: "جديد",
  call: "مكالمة هاتفية",
  meeting: "اجتماع",
  site_visit: "رؤية الموقع",
  closing: "إغلاق الصفقة"
}

const laneOrder = ["new", "call", "meeting", "site_visit", "closing"]

export const KanbanBoard = ({ leads }: { leads?: Lead[] }) => {
  const { data } = useLeads()
  const { data: users } = useUsers()
  const { data: teams } = useTeams()
  const { role, userId } = useAuth()
  const usersById = useMemo(() => new Map((users || []).map((user) => [user.id, user])), [users])
  const teamsById = useMemo(() => new Map((teams || []).map((team) => [team.id, team.name])), [teams])
  const notifyMutation = useMutation({
    mutationFn: (payload: { userId: string; leadName: string }) =>
      notificationService.broadcast({ type: "user", value: payload.userId }, `مطلوب إجراء سريع بخصوص العميل ${payload.leadName}`, ["in_app"])
  })

  const resolvedLeads = useMemo(() => {
    const filteredSource = leads || data || []
    let filtered = filteredSource

    if (role === "sales") {
      filtered = filtered.filter((l) => l.assignedUserId === userId)
    } else if (role === "team_leader") {
      const myTeam = (teams || []).find((t) => t.leaderUserId === userId)
      if (myTeam) {
        const memberIds = new Set((myTeam.members || []).map((m) => m.userId))
        filtered = filtered.filter(
          (l) =>
            l.teamId === myTeam.id ||
            (l.assignedUserId ? memberIds.has(l.assignedUserId) : false) ||
            l.assignedUserId === userId
        )
      } else {
        filtered = filtered.filter((l) => l.assignedUserId === userId)
      }
    }

    return filtered.map((lead) => ({
      ...lead,
      pipelineStage: (lead.callCount || 0) === 0 ? "new" : lead.status
    }))
  }, [leads, data, role, userId, teams])

  const lanes = laneOrder.map((stage) => ({
    id: stage,
    title: stageLabels[stage] || stage,
    leads: resolvedLeads.filter((lead) => lead.pipelineStage === stage)
  }))

  return (
    <Card title="قناة العملاء">
      <div className="overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
        <div className="flex gap-4 lg:grid lg:grid-cols-5 w-max lg:w-full px-3 lg:px-0">
          {lanes.map((lane) => (
            <div key={lane.id} className="w-[92vw] max-w-[360px] flex-shrink-0 snap-center rounded-xl border border-base-100 bg-base-50 p-3 lg:w-auto first:ml-0 last:mr-0">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-base-900">{lane.title}</h4>
                <Badge>{lane.leads.length}</Badge>
              </div>
              <div className="space-y-3">
                {lane.leads.map((lead) => (
                  <div key={lead.id} className="touch-ripple rounded-lg border border-base-100 bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-base-900">{lead.name}</p>
                      <span className="text-xs text-base-500">{lead.leadCode}</span>
                    </div>
                    <p className="truncate text-xs text-base-500">
                      {lead.assignedUserId ? usersById.get(lead.assignedUserId)?.name || usersById.get(lead.assignedUserId)?.email : "غير مُسند"}
                      {lead.teamId && teamsById.get(lead.teamId) ? ` • فريق ${teamsById.get(lead.teamId)}` : ""}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Link href={`/leads/${lead.id}`} className="rounded-md bg-brand-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-brand-700 transition-colors">
                        تفاصيل
                      </Link>
                      {(role === "owner" || role === "team_leader") && lead.assignedUserId && (
                        <Button
                          variant="ghost"
                          className="h-auto px-2 py-1 text-[11px] text-brand-600 hover:bg-brand-50 hover:text-brand-700"
                          disabled={notifyMutation.isPending}
                          onClick={() => notifyMutation.mutate({ userId: lead.assignedUserId || "", leadName: lead.name })}
                        >
                          تنبيه المندوب
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
