"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const formulas_1 = require("./formulas");
(0, vitest_1.describe)("intelligence formulas", () => {
    (0, vitest_1.it)("clamps and normalizes values", () => {
        (0, vitest_1.expect)((0, formulas_1.clamp)(120)).toBe(100);
        (0, vitest_1.expect)((0, formulas_1.clamp)(-10)).toBe(0);
        (0, vitest_1.expect)((0, formulas_1.normalize)(50, 0, 100)).toBe(50);
    });
    (0, vitest_1.it)("scores lead factors into tier", () => {
        const result = (0, formulas_1.scoreLead)({ demographic: 90, engagement: 80, behavioral: 70, historical: 60 });
        (0, vitest_1.expect)(result.score).toBeGreaterThan(70);
        (0, vitest_1.expect)(["hot", "warm", "cold"]).toContain(result.tier);
    });
    (0, vitest_1.it)("scores discipline factors", () => {
        const result = (0, formulas_1.scoreDiscipline)({ followUpFrequency: 80, meetingAdherence: 90, taskCompletion: 70, dataEntryTimeliness: 60, pipelineHygiene: 75 });
        (0, vitest_1.expect)(result.score).toBeGreaterThan(60);
    });
    (0, vitest_1.it)("computes Wilson interval bounds", () => {
        const interval = (0, formulas_1.wilsonInterval)(70, 100);
        (0, vitest_1.expect)(interval.low).toBeLessThan(interval.high);
        (0, vitest_1.expect)(interval.high).toBeLessThanOrEqual(100);
    });
});
