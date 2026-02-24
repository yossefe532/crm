"use client"

import { useState } from "react"
import { KanbanBoard } from "../../../components/pipeline/KanbanBoard"
import { PipelineFilters } from "../../../components/pipeline/PipelineFilters"
import { PipelineAnalytics } from "../../../components/pipeline/PipelineAnalytics"
import { TeamBoard } from "../../../components/pipeline/TeamBoard"
import { MobileLeadList } from "../../../components/pipeline/MobileLeadList"
import { useLeads } from "../../../lib/hooks/useLeads"

export default function PipelinePage() {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [assignment, setAssignment] = useState("all")
  const [view, setView] = useState<"team" | "kanban">("team")
  
  // Fetch more leads for Kanban view to avoid empty columns (up to 1000)
  const { data: leads } = useLeads({ query, pageSize: 1000, status, assignment })
  
  return (
    <div className="space-y-6">
      <PipelineFilters 
        query={query} 
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        assignment={assignment}
        onAssignmentChange={setAssignment}
      />

      {/* Mobile View: List Only */}
      <div className="md:hidden">
        <MobileLeadList leads={leads || []} />
      </div>

      {/* Desktop View: Kanban/Team Boards with Toggle */}
      <div className="hidden md:block space-y-4">
        <div className="flex gap-2 w-full max-w-xs">
          <button
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${view === "team" ? "bg-brand-600 text-white shadow-sm" : "bg-white text-base-700 border border-base-200 hover:bg-base-50"}`}
            onClick={() => setView("team")}
          >
            عرض القائمة
          </button>
          <button
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${view === "kanban" ? "bg-brand-600 text-white shadow-sm" : "bg-white text-base-700 border border-base-200 hover:bg-base-50"}`}
            onClick={() => setView("kanban")}
          >
            عرض اللوحة
          </button>
        </div>
        
        {view === "team" ? <TeamBoard leads={leads || []} /> : <KanbanBoard leads={leads || []} />}
        
        <PipelineAnalytics leads={leads || []} />
      </div>
    </div>
  )
}
