"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { Textarea } from "../ui/Textarea"
import { Select } from "../ui/Select"
import { leadService } from "../../lib/services/leadService"
import { useAuth } from "../../lib/auth/AuthContext"
import { Lead } from "../../lib/types"

interface FailureModalProps {
  isOpen: boolean
  onClose: () => void
  lead: Lead
}

const FAILURE_REASONS = [
  { value: "price_too_high", label: "السعر مرتفع جداً" },
  { value: "competitor", label: "ذهب للمنافس" },
  { value: "lost_interest", label: "فقد الاهتمام" },
  { value: "bad_location", label: "الموقع غير مناسب" },
  { value: "bad_timing", label: "التوقيت غير مناسب" },
  { value: "other", label: "سبب آخر" }
]

export const FailureModal = ({ isOpen, onClose, lead }: FailureModalProps) => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState("")
  const [reasonType, setReasonType] = useState(FAILURE_REASONS[0].value)
  const [error, setError] = useState("")

  const failureMutation = useMutation({
    mutationFn: async () => {
      return leadService.fail(
        lead.id,
        {
          failureType: "surrender", // Sales users surrender leads
          reason: `${FAILURE_REASONS.find(r => r.value === reasonType)?.label || reasonType}: ${reason}`
        },
        token || undefined
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["lead", lead.id] })
      onClose()
    },
    onError: (err: any) => {
      setError(err.message || "حدث خطأ أثناء تسجيل الخسارة")
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    failureMutation.mutate()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="خسارة الصفقة (Lost Deal)">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-sm text-rose-800 mb-4">
          سيتم نقل العميل إلى قائمة الخسائر وإتاحته لإعادة التوزيع أو المتابعة لاحقاً.
        </div>

        <div>
          <label className="block text-sm font-medium text-base-700 mb-1">
            سبب الخسارة <span className="text-rose-500">*</span>
          </label>
          <select
            className="w-full rounded-lg border border-base-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-base-700 dark:bg-base-900 dark:text-white"
            value={reasonType}
            onChange={(e) => setReasonType(e.target.value)}
          >
            {FAILURE_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-base-700 mb-1">
            ملاحظات إضافية (اختياري)
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="تفاصيل إضافية حول سبب الرفض..."
            className="w-full min-h-[100px]"
          />
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-4 border-t border-base-100">
          <Button type="button" variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="submit"
            className="bg-rose-600 hover:bg-rose-700 text-white"
            disabled={failureMutation.isPending}
          >
            {failureMutation.isPending ? "جاري الحفظ..." : "تأكيد الخسارة"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
