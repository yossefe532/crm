"use client"

import { Card } from "../ui/Card"
import { Progress } from "../ui/Progress"
import { useLeads } from "../../lib/hooks/useLeads"
import { useTeams } from "../../lib/hooks/useTeams"

export const TeamPerformance = () => {
  const { data: leads } = useLeads()
  const { data: teams } = useTeams()

  const rows = (teams || []).map((team) => {
    const teamLeads = (leads || []).filter((lead) => lead.teamId === team.id)
    const closed = teamLeads.filter((lead) => lead.status === "closing").length
    const total = teamLeads.length || 1
    const value = Math.round((closed / total) * 100)
    return { id: team.id, name: team.name, value }
  })

  return (
    <Card title="أداء الفرق">
      <div className="space-y-4">
        {rows.map((team) => (
          <div key={team.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-base-900">{team.name}</p>
              <span className="text-sm text-base-600">{team.value}%</span>
            </div>
            <Progress value={team.value} />
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-base-500">لا توجد بيانات للعرض</p>}
      </div>
    </Card>
  )
}
