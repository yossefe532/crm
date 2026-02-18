"use client"

import { Card } from "../ui/Card"
import { Stat } from "../ui/Stat"
import { useMetrics } from "../../lib/hooks/useMetrics"

export const MetricsGrid = () => {
  const { data, isLoading, isError } = useMetrics()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {isLoading && (
        <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-24 bg-base-200 rounded" />
                <div className="h-8 w-32 bg-base-200 rounded" />
                <div className="h-3 w-20 bg-base-200 rounded" />
              </div>
            </Card>
          ))}
        </div>
      )}
      {isError && <p className="col-span-full text-sm text-rose-500">تعذر تحميل المؤشرات</p>}
      {data?.map((metric) => (
        <Card key={metric.label} className="min-h-[120px]">
          <Stat label={metric.label} value={metric.value} change={metric.change} />
        </Card>
      ))}
    </div>
  )
}
