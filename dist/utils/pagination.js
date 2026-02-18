"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPagination = void 0;
const getPagination = (page, pageSize) => {
    const p = Math.max(1, Number(page || 1));
    const s = Math.min(100, Math.max(1, Number(pageSize || 20)));
    return { skip: (p - 1) * s, take: s, page: p, pageSize: s };
};
exports.getPagination = getPagination;
