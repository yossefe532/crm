"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = void 0;
const client_1 = require("../prisma/client");
const logActivity = async (input) => {
    return client_1.prisma.auditLog.create({
        data: {
            tenantId: input.tenantId,
            actorUserId: input.actorUserId,
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId,
            metadata: input.metadata ? input.metadata : undefined
        }
    });
};
exports.logActivity = logActivity;
