"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePasswordStrength = exports.isValidEmail = void 0;
const isValidEmail = (value) => {
    const normalized = value.trim();
    if (!normalized)
        return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
};
exports.isValidEmail = isValidEmail;
const validatePasswordStrength = (value) => {
    const password = value || "";
    const minLength = 8;
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    const ok = password.length >= minLength && hasLower && hasUpper && hasDigit && hasSymbol;
    return {
        ok,
        reasons: ok
            ? []
            : [
                ...(password.length >= minLength ? [] : [`يجب ألا تقل كلمة المرور عن ${minLength} أحرف`]),
                ...(hasLower ? [] : ["يجب أن تحتوي كلمة المرور على حرف صغير واحد على الأقل"]),
                ...(hasUpper ? [] : ["يجب أن تحتوي كلمة المرور على حرف كبير واحد على الأقل"]),
                ...(hasDigit ? [] : ["يجب أن تحتوي كلمة المرور على رقم واحد على الأقل"]),
                ...(hasSymbol ? [] : ["يجب أن تحتوي كلمة المرور على رمز واحد على الأقل"])
            ]
    };
};
exports.validatePasswordStrength = validatePasswordStrength;
