import { LeadScoreFactors, DisciplineFactors } from "./types"

export const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value))

export const normalize = (value: number, min: number, max: number) => {
  if (max <= min) return 0
  const ratio = (value - min) / (max - min)
  return clamp(ratio * 100)
}

export const timeDecayWeight = (daysAgo: number, halfLifeDays: number) => {
  const decay = Math.log(2) / Math.max(1, halfLifeDays)
  return Math.exp(-decay * daysAgo)
}

export const weightedAverage = (weights: Record<string, number>, values: Record<string, number>) => {
  const entries = Object.entries(weights)
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0)
  if (!totalWeight) return 0
  const weighted = entries.reduce((sum, [key, weight]) => sum + (values[key] || 0) * weight, 0)
  return clamp(weighted / totalWeight)
}

export const scoreLead = (factors: LeadScoreFactors, weights?: Partial<Record<keyof LeadScoreFactors, number>>) => {
  const merged = { demographic: 0.25, engagement: 0.25, behavioral: 0.25, historical: 0.25, ...weights }
  const score = weightedAverage(merged, factors)
  const tier = score >= 80 ? "hot" : score >= 60 ? "warm" : "cold"
  return { score, tier }
}

export const scoreDiscipline = (factors: DisciplineFactors, weights?: Partial<Record<keyof DisciplineFactors, number>>) => {
  const merged = { followUpFrequency: 0.2, meetingAdherence: 0.2, taskCompletion: 0.2, dataEntryTimeliness: 0.2, pipelineHygiene: 0.2, ...weights }
  const score = weightedAverage(merged, factors)
  return { score }
}

export const wilsonInterval = (successes: number, total: number, z = 1.96) => {
  if (!total) return { low: 0, high: 1 }
  const phat = successes / total
  const denom = 1 + (z * z) / total
  const center = (phat + (z * z) / (2 * total)) / denom
  const margin = (z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * total)) / total)) / denom
  return { low: clamp((center - margin) * 100), high: clamp((center + margin) * 100) }
}
