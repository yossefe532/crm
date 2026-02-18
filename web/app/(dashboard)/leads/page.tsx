"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "../../../components/ui/Button"
import { LeadList } from "../../../components/dashboard/LeadList"
import { LeadCreateForm } from "../../../components/lead/LeadCreateForm"
import { Card } from "../../../components/ui/Card"
import { StageProgress } from "../../../components/lead/StageProgress"
import { StageControls } from "../../../components/lead/StageControls"
import { useLeads } from "../../../lib/hooks/useLeads"
import { useUsers } from "../../../lib/hooks/useUsers"
import { useTeams } from "../../../lib/hooks/useTeams"
import { useAuth } from "../../../lib/auth/AuthContext"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { leadService } from "../../../lib/services/leadService"

export default function LeadsPage() {
  const { data, isLoading, isError, refetch } = useLeads()
  const { data: users } = useUsers()
  const { data: teams } = useTeams()
  const { role, userId } = useAuth()
  const usersById = new Map((users || []).map((user) => [user.id, user]))
  const router = useRouter()
  const queryClient = useQueryClient()
  const stageMutation = useMutation({
    mutationFn: (payload: { id: string; stage: string }) => leadService.updateStage(payload.id, payload.stage),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["lead", variables.id] })
    }
  })

  const leaderTeams = (teams || []).filter((t) => t.leaderUserId === userId).map((t) => t.id)
  const allowedLeads = (data || []).filter((lead) => {
    if (role === "owner") return true
    if (role === "team_leader") return (leaderTeams.length > 0 && leaderTeams.includes(String(lead.teamId || ""))) || lead.assignedUserId === userId
    return lead.assignedUserId === userId
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-base-900">إدارة العملاء</h1>
        <Button 
          variant="ghost"
          onClick={() => refetch()} 
          className="text-sm text-primary-600 hover:underline p-0 h-auto hover:bg-transparent"
        >
          تحديث البيانات
        </Button>
      </div>

      <LeadCreateForm />
      <LeadList />
      
      <Card title="تقدّم مراحل العملاء">
        <div className="space-y-4">
          {isLoading && <p className="text-center text-sm text-base-500 py-4">جاري تحميل مراحل العملاء...</p>}
          
          {isError && (
            <div className="text-center py-4">
              <p className="text-sm text-red-500 mb-2">تعذر تحميل بيانات المراحل</p>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => refetch()} 
              >
                إعادة المحاولة
              </Button>
            </div>
          )}

          {!isLoading && !isError && allowedLeads.length === 0 && (
            <p className="text-center text-sm text-base-500 py-4">لا يوجد عملاء متاحين حالياً</p>
          )}

          {allowedLeads.map((lead) => (
            <div key={lead.id} className="flex flex-col gap-2 rounded-xl border border-base-100 p-4">

              <div className="flex items-center justify-between">
                <Link href={`/leads/${lead.id}`} className="text-sm font-semibold text-base-900">{lead.name}</Link>
                <span className="text-xs text-base-500">{usersById.get(lead.assignedUserId || "")?.name || usersById.get(lead.assignedUserId || "")?.email || "غير مُسند"}</span>
              </div>
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
          ))}
        </div>
      </Card>
    </div>
  )
}
