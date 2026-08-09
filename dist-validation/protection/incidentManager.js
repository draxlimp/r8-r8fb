"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIncident = createIncident;
exports.updateIncident = updateIncident;
const ids_1 = require("../utils/ids");
const incidentStore_1 = require("../storage/incidentStore");
async function createIncident(input) {
    const incident = {
        id: (0, ids_1.incidentId)(), guildId: input.guildId, module: input.module, event: input.event, severity: input.severity,
        executorId: input.executorId ?? null, targetId: input.targetId ?? null, channelId: input.channelId ?? null, confidence: input.confidence ?? 'unidentified', bypass: null,
        configuredAction: input.configuredAction ?? 'log', actionResult: 'pending', restorationResult: 'not_requested', details: input.details ?? {}, createdAt: new Date().toISOString(), durationMs: Date.now() - (input.startedAt ?? Date.now())
    };
    await (0, incidentStore_1.saveIncident)(incident);
    return incident;
}
async function updateIncident(incident) { incident.durationMs = Math.max(incident.durationMs, 0); await (0, incidentStore_1.saveIncident)(incident); }
//# sourceMappingURL=incidentManager.js.map