import { describe, expect, it } from "vitest"
import { clamp, normalize, scoreLead, scoreDiscipline, wilsonInterval } from "./formulas"

describe("intelligence formulas", () => {
  it("clamps and normalizes values", () => {
    expect(clamp(120)).toBe(100)
    expect(clamp(-10)).toBe(0)
    expect(normalize(50, 0, 100)).toBe(50)
  })

  it("scores lead factors into tier", () => {
    const result = scoreLead({ demographic: 90, engagement: 80, behavioral: 70, historical: 60 })
    expect(result.score).toBeGreaterThan(70)
    expect(["hot", "warm", "cold"]).toContain(result.tier)
  })

  it("scores discipline factors", () => {
    const result = scoreDiscipline({ followUpFrequency: 80, meetingAdherence: 90, taskCompletion: 70, dataEntryTimeliness: 60, pipelineHygiene: 75 })
    expect(result.score).toBeGreaterThan(60)
  })

  it("computes Wilson interval bounds", () => {
    const interval = wilsonInterval(70, 100)
    expect(interval.low).toBeLessThan(interval.high)
    expect(interval.high).toBeLessThanOrEqual(100)
  })
})
