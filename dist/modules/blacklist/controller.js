"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blacklistController = void 0;
const service_1 = require("./service");
const activity_1 = require("../../utils/activity");
exports.blacklistController = {
    createEntry: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const entry = await service_1.blacklistService.createEntry(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "blacklist.entry.created", entityType: "blacklist_entry", entityId: entry.id });
        res.json(entry);
    },
    checkLead: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const matches = await service_1.blacklistService.checkLead(tenantId, req.body.leadId, req.body.identifiers || []);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "blacklist.checked", entityType: "lead", entityId: req.body.leadId });
        res.json(matches);
    }
};
