"use client"

import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { Checkbox } from "../ui/Checkbox"
import { useNotificationSettings, useUpsertNotificationSetting } from "../../lib/hooks/useNotifications"
import { usePush } from "../../lib/hooks/usePush"
import { toast } from "sonner"

type SettingItem = {
  id?: string
  eventKey: string
  channels: string[]
  fallbackChannel?: string | null
  isEnabled: boolean
}

const upsertChannel = (channels: string[], channel: string, enabled: boolean) => {
  const set = new Set(channels)
  if (enabled) set.add(channel)
  else set.delete(channel)
  return Array.from(set)
}

export const NotificationSettingsForm = () => {
  const { data, isLoading } = useNotificationSettings()
  const { mutateAsync, isPending } = useUpsertNotificationSetting()
  const { isSubscribed, subscribe, unsubscribe } = usePush()

  const defaults: SettingItem[] = [
    { eventKey: "default", channels: ["in_app", "push"], fallbackChannel: "sms", isEnabled: true },
    { eventKey: "notification.reminder", channels: ["in_app", "push"], fallbackChannel: "sms", isEnabled: true }
  ]

  const settings = defaults.map((d) => data?.find((s) => s.eventKey === d.eventKey) || d)

  const saveSetting = async (setting: SettingItem) => {
    try {
      await mutateAsync({
        eventKey: setting.eventKey,
        channels: setting.channels,
        fallbackChannel: setting.fallbackChannel || null,
        isEnabled: setting.isEnabled
      })
      toast.success("تم حفظ إعدادات الإشعارات")
    } catch {
      toast.error("فشل حفظ إعدادات الإشعارات")
    }
  }

  if (isLoading) {
    return (
      <Card title="إعدادات الإشعارات الخارجية">
        <p className="text-sm text-base-500">جاري تحميل الإعدادات...</p>
      </Card>
    )
  }

  return (
    <Card title="إعدادات الإشعارات الخارجية">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-base-200 p-3">
          <span className="text-sm text-base-700">اشتراك Push:</span>
          <Button size="sm" variant={isSubscribed ? "outline" : "primary"} onClick={() => (isSubscribed ? unsubscribe() : subscribe())}>
            {isSubscribed ? "إلغاء الاشتراك" : "تفعيل الإشعارات"}
          </Button>
        </div>

        {settings.map((setting) => {
          const channels = setting.channels || []
          return (
            <div key={setting.eventKey} className="rounded-lg border border-base-200 p-3">
              <p className="text-sm font-semibold text-base-800 mb-2">{setting.eventKey}</p>
              <div className="grid gap-2 md:grid-cols-3">
                <Checkbox
                  label="داخل النظام"
                  checked={channels.includes("in_app")}
                  onChange={(e) => saveSetting({ ...setting, channels: upsertChannel(channels, "in_app", e.target.checked) })}
                  disabled={isPending}
                />
                <Checkbox
                  label="Push"
                  checked={channels.includes("push")}
                  onChange={(e) => saveSetting({ ...setting, channels: upsertChannel(channels, "push", e.target.checked) })}
                  disabled={isPending}
                />
                <Checkbox
                  label="قناة بديلة SMS"
                  checked={setting.fallbackChannel === "sms"}
                  onChange={(e) => saveSetting({ ...setting, fallbackChannel: e.target.checked ? "sms" : null })}
                  disabled={isPending}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
