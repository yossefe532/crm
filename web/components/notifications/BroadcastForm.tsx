"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { notificationService } from "../../lib/services/notificationService"
import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"
import { Textarea } from "../ui/Textarea"
import { Select } from "../ui/Select"
import { Checkbox } from "../ui/Checkbox"
import { useAuth } from "../../lib/auth/AuthContext"
import { useUsers } from "../../lib/hooks/useUsers"
import { useTeams } from "../../lib/hooks/useTeams"

export const BroadcastForm = () => {
  const { role } = useAuth()
  const { data: users } = useUsers()
  const { data: teams } = useTeams()
  const [targetType, setTargetType] = useState<"all" | "role" | "users" | "team">("all")
  const [targetValue, setTargetValue] = useState("")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [userSearch, setUserSearch] = useState("")
  const [message, setMessage] = useState("")
  const [channels, setChannels] = useState<string[]>(["in_app", "push"])
  const [success, setSuccess] = useState(false)
  const visibleUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase()
    return (users || []).filter((user) => {
      if (!query) return true
      return (
        user.email.toLowerCase().includes(query) ||
        (user.name || "").toLowerCase().includes(query) ||
        (user.phone || "").includes(query)
      )
    })
  }, [userSearch, users])

  // Set default target value when type changes
  useEffect(() => {
    if (targetType === "team" && teams && teams.length > 0) {
      setTargetValue(teams[0].id)
    } else if (targetType === "role") {
      setTargetValue("sales") // Default role
    } else {
      setTargetValue("")
    }
  }, [targetType, teams])

  useEffect(() => {
    setSuccess(false)
  }, [message, targetType, targetValue, selectedUsers])

  const mutation = useMutation({
    mutationFn: () => {
      if (targetType === "users") {
        return notificationService.broadcast({ type: targetType, value: selectedUsers }, message, channels)
      }
      return notificationService.broadcast({ type: targetType, value: targetValue }, message, channels)
    },
    onSuccess: () => {
      setSuccess(true)
      setMessage("")
      setSelectedUsers([])
    }
  })

  if (role !== "owner") return null

  const toggleChannel = (channel: string) => {
    if (channels.includes(channel)) {
      setChannels(channels.filter((c) => c !== channel))
    } else {
      setChannels([...channels, channel])
    }
  }

  return (
    <Card title="إرسال إشعار جماعي">
      <div className="space-y-4">
        <div>
          <Select
            label="الهدف"
            className="text-right"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as any)}
          >
            <option value="all">الكل</option>
            <option value="role">دور محدد</option>
            <option value="team">فريق محدد</option>
            <option value="users">مستخدمون محددون</option>
          </Select>
        </div>

        {targetType === "role" && (
          <div>
            <Select
              label="الدور"
              className="text-right"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            >
              <option value="sales">مندوب مبيعات</option>
              <option value="team_leader">قائد فريق</option>
              <option value="owner">المالك</option>
            </Select>
          </div>
        )}
        {targetType === "team" && (
          <div>
            <Select
              label="الفريق"
              className="text-right"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            >
              <option value="">اختر الفريق</option>
              {(teams || []).map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {targetType === "users" && (
          <div className="space-y-3">
            <Input
              label="اختيار المستخدمين"
              type="text"
              className="text-right"
              placeholder="ابحث بالبريد أو الهاتف"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-2 custom-scrollbar">
              {visibleUsers.map((user) => (
                <div key={user.id} className="flex items-center gap-2 hover:bg-base-50 p-1 rounded">
                  <Checkbox
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => {
                      setSelectedUsers((prev) =>
                        prev.includes(user.id) ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                      )
                    }}
                    label={<span className="text-sm text-gray-700">{user.name || user.email}</span>}
                  />
                </div>
              ))}
              {visibleUsers.length === 0 && <p className="text-sm text-gray-500">لا يوجد مستخدمون</p>}
            </div>
          </div>
        )}

        <div>
          <Textarea
            label="الرسالة"
            className="text-right"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="خلي بالك في الجديد"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <Checkbox
            checked={channels.includes("in_app")}
            onChange={() => toggleChannel("in_app")}
            label="داخل التطبيق"
          />
          <Checkbox
            checked={channels.includes("push")}
            onChange={() => toggleChannel("push")}
            label="تنبيه متصفح"
          />
          <Checkbox
            checked={channels.includes("sms")}
            onChange={() => toggleChannel("sms")}
            label="رسالة نصية (SMS)"
          />
        </div>

        <Button
          onClick={() => mutation.mutate()}
          disabled={
            mutation.isPending ||
            !message ||
            (targetType === "role" && !targetValue) ||
            (targetType === "team" && !targetValue) ||
            (targetType === "users" && selectedUsers.length === 0)
          }
        >
          {mutation.isPending ? "جاري الإرسال..." : "إرسال"}
        </Button>
        
        {success && <p className="text-green-600">تم الإرسال بنجاح!</p>}
        {mutation.isError && <p className="text-red-600">فشل الإرسال</p>}
      </div>
    </Card>
  )
}
