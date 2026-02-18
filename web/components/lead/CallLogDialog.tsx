"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { leadService } from "../../lib/services/leadService"
import { useAuth } from "../../lib/auth/AuthContext"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { Select } from "../ui/Select"
import { Input } from "../ui/Input"

interface CallLogDialogProps {
  isOpen: boolean
  onClose: () => void
  leadId: string
  phone: string
}

export const CallLogDialog = ({ isOpen, onClose, leadId, phone }: CallLogDialogProps) => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [outcome, setOutcome] = useState("answered")
  const [duration, setDuration] = useState("60")

  const callMutation = useMutation({
    mutationFn: () => leadService.addCall(leadId, { outcome, durationSeconds: parseInt(duration) || 0 }, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads", leadId] })
      onClose()
    }
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تسجيل مكالمة">
      <div className="space-y-4">
        <p className="text-sm text-base-500">
          جاري الاتصال بـ <span className="font-semibold text-base-900" dir="ltr">{phone}</span>...
        </p>
        
        <div className="space-y-2">
          <Select
            label="نتيجة المكالمة"
            id="call-outcome"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          >
            <option value="answered">تم الرد</option>
            <option value="no_answer">لم يتم الرد</option>
            <option value="busy">مشغول</option>
            <option value="wrong_number">رقم خاطئ</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Input
            label="المدة (ثواني)"
            id="call-duration"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => callMutation.mutate()} disabled={callMutation.isPending}>
            {callMutation.isPending ? "جاري الحفظ..." : "حفظ النتيجة"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
