"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { leadService } from "../../lib/services/leadService"
import { useAuth } from "../../lib/auth/AuthContext"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { Textarea } from "../ui/Textarea"
import { Input } from "../ui/Input"
import { Select } from "../ui/Select"

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
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 16))
  const [status, setStatus] = useState("scheduled")

  const visitMutation = useMutation({
    mutationFn: async () => {
      // 1. Create a "Site Visit" meeting
      const start = new Date(visitDate)
      const end = new Date(start.getTime() + 90 * 60000) // Default 1.5 hours
      
      await leadService.createMeeting(leadId, {
        title: `زيارة موقع: ${status === 'completed' ? 'تمت' : 'مجدولة'}`,
        startsAt: start,
        endsAt: end,
        status: status
      }, token || undefined)

      // 2. Update Lead Stage to "site_visit"
      await leadService.update(leadId, { status: "site_visit" }, token || undefined)

      // 3. Add notes to lead
      if (notes) {
        const lead = await leadService.get(leadId, token || undefined)
        const currentNotes = lead.notes || ""
        const newNote = `\n[رؤية الموقع ${new Date(visitDate).toLocaleDateString('ar-EG')} - ${status === 'completed' ? 'تمت' : 'مجدولة'}]: ${notes}`
        await leadService.update(leadId, { notes: currentNotes + newNote }, token || undefined)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      if (onSuccess) onSuccess()
      onClose()
    }
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تسجيل رؤية الموقع">
      <div className="space-y-4">
        <p className="text-sm text-base-500">
          قم بجدولة أو تسجيل زيارة الموقع للعميل. سيتم تحديث حالة العميل إلى &quot;رؤية الموقع&quot;.
        </p>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
                label="تاريخ الزيارة"
                type="datetime-local"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                required
            />
            <Select
                label="حالة الزيارة"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
            >
                <option value="scheduled">مجدولة (قادمة)</option>
                <option value="completed">تمت بالفعل</option>
                <option value="cancelled">ملغاة</option>
            </Select>
          </div>

          <Textarea
            label="ملاحظات / انطباع العميل"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="اكتب انطباع العميل عن الموقع أو تفاصيل الزيارة..."
            className="min-h-[100px]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => visitMutation.mutate()} disabled={visitMutation.isPending}>
            {visitMutation.isPending ? "جاري الحفظ..." : "تأكيد الزيارة"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
