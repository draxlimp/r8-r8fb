"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLogDestination = resolveLogDestination;
const severityWeight = { info: 0, low: 1, medium: 2, high: 3, critical: 4, emergency: 5 };
function resolveLogDestination(cfg, event, severity) {
    const item = cfg.logs.events[event];
    if (!item || item.mode === 'disabled' || severityWeight[severity] < severityWeight[item.minimumSeverity])
        return { enabled: false, channelIds: [], mentionRoleId: null };
    const primary = item.mode === 'specific' ? item.channelId : cfg.logs.defaultChannelId;
    return { enabled: Boolean(primary), channelIds: [primary, item.secondaryChannelId].filter((v) => Boolean(v)), mentionRoleId: item.mentionRoleId && (!item.criticalOnlyMention || severityWeight[severity] >= severityWeight.critical) ? item.mentionRoleId : null };
}
//# sourceMappingURL=logRouter.js.map