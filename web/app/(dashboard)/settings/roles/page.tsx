"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Card } from "../../../../components/ui/Card"
import { Button } from "../../../../components/ui/Button"
import { Select } from "../../../../components/ui/Select"
import { Checkbox } from "../../../../components/ui/Checkbox"
import { useAuth } from "../../../../lib/auth/AuthContext"
import { useRoles } from "../../../../lib/hooks/useRoles"
import { usePermissions } from "../../../../lib/hooks/usePermissions"
import { useRolePermissions } from "../../../../lib/hooks/useRolePermissions"
import { coreService } from "../../../../lib/services/coreService"

export default function RolesSettingsPage() {
  const { role, token } = useAuth()
  const { data: roles, isLoading: rolesLoading } = useRoles()
  const { data: permissions, isLoading: permissionsLoading } = usePermissions()
  type PermissionItem = NonNullable<typeof permissions>[number]
  const [selectedRoleId, setSelectedRoleId] = useState("")
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
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

  if (role !== "owner") {
    return <Card title="إدارة الصلاحيات">غير مصرح لك بالدخول إلى هذه الصفحة</Card>
  }

  return (
    <div className="space-y-6">
      <Card title="تحديد الدور">
        <div className="flex flex-col gap-3">
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
                {item.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card
        title="الصلاحيات"
        actions={
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
        }
      >
        {(permissionsLoading || rolePermissionsLoading) && <p className="text-sm text-base-500">جاري تحميل الصلاحيات...</p>}
        {message && <p className="text-sm text-emerald-600">{message}</p>}
        <div className="space-y-6">
          {groupedPermissions.map(([moduleKey, items]) => (
            <div key={moduleKey} className="space-y-3">
              <p className="text-sm font-semibold text-base-900">{moduleKey}</p>
              <div className="grid gap-3 md:grid-cols-2">
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
    </div>
  )
}
