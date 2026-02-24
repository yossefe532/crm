"use client"

import { useState, useMemo } from "react"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { Avatar } from "../ui/Avatar"
import { Select } from "../ui/Select"
import { Team, User } from "../../lib/types"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { coreService } from "../../lib/services/coreService"
import { Users, UserMinus, Calendar, BarChart3, ShieldAlert } from "lucide-react"
import { toast } from "react-hot-toast"
import { useUsers } from "../../lib/hooks/useUsers"
import { useLeads } from "../../lib/hooks/useLeads"

interface TeamDetailsModalProps {
  team: Team
  isOpen: boolean
  onClose: () => void
}

export const TeamDetailsModal = ({ team, isOpen, onClose }: TeamDetailsModalProps) => {
  const queryClient = useQueryClient()
  const { data: users } = useUsers()
  const { data: leads } = useLeads()
  
  const [isEditingLeader, setIsEditingLeader] = useState(false)
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>("")

  // Calculate analytics
  const memberCount = team.members?.length || 0
  
  const teamStats = useMemo(() => {
      if (!leads) return { total: 0, won: 0, lost: 0, active: 0 }
      
      const memberIds = team.members?.map(m => m.userId) || []
      const teamLeads = leads.filter(lead => 
          (lead.assignedUserId && memberIds.includes(lead.assignedUserId)) || 
          lead.teamId === team.id
      )
      
      return {
          total: teamLeads.length,
          won: teamLeads.filter(l => l.status === "won").length,
          lost: teamLeads.filter(l => l.status === "lost" || l.status === "archive").length,
          active: teamLeads.filter(l => l.status !== "won" && l.status !== "lost" && l.status !== "archive").length
      }
  }, [leads, team])
  
  const createdAt = team.createdAt ? new Date(team.createdAt).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }) : "غير معروف"

  const promoteMutation = useMutation({
    mutationFn: (userId: string) => coreService.updateTeam(team.id, { leaderUserId: userId }), 
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      queryClient.invalidateQueries({ queryKey: ["users"] })
      setIsEditingLeader(false)
      toast.success("تم تغيير قائد الفريق بنجاح")
    },
    onError: () => {
        toast.error("حدث خطأ أثناء تغيير قائد الفريق")
    }
  })

  const handleUpdateLeader = () => {
    if (!selectedLeaderId) return
    promoteMutation.mutate(selectedLeaderId)
  }

  // Candidates for new leader: All users who are not currently leaders or in other teams (or maybe just anyone eligible)
  // For simplicity, let's allow selecting from current members or available users.
  const leaderCandidates = users?.filter(u => 
    !u.roles?.includes("team_leader") && !u.roles?.includes("owner")
  ) || []

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`تفاصيل فريق: ${team.name}`}>
      <div className="space-y-6">
        {/* Header Info */}
        <div className="flex items-center justify-between bg-base-50 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-100 rounded-full text-brand-600">
                <Users className="h-6 w-6" />
            </div>
            <div>
                <h3 className="font-bold text-lg text-base-900">{team.name}</h3>
                <div className="flex items-center gap-2 text-sm text-base-500">
                    <Calendar className="h-3 w-3" />
                    <span>تم الإنشاء: {createdAt}</span>
                </div>
            </div>
          </div>
          <div className="text-center">
             <div className="text-2xl font-bold text-brand-600">{memberCount}</div>
             <div className="text-xs text-base-500">أعضاء</div>
          </div>
        </div>
        
        {/* Analytics Section */}
        <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-3 bg-base-50 rounded-lg">
                <div className="text-xl font-bold text-base-900">{teamStats.total}</div>
                <div className="text-xs text-base-500">إجمالي العملاء</div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg">
                <div className="text-xl font-bold text-emerald-600">{teamStats.won}</div>
                <div className="text-xs text-emerald-700">ناجحة</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-xl font-bold text-blue-600">{teamStats.active}</div>
                <div className="text-xs text-blue-700">جارية</div>
            </div>
            <div className="p-3 bg-rose-50 rounded-lg">
                <div className="text-xl font-bold text-rose-600">{teamStats.lost}</div>
                <div className="text-xs text-rose-700">خسارة</div>
            </div>
        </div>

        {/* Leader Section */}
        <div className="border border-base-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-base-900">قائد الفريق</h4>
                {!isEditingLeader && (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingLeader(true)}>
                        تغيير القائد
                    </Button>
                )}
            </div>
            
            {isEditingLeader ? (
                <div className="flex gap-2">
                    <Select 
                        value={selectedLeaderId} 
                        onChange={(e) => setSelectedLeaderId(e.target.value)}
                        className="flex-1"
                    >
                        <option value="">اختر قائد جديد...</option>
                        {leaderCandidates.map(u => (
                            <option key={u.id} value={u.id}>{u.name || u.email}</option>
                        ))}
                    </Select>
                    <Button 
                        variant="primary" 
                        disabled={!selectedLeaderId || promoteMutation.isPending}
                        onClick={handleUpdateLeader}
                    >
                        حفظ
                    </Button>
                    <Button variant="ghost" onClick={() => setIsEditingLeader(false)}>إلغاء</Button>
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    <Avatar name={team.leader?.name || team.leader?.email} />
                    <div>
                        <p className="font-medium text-base-900">{team.leader?.name || team.leader?.email || "غير محدد"}</p>
                        <p className="text-xs text-base-500">{team.leader?.email}</p>
                    </div>
                </div>
            )}
        </div>

        {/* Members List */}
        <div>
            <h4 className="font-semibold text-sm text-base-900 mb-3">أعضاء الفريق</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {team.members?.map(member => {
                    const memberLeadsCount = leads?.filter(l => l.assignedUserId === member.userId).length || 0
                    return (
                    <div key={member.id} className="flex items-center justify-between p-2 hover:bg-base-50 rounded-lg border border-base-100">
                        <div className="flex items-center gap-3">
                            <Avatar name={member.user?.name || member.user?.email} size="sm" />
                            <div>
                                <p className="text-sm font-medium text-base-900">{member.user?.name || member.user?.email}</p>
                                <span className="text-xs text-base-500">{member.role === "leader" ? "قائد" : "عضو"}</span>
                            </div>
                        </div>
                        <div className="text-xs font-medium bg-base-100 px-2 py-1 rounded text-base-600">
                            {memberLeadsCount} عميل
                        </div>
                    </div>
                )})}
                {(!team.members || team.members.length === 0) && (
                    <p className="text-sm text-base-500 text-center py-4">لا يوجد أعضاء في هذا الفريق</p>
                )}
            </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between pt-4 border-t border-base-200">
            <Button variant="danger" onClick={() => deleteTeamMutation.mutate()} className="gap-2">
                <ShieldAlert className="h-4 w-4" />
                حذف الفريق
            </Button>
            <Button variant="secondary" onClick={onClose}>
                إغلاق
            </Button>
        </div>
      </div>
    </Modal>
  )
}
