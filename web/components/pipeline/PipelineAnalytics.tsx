"use client"

import { Card } from "../ui/Card"
import { Lead } from "../../lib/types"
import { useLeads } from "../../lib/hooks/useLeads"

const stageLabels: Record<string, string> = {
  new: "جديد",
  call: "مكالمة هاتفية",
  meeting: "اجتماع",
  site_visit: "رؤية الموقع",
  closing: "إغلاق الصفقة"
}

export const PipelineAnalytics = ({ leads }: { leads?: Lead[] }) => {
  const { data } = useLeads()
  const resolved = leads || data || []
  const counts = (resolved || []).reduce<Record<string, number>>((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1
    return acc
  }, {})

  const callCount = counts.call || 0
  const meetingCount = counts.meeting || 0
  const siteVisitCount = counts.site_visit || 0
  const closingCount = counts.closing || 0
  const callToMeeting = callCount ? Math.round((meetingCount / callCount) * 100) : 0
  const meetingToVisit = meetingCount ? Math.round((siteVisitCount / meetingCount) * 100) : 0
  const visitToClosing = siteVisitCount ? Math.round((closingCount / siteVisitCount) * 100) : 0

  const bottlenecks = (Object.entries(counts) as Array<[string, number]>)
    .filter(([stage]) => stage !== "closing")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card title="معدلات التحويل">
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-base-100 px-3 py-2">
            <p className="text-sm text-base-700">من مكالمة إلى اجتماع</p>
            <span className="text-sm font-semibold text-base-900">{callToMeeting}%</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-base-100 px-3 py-2">
            <p className="text-sm text-base-700">من اجتماع إلى رؤية الموقع</p>
            <span className="text-sm font-semibold text-base-900">{meetingToVisit}%</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-base-100 px-3 py-2">
            <p className="text-sm text-base-700">من رؤية الموقع إلى الإغلاق</p>
            <span className="text-sm font-semibold text-base-900">{visitToClosing}%</span>
          </div>
        </div>
      </Card>
      <Card title="نقاط التعطّل">
        <div className="space-y-3">
          {bottlenecks.map(([stage, count]) => (
            <div key={stage} className="flex items-center justify-between rounded-lg border border-base-100 px-3 py-2">
              <p className="text-sm font-semibold text-base-900">{stageLabels[stage] || stage}</p>
              <span className="text-xs text-base-500">{count} عميل</span>
            </div>
          ))}
          {bottlenecks.length === 0 && <p className="text-sm text-base-500">لا توجد بيانات</p>}
        </div>
      </Card>
    </div>
  )
}
