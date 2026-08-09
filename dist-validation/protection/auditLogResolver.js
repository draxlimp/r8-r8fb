"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAudit = resolveAudit;
async function resolveAudit(guild, type, targetId, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        if (attempt)
            await new Promise(r => setTimeout(r, 700));
        try {
            const logs = await guild.fetchAuditLogs({ type, limit: 6 });
            const now = Date.now();
            const candidates = [...logs.entries.values()].filter((entry) => now - entry.createdTimestamp < 12_000);
            const exact = candidates.find((entry) => !targetId || entry.target?.id === targetId);
            if (exact?.executor)
                return { executorId: exact.executor.id, executor: exact.executor, entryId: exact.id, confidence: 'confirmed', reason: 'target_and_time_match' };
            if (candidates.length === 1 && candidates[0]?.executor)
                return { executorId: candidates[0].executor.id, executor: candidates[0].executor, entryId: candidates[0].id, confidence: 'probable', reason: 'single_recent_entry' };
        }
        catch (error) {
            if (attempt === retries)
                return { executorId: null, executor: null, entryId: null, confidence: 'unidentified', reason: error instanceof Error ? error.message : String(error) };
        }
    }
    return { executorId: null, executor: null, entryId: null, confidence: 'uncertain', reason: 'no_confident_entry' };
}
//# sourceMappingURL=auditLogResolver.js.map