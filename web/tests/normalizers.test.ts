import { normalizeLead } from "../lib/api/normalizers"

describe("normalizeLead", () => {
  it("casts stage and createdAt", () => {
    const lead = normalizeLead({
      id: "1",
      leadCode: "LD-001",
      name: "Test",
      status: "call",
      priority: "normal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    expect(lead.status).toBe("call")
    expect(lead.createdAt instanceof Date).toBe(true)
  })
})
