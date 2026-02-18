"use client"

import { Card } from "../ui/Card"
import { Stat } from "../ui/Stat"
import { useMetrics } from "../../lib/hooks/useMetrics"

export const MetricsGrid = () => {
  const { data, isLoading, isError } = useMetrics()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
      {isLoading && <p className="col-span-full text-sm text-base-500">جاري تحميل المؤشرات...</p>}
      {isError && <p className="col-span-full text-sm text-rose-500">تعذر تحميل المؤشرات</p>}
      {data?.map((metric) => (
        <Card key={metric.label}>
          <Stat label={metric.label} value={metric.value} change={metric.change} />
        </Card>
      ))}
    </div>
  )
}
