"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStrongPassword = exports.verifyPassword = exports.hashPassword = void 0;
const crypto_1 = __importDefault(require("crypto"));
const encoding = "base64";
const serialize = (payload) => {
    return [
        payload.version,
        `n=${payload.n}`,
        `r=${payload.r}`,
        `p=${payload.p}`,
        `k=${payload.keyLen}`,
        payload.salt.toString(encoding),
        payload.key.toString(encoding)
    ].join("$");
};
const parse = (value) => {
    const parts = value.split("$");
    if (parts.length !== 7)
        return null;
    if (parts[0] !== "scrypt")
        return null;
    const n = Number(parts[1]?.split("=")[1]);
    const r = Number(parts[2]?.split("=")[1]);
    const p = Number(parts[3]?.split("=")[1]);
    const keyLen = Number(parts[4]?.split("=")[1]);
    if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !Number.isFinite(keyLen))
        return null;
    const salt = Buffer.from(parts[5] || "", encoding);
    const key = Buffer.from(parts[6] || "", encoding);
    if (!salt.length || !key.length)
        return null;
    return { version: "scrypt", salt, key, n, r, p, keyLen };
};
const scryptAsync = (password, salt, keyLen, n, r, p) => {
    return new Promise((resolve, reject) => {
        crypto_1.default.scrypt(password, salt, keyLen, { N: n, r, p }, (err, derivedKey) => {
            if (err)
                return reject(err);
            resolve(derivedKey);
        });
    });
};
const hashPassword = async (password) => {
    const salt = crypto_1.default.randomBytes(16);
    const n = 16384;
    const r = 8;
    const p = 1;
    const keyLen = 64;
    const key = await scryptAsync(password, salt, keyLen, n, r, p);
    return serialize({ version: "scrypt", salt, key, n, r, p, keyLen });
};
exports.hashPassword = hashPassword;
const verifyPassword = async (password, stored) => {
    const parsed = parse(stored);
    if (!parsed)
        return false;
    const computed = await scryptAsync(password, parsed.salt, parsed.keyLen, parsed.n, parsed.r, parsed.p);
    if (computed.length !== parsed.key.length)
        return false;
    return crypto_1.default.timingSafeEqual(computed, parsed.key);
};
exports.verifyPassword = verifyPassword;
const pick = (alphabet) => alphabet[crypto_1.default.randomInt(0, alphabet.length)] || "";
const shuffle = (value) => {
    const chars = value.split("");
    for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto_1.default.randomInt(0, i + 1);
        const tmp = chars[i];
        chars[i] = chars[j];
        chars[j] = tmp;
    }
    return chars.join("");
};
const generateStrongPassword = (length = 16) => {
    const safeLength = Number.isFinite(length) && length >= 12 ? Math.floor(length) : 16;
    const lower = "abcdefghijkmnopqrstuvwxyz";
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const digits = "23456789";
    const symbols = "!@#$%^&*()-_=+[]{}:,.?";
    const all = lower + upper + digits + symbols;
    let raw = pick(lower) + pick(upper) + pick(digits) + pick(symbols);
    while (raw.length < safeLength)
        raw += pick(all);
    return shuffle(raw);
};
exports.generateStrongPassword = generateStrongPassword;
