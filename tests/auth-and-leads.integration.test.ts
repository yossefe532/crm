import "../src/config/env"

import { beforeAll, afterAll, describe, expect, it } from "vitest"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { createApp } from "../src/app"
import { prisma } from "../src/prisma/client"

const uniqueId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

describe("integration: auth + users + leads", () => {
  let baseUrl = ""
  let server: ReturnType<typeof createServer> | null = null
  let tenantId: string | null = null

  beforeAll(async () => {
    const app = createApp()
    server = createServer(app)
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve))
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  }, 30000)

  afterAll(async () => {
    if (tenantId) {
      await prisma.notificationDelivery.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.notificationEvent.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.leadDeadline.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.leadStateHistory.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.leadStateTransition.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.leadStateDefinition.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.callLog.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.leadTask.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.leadActivityLog.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.leadAssignment.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.leadContact.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.leadTagLink.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.leadTag.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.lead.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.auditLog.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.rolePermission.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.userPermission.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.userRole.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.teamMember.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.team.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.userProfile.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => undefined)
    }

    await prisma.$disconnect()
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()))
      server = null
    }
  }, 30000)

  it("registers tenant, creates sales user, sales can create lead without code and transition stage", async () => {
    const suffix = uniqueId()
    const ownerEmail = `owner-${suffix}@example.com`
    const ownerPassword = "Aa1!aaaa"

    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantName: `Tenant ${suffix}`,
        email: ownerEmail,
        password: ownerPassword
      })
    })
    expect(registerResponse.status).toBe(200)
    const registerPayload = (await registerResponse.json()) as { token: string; user: { id: string; tenantId: string; roles: string[] } }
    expect(registerPayload.token).toBeTruthy()
    expect(registerPayload.user.roles).toContain("owner")
    tenantId = registerPayload.user.tenantId

    const salesEmail = `sales-${suffix}@example.com`
    const salesPassword = "Aa1!aaaa"
    const createUserResponse = await fetch(`${baseUrl}/api/core/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${registerPayload.token}` },
      body: JSON.stringify({
        name: "Sales User",
        email: salesEmail,
        password: salesPassword,
        role: "sales"
      })
    })
    expect(createUserResponse.status).toBe(200)
    const createUserPayload = (await createUserResponse.json()) as { user: { id: string; tenantId: string; email: string } }
    expect(createUserPayload.user.email).toBe(salesEmail)
    expect(createUserPayload.user.tenantId).toBe(tenantId)

    const salesLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: salesEmail, password: salesPassword })
    })
    expect(salesLoginResponse.status).toBe(200)
    const salesLoginPayload = (await salesLoginResponse.json()) as { token: string; user: { id: string; tenantId: string; roles: string[] } }
    expect(salesLoginPayload.user.roles).toContain("sales")

    const createLeadResponse = await fetch(`${baseUrl}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${salesLoginPayload.token}` },
      body: JSON.stringify({ name: "Lead Without Code", phone: "01000000000" })
    })
    expect(createLeadResponse.status).toBe(200)
    const leadPayload = (await createLeadResponse.json()) as { id: string; leadCode: string; status: string }
    expect(leadPayload.leadCode).toBeTruthy()

    const stageResponse = await fetch(`${baseUrl}/api/leads/${leadPayload.id}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${salesLoginPayload.token}` },
      body: JSON.stringify({ stage: "meeting" })
    })
    expect(stageResponse.status).toBe(200)
    const stagePayload = (await stageResponse.json()) as { code: string }
    expect(stagePayload.code).toBe("meeting")
  }, 20000)
})
