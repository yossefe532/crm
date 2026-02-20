"use client"

import { Card } from "../../../../components/ui/Card"
import { Button } from "../../../../components/ui/Button"
import { Select } from "../../../../components/ui/Select"
import { Checkbox } from "../../../../components/ui/Checkbox"
import { Input } from "../../../../components/ui/Input"
import { Modal } from "../../../../components/ui/Modal"
import { useAuth } from "../../../../lib/auth/AuthContext"
import { usePermissions } from "../../../../lib/hooks/usePermissions"
import { useRolePermissions } from "../../../../lib/hooks/useRolePermissions"
import { useRoles } from "../../../../lib/hooks/useRoles"
import { coreService } from "../../../../lib/services/coreService"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

import { ConfirmationModal } from "../../../../components/ui/ConfirmationModal"

export default function RolesSettingsPage() {
  const { role, token } = useAuth()
  const { data: roles, isLoading: rolesLoading } = useRoles()
  const { data: permissions, isLoading: permissionsLoading } = usePermissions()
  type PermissionItem = NonNullable<typeof permissions>[number]
  const [selectedRoleId, setSelectedRoleId] = useState("")
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null)
  const [newRoleName, setNewRoleName] = useState("")
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!selectedRoleId && roles?.length) {
      setSelectedRoleId(roles[0].id)
    }
  }, [roles, selectedRoleId])

  const { data: rolePermissions, isLoading: rolePermissionsLoading } = useRolePermissions(selectedRoleId)

  useEffect(() => {
    if (!selectedRoleId) return
    setSelectedPermissionIds((rolePermissions || []).map((permission) => permission.id))
  }, [rolePermissions, selectedRoleId])

  const groupedPermissions = useMemo(() => {
    const map = new Map<string, PermissionItem[]>()
    ;(permissions || []).forEach((permission) => {
      const key = permission.moduleKey || "عام"
      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push(permission)
    })
    return Array.from(map.entries())
  }, [permissions])

  const mutation = useMutation({
    mutationFn: () => coreService.updateRolePermissions(selectedRoleId, selectedPermissionIds, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role_permissions", selectedRoleId] })
      setMessage("تم حفظ الصلاحيات")
    }
  })

  const createRoleMutation = useMutation({
    mutationFn: (name: string) => coreService.createRole({ name }, token || undefined),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["roles"] })
      setIsCreateModalOpen(false)
      setNewRoleName("")
      setSelectedRoleId(data.id)
      setMessage("تم إنشاء الدور بنجاح")
    },
    onError: (error: any) => {
        setMessage(error?.response?.data?.message || "فشل إنشاء الدور")
    }
  })

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => coreService.deleteRole(id, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] })
      setSelectedRoleId("") 
      setMessage("تم حذف الدور بنجاح")
    },
    onError: (error: any) => {
      setMessage(error?.response?.data?.message || "فشل حذف الدور")
    }
  })

  if (role !== "owner") {
    return <Card title="إدارة الصلاحيات">غير مصرح لك بالدخول إلى هذه الصفحة</Card>
  }

  const selectedRole = roles?.find(r => r.id === selectedRoleId)
  const isSystemRole = selectedRole?.name === "owner" || selectedRole?.name === "admin" || selectedRole?.name === "team_leader" || selectedRole?.name === "sales"

  return (
    <div className="space-y-6">
      <Card title="إدارة الأدوار" actions={
          <Button onClick={() => setIsCreateModalOpen(true)}>إضافة دور جديد</Button>
      }>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-base-700">اختيار الدور لتعديل الصلاحيات</label>
            {rolesLoading && <p className="text-sm text-base-500">جاري تحميل الأدوار...</p>}
            <Select
              aria-label="اختيار الدور"
              title="اختيار الدور"
              className="text-right"
              value={selectedRoleId}
              onChange={(event) => {
                setSelectedRoleId(event.target.value)
                setMessage(null)
              }}
            >
              {(roles || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} {item.scope === 'tenant' ? '(مخصص)' : '(نظام)'}
                </option>
              ))}
            </Select>
          </div>
          
          <Button 
            variant="danger" 
            disabled={!selectedRoleId || isSystemRole || deleteRoleMutation.isPending}
            onClick={() => setDeleteConfirmationId(selectedRoleId)}
          >
            {deleteRoleMutation.isPending ? "جاري الحذف..." : "حذف الدور"}
          </Button>
        </div>
      </Card>

      <ConfirmationModal
        isOpen={!!deleteConfirmationId}
        onClose={() => setDeleteConfirmationId(null)}
        onConfirm={() => {
            if (deleteConfirmationId) {
                deleteRoleMutation.mutate(deleteConfirmationId)
            }
        }}
        title="تأكيد حذف الدور"
        description="هل أنت متأكد من حذف هذا الدور؟ لا يمكن التراجع عن هذا الإجراء، وسيتم إزالة جميع الصلاحيات المرتبطة به."
        confirmText="حذف نهائي"
      />

      <Card
        title={`صلاحيات الدور: ${selectedRole?.name || ''}`}
        actions={
          <div className="flex gap-2">
            <Button
                variant="secondary"
                onClick={() => {
                    const allIds = permissions?.map(p => p.id) || []
                    setSelectedPermissionIds(allIds)
                }}
            >
                تحديد الكل
            </Button>
            <Button
                variant="ghost"
                onClick={() => setSelectedPermissionIds([])}
            >
                إلغاء التحديد
            </Button>
            <Button
                aria-label="حفظ الصلاحيات"
                title="حفظ الصلاحيات"
                disabled={!selectedRoleId || mutation.isPending}
                onClick={() => {
                setMessage(null)
                mutation.mutate()
                }}
            >
                {mutation.isPending ? "جاري الحفظ..." : "حفظ الصلاحيات"}
            </Button>
          </div>
        }
      >
        {(permissionsLoading || rolePermissionsLoading) && <p className="text-sm text-base-500">جاري تحميل الصلاحيات...</p>}
        {message && <p className={`text-sm ${message.includes('فشل') ? 'text-red-600' : 'text-emerald-600'}`}>{message}</p>}
        
        <div className="space-y-6">
          {groupedPermissions.map(([moduleKey, items]) => (
            <div key={moduleKey} className="space-y-3">
              <div className="flex items-center justify-between border-b border-base-200 pb-2">
                  <p className="text-sm font-semibold text-base-900">{moduleKey}</p>
                  <div className="flex gap-2">
                      <button 
                        className="text-xs text-brand-600 hover:text-brand-700"
                        onClick={() => {
                            const ids = items.map(p => p.id)
                            setSelectedPermissionIds(prev => [...new Set([...prev, ...ids])])
                        }}
                      >
                          تحديد المجموعة
                      </button>
                      <button 
                        className="text-xs text-base-500 hover:text-base-700"
                        onClick={() => {
                            const ids = items.map(p => p.id)
                            setSelectedPermissionIds(prev => prev.filter(id => !ids.includes(id)))
                        }}
                      >
                          إلغاء المجموعة
                      </button>
                  </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {items.map((permission) => (
                  <div key={permission.id} className="rounded-lg border border-base-100 px-3 py-2 hover:bg-base-50 transition-colors">
                    <Checkbox
                      checked={selectedPermissionIds.includes(permission.id)}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...selectedPermissionIds, permission.id]
                          : selectedPermissionIds.filter((id) => id !== permission.id)
                        setSelectedPermissionIds(next)
                      }}
                      label={
                        <div className="flex flex-col">
                          <span className="font-medium text-base-900">{permission.code}</span>
                          <span className="text-xs text-base-500">{permission.description || "بدون وصف"}</span>
                        </div>
                      }
                      aria-label={permission.code}
                      title={permission.code}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="إضافة دور جديد"
      >
        <div className="space-y-4">
            <Input
                label="اسم الدور"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="مثال: مدير تسويق"
            />
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>إلغاء</Button>
                <Button 
                    disabled={!newRoleName.trim() || createRoleMutation.isPending}
                    onClick={() => createRoleMutation.mutate(newRoleName)}
                >
                    {createRoleMutation.isPending ? "جاري الإنشاء..." : "إنشاء"}
                </Button>
            </div>
        </div>
      </Modal>
    </div>
  )
}
