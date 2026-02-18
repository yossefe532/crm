"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const password_1 = require("./password");
(0, vitest_1.describe)("password hashing", () => {
    (0, vitest_1.it)("hashes and verifies password", async () => {
        const password = "Str0ng!Pass";
        const hash = await (0, password_1.hashPassword)(password);
        (0, vitest_1.expect)(hash).toContain("scrypt$");
        await (0, vitest_1.expect)((0, password_1.verifyPassword)(password, hash)).resolves.toBe(true);
        await (0, vitest_1.expect)((0, password_1.verifyPassword)("wrong", hash)).resolves.toBe(false);
    });
});
