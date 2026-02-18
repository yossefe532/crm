"use client"

import { Input } from "../ui/Input"

export const PipelineFilters = ({ query, onChange }: { query: string; onChange: (value: string) => void }) => {
  return (
    <div className="flex flex-wrap gap-3 rounded-2xl border border-base-200 bg-base-0 p-4">
      <Input
        placeholder="ابحث عن عميل بالاسم أو الهاتف أو البريد أو الكود"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        aria-label="بحث العملاء"
        title="بحث العملاء"
        className="text-right"
      />
    </div>
  )
}
