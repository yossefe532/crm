"use client"

import { NotificationsPanel } from "../../../components/notifications/NotificationsPanel"
import { NotificationSettingsForm } from "../../../components/notifications/NotificationSettingsForm"

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">مركز الإشعارات</h1>
      <NotificationSettingsForm />
      <NotificationsPanel fullPage={true} />
    </div>
  )
}
