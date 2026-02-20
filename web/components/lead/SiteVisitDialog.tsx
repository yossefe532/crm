"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { leadService } from "../../lib/services/leadService"
import { useAuth } from "../../lib/auth/AuthContext"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { Textarea } from "../ui/Textarea"

interface SiteVisitDialogProps {
  isOpen: boolean
  onClose: () => void
  leadId: string
  onSuccess?: () => void
}

export const SiteVisitDialog = ({ isOpen, onClose, leadId, onSuccess }: SiteVisitDialogProps) => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState("")

  const visitMutation = useMutation({
    mutationFn: async () => {
      // Add notes to lead
      if (notes) {
        const lead = await leadService.get(leadId, token || undefined)
        const currentNotes = lead.notes || ""
        const newNote = `\n[رؤية الموقع ${new Date().toLocaleDateString('ar-EG')}]: ${notes}`
        await leadService.update(leadId, { notes: currentNotes + newNote }, token || undefined)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
      if (onSuccess) onSuccess()
      onClose()
    }
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تسجيل رؤية الموقع">
      <div className="space-y-4">
        <p className="text-sm text-base-500">
          هل قام العميل بزيارة الموقع؟ يرجى تسجيل انطباع العميل وأي ملاحظات هامة.
        </p>
        
        <div className="space-y-2">
          <Textarea
            label="رأي العميل / الملاحظات"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="اكتب انطباع العميل عن الموقع..."
            className="min-h-[150px]"
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => visitMutation.mutate()} disabled={visitMutation.isPending || !notes.trim()}>
            {visitMutation.isPending ? "جاري الحفظ..." : "تأكيد الزيارة"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
