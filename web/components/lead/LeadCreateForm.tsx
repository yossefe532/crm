"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { Input } from "../ui/Input"
import { Select } from "../ui/Select"
import { useUsers } from "../../lib/hooks/useUsers"
import { useTeams } from "../../lib/hooks/useTeams"
import { useAuth } from "../../lib/auth/AuthContext"
import { leadService } from "../../lib/services/leadService"
import { coreService } from "../../lib/services/coreService"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { notificationService } from "../../lib/services/notificationService"
import { conversationService } from "../../lib/services/conversationService"

export const LeadCreateForm = () => {
  const { token, role, userId } = useAuth()
  const { data: users } = useUsers()
  const { data: teams } = useTeams()
  const queryClient = useQueryClient()
  const [leadCode, setLeadCode] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [budgetMin, setBudgetMin] = useState("")
  const [budgetMax, setBudgetMax] = useState("")
  const [desiredLocation, setDesiredLocation] = useState("")
  const [propertyType, setPropertyType] = useState("")
  const [profession, setProfession] = useState("")
  const [notes, setNotes] = useState("")
  const [priority, setPriority] = useState("normal")
  const [assignedUserId, setAssignedUserId] = useState("")
  const [teamId, setTeamId] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  const teamLeaderTeam = useMemo(() => {
    if (role !== "team_leader") return null
    return (teams || []).find((team) => team.leaderUserId === userId) || null
  }, [role, teams, userId])

  const myTeam = useMemo(() => {
    // FIX: Added (team.members || []) to prevent 'undefined' error
    return (teams || []).find((team) => (team.members || []).some((m) => m.userId === userId))
  }, [teams, userId])

  const assignableUsers = useMemo(() => {
    const base = (users || []).filter((user) => user.status === "active" && !(user.roles || []).includes("owner"))
    if (role !== "team_leader") return base
    const teamMemberIds = new Set((teamLeaderTeam?.members || []).map((member) => member.userId))
    // Add current user (Team Leader) to the set so they can assign to themselves
    if (userId) teamMemberIds.add(userId)
    return base.filter((user) => teamMemberIds.has(user.id))
  }, [role, teamLeaderTeam, users, userId])

  useEffect(() => {
    if (role === "team_leader" && teamLeaderTeam?.id) {
      setTeamId(teamLeaderTeam.id)
    } else if (role === "sales" && myTeam?.id) {
      setTeamId(myTeam.id)
    }
  }, [role, teamLeaderTeam?.id, myTeam?.id])

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        leadCode: leadCode.trim() || undefined,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        budgetMin: budgetMin ? Number(budgetMin) : undefined,
        budgetMax: budgetMax ? Number(budgetMax) : undefined,
        desiredLocation: desiredLocation.trim() || undefined,
        propertyType: propertyType.trim() || undefined,
        profession: profession.trim() || undefined,
        notes: notes.trim() || undefined,
        priority,
        assignedUserId: role === "sales" ? userId : (assignedUserId || undefined),
        teamId: teamId || undefined
      }

      // Sales role ALWAYS creates a request, never directly creates a lead
      if (role === "sales") {
        return coreService.createUserRequest({
          requestType: "create_lead",
          payload
        }, token || undefined)
      }

      // Other roles (Owner, Team Leader) create directly
      return await leadService.create(payload, token || undefined)
    },
    onSuccess: (data: any) => {
      // Check for request response (has requestType or status=pending)
      if (data?.requestType === "create_lead" || (role === "sales" && data?.status === "pending")) {
        setMessage("تم إرسال طلب إضافة العميل للموافقة")
        
        // Notify owners
        try {
          notificationService.broadcast(
            { type: "role", value: "owner" },
            `طلب إضافة عميل جديد: ${name}`,
            ["push", "in_app"],
            token || undefined
          )
          
          if (myTeam?.leaderUserId) {
             notificationService.broadcast(
              { type: "user", value: myTeam.leaderUserId },
              `طلب إضافة عميل جديد من ${users?.find(u => u.id === userId)?.name || "عضو فريق"}`,
              ["push", "in_app"],
              token || undefined
            )
          }
        } catch {}
      } else {
        setMessage("تم إضافة العميل بنجاح")
      }
      
      // Reset form
      setLeadCode("")
      setName("")
      setPhone("")
      setEmail("")
      setBudgetMin("")
      setBudgetMax("")
      setDesiredLocation("")
      setPropertyType("")
      setProfession("")
      setNotes("")
      setPriority("normal")
      setAssignedUserId("")
      setTeamId("")
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["user_requests"] })
    },
    onError: (err: any) => {
      if (err?.status === 409 && err?.lead) {
        const existing = err.lead as { name?: string; phone?: string; email?: string; status?: string }
        setMessage(`هذا العميل مسجل بالفعل: ${existing.name || ""} ${existing.phone || ""} ${existing.status ? `(${existing.status})` : ""}`.trim())
        return
      }
      setMessage(`حدث خطأ: ${err?.message || "فشل تنفيذ الطلب"}`)
    }
  })

  return (
    <Card title="إضافة عميل جديد">
      <form
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          setMessage(null)
          
          if (!name.trim()) {
            setMessage("اسم العميل مطلوب")
            return
          }
          if (!phone.trim()) {
            setMessage("رقم الهاتف مطلوب")
            return
          }
          if (email.trim() && !isValidEmail(email.trim())) {
            setMessage("صيغة البريد الإلكتروني غير صحيحة")
            return
          }
          
          mutation.mutate()
        }}
      >
        <Input
          label="كود العميل"
          className="text-right"
          placeholder="كود العميل (اختياري)"
          value={leadCode}
          onChange={(event) => setLeadCode(event.target.value)}
        />
        <Input
          label="اسم العميل"
          className="text-right"
          placeholder="اسم العميل"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          label="رقم الهاتف"
          className="text-right"
          placeholder="رقم الهاتف"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        <Input
          label="البريد الإلكتروني"
          className="text-right"
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="الحد الأدنى للميزانية"
          className="text-right"
          placeholder="الحد الأدنى للميزانية"
          value={budgetMin}
          onChange={(event) => setBudgetMin(event.target.value)}
        />
        <Input
          label="الحد الأقصى للميزانية"
          className="text-right"
          placeholder="الحد الأقصى للميزانية"
          value={budgetMax}
          onChange={(event) => setBudgetMax(event.target.value)}
        />
        <Input
          label="المنطقة المفضلة"
          className="text-right"
          placeholder="المنطقة المفضلة"
          value={desiredLocation}
          onChange={(event) => setDesiredLocation(event.target.value)}
        />
        <Input
          label="نوع العقار"
          className="text-right"
          placeholder="نوع العقار"
          value={propertyType}
          onChange={(event) => setPropertyType(event.target.value)}
        />
        <Input
          label="مهنة العميل"
          className="text-right"
          placeholder="مهنة العميل"
          value={profession}
          onChange={(event) => setProfession(event.target.value)}
        />
        <Input
          label="ملاحظات"
          className="text-right"
          placeholder="ملاحظات عن العميل"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <Select
          label="الأولوية"
          className="text-right"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
        >
          <option value="normal">أولوية عادية</option>
          <option value="high">أولوية عالية</option>
          <option value="low">أولوية منخفضة</option>
        </Select>
        {(role === "owner" || role === "team_leader") && (
          <Select
            label="تعيين إلى مندوب"
            className="text-right"
            value={assignedUserId}
            onChange={(event) => setAssignedUserId(event.target.value)}
          >
            <option value="">
              {role === "team_leader" ? "تعيين لي (أنا)" : "اختر المندوب"}
            </option>
            {assignableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.id === userId ? `${user.name || user.email} (أنا)` : (user.name || user.email)}
              </option>
            ))}
          </Select>
        )}
        {(role === "owner" || role === "team_leader") && (
          <Select
            label="الفريق"
            className="text-right"
            value={role === "team_leader" ? teamLeaderTeam?.id || "" : teamId}
            onChange={(event) => setTeamId(event.target.value)}
            disabled={role === "team_leader"}
          >
            <option value="">الفريق (اختياري)</option>
            {(teams || []).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        )}
        <div className="md:col-span-2 lg:col-span-3">
          <Button type="submit" disabled={mutation.isPending} aria-label="إضافة العميل" title="إضافة العميل">
            {mutation.isPending ? "جاري الإضافة..." : role === "sales" ? "إرسال طلب إضافة" : "إضافة العميل"}
          </Button>
        </div>
      </form>
      {message && <p className="mt-3 text-sm text-base-700">{message}</p>}
    </Card>
  )
}
