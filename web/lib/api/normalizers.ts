import { Lead } from "../types"

export const normalizeLead = (lead: Lead) => ({
  ...lead,
  status: lead.status,
  createdAt: new Date(lead.createdAt),
  updatedAt: new Date(lead.updatedAt)
})
