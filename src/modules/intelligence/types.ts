export type LeadEngagementEvent = {
  type: string
  occurredAt?: string
  metadata?: Record<string, unknown>
}

export type LeadScoreFactors = {
  demographic: number
  engagement: number
  behavioral: number
  historical: number
}

export type DisciplineFactors = {
  followUpFrequency: number
  meetingAdherence: number
  taskCompletion: number
  dataEntryTimeliness: number
  pipelineHygiene: number
}

export type DealProbability = {
  probability: number
  confidenceLow: number
  confidenceHigh: number
  factors: Record<string, number>
}

export type ForecastPeriod = {
  period: string
  expected: number
  weighted: number
}

export type ForecastPayload = {
  monthly: ForecastPeriod[]
  quarterly: ForecastPeriod[]
  annual: ForecastPeriod[]
  updatedAt: string
}

export type ReminderPriority = {
  leadId: string
  assignedUserId?: string
  dueAt?: string
  reason: string
  priorityScore: number
  dealValue?: number
}

export type ScriptBlock = {
  stage: string
  script: string
  confidence: number
  objections: string[]
}

export type PerformanceRow = {
  subjectId: string
  subjectType: "user" | "team"
  score: number
  metrics: Record<string, number>
}

export type IntelligenceTrigger = {
  type: "lead_changed" | "lead_engaged" | "deal_changed" | "meeting_changed" | "task_changed" | "pipeline_changed"
  tenantId: string
  leadId?: string
  dealId?: string
  userId?: string
}
