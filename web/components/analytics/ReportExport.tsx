"use client"

import { useState } from "react"
import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"

export const ReportExport = () => {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const handleExport = () => {
    const content = `from,to\n${from},${to}`
    const blob = new Blob([content], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "report.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card title="تصدير التقارير">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Input
            id="report-from"
            label="من"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="text-right"
            aria-label="تاريخ البداية"
            title="تاريخ البداية"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Input
            id="report-to"
            label="إلى"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="text-right"
            aria-label="تاريخ النهاية"
            title="تاريخ النهاية"
          />
        </div>
        <Button onClick={handleExport} aria-label="تصدير CSV" title="تصدير CSV">تصدير CSV</Button>
      </div>
    </Card>
  )
}
