"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { leadService } from "../../lib/services/leadService"
import { useAuth } from "../../lib/auth/AuthContext"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"

interface MeetingDialogProps {
  isOpen: boolean
  onClose: () => void
  leadId: string
  initialTitle?: string
}

export const MeetingDialog = ({ isOpen, onClose, leadId, initialTitle }: MeetingDialogProps) => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(initialTitle || "اجتماع جديد")
  const [startsAt, setStartsAt] = useState("")
  const [duration, setDuration] = useState("60")

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle || "اجتماع جديد")
    }
  }, [isOpen, initialTitle])

  const meetingMutation = useMutation({
    mutationFn: () => {
      const start = startsAt ? new Date(startsAt) : new Date()
      const durationMinutes = parseInt(duration) || 60
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
      <div className="space-y-4">
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
          <Button onClick={() => meetingMutation.mutate()} disabled={meetingMutation.isPending || !startsAt}>
            {meetingMutation.isPending ? "جاري الحفظ..." : "حفظ الاجتماع"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
