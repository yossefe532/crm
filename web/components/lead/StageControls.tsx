"use client"

import { Button } from "../ui/Button"
import { Tooltip } from "../ui/Tooltip"

const stageLabels = ["مكالمة هاتفية", "اجتماع", "رؤية الموقع", "إغلاق الصفقة"]
const stageKeys = ["call", "meeting", "site_visit", "closing"]
const stageIndexMap: Record<string, number> = {
  new: 0,
  call: 0,
  meeting: 1,
  site_visit: 2,
  closing: 3
}

export const StageControls = ({ currentStage, onStageChange, disabled }: { currentStage: string; onStageChange: (stage: string) => void; disabled?: boolean }) => {
  const index = stageIndexMap[currentStage] ?? 0
  const nextStage = () => {
    const next = Math.min(stageLabels.length - 1, index + 1)
    const nextStageKey = stageKeys[next] || stageKeys[stageKeys.length - 1]
    const nextStageLabel = stageLabels[next]
    
    if (window.confirm(`هل أنت متأكد من إكمال المرحلة الحالية والانتقال إلى ${nextStageLabel}؟`)) {
      onStageChange(nextStageKey)
    }
  }
  const isLastStage = index >= stageLabels.length - 1

  return (
    <Tooltip text="إكمال المرحلة الحالية">
      <Button onClick={nextStage} disabled={disabled || isLastStage} aria-label="إكمال المرحلة" title="إكمال المرحلة">
        {isLastStage ? "تم إكمال جميع المراحل" : "إكمال المرحلة"}
      </Button>
    </Tooltip>
  )
}
