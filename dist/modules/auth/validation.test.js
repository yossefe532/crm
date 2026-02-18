"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const validation_1 = require("./validation");
(0, vitest_1.describe)("auth validation", () => {
    (0, vitest_1.it)("validates email format", () => {
        (0, vitest_1.expect)((0, validation_1.isValidEmail)("test@example.com")).toBe(true);
        (0, vitest_1.expect)((0, validation_1.isValidEmail)("test.example.com")).toBe(false);
        (0, vitest_1.expect)((0, validation_1.isValidEmail)("")).toBe(false);
    });
    (0, vitest_1.it)("validates strong password rules", () => {
        (0, vitest_1.expect)((0, validation_1.validatePasswordStrength)("weak").ok).toBe(false);
        (0, vitest_1.expect)((0, validation_1.validatePasswordStrength)("Strong1!").ok).toBe(true);
    });
});
