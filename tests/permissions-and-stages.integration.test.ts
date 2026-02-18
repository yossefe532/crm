import "../src/config/env"

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { createApp } from "../src/app"
import { prisma } from "../src/prisma/client"

const uniqueId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`
const uniquePhone = () => `010${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`

const json = async <T>(response: Response) => (await response.json()) as T

describe("integration: permissions + stage transitions", () => {
  let baseUrl = ""
  let server: ReturnType<typeof createServer> | null = null
  const tenantIds: string[] = []

  beforeAll(async () => {
    const app = createApp()
    server = createServer(app)
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve))
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  }, 30000)

  afterAll(async () => {
    for (const tenantId of tenantIds) {
      await prisma.notificationDelivery.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.notificationEvent.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.leadClosure.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.leadFailure.deleteMany({ where: { tenantId } }).catch(() => undefined)
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
      await prisma.financeEntry.deleteMany({ where: { tenantId } }).catch(() => undefined)
      await prisma.userRequest.deleteMany({ where: { tenantId } }).catch(() => undefined)
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
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()))
    server = null
  }, 30000)

  const registerTenant = async () => {
    const suffix = uniqueId()
    const ownerEmail = `owner-${suffix}@example.com`
    const ownerPassword = "Aa1!aaaa"
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantName: `Tenant ${suffix}`, email: ownerEmail, password: ownerPassword })
    })
    expect(res.status).toBe(200)
    const payload = await json<{ token: string; user: { id: string; tenantId: string; roles: string[] } }>(res)
    tenantIds.push(payload.user.tenantId)
    return { ...payload, ownerEmail, ownerPassword }
  }

  const login = async (email: string, password: string) => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    })
    expect(res.status).toBe(200)
    return json<{ token: string; user: { id: string; tenantId: string; roles: string[]; forceReset?: boolean } }>(res)
  }

  const changePassword = async (token: string, currentPassword: string, newPassword: string) => {
    const res = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword: newPassword })
    })
    expect(res.status).toBe(200)
    return json<{ token: string; user: { id: string; tenantId: string; roles: string[] } }>(res)
  }

  it("allows full stage progression and blocks invalid transition", async () => {
    const tenant = await registerTenant()
    const ownerToken = tenant.token

    const salesEmail = `sales-${uniqueId()}@example.com`
    const salesPassword = "Aa1!aaaa"
    const createSales = await fetch(`${baseUrl}/api/core/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: "Sales", email: salesEmail, password: salesPassword, role: "sales" })
    })
    expect(createSales.status).toBe(200)

    const salesSession = await login(salesEmail, salesPassword)

    const createLead = await fetch(`${baseUrl}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${salesSession.token}` },
      body: JSON.stringify({ name: "Lead", phone: "01000000000" })
    })
    expect(createLead.status).toBe(200)
    const lead = await json<{ id: string; status: string }>(createLead)

    const toMeeting = await fetch(`${baseUrl}/api/leads/${lead.id}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${salesSession.token}` },
      body: JSON.stringify({ stage: "meeting" })
    })
    expect(toMeeting.status).toBe(200)
    expect((await json<{ code: string }>(toMeeting)).code).toBe("meeting")

    const toSiteVisit = await fetch(`${baseUrl}/api/leads/${lead.id}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${salesSession.token}` },
      body: JSON.stringify({ stage: "site_visit" })
    })
    expect(toSiteVisit.status).toBe(200)
    expect((await json<{ code: string }>(toSiteVisit)).code).toBe("site_visit")

    const toClosing = await fetch(`${baseUrl}/api/leads/${lead.id}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${salesSession.token}` },
      body: JSON.stringify({ stage: "closing" })
    })
    expect(toClosing.status).toBe(200)
    expect((await json<{ code: string }>(toClosing)).code).toBe("closing")

    const lead2Res = await fetch(`${baseUrl}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${salesSession.token}` },
      body: JSON.stringify({ name: "Lead 2", phone: uniquePhone() })
    })
    expect(lead2Res.status).toBe(200)
    const lead2 = await json<{ id: string }>(lead2Res)

    const invalid = await fetch(`${baseUrl}/api/leads/${lead2.id}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${salesSession.token}` },
      body: JSON.stringify({ stage: "closing" })
    })
    expect(invalid.status).toBe(400)
    const invalidPayload = await json<{ message?: string; error?: string }>(invalid)
    expect(invalidPayload.message || invalidPayload.error).toBe("انتقال غير صالح بين المراحل")
  }, 30000)

  it("enforces team leader/sales visibility and assignment rules", async () => {
    const tenant = await registerTenant()
    const ownerToken = tenant.token

    const teamLeaderEmail = `tl-${uniqueId()}@example.com`
    const teamLeaderPassword = "Aa1!aaaa"
    const createTlRes = await fetch(`${baseUrl}/api/core/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: "Team Leader", email: teamLeaderEmail, password: teamLeaderPassword, role: "team_leader", teamName: "Team A" })
    })
    expect(createTlRes.status).toBe(200)

    const tlSession = await login(teamLeaderEmail, teamLeaderPassword)

    const sales1Email = `sales1-${uniqueId()}@example.com`
    const sales1Password = "Aa1!aaaa"
    const createSales1 = await fetch(`${baseUrl}/api/core/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tlSession.token}` },
      body: JSON.stringify({ name: "Sales 1", email: sales1Email, password: sales1Password, role: "sales" })
    })
    expect(createSales1.status).toBe(403)

    const sales2Email = `sales2-${uniqueId()}@example.com`
    const sales2Password = "Aa1!aaaa"
    const createSales2 = await fetch(`${baseUrl}/api/core/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ name: "Sales 2", email: sales2Email, password: sales2Password, role: "sales" })
    })
    expect(createSales2.status).toBe(200)

    const teamsRes = await fetch(`${baseUrl}/api/core/teams`, {
      method: "GET",
      headers: { Authorization: `Bearer ${ownerToken}` }
    })
    expect(teamsRes.status).toBe(200)
    const teams = await json<Array<{ id: string; leaderUserId?: string | null }>>(teamsRes)
    const leaderTeam = teams.find((team) => team.leaderUserId === tlSession.user.id)
    expect(leaderTeam?.id).toBeTruthy()

    const sales1Request = await fetch(`${baseUrl}/api/core/user-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tlSession.token}` },
      body: JSON.stringify({ name: "Sales 1", email: sales1Email, phone: uniquePhone(), teamId: leaderTeam?.id })
    })
    expect(sales1Request.status).toBe(200)
    const requestPayload = await json<{ id: string }>(sales1Request)

    const approveRequest = await fetch(`${baseUrl}/api/core/user-requests/${requestPayload.id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ status: "approved" })
    })
    expect(approveRequest.status).toBe(200)
    const approval = await json<{ createdUser?: { temporaryPassword?: string } }>(approveRequest)
    const tempPassword = approval.createdUser?.temporaryPassword
    expect(tempPassword).toBeTruthy()

    const sales1Session = await login(sales1Email, tempPassword || sales1Password)
    const sales1ActiveSession = sales1Session.user.forceReset
      ? await changePassword(sales1Session.token, tempPassword || sales1Password, sales1Password)
      : sales1Session
    const sales2Session = await login(sales2Email, sales2Password)

    const sales1LeadRes = await fetch(`${baseUrl}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sales1ActiveSession.token}` },
      body: JSON.stringify({ name: "Sales1 Lead", phone: uniquePhone() })
    })
    expect(sales1LeadRes.status).toBe(200)
    const sales1Lead = await json<{ id: string }>(sales1LeadRes)

    const sales2LeadRes = await fetch(`${baseUrl}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sales2Session.token}` },
      body: JSON.stringify({ name: "Sales2 Lead", phone: uniquePhone() })
    })
    expect(sales2LeadRes.status).toBe(200)
    const sales2Lead = await json<{ id: string }>(sales2LeadRes)

    const tlListRes = await fetch(`${baseUrl}/api/leads?page=1&pageSize=50`, {
      method: "GET",
      headers: { Authorization: `Bearer ${tlSession.token}` }
    })
    expect(tlListRes.status).toBe(200)
    const tlLeads = await json<{ data: Array<{ id: string }> }>(tlListRes)
    expect(tlLeads.data.some((lead) => lead.id === sales1Lead.id)).toBe(true)
    expect(tlLeads.data.some((lead) => lead.id === sales2Lead.id)).toBe(false)

    const sales1ListRes = await fetch(`${baseUrl}/api/leads?page=1&pageSize=50`, {
      method: "GET",
      headers: { Authorization: `Bearer ${sales1ActiveSession.token}` }
    })
    expect(sales1ListRes.status).toBe(200)
    const sales1Leads = await json<{ data: Array<{ id: string }> }>(sales1ListRes)
    expect(sales1Leads.data.some((lead) => lead.id === sales1Lead.id)).toBe(true)
    expect(sales1Leads.data.some((lead) => lead.id === sales2Lead.id)).toBe(false)

    const salesAssignOther = await fetch(`${baseUrl}/api/leads/${sales1Lead.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sales1ActiveSession.token}` },
      body: JSON.stringify({ assignedUserId: sales2Session.user.id })
    })
    expect(salesAssignOther.status).toBe(403)

    const tlAssignInTeam = await fetch(`${baseUrl}/api/leads/${sales1Lead.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tlSession.token}` },
      body: JSON.stringify({ assignedUserId: sales1ActiveSession.user.id })
    })
    expect(tlAssignInTeam.status).toBe(200)

    const tlAssignOutsideTeam = await fetch(`${baseUrl}/api/leads/${sales1Lead.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tlSession.token}` },
      body: JSON.stringify({ assignedUserId: sales2Session.user.id })
    })
    expect(tlAssignOutsideTeam.status).toBe(403)
  }, 30000)
})
