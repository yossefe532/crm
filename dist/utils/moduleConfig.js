"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModuleConfig = void 0;
const client_1 = require("../prisma/client");
const getModuleConfig = async (tenantId, moduleKey) => {
    const module = await client_1.prisma.module.findFirst({ where: { key: moduleKey } });
    if (!module)
        return null;
    return client_1.prisma.moduleConfig.findFirst({ where: { tenantId, moduleId: module.id, isActive: true } });
};
exports.getModuleConfig = getModuleConfig;
