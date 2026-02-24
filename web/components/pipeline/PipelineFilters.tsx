"use client"

import { Input } from "../ui/Input"
import { Select } from "../ui/Select"

interface PipelineFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  assignment: string;
  onAssignmentChange: (value: string) => void;
}

export const PipelineFilters = ({ query, onQueryChange, status, onStatusChange, assignment, onAssignmentChange }: PipelineFiltersProps) => {
  return (
    <div className="flex flex-wrap gap-3 rounded-2xl border border-base-200 bg-base-0 p-4 items-end">
      <div className="flex-1 min-w-[200px]">
        <Input
          placeholder="ابحث عن عميل بالاسم أو الهاتف أو البريد أو الكود"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label="بحث العملاء"
          title="بحث العملاء"
          className="text-right w-full"
        />
      </div>
      <div className="w-full sm:w-auto min-w-[150px]">
        <Select
          label="الحالة"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          options={[
            { value: "all", label: "الكل" },
            { value: "new", label: "جديد" },
            { value: "won", label: "صفقة ناجحة" },
            { value: "lost", label: "صفقة فاشلة" },
            // Add other statuses if needed
          ]}
        />
      </div>
       <div className="w-full sm:w-auto min-w-[150px]">
        <Select
          label="الإسناد"
          value={assignment}
          onChange={(e) => onAssignmentChange(e.target.value)}
          options={[
            { value: "all", label: "الكل" },
            { value: "assigned", label: "مسند" },
            { value: "unassigned", label: "غير مسند" },
          ]}
        />
      </div>
    </div>
  )
}
