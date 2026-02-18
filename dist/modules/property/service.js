"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertyService = void 0;
const client_1 = require("../../prisma/client");
exports.propertyService = {
    createProperty: (tenantId, data) => client_1.prisma.property.create({ data: { tenantId, ownerContactId: data.ownerContactId, address: data.address, city: data.city, state: data.state, country: data.country, propertyType: data.propertyType } }),
    createUnit: (tenantId, data) => client_1.prisma.propertyUnit.create({ data: { tenantId, propertyId: data.propertyId, unitCode: data.unitCode, bedrooms: data.bedrooms, bathrooms: data.bathrooms, sizeSqm: data.sizeSqm } }),
    createListing: (tenantId, data) => client_1.prisma.listing.create({ data: { tenantId, propertyId: data.propertyId, unitId: data.unitId, listingType: data.listingType, price: data.price, currency: data.currency || "USD" } }),
    createInquiry: (tenantId, data) => client_1.prisma.inquiry.create({ data: { tenantId, leadId: data.leadId, listingId: data.listingId, inquiryType: data.inquiryType } }),
    createDeal: (tenantId, data) => client_1.prisma.deal.create({ data: { tenantId, leadId: data.leadId, listingId: data.listingId, dealValue: data.dealValue } }),
    createOffer: (tenantId, data) => client_1.prisma.offer.create({ data: { tenantId, dealId: data.dealId, amount: data.amount } })
};
