"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDailyReportJob = void 0;
const client_1 = require("../prisma/client");
const runDailyReportJob = async (tenantId) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const start = new Date(yesterday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(yesterday);
    end.setHours(23, 59, 59, 999);
    const leadsCreated = await client_1.prisma.lead.count({ where: { tenantId, createdAt: { gte: start, lte: end } } });
    const leadsClosed = await client_1.prisma.deal.count({ where: { tenantId, status: "closed", closedAt: { gte: start, lte: end } } });
    await client_1.prisma.leadMetricsDaily.create({ data: { tenantId, metricDate: start, leadsCreated, leadsClosed } });
};
exports.runDailyReportJob = runDailyReportJob;
