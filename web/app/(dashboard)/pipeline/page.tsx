"use client"

import { useState } from "react"
import { KanbanBoard } from "../../../components/pipeline/KanbanBoard"
import { PipelineFilters } from "../../../components/pipeline/PipelineFilters"
import { PipelineAnalytics } from "../../../components/pipeline/PipelineAnalytics"
import { TeamBoard } from "../../../components/pipeline/TeamBoard"
import { useLeads } from "../../../lib/hooks/useLeads"

export default function PipelinePage() {
  const [query, setQuery] = useState("")
  const [view, setView] = useState<"team" | "kanban">("team")
  const { data: leads } = useLeads(query)
  return (
    <div className="space-y-6">
      <PipelineFilters query={query} onChange={setQuery} />
      <div className="md:hidden flex gap-2">
        <button
          className={`flex-1 rounded-md px-3 py-2 text-sm ${view === "team" ? "bg-brand-600 text-white" : "bg-white text-base-700 border border-base-200"}`}
          onClick={() => setView("team")}
        >
          قائمة
        </button>
        <button
          className={`flex-1 rounded-md px-3 py-2 text-sm ${view === "kanban" ? "bg-brand-600 text-white" : "bg-white text-base-700 border border-base-200"}`}
          onClick={() => setView("kanban")}
        >
          كانبان
        </button>
      </div>
      {view === "team" ? <TeamBoard leads={leads || []} /> : <KanbanBoard leads={leads || []} />}
      <div className="hidden md:block">
        <PipelineAnalytics leads={leads || []} />
      </div>
    </div>
  )
}
