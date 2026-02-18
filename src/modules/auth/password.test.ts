import { describe, expect, it } from "vitest"
import { hashPassword, verifyPassword } from "./password"

describe("password hashing", () => {
  it("hashes and verifies password", async () => {
    const password = "Str0ng!Pass"
    const hash = await hashPassword(password)
    expect(hash).toContain("scrypt$")
    await expect(verifyPassword(password, hash)).resolves.toBe(true)
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false)
  })
})

