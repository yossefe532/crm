import { LeadProgress } from "./LeadProgress"

const defaultStages = ["مكالمة هاتفية", "اجتماع", "رؤية الموقع", "إغلاق الصفقة"]
const stageKeys = ["call", "meeting", "site_visit", "closing"]

const stageIndexMap: Record<string, number> = {
  new: 0,
  call: 0,
  meeting: 1,
  site_visit: 2,
  closing: 3,
  closed: 3,
  failed: 0,
  "مكالمة هاتفية": 0,
  "اجتماع": 1,
  "رؤية الموقع": 2,
  "إغلاق الصفقة": 3
}

export const StageProgress = ({ stage, stages = defaultStages, onStageChange, readOnly }: { stage: string; stages?: string[]; onStageChange?: (stage: string) => void; readOnly?: boolean }) => {
  const activeIndex = stageIndexMap[stage] ?? 0
  return (
    <LeadProgress
      stages={stages}
      activeIndex={activeIndex}
      readOnly={readOnly}
      onStageChange={(index) => {
        const nextStage = stageKeys[index]
        if (nextStage) onStageChange?.(nextStage)
      }}
    />
  )
}
