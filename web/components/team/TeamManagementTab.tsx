"use client"

import { useState, useMemo } from "react"
import { useAuth } from "../../lib/auth/AuthContext"
import { useTeams } from "../../lib/hooks/useTeams"
import { useUsers } from "../../lib/hooks/useUsers"
import { useLeads } from "../../lib/hooks/useLeads"
import { coreService } from "../../lib/services/coreService"
import { analyticsService } from "../../lib/services/analyticsService"
import { goalsService } from "../../lib/services/goalsService"
import { notificationService } from "../../lib/services/notificationService"
import { conversationService } from "../../lib/services/conversationService"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"
import { Avatar } from "../ui/Avatar"
import { Modal } from "../ui/Modal"
import { UserCreateForm } from "../users/UserCreateForm"
import { Users, UserMinus, Edit2, Check, X, TrendingUp, Target, Award, ArrowUpRight, Clock, Bell, MessageCircle } from "lucide-react"
import { toast } from "react-hot-toast"
import { format, differenceInDays } from "date-fns"
import { ar } from "date-fns/locale"

export const TeamManagementTab = () => {
  const { userId, role, token } = useAuth()
  const { data: teams } = useTeams()
  const { data: users } = useUsers()
  const { leads } = useLeads({ pageSize: 100 }) // Fetch enough leads to find stuck ones
  const queryClient = useQueryClient()

  const [isEditingName, setIsEditingName] = useState(false)
  const [newName, setNewName] = useState("")
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)

  // Find the team managed by the current user
  const myTeam = useMemo(() => {
    return teams?.find(t => t.leaderUserId === userId)
  }, [teams, userId])

  // Initialize newName when team loads
  useMemo(() => {
    if (myTeam && !newName) {
      setNewName(myTeam.name)
    }
  }, [myTeam])

  // Analytics Query
  const { data: analytics } = useQuery({
    queryKey: ["dashboard-metrics", "team-tab"],
    queryFn: () => analyticsService.getDashboardMetrics(token || undefined),
    enabled: !!token && !!myTeam
  })

  // Goals Query
  const { data: goalsOverview } = useQuery({
    queryKey: ["goals-overview", "monthly"],
    queryFn: () => goalsService.overview("monthly", token || undefined),
    enabled: !!token && !!myTeam
  })

  // Merge Analytics with Team Members
  const memberStats = useMemo(() => {
    if (!myTeam || !users) return []

    const performanceMap = new Map(analytics?.salesPerformance?.map(p => [p.userId, p]) || [])

    const stats = (myTeam.members || []).map(member => {
      const perf = performanceMap.get(member.userId)
      const user = users.find(u => u.id === member.userId)
      
      return {
        userId: member.userId,
        name: user?.name || user?.email || "Unknown",
        email: user?.email,
        role: member.role,
        deals: perf?.deals || 0,
        value: perf?.value || 0,
        total: perf?.total || 0,
        conversionRate: perf?.conversionRate || 0,
        avatar: user?.profile?.avatar
      }
    })

    return stats.sort((a, b) => b.deals - a.deals) // Sort by won deals (most active)
  }, [myTeam, users, analytics])

  // Get Top Performer
  const topPerformer = useMemo(() => {
    if (memberStats.length === 0) return null
    return memberStats[0]
  }, [memberStats])

  // Identify Stuck Leads (No update for > 3 days)
  const stuckLeads = useMemo(() => {
    if (!leads || !myTeam) return []
    const thresholdDate = new Date()
    thresholdDate.setDate(thresholdDate.getDate() - 3)

    return leads.filter(lead => {
      // Must be assigned to a team member (not unassigned)
      if (!lead.assignedUserId) return false
      // Exclude leads assigned to self (optional, but usually you remind others)
      // if (lead.assignedUserId === userId) return false 
      
      const lastUpdate = new Date(lead.updatedAt)
      return lastUpdate < thresholdDate && lead.status !== "won" && lead.status !== "lost" && lead.status !== "archived"
    }).map(lead => {
        const assignedUser = users?.find(u => u.id === lead.assignedUserId)
        return { ...lead, assignedUser }
    })
  }, [leads, myTeam, users])

  // Mutations
  const updateTeamMutation = useMutation({
    mutationFn: (name: string) => {
      if (!myTeam) throw new Error("No team found")
      return coreService.updateTeam(myTeam.id, { name })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      setIsEditingName(false)
      toast.success("تم تحديث اسم الفريق بنجاح")
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "فشل تحديث اسم الفريق")
    }
  })

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => {
      if (!myTeam) throw new Error("No team found")
      return coreService.removeTeamMember(myTeam.id, memberId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success("تم إزالة العضو من الفريق")
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "فشل إزالة العضو")
    }
  })

  const remindMemberMutation = useMutation({
    mutationFn: async ({ userId, leadId, leadName }: { userId: string, leadId: string, leadName: string }) => {
        if (!myTeam) throw new Error("No team found")
        return coreService.remindTeamMember(myTeam.id, { userId, leadId, leadName })
    },
    onSuccess: () => {
        toast.success("تم إرسال التذكير بنجاح")
    },
    onError: (err: any) => {
        toast.error(err?.response?.data?.message || "فشل إرسال التذكير")
    }
  })

  if (!myTeam) {
    return (
      <Card>
        <div className="p-6 text-center text-base-500">
          لا يوجد فريق مرتبط بحسابك حالياً.
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Team Header & Settings */}
      <Card>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="p-3 bg-brand-100 rounded-xl text-brand-600">
              <Users className="h-8 w-8" />
            </div>
            <div className="flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-10 min-w-[200px]"
                    placeholder="اسم الفريق"
                  />
                  <Button 
                    size="sm" 
                    onClick={() => updateTeamMutation.mutate(newName)}
                    disabled={!newName.trim() || updateTeamMutation.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => {
                      setIsEditingName(false)
                      setNewName(myTeam.name)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h2 className="text-2xl font-bold text-base-900">{myTeam.name}</h2>
                  <button 
                    onClick={() => setIsEditingName(true)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-base-100 rounded text-base-500"
                    title="تعديل الاسم"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
              )}
              <p className="text-sm text-base-500">
                {myTeam.members?.length || 0} أعضاء • تم الإنشاء {new Date(myTeam.createdAt).toLocaleDateString("ar-EG")}
              </p>
            </div>
          </div>
          
          <Button onClick={() => setIsAddMemberOpen(true)}>
            إضافة عضو جديد (طلب)
          </Button>
        </div>
      </Card>

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="الأكثر نشاطاً (Top Performer)">
            {topPerformer ? (
               <div className="flex flex-col items-center justify-center py-4 space-y-3">
                  <div className="relative">
                    <Avatar src={topPerformer.avatar} name={topPerformer.name} size="lg" />
                    <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-white p-1 rounded-full shadow-lg border-2 border-white">
                       <Award className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-center">
                     <p className="font-bold text-lg text-base-900">{topPerformer.name}</p>
                     <p className="text-sm text-base-500">{topPerformer.deals} صفقة ناجحة</p>
                  </div>
                  <div className="w-full bg-base-100 rounded-full h-2.5 mt-2">
                     <div className="bg-brand-600 h-2.5 rounded-full" style={{ width: `${topPerformer.conversionRate}%` }}></div>
                  </div>
                  <p className="text-xs text-base-500">معدل تحويل {topPerformer.conversionRate}%</p>
               </div>
            ) : (
               <div className="flex flex-col items-center justify-center h-40 text-base-500">
                  <p>لا توجد بيانات كافية</p>
               </div>
            )}
        </Card>

        <Card title="أداء الفريق (Team Performance)">
            <div className="space-y-4">
               {memberStats.slice(0, 3).map((stat, idx) => (
                  <div key={stat.userId} className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-base-100 text-base-700'}`}>
                           {idx + 1}
                        </div>
                        <div>
                           <p className="text-sm font-medium">{stat.name}</p>
                           <p className="text-xs text-base-500">{stat.deals} صفقة</p>
                        </div>
                     </div>
                     <span className={`text-xs font-bold px-2 py-1 rounded-full ${stat.conversionRate > 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-base-100 text-base-700'}`}>
                        {stat.conversionRate}%
                     </span>
                  </div>
               ))}
               {memberStats.length === 0 && <p className="text-sm text-base-500 text-center">لا توجد بيانات</p>}
            </div>
        </Card>

        <Card title="أهداف الفريق (Monthly Goals)">
             {goalsOverview?.plan ? (
                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{goalsOverview.plan.name}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${goalsOverview.report?.periodProgress > 0.9 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                         {Math.round((goalsOverview.report?.periodProgress || 0) * 100)}% انقضى
                      </span>
                   </div>
                   
                   {/* Team Aggregate Progress if available or generic message */}
                   <div className="p-3 bg-base-50 rounded-lg border border-base-200">
                      <div className="flex items-center gap-2 mb-2">
                         <Target className="w-4 h-4 text-brand-600" />
                         <span className="text-xs font-medium text-base-700">التقدم العام</span>
                      </div>
                      {/* Calculate average score of team members */}
                      {(() => {
                         const teamTargets = goalsOverview.report?.rows.filter(r => myTeam.members.some(m => m.userId === r.subjectId)) || []
                         const avgScore = teamTargets.length > 0 
                            ? teamTargets.reduce((acc, curr) => acc + curr.ratio, 0) / teamTargets.length 
                            : 0;
                         const percentage = Math.round(avgScore * 100);
                         return (
                            <div>
                               <div className="flex justify-between text-xs mb-1">
                                  <span>الإنجاز</span>
                                  <span>{percentage}%</span>
                               </div>
                               <div className="w-full bg-base-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${percentage >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} 
                                    style={{ width: `${Math.min(100, percentage)}%` }}
                                  ></div>
                               </div>
                            </div>
                         )
                      })()}
                   </div>

                   <Button variant="outline" size="sm" className="w-full" as="a" href="/goals">
                      عرض التفاصيل <ArrowUpRight className="w-3 h-3 mr-2" />
                   </Button>
                </div>
             ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[150px] text-base-500 gap-2">
                   <Target className="h-8 w-8 text-base-300" />
                   <p className="text-sm">لا توجد خطة أهداف نشطة لهذا الشهر</p>
                   <p className="text-xs text-base-400">تواصل مع المالك لتحديد الأهداف</p>
                </div>
             )}
        </Card>
      </div>

      {/* Stuck Leads */}
      {stuckLeads.length > 0 && (
        <Card title="عملاء يحتاجون متابعة (متوقفين لأكثر من 3 أيام)">
            <div className="overflow-x-auto">
                <table className="w-full text-right">
                    <thead className="text-sm text-base-500 border-b border-base-200">
                        <tr>
                            <th className="pb-3 pr-4">العميل</th>
                            <th className="pb-3">المسؤول</th>
                            <th className="pb-3">آخر تحديث</th>
                            <th className="pb-3 pl-4">إجراء</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-base-100">
                        {stuckLeads.map(lead => (
                            <tr key={lead.id} className="group hover:bg-base-50">
                                <td className="py-3 pr-4 font-medium">{lead.name}</td>
                                <td className="py-3">
                                    <div className="flex items-center gap-2">
                                        <Avatar src={lead.assignedUser?.profile?.avatar} name={lead.assignedUser?.name} size="xs" />
                                        <span className="text-sm">{lead.assignedUser?.name || "Unknown"}</span>
                                    </div>
                                </td>
                                <td className="py-3 text-sm text-base-500">
                                    {format(new Date(lead.updatedAt), "dd MMMM", { locale: ar })}
                                </td>
                                <td className="py-3 pl-4">
                                    <Button 
                                        size="xs" 
                                        variant="outline"
                                        onClick={() => {
                                            if (lead.assignedUserId) {
                                                remindMemberMutation.mutate({
                                                    userId: lead.assignedUserId,
                                                    leadId: lead.id,
                                                    leadName: lead.name
                                                })
                                            }
                                        }}
                                        disabled={remindMemberMutation.isPending}
                                        className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                    >
                                        <Bell className="w-3 h-3 ml-1" />
                                        تذكير
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
      )}

      {/* Members List */}
      <Card title="أعضاء الفريق">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-base-200 text-base-500 text-sm">
                <th className="pb-3 pr-4">العضو</th>
                <th className="pb-3">الدور</th>
                <th className="pb-3">العملاء (المسندة)</th>
                <th className="pb-3">الصفقات (الناجحة)</th>
                <th className="pb-3">التحويل</th>
                <th className="pb-3 pl-4">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-100">
              {memberStats.map((member) => (
                <tr key={member.userId} className="group hover:bg-base-50 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} src={member.avatar} size="sm" />
                      <div>
                        <div className="font-medium text-base-900">{member.name}</div>
                        <div className="text-xs text-base-500">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${member.role === 'leader' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {member.role === 'leader' ? 'قائد' : 'مبيعات'}
                    </span>
                  </td>
                  <td className="py-3 text-sm">
                    {member.total}
                  </td>
                  <td className="py-3 text-sm font-medium text-emerald-600">
                    {member.deals}
                  </td>
                  <td className="py-3 text-sm">
                    {member.conversionRate}%
                  </td>
                  <td className="py-3 pl-4">
                    {member.role !== 'leader' && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                                if (confirm("هل أنت متأكد من إزالة هذا العضو من الفريق؟")) {
                                    removeMemberMutation.mutate(member.userId)
                                }
                            }}
                            disabled={removeMemberMutation.isPending}
                        >
                            <UserMinus className="h-4 w-4" />
                        </Button>
                    )}
                  </td>
                </tr>
              ))}
              {memberStats.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-base-500">
                    لا يوجد أعضاء في الفريق
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Member Modal */}
      <Modal 
        isOpen={isAddMemberOpen} 
        onClose={() => setIsAddMemberOpen(false)}
        title="طلب إضافة عضو جديد"
      >
         <div className="max-h-[80vh] overflow-y-auto p-1">
            <UserCreateForm />
         </div>
      </Modal>
    </div>
  )
}
