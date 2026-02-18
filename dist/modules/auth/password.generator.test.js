"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const password_1 = require("./password");
const validation_1 = require("./validation");
(0, vitest_1.describe)("password generator", () => {
    (0, vitest_1.it)("generates passwords that pass strength validation", () => {
        const password = (0, password_1.generateStrongPassword)();
        (0, vitest_1.expect)((0, validation_1.validatePasswordStrength)(password).ok).toBe(true);
    });
});
