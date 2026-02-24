"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { leadService } from "../../lib/services/leadService"
import { useAuth } from "../../lib/auth/AuthContext"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { Select } from "../ui/Select"
import { Input } from "../ui/Input"
import { Textarea } from "../ui/Textarea"

interface CallLogDialogProps {
  isOpen: boolean
  onClose: () => void
  leadId: string
  phone: string
  onSuccess?: (outcome: string, notes?: string) => void
}

export const CallLogDialog = ({ isOpen, onClose, leadId, phone, onSuccess }: CallLogDialogProps) => {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [stage, setStage] = useState<"initial" | "confirm_surrender">("initial")
  const [outcome, setOutcome] = useState("answered")
  const [duration, setDuration] = useState("")
  const [notes, setNotes] = useState("")
  const [followUpDate, setFollowUpDate] = useState("")

  const surrenderMutation = useMutation({
    mutationFn: async () => {
      // 1. Log the call first so we have history
      await leadService.addCall(leadId, { outcome, durationSeconds: parseInt(duration) || 0 }, token || undefined)
      // 2. Mark as surrendered
      await leadService.fail(leadId, { failureType: "surrender", reason: outcome === "wrong_number" ? "رقم خاطئ" : "رفض العميل" }, token || undefined)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads", leadId] })
      if (onSuccess) onSuccess(outcome, notes)
      onClose()
    }
  })

  const callMutation = useMutation({
    mutationFn: async () => {
      // 1. Log the call
      await leadService.addCall(leadId, { outcome, durationSeconds: parseInt(duration) || 0 }, token || undefined)
      
      // 2. Handle specific outcomes
      if (outcome === "wrong_number") {
         // Add note about wrong number and set flag
         const lead = await leadService.get(leadId, token || undefined)
         const currentNotes = lead.notes || ""
         const newNote = `\n[تنبيه]: رقم خاطئ تم الإبلاغ عنه بواسطة Sales.`
         await leadService.update(leadId, { 
            notes: currentNotes + newNote,
            isWrongNumber: true
         }, token || undefined)
      } else if (outcome === "no_answer") {
         if (followUpDate) {
             const start = new Date(followUpDate)
             const end = new Date(start.getTime() + 15 * 60000) // 15 min
             await leadService.createMeeting(leadId, {
                 title: "متابعة (لم يتم الرد)",
                 startsAt: start,
                 endsAt: end,
                 status: "scheduled"
             }, token || undefined)
         }
      } else if (outcome === "answered") {
         if (notes) {
             const lead = await leadService.get(leadId, token || undefined)
             const currentNotes = lead.notes || ""
             const newNote = `\n[مكالمة ${new Date().toLocaleDateString('ar-EG')}]: ${notes}`
             await leadService.update(leadId, { notes: currentNotes + newNote }, token || undefined)
         }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads", leadId] })
      if (onSuccess) onSuccess(outcome, notes)
      onClose()
    }
  })

  const handleSave = () => {
    // Validation
    if (outcome === "answered") {
        if (!notes.trim()) {
            alert("يرجى كتابة ملاحظات المكالمة")
            return
        }
        if (!duration || parseInt(duration) <= 0) {
            alert("يرجى تحديد مدة المكالمة")
            return
        }
    }
    
    if (outcome === "no_answer") {
        if (!followUpDate) {
            alert("يرجى تحديد وقت المتابعة القادمة")
            return
        }
    }

    if (outcome === "wrong_number" || outcome === "refused") {
      setStage("confirm_surrender")
    } else {
      callMutation.mutate()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تسجيل مكالمة">
      {stage === "initial" ? (
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
            <option value="refused">رفض / غير مهتم</option>
          </Select>
        </div>

        {outcome === "answered" && (
           <div className="space-y-2">
             <Textarea
               label="انطباع المكالمة / ملاحظات"
               value={notes}
               onChange={(e) => setNotes(e.target.value)}
               placeholder="اكتب ملخص المكالمة..."
               required
             />
             <Input
                label="المدة (ثواني)"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
             />
           </div>
        )}

        {outcome === "no_answer" && (
            <div className="space-y-2 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                <p className="text-sm text-yellow-800 mb-2">يرجى تحديد موعد للمحاولة مرة أخرى:</p>
                <Input
                    label="وقت المتابعة"
                    type="datetime-local"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    required
                />
            </div>
        )}

        {outcome === "wrong_number" && (
            <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-sm text-rose-800">
                ⚠️ سيتم إبلاغ المالك بأن هذا الرقم خاطئ. يرجى التوقف عن الاتصال بهذا الرقم حتى يتم تحديثه.
            </div>
        )}
        
        {outcome === "refused" && (
            <div className="bg-gray-50 border border-gray-100 p-3 rounded-lg text-sm text-gray-800">
                سيتم تسجيل رفض العميل. هل ترغب في الاستسلام (أرشفة العميل) أم المتابعة لاحقاً؟
            </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave} disabled={callMutation.isPending}>
            {callMutation.isPending ? "جاري الحفظ..." : "حفظ النتيجة"}
          </Button>
        </div>
      </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 text-center">
            <h3 className="text-lg font-medium text-orange-900 mb-2">
              {outcome === "wrong_number" ? "رقم خاطئ" : "رفض العميل"}
            </h3>
            <p className="text-orange-800">
              هل ترغب في الاستسلام (أرشفة العميل) أم إبلاغ المالك/المتابعة؟
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button 
              variant="outline" 
              className="w-full justify-center border-rose-200 text-rose-700 hover:bg-rose-50"
              onClick={() => surrenderMutation.mutate()}
              disabled={surrenderMutation.isPending}
            >
              {surrenderMutation.isPending ? "جاري الاستسلام..." : "نعم، استسلام (أرشفة العميل)"}
            </Button>
            
            <Button 
              variant="primary" 
              className="w-full justify-center"
              onClick={() => callMutation.mutate()}
              disabled={callMutation.isPending}
            >
              {callMutation.isPending ? "جاري الحفظ..." : (outcome === "wrong_number" ? "لا، إبلاغ المالك فقط" : "لا، سأتابع معه لاحقاً")}
            </Button>
            
            <Button variant="ghost" className="w-full justify-center" onClick={() => setStage("initial")}>
              رجوع
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
