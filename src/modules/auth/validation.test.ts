import { describe, expect, it } from "vitest"
import { isValidEmail, validatePasswordStrength } from "./validation"

describe("auth validation", () => {
  it("validates email format", () => {
    expect(isValidEmail("test@example.com")).toBe(true)
    expect(isValidEmail("test.example.com")).toBe(false)
    expect(isValidEmail("")).toBe(false)
  })

  it("validates strong password rules", () => {
    expect(validatePasswordStrength("weak").ok).toBe(false)
    expect(validatePasswordStrength("Strong1!").ok).toBe(true)
  })
})

