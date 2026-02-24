import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"
import { leadService } from "../../lib/services/leadService"
import { useAuth } from "../../lib/auth/AuthContext"

interface StageTransitionModalProps {
  isOpen: boolean
  onClose: () => void
  leadId: string
  targetStage: string
  currentStage: string
  onSuccess?: () => void
}

export function StageTransitionModal({ isOpen, onClose, leadId, targetStage, currentStage, onSuccess }: StageTransitionModalProps) {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [error, setError] = useState<string | null>(null)

  // Fetch stage details to get questions
  const { data: stage, isLoading } = useQuery({
    queryKey: ["stage", targetStage],
    queryFn: () => leadService.getStage(targetStage, token || undefined),
    enabled: isOpen && !!targetStage
  })

  const mutation = useMutation({
    mutationFn: async () => {
      return leadService.updateStage(leadId, targetStage, answers, token || undefined)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      onSuccess?.()
      onClose()
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || err.message || "حدث خطأ أثناء تحديث المرحلة")
    }
  })

  const handleSubmit = () => {
    // Validate required questions
    if (stage?.questions) {
      for (const q of stage.questions) {
        if (q.required && !answers[q.id]) {
          setError(`يرجى الإجابة على السؤال: ${q.text}`)
          return
        }
      }
    }
    mutation.mutate()
  }

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setAnswers({})
      setError(null)
    }
  }, [isOpen, targetStage])

  const stageLabelMap: Record<string, string> = { new: "جديد", call: "مكالمة هاتفية", meeting: "اجتماع", site_visit: "رؤية الموقع", closing: "إغلاق الصفقة" }
  const stageName = stage?.name || stageLabelMap[targetStage] || targetStage

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تحديث مرحلة العميل">
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-4">جاري التحميل...</div>
        ) : (
          <>
            <p className="text-sm text-base-600 dark:text-base-400">
              هل أنت متأكد من نقل العميل إلى مرحلة <strong className="text-base-900 dark:text-white">{stageName}</strong>؟
            </p>

            {stage?.questions && stage.questions.length > 0 && (
              <div className="space-y-3 mt-4 bg-base-50 dark:bg-base-900/50 p-4 rounded-lg border border-base-200 dark:border-base-800">
                <h4 className="font-bold text-sm text-base-900 dark:text-white mb-2">أسئلة مطلوبة:</h4>
                {stage.questions.map((q) => (
                  <div key={q.id} className="space-y-1.5">
                    <label className="text-xs font-medium text-base-700 dark:text-base-300">
                      {q.text} {q.required && <span className="text-rose-500">*</span>}
                    </label>
                    {q.type === 'select' ? (
                        <select 
                            className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-base-900 border-base-300 dark:border-base-700 focus:ring-2 focus:ring-brand-500 outline-none"
                            value={answers[q.id] || ""}
                            onChange={(e) => {
                                setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))
                                setError(null)
                            }}
                        >
                            <option value="">اختر إجابة...</option>
                            {q.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    ) : (
                        <Input
                          value={answers[q.id] || ""}
                          onChange={(e) => {
                              setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))
                              setError(null)
                          }}
                          placeholder="إجابتك..."
                          className="bg-white dark:bg-base-900"
                        />
                    )}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="text-rose-600 text-sm bg-rose-50 dark:bg-rose-900/20 p-3 rounded-lg border border-rose-200 dark:border-rose-800">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
                إلغاء
              </Button>
              <Button onClick={handleSubmit} isLoading={mutation.isPending}>
                تأكيد الانتقال
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
