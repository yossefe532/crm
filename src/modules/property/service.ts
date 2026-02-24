import { prisma } from "../../prisma/client"
import { notificationService } from "../notifications/service"

export const propertyService = {
  createProperty: (tenantId: string, data: { ownerContactId?: string; address: string; city: string; state: string; country: string; propertyType: string }) =>
    prisma.property.create({ 
      data: { 
        tenantId, 
        name: `${data.address}, ${data.city}`, // Mapped from address
        type: data.propertyType, // Mapped from propertyType
        location: `${data.city}, ${data.state}, ${data.country}` // Mapped from city, state, country
      } 
    }),

  createUnit: (tenantId: string, data: { propertyId: string; unitCode: string; bedrooms?: number; bathrooms?: number; sizeSqm?: number }) =>
    prisma.propertyUnit.create({ 
      data: { 
        tenantId, 
        propertyId: data.propertyId, 
        unitNumber: data.unitCode, // Mapped from unitCode
        rooms: data.bedrooms, // Mapped from bedrooms
        bathrooms: data.bathrooms, 
        area: data.sizeSqm // Mapped from sizeSqm
      } 
    }),

  createListing: (tenantId: string, data: { propertyId: string; unitId?: string; listingType: string; price: number; currency?: string }) =>
    prisma.listing.create({ 
      data: { 
        tenantId, 
        propertyId: data.propertyId, 
        unitId: data.unitId, 
        type: data.listingType, // Mapped from listingType
        price: data.price, 
        currency: data.currency || "USD" 
      } 
    }),

  createInquiry: (tenantId: string, data: { leadId: string; listingId: string; inquiryType: string }) =>
    prisma.inquiry.create({ 
      data: { 
        tenantId, 
        leadId: data.leadId, 
        content: `Inquiry about listing ${data.listingId} (Type: ${data.inquiryType})` // Mapped to content
      } 
    }),

  createDeal: async (tenantId: string, data: { leadId: string; listingId: string; dealValue?: number; createdBy?: string }) => {
    const deal = await prisma.deal.create({ 
      data: { 
        tenantId, 
        leadId: data.leadId, 
        listingId: data.listingId, 
        price: data.dealValue || 0 // Mapped dealValue -> price
      } 
    })
    
    // Notify Admins
    const admins = await prisma.user.findMany({
      where: {
        tenantId,
        roleLinks: { some: { role: { name: { in: ["owner", "team_leader"] } } } },
        deletedAt: null,
        status: "active"
      },
      select: { id: true }
    })
    
    if (admins.length > 0) {
      await notificationService.sendMany(
        admins.map(a => a.id),
        {
          tenantId,
          type: "info",
          title: "صفقة جديدة (عقار)",
          message: `تم تسجيل صفقة جديدة بقيمة ${data.dealValue || 0}`,
          entityType: "deal",
          entityId: deal.id,
          actionUrl: `/leads/${data.leadId}`, // Navigate to lead to see deal
          senderId: data.createdBy
        }
      ).catch(console.error)
    }

    return deal
  },

  createOffer: async (tenantId: string, data: { dealId: string; amount: number; createdBy?: string }) => {
    // Deal doesn't have lead relation in schema, so we fetch deal first to get leadId/listingId
    const deal = await prisma.deal.findUnique({ where: { id: data.dealId } })
    if (!deal) throw new Error("Deal not found")

    const offer = await prisma.offer.create({ 
      data: { 
        tenantId, 
        listingId: deal.listingId,
        leadId: deal.leadId,
        price: data.amount // Mapped amount -> price
      } 
    })
    
    // Notify Deal Owner / Lead Assignee
    // Fetch lead separately
    const lead = await prisma.lead.findUnique({ where: { id: deal.leadId } })

    if (lead && lead.assignedUserId) {
        if (lead.assignedUserId !== data.createdBy) {
            await notificationService.sendMany(
                [lead.assignedUserId],
                {
                    tenantId,
                    type: "info",
                    title: "عرض جديد",
                    message: `تم تقديم عرض جديد بقيمة ${data.amount} للصفقة #${data.dealId}`,
                    entityType: "offer",
                    entityId: offer.id,
                    actionUrl: `/leads/${deal.leadId}`,
                    senderId: data.createdBy
                }
            ).catch(console.error)
        }
    }
    
    return offer
  }
}
