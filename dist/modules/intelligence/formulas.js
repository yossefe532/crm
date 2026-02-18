"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wilsonInterval = exports.scoreDiscipline = exports.scoreLead = exports.weightedAverage = exports.timeDecayWeight = exports.normalize = exports.clamp = void 0;
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
exports.clamp = clamp;
const normalize = (value, min, max) => {
    if (max <= min)
        return 0;
    const ratio = (value - min) / (max - min);
    return (0, exports.clamp)(ratio * 100);
};
exports.normalize = normalize;
const timeDecayWeight = (daysAgo, halfLifeDays) => {
    const decay = Math.log(2) / Math.max(1, halfLifeDays);
    return Math.exp(-decay * daysAgo);
};
exports.timeDecayWeight = timeDecayWeight;
const weightedAverage = (weights, values) => {
    const entries = Object.entries(weights);
    const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
    if (!totalWeight)
        return 0;
    const weighted = entries.reduce((sum, [key, weight]) => sum + (values[key] || 0) * weight, 0);
    return (0, exports.clamp)(weighted / totalWeight);
};
exports.weightedAverage = weightedAverage;
const scoreLead = (factors, weights) => {
    const merged = { demographic: 0.25, engagement: 0.25, behavioral: 0.25, historical: 0.25, ...weights };
    const score = (0, exports.weightedAverage)(merged, factors);
    const tier = score >= 80 ? "hot" : score >= 60 ? "warm" : "cold";
    return { score, tier };
};
exports.scoreLead = scoreLead;
const scoreDiscipline = (factors, weights) => {
    const merged = { followUpFrequency: 0.2, meetingAdherence: 0.2, taskCompletion: 0.2, dataEntryTimeliness: 0.2, pipelineHygiene: 0.2, ...weights };
    const score = (0, exports.weightedAverage)(merged, factors);
    return { score };
};
exports.scoreDiscipline = scoreDiscipline;
const wilsonInterval = (successes, total, z = 1.96) => {
    if (!total)
        return { low: 0, high: 1 };
    const phat = successes / total;
    const denom = 1 + (z * z) / total;
    const center = (phat + (z * z) / (2 * total)) / denom;
    const margin = (z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * total)) / total)) / denom;
    return { low: (0, exports.clamp)((center - margin) * 100), high: (0, exports.clamp)((center + margin) * 100) };
};
exports.wilsonInterval = wilsonInterval;
