"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { leadService } from "../../lib/services/leadService"
import { useAuth } from "../../lib/auth/AuthContext"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"
import { Textarea } from "../ui/Textarea"
import { useLead } from "../../lib/hooks/useLead"

interface MeetingDialogProps {
  isOpen: boolean
  onClose: () => void
  leadId: string
  initialTitle?: string
}

export const MeetingDialog = ({ isOpen, onClose, leadId, initialTitle }: MeetingDialogProps) => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const { data: lead } = useLead(leadId)
  
  const [title, setTitle] = useState(initialTitle || "اجتماع جديد")
  const [startsAt, setStartsAt] = useState("")
  const [duration, setDuration] = useState("60")

  // Call Log Fields
  const [showCallFields, setShowCallFields] = useState(false)
  const [callDuration, setCallDuration] = useState("60")
  const [callNote, setCallNote] = useState("")

  const hasScheduledMeeting = lead?.meetings?.some(m => m.status === 'scheduled')
  const hasAnsweredCall = lead?.callLogs?.some(c => c.outcome === 'answered')

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle || "اجتماع جديد")
      // Check if call log is needed
      // We check if lead exists and has NO answered calls
      if (lead && !hasAnsweredCall) {
          setShowCallFields(true)
      } else {
          setShowCallFields(false)
      }
    }
  }, [isOpen, initialTitle, lead, hasAnsweredCall])

  const meetingMutation = useMutation({
    mutationFn: async () => {
      // 1. Create call log if needed
      if (showCallFields) {
          await leadService.addCall(leadId, {
              outcome: "answered",
              durationSeconds: parseInt(callDuration) || 0
          }, token || undefined)
          
          if (callNote) {
               const currentNotes = lead?.notes || ""
               const newNote = `\n[مكالمة قبل الاجتماع ${new Date().toLocaleDateString('ar-EG')}]: ${callNote}`
               await leadService.update(leadId, { notes: currentNotes + newNote }, token || undefined)
          }
      }

      const start = startsAt ? new Date(startsAt) : new Date()
      const durationMinutes = parseInt(duration) || 60
      // 2. Update Lead Stage to "meeting" if needed
      if (lead && (lead.status === 'new' || lead.status === 'call')) {
          await leadService.update(leadId, { status: 'meeting' }, token || undefined)
      }

      return leadService.createMeeting(leadId, {
        title,
        startsAt: start,
        endsAt: new Date(start.getTime() + durationMinutes * 60000),
        status: "scheduled"
      }, token || undefined)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      onClose()
    }
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="جدولة اجتماع">
      <div className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
        
        {hasScheduledMeeting && (
             <div className="bg-orange-50 border border-orange-200 text-orange-800 p-3 rounded-md text-sm mb-4 animate-fadeIn">
                 ⚠️ تنبيه: يوجد بالفعل اجتماع مجدول لهذا العميل. هل أنت متأكد من إضافة اجتماع آخر؟
             </div>
        )}

        {showCallFields && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-md mb-4 space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2 text-blue-800 font-medium text-sm">
                    <span>📞</span>
                    <span>لم يتم تسجيل مكالمة ناجحة. يرجى تسجيل تفاصيل المكالمة أولاً:</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                     <Input
                        label="مدة المكالمة (ثانية)"
                        type="number"
                        value={callDuration}
                        onChange={(e) => setCallDuration(e.target.value)}
                    />
                </div>
                
                <Textarea 
                    label="تفاصيل المكالمة"
                    placeholder="اكتب ملخص المكالمة هنا..."
                    value={callNote}
                    onChange={(e) => setCallNote(e.target.value)}
                    required
                    className="min-h-[80px]"
                />
            </div>
        )}

        <div className="space-y-2">
          <Input
            label="عنوان الاجتماع"
            id="meeting-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Input
            label="تاريخ ووقت البدء"
            id="meeting-start"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Input
            label="المدة (دقيقة)"
            id="meeting-duration"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => meetingMutation.mutate()} disabled={meetingMutation.isPending || !startsAt || (showCallFields && !callNote)}>
            {meetingMutation.isPending ? "جاري الحفظ..." : "حفظ الاجتماع"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
