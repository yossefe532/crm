"use client"

import { useState } from "react"
import { KanbanBoard } from "../../../components/pipeline/KanbanBoard"
import { PipelineFilters } from "../../../components/pipeline/PipelineFilters"
import { PipelineAnalytics } from "../../../components/pipeline/PipelineAnalytics"
import { TeamBoard } from "../../../components/pipeline/TeamBoard"
import { useLeads } from "../../../lib/hooks/useLeads"

export default function PipelinePage() {
  const [query, setQuery] = useState("")
  const { data: leads } = useLeads(query)
  return (
    <div className="space-y-6">
      <PipelineFilters query={query} onChange={setQuery} />
      <TeamBoard leads={leads || []} />
      <KanbanBoard leads={leads || []} />
      <PipelineAnalytics leads={leads || []} />
    </div>
  )
}
