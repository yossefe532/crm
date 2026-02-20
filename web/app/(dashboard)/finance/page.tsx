"use client"

import { useState, useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Card } from "../../../components/ui/Card"
import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Modal } from "../../../components/ui/Modal"
import { ConfirmationModal } from "../../../components/ui/ConfirmationModal"
import { useFinanceEntries } from "../../../lib/hooks/useFinanceEntries"
import { coreService } from "../../../lib/services/coreService"
import { useAuth } from "../../../lib/auth/AuthContext"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts"
import { format } from "date-fns"
import { ar } from "date-fns/locale"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const CATEGORY_LABELS: Record<string, string> = {
  "sales_revenue": "عائد مبيعات",
  "salary": "رواتب",
  "rent": "إيجار",
  "commission": "عمولات",
  "marketing": "تسويق",
  "office": "مصاريف مكتبية",
  "software": "برمجيات",
  "utilities": "مرافق",
  "other": "أخرى"
}

export default function FinancePage() {
  const { role, token } = useAuth()
  const { data: entries, isLoading } = useFinanceEntries()
  const queryClient = useQueryClient()

  // Filters
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString())
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null)

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [entryType, setEntryType] = useState<"income" | "expense">("expense")
  const [category, setCategory] = useState("")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().split('T')[0])
  const [formError, setFormError] = useState<string | null>(null)

  // Reset Form
  const resetForm = () => {
    setEditingId(null)
    setEntryType("expense")
    setCategory("")
    setAmount("")
    setNote("")
    setOccurredAt(new Date().toISOString().split('T')[0])
    setIsModalOpen(false)
    setFormError(null)
  }

  // Edit Handler
  const handleEdit = (entry: any) => {
    setEditingId(entry.id)
    setEntryType(entry.entryType)
    setCategory(entry.category)
    setAmount(entry.amount.toString())
    setNote(entry.note || "")
    setOccurredAt(entry.occurredAt.split('T')[0])
    setIsModalOpen(true)
  }

  // Mutations
  const createMutation = useMutation({
    mutationFn: () => coreService.createFinanceEntry({
      entryType,
      category,
      amount: Number(amount),
      note,
      occurredAt
    }, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_entries"] })
      resetForm()
    }
  })

  const updateMutation = useMutation({
    mutationFn: () => coreService.updateFinanceEntry(editingId!, {
      entryType,
      category,
      amount: Number(amount),
      note,
      occurredAt
    }, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_entries"] })
      resetForm()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => coreService.deleteFinanceEntry(id, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_entries"] })
    }
  })

  const handleSubmit = () => {
    setFormError(null)
    const amt = Number(amount)
    if (!category.trim()) {
      setFormError("الفئة مطلوبة")
      return
    }
    if (!amount || isNaN(amt) || amt <= 0) {
      setFormError("يرجى إدخال مبلغ صحيح أكبر من صفر")
      return
    }
    if (editingId) {
      updateMutation.mutate()
    } else {
      createMutation.mutate()
    }
  }

  // Filter Logic
  const filteredEntries = useMemo(() => {
    if (!entries) return []
    return entries.filter(entry => {
      const date = new Date(entry.occurredAt)
      return date.getFullYear().toString() === selectedYear && 
             (date.getMonth() + 1).toString() === selectedMonth
    }).sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
  }, [entries, selectedYear, selectedMonth])

  // Stats
  const stats = useMemo(() => {
    const income = filteredEntries.filter(e => e.entryType === "income").reduce((sum, e) => sum + e.amount, 0)
    const expense = filteredEntries.filter(e => e.entryType === "expense").reduce((sum, e) => sum + e.amount, 0)
    return { income, expense, net: income - expense }
  }, [filteredEntries])

  // Chart Data
  const categoryData = useMemo(() => {
    const map = new Map<string, number>()
    filteredEntries.filter(e => e.entryType === "expense").forEach(e => {
      const label = CATEGORY_LABELS[e.category] || e.category
      map.set(label, (map.get(label) || 0) + e.amount)
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [filteredEntries])

  const incomeCategoryData = useMemo(() => {
    const map = new Map<string, number>()
    filteredEntries.filter(e => e.entryType === "income").forEach(e => {
      const label = CATEGORY_LABELS[e.category] || e.category
      map.set(label, (map.get(label) || 0) + e.amount)
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [filteredEntries])

  const dailyData = useMemo(() => {
    const map = new Map<string, { income: number, expense: number }>()
    // Initialize days of month
    const daysInMonth = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate()
    for (let i = 1; i <= daysInMonth; i++) {
      map.set(i.toString(), { income: 0, expense: 0 })
    }
    
    filteredEntries.forEach(e => {
      const day = new Date(e.occurredAt).getDate().toString()
      const current = map.get(day) || { income: 0, expense: 0 }
      if (e.entryType === "income") current.income += e.amount
      else current.expense += e.amount
      map.set(day, current)
    })

    return Array.from(map.entries()).map(([day, val]) => ({
      day,
      ...val
    }))
  }, [filteredEntries, selectedYear, selectedMonth])


  if (role !== "owner") {
    return <Card title="المالية">غير مصرح لك بالوصول لهذه الصفحة</Card>
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-base-900 p-4 rounded-xl shadow-sm border border-base-200">
        <h1 className="text-2xl font-bold text-base-900 dark:text-white">المالية</h1>
        <div className="flex gap-2">
          <Select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-32">
            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
          <Select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-32">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{format(new Date(2024, m - 1), 'MMMM', { locale: ar })}</option>
            ))}
          </Select>
          <Button onClick={() => setIsModalOpen(true)}>+ إضافة عملية</Button>
          <Button
            variant="secondary"
            onClick={() => {
              const rows = filteredEntries.map(e => [
                format(new Date(e.occurredAt), 'yyyy-MM-dd', { locale: ar }),
                e.entryType === 'income' ? 'دخل' : 'صرف',
                CATEGORY_LABELS[e.category] || e.category,
                String(e.amount),
                e.note || ''
              ])
              const header = ['التاريخ','النوع','الفئة','المبلغ','ملاحظات']
              const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `finance_${selectedYear}_${selectedMonth}.csv`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
            }}
          >
            تصدير CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-emerald-50 border-emerald-100">
          <div className="text-emerald-600 text-sm font-medium">إجمالي الدخل</div>
          <div className="text-2xl font-bold text-emerald-700">{stats.income.toLocaleString()} ج.م</div>
        </Card>
        <Card className="bg-rose-50 border-rose-100">
          <div className="text-rose-600 text-sm font-medium">إجمالي المصروفات</div>
          <div className="text-2xl font-bold text-rose-700">{stats.expense.toLocaleString()} ج.م</div>
        </Card>
        <Card className={`border-base-200 ${stats.net >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
          <div className="text-base-600 text-sm font-medium">صافي الربح</div>
          <div className={`text-2xl font-bold ${stats.net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            {stats.net.toLocaleString()} ج.م
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="تحليل الدخل">
          <div className="h-[300px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={incomeCategoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#10B981"
                  dataKey="value"
                >
                  {incomeCategoryData.map((entry, index) => (
                    <Cell key={`cell-income-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="تحليل المصروفات">
          <div className="h-[300px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#EF4444"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-expense-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="التدفق اليومي" className="lg:col-span-2">
          <div className="h-[300px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="income" fill="#10B981" name="دخل" />
                <Bar dataKey="expense" fill="#EF4444" name="صرف" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card title="سجل العمليات">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="border-b border-base-200 text-base-500">
                <th className="py-3 px-4">التاريخ</th>
                <th className="py-3 px-4">النوع</th>
                <th className="py-3 px-4">الفئة</th>
                <th className="py-3 px-4">المبلغ</th>
                <th className="py-3 px-4">ملاحظات</th>
                <th className="py-3 px-4">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-base-500">لا توجد عمليات في هذا الشهر</td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-base-100 hover:bg-base-50 transition-colors">
                    <td className="py-3 px-4">{format(new Date(entry.occurredAt), 'dd MMM yyyy', { locale: ar })}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        entry.entryType === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {entry.entryType === 'income' ? 'دخل' : 'صرف'}
                      </span>
                    </td>
                    <td className="py-3 px-4">{CATEGORY_LABELS[entry.category] || entry.category}</td>
                    <td className="py-3 px-4 font-semibold">{entry.amount.toLocaleString()}</td>
                    <td className="py-3 px-4 max-w-[200px] truncate">{entry.note || "-"}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(entry)}>تعديل</Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-rose-600 hover:bg-rose-50"
                          onClick={() => setDeleteConfirmationId(entry.id)}
                        >
                          حذف
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmationModal
        isOpen={!!deleteConfirmationId}
        onClose={() => setDeleteConfirmationId(null)}
        onConfirm={() => {
          if (deleteConfirmationId) {
            deleteMutation.mutate(deleteConfirmationId)
          }
        }}
        title="تأكيد حذف العملية"
        description="هل أنت متأكد من حذف هذه العملية المالية؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف العملية"
      />

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={resetForm}
        title={editingId ? "تعديل عملية" : "إضافة عملية جديدة"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="النوع" value={entryType} onChange={(e) => setEntryType(e.target.value as any)}>
              <option value="income">دخل</option>
              <option value="expense">مصروف</option>
            </Select>
            <Input 
              label="التاريخ" 
              type="date" 
              value={occurredAt} 
              onChange={(e) => setOccurredAt(e.target.value)} 
            />
          </div>
          
          <div className="space-y-2">
            <Select 
              label="الفئة"
              value={Object.keys(CATEGORY_LABELS).includes(category) ? category : 'custom'} 
              onChange={(e) => {
                if (e.target.value === 'custom') setCategory('')
                else setCategory(e.target.value)
              }}
            >
              <option value="" disabled>اختر الفئة</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
              <option value="custom">فئة مخصصة...</option>
            </Select>
            
            {!Object.keys(CATEGORY_LABELS).includes(category) && (
               <Input 
                 value={category} 
                 onChange={(e) => setCategory(e.target.value)} 
                 placeholder="أدخل اسم الفئة..."
               />
            )}
          </div>
          
          <Input 
            label="المبلغ" 
            type="number" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            placeholder="0.00"
          />
          
          <Input 
            label="ملاحظات" 
            value={note} 
            onChange={(e) => setNote(e.target.value)} 
            placeholder="تفاصيل إضافية..."
          />
          {formError && <p className="text-sm text-rose-600">{formError}</p>}

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={resetForm}>إلغاء</Button>
            <Button 
              onClick={handleSubmit} 
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
