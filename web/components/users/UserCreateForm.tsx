"use client"

import { FormEvent, useMemo, useState } from "react"
import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"
import { Select } from "../ui/Select"
import { Modal } from "../ui/Modal"
import { useAuth } from "../../lib/auth/AuthContext"
import { useTeams } from "../../lib/hooks/useTeams"
import { useRoles } from "../../lib/hooks/useRoles"
import { coreService } from "../../lib/services/coreService"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { User } from "../../lib/types"
import { PlusCircle, Shield } from "lucide-react"
import Link from "next/link"

export const UserCreateForm = () => {
  const { role, token } = useAuth()
  const { data: teams } = useTeams()
  const { data: rolesList } = useRoles()
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
  
  // Role creation state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")

  const availableRoles = useMemo(() => {
    if (role === "owner") {
      let roles = [];
      // If we have roles from backend, use them. Otherwise fallback to defaults for safety
      if (rolesList && rolesList.length > 0) {
        roles = rolesList;
      } else {
        roles = [
          { id: "team_leader", name: "team_leader", scope: "system" }, 
          { id: "sales", name: "sales", scope: "system" }
        ];
      }
      // Filter out 'owner' role to prevent creating another owner
      return roles.filter(r => r.name !== "owner");
    }
    return []
  }, [role, rolesList])

  // Helper to get the selected role name regardless of whether ID or Name is used
  const selectedRoleName = useMemo(() => {
    const found = availableRoles.find(r => r.id === userRole || r.name === userRole);
    return found ? found.name : userRole;
  }, [availableRoles, userRole]);

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const createRoleMutation = useMutation({
    mutationFn: (name: string) => coreService.createRole({ name }, token || undefined),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["roles"] })
      setIsRoleModalOpen(false)
      setNewRoleName("")
      setUserRole(data.id) // Auto-select the new role
      setMessage(`تم إنشاء الدور "${data.name}" بنجاح. يمكنك ضبط صلاحياته لاحقاً.`)
    },
    onError: (err: any) => {
      setMessage(`فشل إنشاء الدور: ${err?.response?.data?.message || err.message}`)
    }
  })

  const mutation = useMutation({
    mutationFn: async () => {
      // Always call createUser. The backend will handle converting it to a request if the user is a Team Leader.
      return coreService.createUser(
        {
          name: name.trim(),
          email: email.trim(),
          phone: phone ? phone.trim() : undefined,
          password: password || undefined,
          role: userRole,
          teamId: selectedRoleName === "sales" ? teamId || undefined : undefined,
          teamName: selectedRoleName === "team_leader" ? teamName || undefined : undefined
        },
        token || undefined
      )
    },
    onSuccess: (result: any) => {
      if (result?.request) {
        setMessage("تم إرسال طلب إنشاء المستخدم للموافقة من المالك")
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
    onError: (err: { status?: number; message?: string; response?: any }) => {
      // Use the message from backend if available, otherwise fallback
      const errorMsg = err?.response?.data?.message || err?.message || "فشل إنشاء المستخدم";
      if (err?.status === 409) {
        // If the backend specifically says "Email...", use that, otherwise use the backend message
        if (errorMsg.includes("البريد")) setMessage("البريد الإلكتروني مستخدم بالفعل")
        else if (errorMsg.includes("الهاتف")) setMessage("رقم الهاتف مستخدم بالفعل")
        else if (errorMsg.includes("الفريق")) setMessage("اسم الفريق مستخدم بالفعل")
        else setMessage(errorMsg)
        return
      }
      setMessage(`حدث خطأ: ${errorMsg}`)
    }
  })

  if (role !== "owner" && role !== "team_leader") return null

  return (
    <>
      <Card title="إضافة مستخدم جديد">
      <form
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
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
          
          // Validation for Team Leader creation
          if (role === "owner" && selectedRoleName === "team_leader" && !teamName.trim()) {
            setMessage("اسم الفريق إجباري عند إنشاء قائد فريق")
            return
          }
          if (role === "owner" && selectedRoleName === "sales" && !teamId) {
             // Optional: Force owner to select a team? Or allow unassigned?
             // User said "I can't find how to add him to a team". So let's make it available but maybe not strictly mandatory if system allows unassigned.
             // But for better UX, let's keep it available.
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
          label="الاسم"
          className="text-right"
          placeholder="الاسم"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          label="البريد الإلكتروني"
          className="text-right"
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="رقم الهاتف"
          className="text-right"
          placeholder="رقم الهاتف"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        {role === "owner" && (
          <Input
            label="كلمة مرور مؤقتة"
            className="text-right"
            placeholder="كلمة مرور (اختياري)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
        {role === "owner" && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select
                label="الدور"
                className="text-right"
                value={userRole}
                onChange={(event) => setUserRole(event.target.value)}
              >
                {availableRoles.map((roleItem) => (
                  <option key={roleItem.id} value={roleItem.id || roleItem.name}>
                    {roleItem.name === "owner" ? "المالك" : 
                     roleItem.name === "team_leader" ? "قائد فريق" : 
                     roleItem.name === "sales" ? "مبيعات" : 
                     roleItem.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button 
              type="button" 
              variant="secondary" 
              className="mb-[2px] px-3"
              onClick={() => setIsRoleModalOpen(true)}
              title="إضافة دور جديد"
            >
              <PlusCircle className="h-5 w-5" />
            </Button>
            <Link href="/settings/roles">
              <Button 
                type="button" 
                variant="ghost" 
                className="mb-[2px] px-3"
                title="إدارة الصلاحيات"
              >
                <Shield className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        )}
        {selectedRoleName === "sales" && role === "owner" && (
          <Select
            label="الفريق"
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
        {selectedRoleName === "team_leader" && role === "owner" && (
          <Input
            label="اسم الفريق"
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
      </Card>

      <Modal
        isOpen={!!temporaryPassword}
        onClose={() => {
          setTemporaryPassword(null)
          setMessage(null)
        }}
        title="تم إنشاء المستخدم بنجاح"
      >
        <div className="space-y-4">
           <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
             <p className="mb-2 text-sm text-emerald-800">تم إنشاء الحساب بنجاح. يرجى نسخ كلمة المرور المؤقتة أدناه:</p>
             <p className="text-xl font-bold tracking-wider text-emerald-900 select-all font-mono bg-white p-2 rounded border border-emerald-100">
               {temporaryPassword}
             </p>
           </div>
           <p className="text-xs text-gray-500 text-center">
             يجب على المستخدم تغيير كلمة المرور عند تسجيل الدخول لأول مرة.
           </p>
           <Button onClick={() => setTemporaryPassword(null)} className="w-full">
             حسناً
           </Button>
        </div>
      </Modal>

      {/* Success Message for Requests */}
      <Modal
        isOpen={message === "تم إرسال طلب إنشاء المستخدم للموافقة من المالك"}
        onClose={() => setMessage(null)}
        title="تم الإرسال"
      >
        <div className="space-y-4 text-center">
           <p className="text-base-700">تم إرسال طلب إنشاء مندوب المبيعات إلى المالك للموافقة عليه.</p>
           <Button onClick={() => setMessage(null)} className="w-full">
             حسناً
           </Button>
        </div>
      </Modal>

      {message && message !== "تم إرسال طلب إنشاء المستخدم للموافقة من المالك" && (
         <div className={`mt-4 p-4 rounded-lg border ${message.includes("نجاح") ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
           {message}
         </div>
      )}
      
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title="إضافة دور جديد"
      >
        <div className="space-y-4">
            <Input
                label="اسم الدور"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="مثال: مدير تسويق"
            />
            <p className="text-xs text-base-500">
              بعد إنشاء الدور، يمكنك تحديد صلاحياته بالضغط على أيقونة الدرع (إدارة الصلاحيات).
            </p>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setIsRoleModalOpen(false)}>إلغاء</Button>
                <Button 
                    disabled={!newRoleName.trim() || createRoleMutation.isPending}
                    onClick={() => createRoleMutation.mutate(newRoleName)}
                >
                    {createRoleMutation.isPending ? "جاري الإنشاء..." : "إنشاء"}
                </Button>
            </div>
        </div>
      </Modal>
    </>
  )
}
