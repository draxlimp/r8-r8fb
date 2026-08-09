"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voiceSeconds = voiceSeconds;
exports.voiceLeaderboard = voiceLeaderboard;
exports.formatVoiceTime = formatVoiceTime;
function voiceSeconds(config, userId, now = Date.now()) {
    const base = config.community.voiceActivity.totalsSeconds[userId] ?? 0;
    const active = config.community.voiceActivity.activeSince[userId];
    return base + (active ? Math.max(0, Math.floor((now - Date.parse(active)) / 1000)) : 0);
}
function voiceLeaderboard(config, limit = 10, now = Date.now()) {
    const ids = new Set([
        ...Object.keys(config.community.voiceActivity.totalsSeconds),
        ...Object.keys(config.community.voiceActivity.activeSince)
    ]);
    return [...ids]
        .map(userId => ({ userId, seconds: voiceSeconds(config, userId, now) }))
        .filter(item => item.seconds > 0)
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, Math.max(1, limit));
}
function formatVoiceTime(seconds) {
    const safe = Math.max(0, Math.floor(seconds));
    const days = Math.floor(safe / 86400);
    const hours = Math.floor((safe % 86400) / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const remainingSeconds = safe % 60;
    if (days)
        return `${days}d ${hours}h ${minutes}m`;
    if (hours)
        return `${hours}h ${minutes}m`;
    if (minutes)
        return `${minutes}m ${remainingSeconds}s`;
    return `${remainingSeconds}s`;
}
//# sourceMappingURL=activityMath.js.map