import { prisma } from "../../prisma/client"

export const propertyService = {
  createProperty: (tenantId: string, data: { ownerContactId?: string; address: string; city: string; state: string; country: string; propertyType: string }) =>
    prisma.property.create({ data: { tenantId, ownerContactId: data.ownerContactId, address: data.address, city: data.city, state: data.state, country: data.country, propertyType: data.propertyType } }),

  createUnit: (tenantId: string, data: { propertyId: string; unitCode: string; bedrooms?: number; bathrooms?: number; sizeSqm?: number }) =>
    prisma.propertyUnit.create({ data: { tenantId, propertyId: data.propertyId, unitCode: data.unitCode, bedrooms: data.bedrooms, bathrooms: data.bathrooms, sizeSqm: data.sizeSqm } }),

  createListing: (tenantId: string, data: { propertyId: string; unitId?: string; listingType: string; price: number; currency?: string }) =>
    prisma.listing.create({ data: { tenantId, propertyId: data.propertyId, unitId: data.unitId, listingType: data.listingType, price: data.price, currency: data.currency || "USD" } }),

  createInquiry: (tenantId: string, data: { leadId: string; listingId: string; inquiryType: string }) =>
    prisma.inquiry.create({ data: { tenantId, leadId: data.leadId, listingId: data.listingId, inquiryType: data.inquiryType } }),

  createDeal: (tenantId: string, data: { leadId: string; listingId: string; dealValue?: number }) =>
    prisma.deal.create({ data: { tenantId, leadId: data.leadId, listingId: data.listingId, dealValue: data.dealValue } }),

  createOffer: (tenantId: string, data: { dealId: string; amount: number }) =>
    prisma.offer.create({ data: { tenantId, dealId: data.dealId, amount: data.amount } })
}
