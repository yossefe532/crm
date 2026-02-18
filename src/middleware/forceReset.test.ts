import { describe, expect, it, vi } from "vitest"
import { forceResetMiddleware } from "./forceReset"

describe("forceResetMiddleware", () => {
  it("blocks access when user.forceReset is true", () => {
    const req = { user: { id: "u1", tenantId: "t1", roles: ["sales"], forceReset: true }, path: "/api/leads" } as any
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any
    const next = vi.fn()

    forceResetMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: "يجب تغيير كلمة المرور أولاً" })
    expect(next).not.toHaveBeenCalled()
  })

  it("allows access to change-password path when user.forceReset is true", () => {
    const req = { user: { id: "u1", tenantId: "t1", roles: ["sales"], forceReset: true }, path: "/api/auth/change-password" } as any
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any
    const next = vi.fn()

    forceResetMiddleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it("allows access when user.forceReset is false", () => {
    const req = { user: { id: "u1", tenantId: "t1", roles: ["sales"] }, path: "/api/leads" } as any
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any
    const next = vi.fn()

    forceResetMiddleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })
})

