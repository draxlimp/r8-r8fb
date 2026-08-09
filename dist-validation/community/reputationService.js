"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPUTATION_COOLDOWN_MS = void 0;
exports.getReputation = getReputation;
exports.giveReputation = giveReputation;
exports.topReputation = topReputation;
exports.REPUTATION_COOLDOWN_MS = 12 * 60 * 60 * 1000;
function getReputation(config, userId) {
    const value = Number(config.community.reputation.scores[userId] ?? 0);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
function giveReputation(config, giverId, targetId, now = new Date()) {
    if (giverId === targetId)
        throw new Error('Você não pode dar reputação para si mesmo');
    const last = config.community.reputation.lastGivenAt[giverId];
    const lastTime = last ? Date.parse(last) : 0;
    const remainingMs = Math.max(0, exports.REPUTATION_COOLDOWN_MS - (now.getTime() - lastTime));
    if (remainingMs > 0)
        return { ok: false, score: getReputation(config, targetId), remainingMs };
    const score = getReputation(config, targetId) + 1;
    config.community.reputation.scores[targetId] = score;
    config.community.reputation.lastGivenAt[giverId] = now.toISOString();
    return { ok: true, score, remainingMs: 0 };
}
function topReputation(config, limit = 10) {
    return Object.entries(config.community.reputation.scores)
        .map(([userId, score]) => ({ userId, score: Math.max(0, Math.floor(Number(score) || 0)) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId))
        .slice(0, Math.max(1, Math.min(25, limit)));
}
//# sourceMappingURL=reputationService.js.map