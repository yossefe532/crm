"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"
import { Textarea } from "../ui/Textarea"
import { leadService } from "../../lib/services/leadService"
import { useAuth } from "../../lib/auth/AuthContext"
import { Lead } from "../../lib/types"

interface ClosureModalProps {
  isOpen: boolean
  onClose: () => void
  lead: Lead
}

export const ClosureModal = ({ isOpen, onClose, lead }: ClosureModalProps) => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState<string>(lead.budgetMin ? String(lead.budgetMin) : "")
  const [contractDate, setContractDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState("")
  const [address, setAddress] = useState("")
  const [error, setError] = useState("")

  const closureMutation = useMutation({
    mutationFn: async () => {
      if (!amount || isNaN(Number(amount))) {
        throw new Error("يرجى إدخال مبلغ صحيح")
      }
      if (!contractDate) {
        throw new Error("يرجى تحديد تاريخ العقد")
      }
      return leadService.close(
        lead.id,
        {
          amount: Number(amount),
          contractDate,
          note: note || undefined,
          address: address || undefined
        },
        token || undefined
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["lead", lead.id] })
      onClose()
    },
    onError: (err: unknown) => {
      const error = err as { message?: string }
      setError(error?.message || "حدث خطأ أثناء إغلاق الصفقة")
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    closureMutation.mutate()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إغلاق الصفقة (Won Deal)">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-sm text-emerald-800 mb-4">
          أنت على وشك إغلاق الصفقة بنجاح! سيتم تسجيل المبلغ في تقارير المبيعات الخاصة بك.
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-base-700 mb-1">
              قيمة الصفقة (ج.م) <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="مثال: 1500000"
              required
              min={0}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-700 mb-1">
              تاريخ العقد <span className="text-rose-500">*</span>
            </label>
            <Input
              type="date"
              value={contractDate}
              onChange={(e) => setContractDate(e.target.value)}
              required
              className="w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-base-700 mb-1">
            عنوان الوحدة / العقار (اختياري)
          </label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="مثال: التجمع الخامس، حي الياسمين، فيلا 12"
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-base-700 mb-1">
            تفاصيل الاتفاق / ملاحظات <span className="text-rose-500">*</span>
          </label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="اكتب تفاصيل الاتفاق وما تم التوصل إليه..."
            className="w-full min-h-[100px]"
            required
          />
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-4 border-t border-base-100">
          <Button type="button" variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={closureMutation.isPending}
          >
            {closureMutation.isPending ? "جاري الحفظ..." : "تأكيد الإغلاق"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
