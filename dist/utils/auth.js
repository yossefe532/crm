"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAuthToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const parseAuthToken = (token) => {
    if (!token)
        return null;
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
        if (!payload?.id || !payload?.tenantId)
            return null;
        return payload;
    }
    catch {
        return null;
    }
};
exports.parseAuthToken = parseAuthToken;
