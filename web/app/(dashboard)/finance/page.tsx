"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Card } from "../../../components/ui/Card"
import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { useFinanceEntries } from "../../../lib/hooks/useFinanceEntries"
import { coreService } from "../../../lib/services/coreService"
import { useAuth } from "../../../lib/auth/AuthContext"

export default function FinancePage() {
  const { role, token } = useAuth()
  const { data } = useFinanceEntries()
  const [entryType, setEntryType] = useState("expense")
  const [category, setCategory] = useState("")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [occurredAt, setOccurredAt] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () =>
      coreService.createFinanceEntry(
        { entryType: entryType as "income" | "expense", category, amount: Number(amount), note: note || undefined, occurredAt: occurredAt || undefined },
        token || undefined
      ),
    onSuccess: () => {
      setCategory("")
      setAmount("")
      setNote("")
      setOccurredAt("")
      setMessage("تم حفظ العملية المالية")
      queryClient.invalidateQueries({ queryKey: ["finance_entries"] })
    }
  })

  if (role !== "owner") {
    return <Card title="المالية">غير مصرح</Card>
  }

  const now = new Date()
  const currentKey = `${now.getFullYear()}-${now.getMonth() + 1}`
  const grouped = (data || []).reduce<Record<string, typeof data>>((acc, item) => {
    const date = new Date(item.occurredAt)
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`
    acc[key] = acc[key] || []
    acc[key]?.push(item)
    return acc
  }, {})
  const currentEntries = grouped[currentKey] || []
  const archiveKeys = Object.keys(grouped)
    .filter((key) => key !== currentKey)
    .sort((a, b) => {
      const [ay, am] = a.split("-").map(Number)
      const [by, bm] = b.split("-").map(Number)
      return new Date(by, bm - 1, 1).getTime() - new Date(ay, am - 1, 1).getTime()
    })
    .slice(0, 6)
  const annualSummary = (data || []).reduce<Record<string, { income: number; expense: number }>>((acc, item) => {
    const year = new Date(item.occurredAt).getFullYear().toString()
    if (!acc[year]) acc[year] = { income: 0, expense: 0 }
    if (item.entryType === "income") acc[year].income += item.amount || 0
    if (item.entryType === "expense") acc[year].expense += item.amount || 0
    return acc
  }, {})
  const annualKeys = Object.keys(annualSummary).sort((a, b) => Number(b) - Number(a))
  const totalIncome = currentEntries.filter((item) => item.entryType === "income").reduce((sum, item) => sum + (item.amount || 0), 0)
  const totalExpense = currentEntries.filter((item) => item.entryType === "expense").reduce((sum, item) => sum + (item.amount || 0), 0)

  return (
    <div className="space-y-6">
      <Card title="ملخص مالي">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-base-100 px-4 py-3">
            <p className="text-xs text-base-500">الدخل</p>
            <p className="text-lg font-semibold text-base-900">{totalIncome.toLocaleString("ar-EG")}</p>
          </div>
          <div className="rounded-lg border border-base-100 px-4 py-3">
            <p className="text-xs text-base-500">المصروفات</p>
            <p className="text-lg font-semibold text-base-900">{totalExpense.toLocaleString("ar-EG")}</p>
          </div>
          <div className="rounded-lg border border-base-100 px-4 py-3">
            <p className="text-xs text-base-500">الصافي</p>
            <p className="text-lg font-semibold text-base-900">{(totalIncome - totalExpense).toLocaleString("ar-EG")}</p>
          </div>
        </div>
      </Card>
      <Card title="إضافة عملية مالية">
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[160px_1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault()
            setMessage(null)
            if (!category.trim() || !amount) {
              setMessage("التصنيف والقيمة مطلوبان")
              return
            }
            mutation.mutate()
          }}
        >
          <Select
            className="text-right"
            value={entryType}
            onChange={(event) => setEntryType(event.target.value)}
          >
            <option value="expense">مصروف</option>
            <option value="income">دخل</option>
          </Select>
          <Input
            className="text-right"
            placeholder="التصنيف"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />
          <Input
            className="text-right"
            placeholder="القيمة"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </form>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            className="text-right"
            type="datetime-local"
            placeholder="تاريخ العملية"
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
          />
          <Select
            className="text-right"
            value={occurredAt ? (new Date(occurredAt).getTime() > Date.now() ? "advance" : "normal") : ""}
            onChange={() => {}}
          >
            <option value="">نوع التاريخ</option>
            <option value="normal">تاريخ سابق / حالي</option>
            <option value="advance">مقدم (مستقبلي)</option>
          </Select>
        </div>
        <Input
          className="mt-3 text-right"
          placeholder="ملاحظة (اختياري)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {message && <p className="mt-3 text-sm text-base-600">{message}</p>}
      </Card>
      <Card title="تفاصيل الشهر الحالي">
        <div className="space-y-3">
          {currentEntries.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-100 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-base-900">{item.category}</p>
                <p className="text-xs text-base-500">{new Date(item.occurredAt).toLocaleString("ar-EG")}</p>
              </div>
              <div className="text-sm font-medium text-base-900">
                {item.entryType === "expense" ? "-" : "+"}
                {item.amount.toLocaleString("ar-EG")}
              </div>
              <div className="w-full sm:w-auto">
                {(new Date(item.occurredAt).getTime() > Date.now()) && <span className="rounded bg-amber-200 px-2 py-1 text-[11px] text-amber-800">مقدم</span>}
                {(new Date(item.occurredAt).getMonth() < new Date().getMonth() || new Date(item.occurredAt).getFullYear() < new Date().getFullYear()) && <span className="ml-2 rounded bg-base-200 px-2 py-1 text-[11px] text-base-800">قديم</span>}
              </div>
            </div>
          ))}
          {currentEntries.length === 0 && <p className="text-sm text-base-500">لا توجد عمليات هذا الشهر</p>}
        </div>
      </Card>
      <Card title="أرشيف آخر 6 شهور">
        <div className="space-y-4">
          {archiveKeys.map((key) => (
            <div key={key} className="rounded-2xl border border-base-100 p-4">
              <p className="text-sm font-semibold text-base-900">شهر {key}</p>
              <div className="mt-3 space-y-3">
                {(grouped[key] || []).map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-100 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-base-900">{item.category}</p>
                      <p className="text-xs text-base-500">{new Date(item.occurredAt).toLocaleString("ar-EG")}</p>
                    </div>
                    <div className="text-sm font-medium text-base-900">
                      {item.entryType === "expense" ? "-" : "+"}
                      {item.amount.toLocaleString("ar-EG")}
                    </div>
                    <div className="w-full sm:w-auto">
                      {(new Date(item.occurredAt).getTime() > Date.now()) && <span className="rounded bg-amber-200 px-2 py-1 text-[11px] text-amber-800">مقدم</span>}
                      <span className="ml-2 rounded bg-base-200 px-2 py-1 text-[11px] text-base-800">قديم</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {archiveKeys.length === 0 && <p className="text-sm text-base-500">لا يوجد أرشيف بعد</p>}
        </div>
      </Card>
      <Card title="ملخص سنوي">
        <div className="space-y-3">
          {annualKeys.map((year) => (
            <div key={year} className="rounded-lg border border-base-100 px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-base-900">سنة {year}</p>
                <span className="text-sm font-semibold text-base-900">
                  {(annualSummary[year].income - annualSummary[year].expense).toLocaleString("ar-EG")}
                </span>
              </div>
              <p className="text-xs text-base-500">
                دخل {annualSummary[year].income.toLocaleString("ar-EG")} • مصروفات {annualSummary[year].expense.toLocaleString("ar-EG")}
              </p>
            </div>
          ))}
          {annualKeys.length === 0 && <p className="text-sm text-base-500">لا توجد بيانات سنوية بعد</p>}
        </div>
      </Card>
    </div>
  )
}
