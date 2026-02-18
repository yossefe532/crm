"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { coreService } from "../../lib/services/coreService"
import { useAuth } from "../../lib/auth/AuthContext"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"
import { Checkbox } from "../ui/Checkbox"
import { useState } from "react"

export const UserPermissionPanel = ({ userId, userName, roles, onClose }: { userId: string; userName: string; roles: string[]; onClose: () => void }) => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const isOwner = roles.includes("owner")
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState("")
  
  const { data: allPermissions, isLoading: isLoadingAll } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => coreService.listPermissions(token || undefined)
  })

  const { data: userPermissions, isLoading: isLoadingUser } = useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: () => coreService.listUserPermissions(userId, token || undefined),
    enabled: !isOwner
  })

  const updateMutation = useMutation({
    mutationFn: (permissionIds: string[]) => coreService.updateUserPermissions(userId, permissionIds, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions", userId] })
      onClose()
      alert("تم تحديث الصلاحيات بنجاح")
    }
  })

  const permissionsByModule = (allPermissions || []).reduce((acc, perm) => {
    const moduleKey = perm.moduleKey || "General"
    const query = search.trim().toLowerCase()
    if (query && !perm.code.toLowerCase().includes(query) && !(perm.description || "").toLowerCase().includes(query)) {
      return acc
    }
    if (!acc[moduleKey]) acc[moduleKey] = []
    acc[moduleKey].push(perm)
    return acc
  }, {} as Record<string, typeof allPermissions>)

  const isRoleGranted = (permissionId: string) => {
    return userPermissions?.rolePermissions.some(p => p.id === permissionId)
  }

  const isDirectlyGranted = (permissionId: string) => {
    return userPermissions?.directPermissions.some(p => p.id === permissionId)
  }

  const isChecked = (permissionId: string) => {
    if (isRoleGranted(permissionId)) return true
    if (permissionId in pendingChanges) return pendingChanges[permissionId]
    return isDirectlyGranted(permissionId)
  }

  const handleCheckboxChange = (permissionId: string) => {
    if (isRoleGranted(permissionId)) return
    const current = isChecked(permissionId)
    setPendingChanges(prev => ({ ...prev, [permissionId]: !current }))
  }

  const handleModuleToggle = (modulePermissions: Array<{ id: string }>) => {
    const next: Record<string, boolean> = {}
    const hasUnchecked = modulePermissions.some((permission) => !isChecked(permission.id) && !isRoleGranted(permission.id))
    modulePermissions.forEach((permission) => {
      if (isRoleGranted(permission.id)) return
      next[permission.id] = hasUnchecked
    })
    setPendingChanges((prev) => ({ ...prev, ...next }))
  }

  const handleSave = () => {
    // Calculate final direct permissions
    const finalDirectIds = (allPermissions || [])
      .filter(p => {
        if (isRoleGranted(p.id)) return false // Don't save role permissions as direct
        return isChecked(p.id)
      })
      .map(p => p.id)

    updateMutation.mutate(finalDirectIds)
  }

  if (isOwner) {
    return (
      <div className="rounded-lg border border-base-200 bg-base-0 p-4 shadow-sm mt-4 dark:border-base-700 dark:bg-base-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="font-semibold text-lg text-base-900 dark:text-base-50">صلاحيات المستخدم: {userName}</h3>
          <Button variant="ghost" onClick={onClose}>إغلاق</Button>
        </div>
        <p className="text-base-600 dark:text-base-400">هذا المستخدم لديه صلاحيات المالك (Owner) ويتمتع بكامل الصلاحيات تلقائياً.</p>
      </div>
    )
  }

  if (isLoadingAll || isLoadingUser) return <div className="p-4">جاري التحميل...</div>

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">صلاحيات المستخدم: {userName}</h3>
        <Button variant="ghost" onClick={onClose}>إغلاق</Button>
      </div>

      <div className="space-y-4">
        <Input
          className="text-right"
          placeholder="بحث في الصلاحيات"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="space-y-6 max-h-[60vh] overflow-y-auto">
        {Object.entries(permissionsByModule).map(([module, permissions]) => (
          <div key={module}>
            <div className="mb-2 flex items-center justify-between border-b pb-1">
              <h4 className="font-medium text-gray-700">{module.toUpperCase()}</h4>
              <Button variant="ghost" onClick={() => handleModuleToggle(permissions || [])}>تحديد الكل</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {permissions?.map(permission => {
                const roleGranted = isRoleGranted(permission.id)
                return (
                  <div key={permission.id} className="p-2 hover:bg-base-50 rounded transition-colors">
                    <Checkbox
                      checked={isChecked(permission.id)}
                      disabled={roleGranted}
                      onChange={() => handleCheckboxChange(permission.id)}
                      label={
                        <div className="flex flex-col">
                          <span className="font-medium text-base-900">{permission.code}</span>
                          {permission.description && <span className="text-xs text-base-500">{permission.description}</span>}
                          {roleGranted && <span className="text-xs text-amber-600">(من الدور)</span>}
                        </div>
                      }
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end gap-2 pt-4 border-t">
        <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
        </Button>
      </div>
    </div>
  )
}
