"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blacklistService = void 0;
const client_1 = require("../../prisma/client");
exports.blacklistService = {
    createEntry: (tenantId, data) => client_1.prisma.blacklistEntry.create({ data: { tenantId, identifierType: data.identifierType, identifierValue: data.identifierValue, reason: data.reason, severity: data.severity } }),
    checkLead: async (tenantId, leadId, identifiers) => {
        const matches = await client_1.prisma.blacklistEntry.findMany({
            where: {
                tenantId,
                OR: identifiers.map((id) => ({ identifierType: id.type, identifierValue: id.value }))
            }
        });
        const created = await Promise.all(matches.map((entry) => client_1.prisma.blacklistMatch.create({ data: { tenantId, leadId, entryId: entry.id, matchScore: 100, status: "flagged" } })));
        return created;
    }
};
