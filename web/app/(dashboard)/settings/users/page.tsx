"use client"

import { useAuth } from "../../../../lib/auth/AuthContext"
import { UserCreateForm } from "../../../../components/users/UserCreateForm"
import { useUsers } from "../../../../lib/hooks/useUsers"
import { Card } from "../../../../components/ui/Card"
import { Button } from "../../../../components/ui/Button"
import { Input } from "../../../../components/ui/Input"
import { Select } from "../../../../components/ui/Select"
import { Avatar } from "../../../../components/ui/Avatar"
import { Checkbox } from "../../../../components/ui/Checkbox"
import { UserPermissionPanel } from "../../../../components/users/UserPermissionPanel"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useUserRequests } from "../../../../lib/hooks/useUserRequests"
import { coreService } from "../../../../lib/services/coreService"
import { useTeams } from "../../../../lib/hooks/useTeams"
import { useLeads } from "../../../../lib/hooks/useLeads"

export default function UsersSettingsPage() {
  const { role, token, userId: currentUserId } = useAuth()
  const { data } = useUsers()
  const { data: requests } = useUserRequests()
  const { data: teams } = useTeams()
  const { data: leads } = useLeads()
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; roles: string[] } | null>(null)
  const [resetInfo, setResetInfo] = useState<Record<string, string>>({})
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({})
  const [teamSetup, setTeamSetup] = useState<{ leaderId: string } | null>(null)
  const [teamSetupName, setTeamSetupName] = useState("")
  const [teamSetupMembers, setTeamSetupMembers] = useState<string[]>([])
  const [editValues, setEditValues] = useState<Record<string, { email?: string; phone?: string; status?: string }>>({})
  const [auditUserId, setAuditUserId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const decideMutation = useMutation({
    mutationFn: (payload: { requestId: string; status: "approved" | "rejected" }) =>
      coreService.decideUserRequest(payload.requestId, payload.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_requests"] })
      queryClient.invalidateQueries({ queryKey: ["users"] })
    }
  })
  const resetMutation = useMutation({
    mutationFn: (userId: string) => coreService.resetUserPassword(userId, {}),
    onSuccess: (result, userId) => {
      if (result.temporaryPassword) {
        setResetInfo((prev) => ({ ...prev, [userId]: result.temporaryPassword || "" }))
      }
    }
  })
  const updateUserMutation = useMutation({
    mutationFn: (payload: { userId: string; email?: string; phone?: string; status?: string }) =>
      coreService.updateUser(payload.userId, { email: payload.email, phone: payload.phone || undefined, status: payload.status }, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    }
  })
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => coreService.deleteUser(userId, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    }
  })
  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: string) => coreService.deleteTeam(teamId, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    }
  })
  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ["user-audit", auditUserId],
    queryFn: () => coreService.listUserAudit(auditUserId || "", token || undefined),
    enabled: !!auditUserId
  })
  const transferMutation = useMutation({
    mutationFn: (payload: { userId: string; teamId: string }) => coreService.transferUserTeam(payload.userId, { teamId: payload.teamId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      queryClient.invalidateQueries({ queryKey: ["users"] })
    }
  })
  const promoteMutation = useMutation({
    mutationFn: (payload: { userId: string; teamName?: string; memberIds?: string[] }) =>
      coreService.promoteUser(payload.userId, { teamName: payload.teamName, memberIds: payload.memberIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      queryClient.invalidateQueries({ queryKey: ["users"] })
    }
  })

  const leadsByUser = useMemo(() => {
    const map = new Map<string, typeof leads>()
    ;(leads || []).forEach((lead) => {
      if (!lead.assignedUserId) return
      if (!map.has(lead.assignedUserId)) map.set(lead.assignedUserId, [])
      map.get(lead.assignedUserId)?.push(lead)
    })
    return map
  }, [leads])

  const teamMembersCount = useMemo(() => {
    const map = new Map<string, number>()
    ;(teams || []).forEach((team) => {
      map.set(team.id, (team.members || []).length)
    })
    return map
  }, [teams])

  const availableTeamMembers = useMemo(() => {
    return (data || []).filter((user) => {
      const hasTeam = (user.teamMemberships || []).length > 0
      const isLeader = (user.roles || []).includes("team_leader")
      return !hasTeam && !isLeader
    })
  }, [data])

  if (role !== "owner" && role !== "team_leader") {
    return <Card title="إدارة المستخدمين">غير مصرح لك بالدخول إلى هذه الصفحة</Card>
  }

  return (
    <div className="space-y-6">
      <UserCreateForm />
      {role === "owner" && (
        <Card title="طلبات إنشاء المستخدمين">
          <div className="space-y-3">
            {(requests || []).map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-100 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-base-900">{request.payload?.name || ""}</p>
                  <p className="text-xs text-base-500">{request.payload?.email || ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-base-500">{request.status === "pending" ? "قيد المراجعة" : request.status}</span>
                  {request.status === "pending" && (
                    <>
                      <Button variant="secondary" onClick={() => decideMutation.mutate({ requestId: request.id, status: "approved" })}>
                        قبول
                      </Button>
                      <Button variant="ghost" onClick={() => decideMutation.mutate({ requestId: request.id, status: "rejected" })}>
                        رفض
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {(requests || []).length === 0 && <p className="text-sm text-base-500">لا توجد طلبات حالياً</p>}
          </div>
        </Card>
      )}
      {role === "owner" && (
        <Card title="إدارة الفرق">
          <div className="space-y-3">
            {(teams || []).map((team) => (
              <div key={team.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-100 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-base-900">{team.name}</p>
                  <p className="text-xs text-base-500">{team.status}</p>
                  <p className="text-xs text-base-500">الأعضاء: {teamMembersCount.get(team.id) || 0} / 10</p>
                  {(team.members || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(team.members || []).map((member) => {
                        const profileName = member.user?.profile?.firstName
                          ? `${member.user.profile.firstName}${member.user.profile.lastName ? ` ${member.user.profile.lastName}` : ""}`
                          : undefined
                        return (
                          <span key={member.id} className="rounded-full bg-base-100 px-2 py-1 text-xs text-base-700">
                            {member.user?.name || profileName || member.user?.email || member.userId}
                            <span className="text-[10px] text-base-500"> • {(leadsByUser.get(member.userId) || []).length} عميل</span>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const confirmed = window.confirm("سيتم حذف الفريق وإلغاء إسناد العملاء إليه. هل أنت متأكد؟")
                    if (!confirmed) return
                    deleteTeamMutation.mutate(team.id)
                  }}
                >
                  حذف الفريق
                </Button>
              </div>
            ))}
            {(teams || []).length === 0 && <p className="text-sm text-base-500">لا توجد فرق</p>}
          </div>
        </Card>
      )}
      <Card title="قائمة المستخدمين">
        <div className="space-y-3">
          {(data || []).map((user) => {
            const isOwnerAccount = (user.roles || []).includes("owner") || (role === "owner" && user.id === currentUserId) || user.email === "admin@crm-doctor.com" // Fallback protection
            return (
            <div key={user.id} className={`space-y-3 rounded-lg border px-3 py-2 ${isOwnerAccount ? "border-amber-200 bg-amber-50" : "border-base-100"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={user.name || user.email} size="md" className="hidden sm:inline-block" />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-base-900">{user.name || user.email}</p>
                      {isOwnerAccount && <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] text-amber-800">حساب المالك</span>}
                      {user.id === currentUserId && <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] text-brand-700">أنت</span>}
                    </div>
                    <p className="text-xs text-base-500">{user.phone || "بدون رقم"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs text-base-500">{user.status}</span>
                  {role === "owner" && !isOwnerAccount && (
                    <Button 
                      variant="ghost" 
                      onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : { id: user.id, name: user.name || user.email, roles: user.roles || [] })}
                    >
                      {selectedUser?.id === user.id ? "إخفاء الصلاحيات" : "الصلاحيات"}
                    </Button>
                  )}
                  {role === "owner" && !isOwnerAccount && (
                    <Button
                      variant="secondary"
                      onClick={() => resetMutation.mutate(user.id)}
                    >
                      إعادة تعيين كلمة المرور
                    </Button>
                  )}
                  {isOwnerAccount && <span className="text-xs text-base-500">حساب المالك</span>}
                </div>
              </div>
              {role === "owner" && !isOwnerAccount && (
                <div className="grid gap-2 md:grid-cols-3">
                  <Input
                    className="text-right disabled:bg-base-50 disabled:text-base-400"
                    placeholder="البريد الإلكتروني"
                    disabled={isOwnerAccount}
                    value={editValues[user.id]?.email ?? user.email}
                    onChange={(event) =>
                      setEditValues((prev) => ({ ...prev, [user.id]: { ...prev[user.id], email: event.target.value } }))
                    }
                  />
                  <Input
                    className="text-right disabled:bg-base-50 disabled:text-base-400"
                    placeholder="رقم الهاتف"
                    disabled={isOwnerAccount}
                    value={editValues[user.id]?.phone ?? user.phone ?? ""}
                    onChange={(event) =>
                      setEditValues((prev) => ({ ...prev, [user.id]: { ...prev[user.id], phone: event.target.value } }))
                    }
                  />
                  <Select
                    className="text-right disabled:bg-base-50 disabled:text-base-400"
                    value={editValues[user.id]?.status ?? user.status}
                    disabled={isOwnerAccount}
                    onChange={(event) =>
                      setEditValues((prev) => ({ ...prev, [user.id]: { ...prev[user.id], status: event.target.value } }))
                    }
                  >
                    <option value="active">نشط</option>
                    <option value="inactive">غير نشط</option>
                  </Select>
                </div>
              )}
              {role === "owner" && !isOwnerAccount && (
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <Select
                    className="text-right"
                    value={transferTargets[user.id] || ""}
                    onChange={(event) =>
                      setTransferTargets((prev) => ({ ...prev, [user.id]: event.target.value }))
                    }
                  >
                    <option value="">نقل إلى فريق</option>
                    {(teams || []).map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </Select>
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={!transferTargets[user.id]}
                    onClick={() => transferMutation.mutate({ userId: user.id, teamId: transferTargets[user.id] })}
                  >
                    نقل
                  </Button>
                  <Button
                    type="button"
                    disabled={user.roles?.includes("team_leader")}
                    onClick={() => {
                      setTeamSetup({ leaderId: user.id })
                      setTeamSetupName("")
                      setTeamSetupMembers([])
                    }}
                  >
                    إنشاء فريق
                  </Button>
                  {user.roles?.includes("team_leader") && (
                    <p className="md:col-span-3 text-xs text-base-500">هذا المستخدم قائد فريق بالفعل</p>
                  )}
                </div>
              )}
              {role === "owner" && !isOwnerAccount && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      updateUserMutation.mutate({
                        userId: user.id,
                        email: editValues[user.id]?.email ?? user.email,
                        phone: editValues[user.id]?.phone ?? user.phone ?? undefined,
                        status: editValues[user.id]?.status ?? user.status
                      })
                    }
                  >
                    حفظ التعديلات
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setAuditUserId((prev) => (prev === user.id ? null : user.id))}
                  >
                    سجل المعاملات
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const confirmed = window.confirm("سيتم حذف المستخدم وتعطيل دخوله للنظام. هل أنت متأكد؟")
                      if (!confirmed) return
                      deleteUserMutation.mutate(user.id)
                    }}
                  >
                    حذف المستخدم
                  </Button>
                </div>
              )}
              {auditUserId === user.id && !isOwnerAccount && (
                <div className="rounded-lg border border-base-100 px-3 py-2 text-xs text-base-600">
                  {auditLoading && <p>جاري تحميل سجل المعاملات...</p>}
                  {!auditLoading && (auditLogs || []).length === 0 && <p>لا توجد معاملات مسجلة</p>}
                  <div className="space-y-2">
                    {(auditLogs || []).map((log) => (
                      <div key={log.id} className="flex items-center justify-between">
                        <span>{log.action}</span>
                        <span className="text-base-500">{new Date(log.createdAt).toLocaleString("ar-EG")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {role === "owner" && !isOwnerAccount && (
                <div className="rounded-lg border border-base-100 px-3 py-2 text-xs text-base-500">
                  العملاء المسندون: {(leadsByUser.get(user.id) || []).length}
                  {(leadsByUser.get(user.id) || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(leadsByUser.get(user.id) || []).map((lead) => (
                        <span key={lead.id} className="rounded-full bg-base-100 px-2 py-1 text-xs text-base-700">
                          {lead.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {resetInfo[user.id] && (
                <p className="text-xs text-emerald-600">كلمة المرور المؤقتة: {resetInfo[user.id]}</p>
              )}
              {selectedUser?.id === user.id && !isOwnerAccount && (
                <UserPermissionPanel 
                  userId={user.id} 
                  userName={user.name || user.email} 
                  roles={user.roles || []}
                  onClose={() => setSelectedUser(null)} 
                />
              )}
            </div>
          )})}
        </div>
      </Card>
      {role === "owner" && teamSetup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-base-0 p-4 sm:p-6 max-h-[85vh] sm:max-h-[80vh] flex flex-col">
            <div className="mb-4 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold text-base-900">تأسيس فريق جديد</h3>
              <Button variant="ghost" onClick={() => setTeamSetup(null)}>×</Button>
            </div>
            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1">
              <Input
                aria-label="اسم الفريق"
                className="text-right"
                placeholder="اسم الفريق"
                value={teamSetupName}
                onChange={(event) => setTeamSetupName(event.target.value)}
              />
              <div className="space-y-2">
                <p className="text-sm text-base-700">اختيار أعضاء بدون فريق (حتى 9 أعضاء)</p>
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-base-200 p-2">
                  {availableTeamMembers.map((member) => {
                    const checked = teamSetupMembers.includes(member.id)
                    const disabled = teamSetupMembers.length >= 9 && !checked
                    return (
                      <div key={member.id} className="flex items-center gap-2">
                        <Checkbox
                          disabled={disabled}
                          checked={checked}
                          label={member.name || member.email}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTeamSetupMembers((prev) => [...prev, member.id])
                            } else {
                              setTeamSetupMembers((prev) => prev.filter((id) => id !== member.id))
                            }
                          }}
                        />
                      </div>
                    )
                  })}
                  {availableTeamMembers.length === 0 && <p className="text-sm text-base-500">لا يوجد أعضاء متاحين حالياً</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    if (!teamSetupName) return
                    promoteMutation.mutate({ userId: teamSetup.leaderId, teamName: teamSetupName, memberIds: teamSetupMembers })
                    setTeamSetup(null)
                  }}
                  disabled={!teamSetupName || promoteMutation.isPending}
                >
                  حفظ الفريق
                </Button>
                <Button variant="ghost" onClick={() => setTeamSetup(null)}>إلغاء</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
