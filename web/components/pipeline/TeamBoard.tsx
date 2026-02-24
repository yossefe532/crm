"use client"

import { ReactNode, useMemo } from "react"
import { DndContext, DragEndEvent, useDraggable, useDroppable, useSensor, useSensors, PointerSensor, TouchSensor } from "@dnd-kit/core"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Card } from "../ui/Card"
import { Badge } from "../ui/Badge"
import { useTeams } from "../../lib/hooks/useTeams"
import { useUsers } from "../../lib/hooks/useUsers"
import { useAuth } from "../../lib/auth/AuthContext"
import { leadService } from "../../lib/services/leadService"
import { Lead } from "../../lib/types"
import { useLeads } from "../../lib/hooks/useLeads"
import { useRouter } from "next/navigation"

const Lane = ({ id, title, count, children, isDisabled }: { id: string; title: string; count: number; children: ReactNode; isDisabled?: boolean }) => {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: isDisabled })
  return (
    <div ref={setNodeRef} className={`w-[85vw] max-w-[320px] flex-shrink-0 snap-center rounded-2xl border border-base-100 bg-base-50 p-4 lg:w-80 md:flex-shrink-0 ${isOver ? "ring-2 ring-brand-500" : ""}`}>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-base-900">{title}</h4>
        <Badge>{count}</Badge>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

const LeadCard = ({ id, name, code, owner, role, onDelete }: { id: string; name: string; code?: string | null; owner?: string | null; role?: string; onDelete?: (id: string) => void }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  const router = useRouter()
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`touch-ripple rounded-xl border border-base-100 bg-white p-3 ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-base-900 truncate max-w-[120px]">{name}</p>
        <p className="text-xs text-base-500">{code}</p>
      </div>
      {owner && <p className="text-[11px] text-base-500 mt-1 truncate">مسند إلى: {owner}</p>}
      <div className="mt-3 flex justify-end gap-2">
        {role === "owner" && onDelete && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              if (confirm("هل أنت متأكد من نقل هذا العميل إلى سلة المهملات؟")) {
                onDelete(id)
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            title="نقل للمهملات"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/leads/${id}`)
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
          title="تفاصيل العميل"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export const TeamBoard = ({ leads }: { leads?: Lead[] }) => {
  const { data: teams } = useTeams()
  const { data } = useLeads()
  const { data: users } = useUsers()
  const { role, userId, token } = useAuth()
  const queryClient = useQueryClient()
  const resolvedLeads = useMemo(() => leads || data || [], [leads, data])
  const usersById = useMemo(() => new Map((users || []).map((user) => [user.id, user])), [users])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadService.delete(id, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    }
  })

  const userTeamId = useMemo(() => {
    if (role !== "team_leader") return null
    return (teams || []).find((team) => team.leaderUserId === userId)?.id || null
  }, [role, teams, userId])

  const mutation = useMutation({
    mutationFn: (payload: { leadId: string; teamId: string | null }) =>
      leadService.update(payload.leadId, { teamId: payload.teamId, assignedUserId: null }, token || undefined),
    onMutate: async (newAssignment) => {
      await queryClient.cancelQueries({ queryKey: ["leads"] })
      const previousLeads = queryClient.getQueryData<Lead[]>(["leads", ""])
      
      if (previousLeads) {
        queryClient.setQueryData<Lead[]>(["leads", ""], (old) => {
          if (!old) return []
          return old.map((lead) => 
            lead.id === newAssignment.leadId 
              ? { ...lead, teamId: newAssignment.teamId, assignedUserId: null } 
              : lead
          )
        })
      }
      return { previousLeads }
    },
    onError: (err, newAssignment, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData<Lead[]>(["leads", ""], context.previousLeads)
      }
    },
    onSettled: () => {
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  )

  const lanes = useMemo(() => {
    // 1. Get leads for the current user/role scope
    const scopedLeads = resolvedLeads.filter((lead) => {
      if (role === "sales") return lead.assignedUserId === userId
      if (role === "team_leader") {
        // TL sees leads assigned to their team
        // If lead has teamId matching userTeamId, show it
        return lead.teamId === userTeamId
      }
      return true // owner sees all
    })

    // 2. Map teams to lanes
    // Always include "Unassigned" lane first
    const unassignedLane = { id: "unassigned", title: "غير معين", leads: [], count: 0 }
    
    // For TL, only show their team lane + unassigned
    // For Owner, show all team lanes + unassigned
    let teamLanes: any[] = []
    
    if (role === "team_leader") {
      const myTeam = teams?.find(t => t.id === userTeamId)
      if (myTeam) {
        teamLanes = [{ id: myTeam.id, title: myTeam.name, leads: [], count: 0 }]
      }
    } else {
      teamLanes = (teams || []).map(team => ({
        id: team.id,
        title: team.name,
        leads: [],
        count: 0
      }))
    }

    const lanes = [unassignedLane, ...teamLanes]

    return lanes.map((lane) => {
      const laneLeads = scopedLeads.filter((lead) => {
        if (lane.id === "unassigned") return !lead.teamId
        return lead.teamId === lane.id
      })
      return {
        ...lane,
        leads: laneLeads,
        count: laneLeads.length
      }
    })
  }, [resolvedLeads, teams, role, userId, userTeamId])

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
      <div className="overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 w-max px-4">
            {lanes.map((lane) => (
              <Lane key={lane.id} id={lane.id} title={lane.title} count={lane.leads.length} isDisabled={role === "team_leader" && userTeamId !== lane.id && lane.id !== "unassigned"}>
                {lane.leads.map((lead: Lead) => (
                  <LeadCard
                    key={lead.id}
                    id={lead.id}
                    name={lead.name}
                    code={lead.leadCode}
                    owner={lead.assignedUserId ? usersById.get(lead.assignedUserId)?.name || usersById.get(lead.assignedUserId)?.email : "غير مُسند"}
                    role={role || undefined}
                    onDelete={(id) => deleteMutation.mutate(id)}
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
