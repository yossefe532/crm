"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { Textarea } from "../ui/Textarea"
import { Select } from "../ui/Select"
import { leadService } from "../../lib/services/leadService"

type Props = {
  isOpen: boolean
  onClose: () => void
  leadId: string
}

export const ExtensionRequestModal = ({ isOpen, onClose, leadId }: Props) => {
  const [reason, setReason] = useState("")
  const [days, setDays] = useState("3")
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      return leadService.requestExtension(leadId, reason, parseInt(days))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
      onClose()
      setReason("")
      setDays("3")
    }
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="طلب تمديد المهلة">
      <div className="space-y-4">
        <p className="text-sm text-base-500">
          يمكنك طلب تمديد المهلة الزمنية للعميل. سيتم إرسال الطلب للمدير للموافقة.
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium">مدة التمديد (أيام)</label>
          <Select 
            value={days} 
            onChange={(e) => setDays(e.target.value)}
            options={[
              { label: "3 أيام", value: "3" },
              { label: "5 أيام", value: "5" },
              { label: "7 أيام", value: "7" },
            ]}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">سبب التمديد</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="اذكر سبب طلب التمديد..."
            rows={4}
          />
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            إلغاء
          </Button>
          <Button 
            variant="primary" 
            onClick={() => mutation.mutate()} 
            disabled={!reason || mutation.isPending}
          >
            {mutation.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
