"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.smsService = exports.logSmsService = void 0;
exports.logSmsService = {
    send: async (to, message) => {
        console.log(`[SMS] To: ${to}, Message: ${message}`);
    }
};
// In a real app, we would switch implementation based on env config
exports.smsService = exports.logSmsService;
