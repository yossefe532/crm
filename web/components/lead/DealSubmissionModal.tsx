"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"
import { Textarea } from "../ui/Textarea"
import { leadService } from "../../lib/services/leadService"

type Props = {
  isOpen: boolean
  onClose: () => void
  leadId: string
}

export const DealSubmissionModal = ({ isOpen, onClose, leadId }: Props) => {
  const [amount, setAmount] = useState("")
  const [commission, setCommission] = useState("")
  const [contractDate, setContractDate] = useState("")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      return leadService.submitDeal(leadId, {
        amount: parseFloat(amount),
        commission: parseFloat(commission),
        contractDate,
        address,
        notes
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
      onClose()
      setAmount("")
      setCommission("")
      setContractDate("")
      setAddress("")
      setNotes("")
    }
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تقديم صفقة للموافقة">
      <div className="space-y-4">
        <p className="text-sm text-base-500">
          يرجى إدخال تفاصيل الصفقة ليتم مراجعتها من قبل المدير.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">قيمة الصفقة</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">العمولة المتوقعة</label>
            <Input
              type="number"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">تاريخ العقد</label>
          <Input
            type="date"
            value={contractDate}
            onChange={(e) => setContractDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">العنوان / تفاصيل الوحدة</label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="عنوان العقار..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">ملاحظات إضافية</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أي تفاصيل أخرى..."
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            إلغاء
          </Button>
          <Button 
            variant="primary" 
            onClick={() => mutation.mutate()} 
            disabled={!amount || !contractDate || mutation.isPending}
          >
            {mutation.isPending ? "جاري التقديم..." : "تقديم الصفقة"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
