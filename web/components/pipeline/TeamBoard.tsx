"use client"

import { ReactNode, useMemo } from "react"
import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Card } from "../ui/Card"
import { Badge } from "../ui/Badge"
import { useTeams } from "../../lib/hooks/useTeams"
import { useUsers } from "../../lib/hooks/useUsers"
import { useAuth } from "../../lib/auth/AuthContext"
import { leadService } from "../../lib/services/leadService"
import { Lead } from "../../lib/types"
import { useLeads } from "../../lib/hooks/useLeads"

const Lane = ({ id, title, count, children, isDisabled }: { id: string; title: string; count: number; children: ReactNode; isDisabled?: boolean }) => {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: isDisabled })
  return (
    <div ref={setNodeRef} className={`min-w-[240px] rounded-2xl border border-base-100 bg-base-50 p-4 ${isOver ? "ring-2 ring-brand-500" : ""}`}>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-base-900">{title}</h4>
        <Badge>{count}</Badge>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

const LeadCard = ({ id, name, code, owner }: { id: string; name: string; code?: string | null; owner?: string | null }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`touch-ripple rounded-xl border border-base-100 bg-white p-3 ${isDragging ? "opacity-60" : ""}`}
    >
      <p className="text-sm font-semibold text-base-900">{name}</p>
      <p className="text-xs text-base-500">{code}</p>
      {owner && <p className="text-[11px] text-base-500">مسند إلى: {owner}</p>}
    </div>
  )
}

export const TeamBoard = ({ leads }: { leads?: Lead[] }) => {
  const { data: teams } = useTeams()
  const { data } = useLeads()
  const { data: users } = useUsers()
  const { role, userId, token } = useAuth()
  const queryClient = useQueryClient()
  const resolvedLeads = leads || data || []
  const usersById = useMemo(() => new Map((users || []).map((user) => [user.id, user])), [users])

  const userTeamId = useMemo(() => {
    if (role !== "team_leader") return null
    return (teams || []).find((team) => team.leaderUserId === userId)?.id || null
  }, [role, teams, userId])

  const mutation = useMutation({
    mutationFn: (payload: { leadId: string; teamId: string | null }) =>
      leadService.update(payload.leadId, { teamId: payload.teamId, assignedUserId: null }, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    }
  })

  const scopedLeads = useMemo(() => {
    if (role !== "team_leader") return resolvedLeads
    const leaderTeam = (teams || []).find((team) => team.leaderUserId === userId)
    if (!leaderTeam) return []
    const memberIds = new Set((leaderTeam.members || []).map((member) => member.userId))
    return resolvedLeads.filter((lead) => lead.teamId === leaderTeam.id || (lead.assignedUserId ? memberIds.has(lead.assignedUserId) : false))
  }, [resolvedLeads, role, teams, userId])

  const lanes = useMemo(() => {
    const all = teams || []
    const lanes = [{ id: "unassigned", title: "غير مسند" }, ...all.map((team) => ({ id: team.id, title: team.name }))]
    return lanes.map((lane) => ({
      ...lane,
      leads: scopedLeads.filter((lead) => (lane.id === "unassigned" ? !lead.teamId : lead.teamId === lane.id))
    }))
  }, [scopedLeads, teams])

  if (role === "sales") return null

  const handleDragEnd = (event: DragEndEvent) => {
    const leadId = String(event.active.id || "")
    const overId = event.over?.id ? String(event.over.id) : ""
    if (!leadId || !overId) return
    const targetTeamId = overId === "unassigned" ? null : overId
    if (role === "team_leader" && userTeamId && targetTeamId !== userTeamId) return
    mutation.mutate({ leadId, teamId: targetTeamId })
  }

  return (
    <Card title="لوحة العملاء حسب الفريق">
      <div className="overflow-x-auto">
        <DndContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 pb-2">
            {lanes.map((lane) => (
              <Lane key={lane.id} id={lane.id} title={lane.title} count={lane.leads.length} isDisabled={role === "team_leader" && userTeamId !== lane.id && lane.id !== "unassigned"}>
                {lane.leads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    id={lead.id}
                    name={lead.name}
                    code={lead.leadCode}
                    owner={lead.assignedUserId ? usersById.get(lead.assignedUserId)?.name || usersById.get(lead.assignedUserId)?.email : "غير مُسند"}
                  />
                ))}
              </Lane>
            ))}
          </div>
        </DndContext>
      </div>
    </Card>
  )
}
