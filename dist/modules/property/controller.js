"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertyController = void 0;
const service_1 = require("./service");
const activity_1 = require("../../utils/activity");
const service_2 = require("../intelligence/service");
exports.propertyController = {
    createProperty: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const property = await service_1.propertyService.createProperty(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "property.created", entityType: "property", entityId: property.id });
        res.json(property);
    },
    createUnit: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const unit = await service_1.propertyService.createUnit(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "property_unit.created", entityType: "property_unit", entityId: unit.id });
        res.json(unit);
    },
    createListing: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const listing = await service_1.propertyService.createListing(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "listing.created", entityType: "listing", entityId: listing.id });
        res.json(listing);
    },
    createInquiry: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const inquiry = await service_1.propertyService.createInquiry(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "inquiry.created", entityType: "inquiry", entityId: inquiry.id });
        res.json(inquiry);
    },
    createDeal: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const deal = await service_1.propertyService.createDeal(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "deal.created", entityType: "deal", entityId: deal.id });
        service_2.intelligenceService.queueTrigger({ type: "deal_changed", tenantId, dealId: deal.id, leadId: deal.leadId });
        res.json(deal);
    },
    createOffer: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const offer = await service_1.propertyService.createOffer(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "offer.created", entityType: "offer", entityId: offer.id });
        service_2.intelligenceService.queueTrigger({ type: "deal_changed", tenantId, dealId: offer.dealId });
        res.json(offer);
    }
};
