"use client"

import { useMemo, useState } from "react"
import { 
  DndContext, 
  DragOverlay, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  TouchSensor, 
  DragStartEvent, 
  DragEndEvent, 
  defaultDropAnimationSideEffects, 
  DropAnimation,
  useDraggable,
  useDroppable
} from '@dnd-kit/core';
import { Card } from "../ui/Card"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Lead, User } from "../../lib/types"
import { useLeads } from "../../lib/hooks/useLeads"
import { useUsers } from "../../lib/hooks/useUsers"
import { useTeams } from "../../lib/hooks/useTeams"
import { useAuth } from "../../lib/auth/AuthContext"
import { notificationService } from "../../lib/services/notificationService"
import { leadService } from "../../lib/services/leadService"
import { useMutation, useQueryClient, UseMutationResult } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

const stageLabels: Record<string, string> = {
  new: "جديد",
  call: "مكالمة هاتفية",
  meeting: "اجتماع",
  site_visit: "رؤية الموقع",
  closing: "إغلاق الصفقة"
}

const laneOrder = ["new", "call", "meeting", "site_visit", "closing"]

const KanbanLane = ({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id })
  
  return (
    <div 
      ref={setNodeRef} 
      className={`w-[85vw] max-w-[300px] flex-shrink-0 flex flex-col rounded-xl border border-base-200 bg-base-50/50 p-3 lg:w-[280px] transition-colors ${
        isOver ? "bg-brand-50 border-brand-300 ring-2 ring-brand-100" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h4 className="text-sm font-bold text-base-900 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            id === 'new' ? 'bg-blue-500' :
            id === 'call' ? 'bg-yellow-500' :
            id === 'meeting' ? 'bg-purple-500' :
            id === 'site_visit' ? 'bg-orange-500' :
            'bg-green-500'
          }`}></span>
          {title}
        </h4>
        <Badge variant="outline" className="bg-white shadow-sm border border-base-100 text-xs px-2 py-0.5 min-w-[24px] justify-center">{count}</Badge>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto min-h-[100px] scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-transparent pr-1 pl-1 -mr-1 -ml-1 py-1">
        {children}
      </div>
    </div>
  )
}

