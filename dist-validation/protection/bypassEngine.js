"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveBypass = resolveBypass;
exports.pruneExpiredBypasses = pruneExpiredBypasses;
const dates_1 = require("../utils/dates");
function applies(entry, module) { return entry.modules.length === 0 || entry.modules.includes('*') || entry.modules.includes(module); }
function resolveBypass(cfg, ctx, globalOwners = []) {
    if (!ctx.executorId)
        return { bypassed: false, entry: null, behavior: null, reason: 'executor_unknown' };
    if (ctx.executorId === ctx.botUserId)
        return { bypassed: true, entry: null, behavior: { ignoreDetection: true, ignorePunishment: true, ignoreRestoration: true, ignoreLimit: true, continueLogging: false }, reason: 'self_action' };
    if (globalOwners.includes(ctx.executorId))
        return { bypassed: true, entry: null, behavior: { ignoreDetection: false, ignorePunishment: true, ignoreRestoration: true, ignoreLimit: true, continueLogging: true }, reason: 'global_owner' };
    const active = cfg.bypasses.filter(e => !(0, dates_1.isExpired)(e.expiresAt) && applies(e, ctx.module));
    const order = [
        (e) => e.kind === 'user' && e.targetId === ctx.executorId && e.modules.includes('*'),
        (e) => e.kind === 'role' && ctx.executorRoleIds.includes(e.targetId) && e.modules.includes('*'),
        (e) => e.kind === 'user' && e.targetId === ctx.executorId,
        (e) => e.kind === 'role' && ctx.executorRoleIds.includes(e.targetId),
        (e) => e.expiresAt !== null && ((e.kind === 'user' && e.targetId === ctx.executorId) || (e.kind === 'role' && ctx.executorRoleIds.includes(e.targetId))),
        (e) => e.kind === 'bot' && ctx.executorIsBot === true && e.targetId === ctx.executorId,
        (e) => e.kind === 'channel' && e.targetId === ctx.channelId,
        (e) => e.kind === 'category' && e.targetId === ctx.categoryId
    ];
    for (const predicate of order) {
        const entry = active.find(predicate);
        if (entry)
            return { bypassed: true, entry, behavior: entry.behavior, reason: `bypass_${entry.kind}` };
    }
    return { bypassed: false, entry: null, behavior: null, reason: 'none' };
}
function pruneExpiredBypasses(cfg, now = Date.now()) {
    const expired = cfg.bypasses.filter(e => e.expiresAt && Date.parse(e.expiresAt) <= now);
    cfg.bypasses = cfg.bypasses.filter(e => !e.expiresAt || Date.parse(e.expiresAt) > now);
    return expired;
}
//# sourceMappingURL=bypassEngine.js.map