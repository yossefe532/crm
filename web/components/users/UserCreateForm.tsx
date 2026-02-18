"use client"

import { FormEvent, useMemo, useState } from "react"
import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"
import { Select } from "../ui/Select"
import { useAuth } from "../../lib/auth/AuthContext"
import { useTeams } from "../../lib/hooks/useTeams"
import { coreService } from "../../lib/services/coreService"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export const UserCreateForm = () => {
  const { role, token } = useAuth()
  const { data: teams } = useTeams()
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [userRole, setUserRole] = useState(role === "team_leader" ? "sales" : "team_leader")
  const [teamId, setTeamId] = useState("")
  const [teamName, setTeamName] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)

  const availableRoles = useMemo(() => {
    if (role === "owner") return ["team_leader", "sales"]
    return []
  }, [role])

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (role === "team_leader") {
        return coreService.createUserRequest(
          {
            name: name.trim(),
            email: email.trim(),
            phone: phone ? phone.trim() : undefined
          },
          token || undefined
        )
      }
      return coreService.createUser(
        {
          name: name.trim(),
          email: email.trim(),
          phone: phone ? phone.trim() : undefined,
          password: password || undefined,
          role: userRole,
          teamId: userRole === "sales" ? teamId || undefined : undefined,
          teamName: userRole === "team_leader" ? teamName || undefined : undefined
        },
        token || undefined
      )
    },
    onSuccess: (result: any) => {
      if (role === "team_leader") {
        setMessage("تم إرسال الطلب للمالك")
      } else {
        setMessage("تم إنشاء المستخدم بنجاح")
        if (result?.temporaryPassword) {
          setTemporaryPassword(result.temporaryPassword)
        }
      }
      setName("")
      setEmail("")
      setPhone("")
      setPassword("")
      setTeamId("")
      setTeamName("")
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["user_requests"] })
    },
    onError: (err: any) => {
      if (err?.status === 409) {
        setMessage("البريد الإلكتروني مستخدم بالفعل")
        return
      }
      setMessage(`حدث خطأ: ${err.message || "فشل إنشاء المستخدم"}`)
    }
  })

  if (role !== "owner" && role !== "team_leader") return null

  return (
    <Card title="إضافة مستخدم جديد">
      <form
        className="grid gap-4 lg:grid-cols-3"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          setMessage(null)
          setTemporaryPassword(null)
          
          if (!name.trim()) {
            setMessage("الاسم مطلوب")
            return
          }
          if (!email.trim()) {
            setMessage("البريد الإلكتروني مطلوب")
            return
          }
          if (!isValidEmail(email.trim())) {
            setMessage("صيغة البريد الإلكتروني غير صحيحة")
            return
          }
          if (role === "owner" && password && password.length < 8) {
            setMessage("كلمة المرور يجب أن تكون 8 أحرف على الأقل")
            return
          }

          mutation.mutate()
        }}
      >
        <Input
          aria-label="الاسم"
          title="الاسم"
          className="text-right"
          placeholder="الاسم"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          aria-label="البريد الإلكتروني"
          title="البريد الإلكتروني"
          className="text-right"
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          aria-label="رقم الهاتف"
          title="رقم الهاتف"
          className="text-right"
          placeholder="رقم الهاتف"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        {role === "owner" && (
          <Input
            aria-label="كلمة مرور مؤقتة"
            title="كلمة مرور مؤقتة"
            className="text-right"
            placeholder="كلمة مرور (اختياري)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
        {role === "owner" && (
          <Select
            aria-label="الدور"
            title="الدور"
            className="text-right"
            value={userRole}
            onChange={(event) => setUserRole(event.target.value)}
          >
            {availableRoles.map((value) => (
              <option key={value} value={value}>
                {value === "team_leader" ? "قائد فريق" : "مبيعات"}
              </option>
            ))}
          </Select>
        )}
        {userRole === "sales" && role === "owner" && (
          <Select
            aria-label="الفريق"
            title="الفريق"
            className="text-right"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
          >
            <option value="">اختر الفريق</option>
            {(teams || []).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        )}
        {userRole === "team_leader" && role === "owner" && (
          <Input
            aria-label="اسم الفريق"
            title="اسم الفريق"
            className="text-right"
            placeholder="اسم الفريق الجديد (اختياري)"
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
          />
        )}
        <div className="lg:col-span-3">
          <Button type="submit" disabled={mutation.isPending} aria-label="إنشاء المستخدم" title="إنشاء المستخدم">
            {mutation.isPending ? "جاري الإرسال..." : role === "team_leader" ? "إرسال طلب إنشاء" : "إنشاء المستخدم"}
          </Button>
        </div>
      </form>
      {message && <p className="mt-3 text-sm text-base-700">{message}</p>}
      {temporaryPassword && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          كلمة المرور المؤقتة: {temporaryPassword}
        </div>
      )}
    </Card>
  )
}
