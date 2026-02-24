"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "../../../components/ui/Button"
import { LeadList } from "../../../components/dashboard/LeadList"
import { LeadCreateForm } from "../../../components/lead/LeadCreateForm"
import { Card } from "../../../components/ui/Card"
import { StageProgress } from "../../../components/lead/StageProgress"
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
    </div>
  )
}
