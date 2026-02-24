import { Request, Response } from "express"
import { propertyService } from "./service"
import { logActivity } from "../../utils/activity"
import { intelligenceService } from "../intelligence/service"

export const propertyController = {
  createProperty: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const property = await propertyService.createProperty(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "property.created", entityType: "property", entityId: property.id })
    res.json(property)
  },
  createUnit: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const unit = await propertyService.createUnit(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "property_unit.created", entityType: "property_unit", entityId: unit.id })
    res.json(unit)
  },
  createListing: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const listing = await propertyService.createListing(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "listing.created", entityType: "listing", entityId: listing.id })
    res.json(listing)
  },
  createInquiry: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const inquiry = await propertyService.createInquiry(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "inquiry.created", entityType: "inquiry", entityId: inquiry.id })
    res.json(inquiry)
  },
  createDeal: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const deal = await propertyService.createDeal(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "deal.created", entityType: "deal", entityId: deal.id })
    intelligenceService.queueTrigger({ type: "deal_changed", tenantId, dealId: deal.id, leadId: deal.leadId })
    res.json(deal)
  },
  createOffer: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const offer = await propertyService.createOffer(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "offer.created", entityType: "offer", entityId: offer.id })
    intelligenceService.queueTrigger({ type: "deal_changed", tenantId, dealId: req.body.dealId })
    res.json(offer)
  }
}
