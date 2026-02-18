"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"
import { Checkbox } from "../ui/Checkbox"
import { useAuth } from "../../lib/auth/AuthContext"
import { usePush } from "../../lib/hooks/usePush"
import { notificationService } from "../../lib/services/notificationService"

export const PushPolicyForm = () => {
  const { token, role } = useAuth()
  const { isSubscribed, subscribe } = usePush()
  const { data } = useQuery({
    queryKey: ["notification_policy"],
    queryFn: () => notificationService.getPolicy(token || undefined),
    enabled: role === "owner"
  })
  const [enabled, setEnabled] = useState(true)
  const [dailyLimit, setDailyLimit] = useState("10")
  const [quietEnabled, setQuietEnabled] = useState(true)
  const [quietStart, setQuietStart] = useState("22")
  const [quietEnd, setQuietEnd] = useState("8")

  useEffect(() => {
    if (!data) return
    setEnabled(data.enabled)
    setDailyLimit(String(data.dailyLimit))
    setQuietEnabled(data.quietHours.enabled)
    setQuietStart(String(data.quietHours.start))
    setQuietEnd(String(data.quietHours.end))
  }, [data])

  const mutation = useMutation({
    mutationFn: () =>
      notificationService.updatePolicy(
        {
          enabled,
          dailyLimit: Number(dailyLimit || 10),
          quietHours: { enabled: quietEnabled, start: Number(quietStart || 22), end: Number(quietEnd || 8) }
        },
        token || undefined
      )
  })

  if (role !== "owner") return null

  const resolved = data || { enabled: true, dailyLimit: 10, quietHours: { enabled: true, start: 22, end: 8 } }

  return (
    <Card title="سياسات الإشعارات">
      <div className="grid gap-3 md:grid-cols-2">
        <Checkbox
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          label="تفعيل الإشعارات"
        />
        <Checkbox
          checked={quietEnabled}
          onChange={(event) => setQuietEnabled(event.target.checked)}
          label="تفعيل ساعات الهدوء"
        />
        <div>
          <Input
            label="الحد اليومي (حتى 50)"
            className="text-right"
            value={dailyLimit}
            onChange={(event) => setDailyLimit(event.target.value)}
            placeholder={`${resolved.dailyLimit}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Input
              label="من الساعة"
              className="text-right"
              value={quietStart}
              onChange={(event) => setQuietStart(event.target.value)}
              placeholder={`${resolved.quietHours.start}`}
            />
          </div>
          <div>
            <Input
              label="إلى الساعة"
              className="text-right"
              value={quietEnd}
              onChange={(event) => setQuietEnd(event.target.value)}
              placeholder={`${resolved.quietHours.end}`}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => subscribe()}>
          {isSubscribed ? "التنبيهات مفعلة" : "تفعيل تنبيهات المتصفح"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setEnabled(resolved.enabled)
            setDailyLimit(String(resolved.dailyLimit))
            setQuietEnabled(resolved.quietHours.enabled)
            setQuietStart(String(resolved.quietHours.start))
            setQuietEnd(String(resolved.quietHours.end))
          }}
        >
          استرجاع الإعدادات
        </Button>
        <Button type="button" onClick={() => mutation.mutate()}>
          {mutation.isPending ? "جاري الحفظ..." : "حفظ السياسات"}
        </Button>
      </div>
    </Card>
  )
}
