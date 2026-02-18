import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { validate } from "./validate"

describe("validate middleware", () => {
  it("returns structured Arabic validation errors", () => {
    const schema = z.object({ email: z.string().email("صيغة البريد الإلكتروني غير صحيحة") })
    const handler = validate(schema)

    const req = { body: { email: "not-an-email" } } as any
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any
    const next = vi.fn()

    handler(req, res, next)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "خطأ في التحقق من البيانات",
        message: "صيغة البريد الإلكتروني غير صحيحة",
        details: [{ path: "email", message: "صيغة البريد الإلكتروني غير صحيحة" }]
      })
    )
    expect(next).not.toHaveBeenCalled()
  })
})

