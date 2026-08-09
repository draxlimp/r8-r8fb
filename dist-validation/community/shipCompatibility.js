"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shipCompatibility = shipCompatibility;
function shipCompatibility(firstId, secondId, guildId = '') {
    const pair = [firstId, secondId].sort().join(':');
    let hash = 2166136261;
    for (const char of `${guildId}:${pair}`) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0) % 101;
}
//# sourceMappingURL=shipCompatibility.js.map