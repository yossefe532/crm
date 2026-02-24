"use client"

import { useEffect, useState } from "react"
import { MetricsGrid } from "../../../components/dashboard/MetricsGrid"
import { PerformanceCharts } from "../../../components/analytics/PerformanceCharts"
import { KanbanBoard } from "../../../components/pipeline/KanbanBoard"
import { LeadList } from "../../../components/dashboard/LeadList"
import { RoleCatalog } from "../../../components/catalog/RoleCatalog"
import { NotificationsPanel } from "../../../components/notifications/NotificationsPanel"
import { BroadcastForm } from "../../../components/notifications/BroadcastForm"
import { PushPolicyForm } from "../../../components/notifications/PushPolicyForm"
import { LeadOutcomePanel } from "../../../components/owner/LeadOutcomePanel"
import { LeadStageSummary } from "../../../components/dashboard/LeadStageSummary"

export default function OwnerDashboard() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="h-32 rounded-xl bg-base-100 animate-pulse" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-64 rounded-xl bg-base-100 animate-pulse" />
          <div className="h-64 rounded-xl bg-base-100 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <MetricsGrid />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PerformanceCharts />
        <NotificationsPanel />
      </div>
      <div className="grid grid-cols-1 gap-6">
        <KanbanBoard />
      </div>
      <div className="grid grid-cols-1 gap-6">
        <LeadOutcomePanel />
        <LeadStageSummary />
      </div>
      <div className="grid grid-cols-1 gap-6">
        <BroadcastForm />
        <PushPolicyForm />
      </div>
      <RoleCatalog role="owner" />
    </div>
  )
}
