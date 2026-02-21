"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { leadService } from "../../lib/services/leadService"
import { useAuth } from "../../lib/auth/AuthContext"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { Select } from "../ui/Select"
import { Textarea } from "../ui/Textarea"
import { Input } from "../ui/Input"
import { Meeting } from "../../lib/types"

interface MeetingOutcomeDialogProps {
  isOpen: boolean
  onClose: () => void
  leadId: string
  meeting?: Meeting
  onSuccess?: () => void
}

export const MeetingOutcomeDialog = ({ isOpen, onClose, leadId, meeting, onSuccess }: MeetingOutcomeDialogProps) => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [outcome, setOutcome] = useState("completed")
  const [notes, setNotes] = useState("")
  const [rescheduleDate, setRescheduleDate] = useState("")

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (meeting) {
        // Update existing meeting
        if (outcome === "rescheduled") {
            if (!rescheduleDate) throw new Error("يرجى تحديد موعد جديد")
            const start = new Date(rescheduleDate)
            const end = new Date(start.getTime() + 60 * 60000) // Default 1 hour
            
            await leadService.updateMeeting(meeting.id, {
                status: "rescheduled",
                startsAt: start.toISOString(),
                endsAt: end.toISOString(),
                // Append note to title or separate field if supported
            }, token || undefined)
        } else {
            await leadService.updateMeeting(meeting.id, {
                status: outcome === "completed" ? "completed" : "cancelled",
            }, token || undefined)
        }
      } else {
        // Log a generic meeting outcome (if no scheduled meeting found)
        // Since we don't have a specific "log meeting" endpoint that is separate from create,
        // we might create a completed meeting entry.
        const now = new Date()
        await leadService.createMeeting(leadId, {
            title: "اجتماع (تم تسجيله يدوياً)",
            startsAt: now,
            endsAt: new Date(now.getTime() + 60 * 60000),
            status: "completed"
        }, token || undefined)
      }

      // Add notes to lead
      if (notes) {
        const lead = await leadService.get(leadId, token || undefined)
        const currentNotes = lead.notes || ""
        const newNote = `\n[اجتماع ${new Date().toLocaleDateString('ar-EG')}]: ${notes}`
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

  const handleSave = () => {
    if (outcome === "rescheduled" && !rescheduleDate) {
        alert("يرجى تحديد موعد جديد")
        return
    }
    if (outcome === "completed" && !notes.trim()) {
        alert("يرجى كتابة تفاصيل الاجتماع")
        return
    }
    updateMutation.mutate()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تسجيل نتيجة الاجتماع">
      <div className="space-y-4">
        <div className="space-y-2">
          <Select
            label="حالة الاجتماع"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          >
            <option value="completed">تم الاجتماع</option>
            <option value="cancelled">تم الإلغاء</option>
            <option value="rescheduled">تأجيل / إعادة جدولة</option>
          </Select>
        </div>

        {outcome === "rescheduled" && (
          <div className="space-y-2">
            <Input
              label="الموعد الجديد"
              type="datetime-local"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              required
            />
          </div>
        )}

        <div className="space-y-2">
          <Textarea
            label="ملاحظات / تفاصيل الاجتماع"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="اكتب تفاصيل الاجتماع هنا..."
            className="min-h-[100px]"
            required={outcome === "completed"}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "جاري الحفظ..." : "حفظ النتيجة"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
