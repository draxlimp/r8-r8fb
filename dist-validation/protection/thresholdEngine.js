"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.thresholdEngine = exports.ThresholdEngine = void 0;
class ThresholdEngine {
    entries = new Map();
    hit(guildId, module, actorId, quantity, intervalSeconds, value) {
        const key = `${guildId}:${module}:${actorId}`;
        const now = Date.now();
        const cutoff = now - intervalSeconds * 1000;
        const entry = this.entries.get(key) ?? { timestamps: [], values: [] };
        entry.timestamps = entry.timestamps.filter(t => t >= cutoff);
        entry.timestamps.push(now);
        entry.values = entry.values.filter(v => v.at >= cutoff);
        if (value !== undefined)
            entry.values.push({ at: now, value: normalize(value) });
        this.entries.set(key, entry);
        return { exceeded: entry.timestamps.length >= quantity, count: entry.timestamps.length };
    }
    hitRepeated(guildId, module, actorId, quantity, intervalSeconds, value) {
        const result = this.hit(guildId, module, actorId, Number.MAX_SAFE_INTEGER, intervalSeconds, value);
        const entry = this.entries.get(`${guildId}:${module}:${actorId}`);
        const normalized = normalize(value);
        const count = entry.values.filter(v => v.value === normalized && normalized.length > 0).length;
        return { exceeded: count >= quantity, count };
    }
    count(guildId, module, actorId, intervalSeconds) {
        const entry = this.entries.get(`${guildId}:${module}:${actorId}`);
        if (!entry)
            return 0;
        const cutoff = Date.now() - intervalSeconds * 1000;
        entry.timestamps = entry.timestamps.filter(t => t >= cutoff);
        return entry.timestamps.length;
    }
    clear(guildId, module, actorId) { this.entries.delete(`${guildId}:${module}:${actorId}`); }
}
exports.ThresholdEngine = ThresholdEngine;
function normalize(value) { return value.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 500); }
exports.thresholdEngine = new ThresholdEngine();
//# sourceMappingURL=thresholdEngine.js.map