const KanbanCard = ({ lead, usersById, teamsById, role, notifyMutation, onDelete, disabled }: { 
  lead: Lead & { pipelineStage: string }; 
  usersById: Map<string, User>; 
  teamsById: Map<string, string>;
  role: string;
  notifyMutation: UseMutationResult<void, Error, { userId: string; leadName: string }, unknown>;
  onDelete: (id: string) => void;
  disabled?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled
  })
  const router = useRouter()
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  if (isDragging) {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className="opacity-30 rounded-lg border border-base-200 bg-white p-3 shadow-sm h-[120px]" 
      />
    )
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className="touch-manipulation group relative rounded-lg border border-base-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h5 className="text-sm font-semibold text-base-900 line-clamp-1" title={lead.name}>{lead.name}</h5>
          <p className="text-[10px] text-base-400 font-mono mt-0.5">{lead.leadCode}</p>
        </div>
        {lead.priority === 'high' && <span className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-full border border-rose-100">هام</span>}
      </div>
      
      <div className="text-xs text-base-500 space-y-1 mb-3">
        <div className="flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span className="truncate max-w-[140px]">
            {lead.assignedUserId ? usersById.get(lead.assignedUserId)?.name || usersById.get(lead.assignedUserId)?.email : "غير مُسند"}
          </span>
        </div>
        {lead.phone && (
          <div className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span dir="ltr">{lead.phone}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-base-50">
        {role === "owner" && (
          <button
             onPointerDown={(e) => e.stopPropagation()}
             onMouseDown={(e) => e.stopPropagation()}
             onTouchStart={(e) => e.stopPropagation()}
             onClick={(e) => {
               e.stopPropagation()
               if (confirm("هل أنت متأكد من نقل هذا العميل إلى سلة المهملات؟")) {
                 onDelete(lead.id)
               }
             }}
             className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
             title="نقل للمهملات"
           >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        )}
        <button
           onPointerDown={(e) => e.stopPropagation()}
           onMouseDown={(e) => e.stopPropagation()}
           onTouchStart={(e) => e.stopPropagation()}
           onClick={(e) => {
             e.stopPropagation()
             router.push(`/leads/${lead.id}`)
           }}
           className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
           title="تفاصيل العميل"
         >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        
        {lead.phone && (
           <a 
             href={`https://wa.me/${lead.phone.replace(/\D/g, "").replace(/^0/, "20")}`}
             target="_blank"
             rel="noopener noreferrer"
             onPointerDown={(e) => { e.stopPropagation() }}
             className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
             title="واتساب"
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
           </a>
        )}

        {(role === "owner" || role === "team_leader") && lead.assignedUserId && (
          <Button
            variant="ghost"
            className="h-7 w-7 rounded-full p-0 text-amber-600 hover:bg-amber-50"
            disabled={notifyMutation.isPending}
            onPointerDown={(e) => { e.stopPropagation() }}
            onClick={(e) => {
              e.stopPropagation()
              notifyMutation.mutate({ userId: lead.assignedUserId || "", leadName: lead.name })
            }}
            title="تنبيه المندوب"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          </Button>
        )}
      </div>
    </div>
  )
}

export const KanbanBoard = ({ leads }: { leads?: Lead[] }) => {
  const { data } = useLeads()
  const { data: users } = useUsers()
  const { data: teams } = useTeams()
  const { role, userId, token } = useAuth()
  const queryClient = useQueryClient()
  
  const usersById = useMemo(() => new Map((users || []).map((user) => [user.id, user])), [users])
  const teamsById = useMemo(() => new Map((teams || []).map((team) => [team.id, team.name])), [teams])

  // Drag sensors
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

  const [activeId, setActiveId] = useState<string | null>(null)

  // Mutations
  const updateStageMutation = useMutation({
    mutationFn: (payload: { id: string; stage: string }) =>
      leadService.updateStage(payload.id, payload.stage, token || undefined),
    onMutate: async (newLead) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["leads"] })

      // Snapshot the previous value
      const previousLeads = queryClient.getQueryData<Lead[]>(["leads", ""])

      // Optimistically update to the new value
      if (previousLeads) {
        queryClient.setQueryData<Lead[]>(["leads", ""], (old) => {
          if (!old) return []
          return old.map((lead) => 
            lead.id === newLead.id ? { ...lead, status: newLead.stage } : lead
          )
        })
      }

      // Return a context object with the snapshotted value
      return { previousLeads }
    },
    onError: (err, newLead, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousLeads) {
        queryClient.setQueryData<Lead[]>(["leads", ""], context.previousLeads)
      }
      notificationService.broadcast(
        { type: "user", value: userId || "" }, 
        "فشل تحديث مرحلة العميل", 
        ["in_app"], 
        token || undefined
      )
    },
    onSettled: () => {
      // Always refetch after error or success:
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    }
  })

  const notifyMutation = useMutation({
    mutationFn: async (payload: { userId: string; leadName: string }) => {
      await notificationService.broadcast(
        { type: "user", value: payload.userId },
        `مطلوب إجراء سريع بخصوص العميل ${payload.leadName}`,
        ["in_app", "push"],
        token || undefined
      )
    }
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadService.delete(id, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    }
  })

  // Filter leads
  const resolvedLeads = useMemo(() => {
    const filteredSource = leads || data || []
    let filtered = filteredSource

    if (role === "sales") {
      filtered = filtered.filter((l) => l.assignedUserId === userId)
    } else if (role === "team_leader") {
      const myTeams = (teams || []).filter((t) => t.leaderUserId === userId)
      const myTeamIds = new Set(myTeams.map(t => t.id))
      const myMemberIds = new Set<string>()
      myTeams.forEach(t => t.members?.forEach(m => myMemberIds.add(m.userId)))

      filtered = filtered.filter(
        (l) =>
          l.assignedUserId === userId ||
          (l.teamId && myTeamIds.has(l.teamId)) ||
          (l.assignedUserId && myMemberIds.has(l.assignedUserId))
      )
    }

    return filtered.map((lead) => ({
      ...lead,
      pipelineStage: lead.status // Use actual status as source of truth
    }))
  }, [leads, data, role, userId, teams])

  // Group by stage
  const lanes = useMemo(() => {
    return laneOrder.map((stage) => ({
      id: stage,
      title: stageLabels[stage] || stage,
      leads: resolvedLeads.filter((lead) => {
        // Fallback for empty status to 'new'
        const s = lead.status || 'new'
        return s === stage
      })
    }))
  }, [resolvedLeads])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const leadId = String(active.id)
    const newStage = String(over.id)
    
    // Find the lead to check current stage
    const lead = resolvedLeads.find(l => l.id === leadId)
    if (!lead) return

    if (lead.status !== newStage) {
      // Optimistic update could be done here if we had local state for leads
      // But for now we rely on mutation + invalidation
      updateStageMutation.mutate({ id: leadId, stage: newStage })
    }
  }

  const activeLead = activeId ? resolvedLeads.find(l => l.id === activeId) : null

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  }

  return (
    <Card title="قناة العملاء" className="bg-transparent border-none shadow-none p-0">
      <div className="h-full w-full overflow-x-auto pb-4">
        <DndContext 
          sensors={sensors} 
          onDragStart={handleDragStart} 
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 w-max px-2 lg:w-full lg:grid lg:grid-cols-5 lg:gap-4 lg:px-0 items-start h-full">
            {lanes.map((lane) => (
              <KanbanLane key={lane.id} id={lane.id} title={lane.title} count={lane.leads.length}>
                {lane.leads.map((lead) => (
                  <KanbanCard 
            key={lead.id} 
            lead={lead} 
            usersById={usersById} 
            teamsById={teamsById} 
            role={role || ""}
            notifyMutation={notifyMutation}
            onDelete={(id) => deleteMutation.mutate(id)}
            disabled={role === "owner"}
          />
                ))}
              </KanbanLane>
            ))}
          </div>

          <DragOverlay dropAnimation={dropAnimation}>
            {activeLead ? (
              <div className="rotate-2 cursor-grabbing opacity-90 w-[280px]">
                 <div className="rounded-lg border border-brand-200 bg-white p-3 shadow-xl">
                    <h5 className="text-sm font-semibold text-base-900">{activeLead.name}</h5>
                    <p className="text-xs text-base-500 mt-1">{activeLead.leadCode}</p>
                 </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </Card>
  )
}
