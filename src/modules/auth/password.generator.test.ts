import { describe, expect, it } from "vitest"
import { generateStrongPassword } from "./password"
import { validatePasswordStrength } from "./validation"

describe("password generator", () => {
  it("generates passwords that pass strength validation", () => {
    const password = generateStrongPassword()
    expect(validatePasswordStrength(password).ok).toBe(true)
  })
})

