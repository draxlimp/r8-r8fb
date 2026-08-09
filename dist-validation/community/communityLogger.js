"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logCommunityEvent = logCommunityEvent;
const incidentManager_1 = require("../protection/incidentManager");
const logManager_1 = require("../logs/logManager");
async function logCommunityEvent(input) {
    const incident = await (0, incidentManager_1.createIncident)({
        guildId: input.guild.id,
        module: input.module,
        event: input.event,
        severity: input.severity ?? 'info',
        executorId: input.executorId ?? null,
        targetId: input.targetId ?? null,
        channelId: input.channelId ?? null,
        confidence: 'confirmed',
        configuredAction: input.module,
        details: input.details ?? {}
    });
    incident.actionResult = input.actionResult ?? 'success';
    incident.restorationResult = 'not_requested';
    await (0, incidentManager_1.updateIncident)(incident);
    await (0, logManager_1.sendIncidentLog)(input.guild, input.config, incident);
}
//# sourceMappingURL=communityLogger.js.map