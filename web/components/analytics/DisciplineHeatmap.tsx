"use client"

import { Card } from "../ui/Card"

const data = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  value: Math.floor(Math.random() * 5)
}))

const colors = ["bg-base-100", "bg-brand-500/20", "bg-brand-500/40", "bg-brand-500/70", "bg-brand-500"]

export const DisciplineHeatmap = () => {
  return (
    <Card title="خريطة الانضباط الأسبوعية">
      <div className="grid grid-cols-7 gap-2">
        {data.map((cell) => (
          <div key={cell.id} className={`h-8 w-full rounded ${colors[cell.value]}`} />
        ))}
      </div>
    </Card>
  )
}
