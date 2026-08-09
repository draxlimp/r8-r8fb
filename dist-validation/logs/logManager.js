"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendIncidentLog = sendIncidentLog;
const logRouter_1 = require("./logRouter");
const logRenderer_1 = require("./logRenderer");
const logger_1 = require("../utils/logger");
async function sendIncidentLog(guild, cfg, incident) {
    const destination = (0, logRouter_1.resolveLogDestination)(cfg, incident.event, incident.severity);
    if (!destination.enabled)
        return;
    for (const channelId of destination.channelIds) {
        try {
            const channel = await guild.channels.fetch(channelId);
            if (!channel?.isTextBased?.())
                throw new Error('Canal não é textual ou não existe');
            await channel.send((0, logRenderer_1.renderIncident)(incident, guild.name));
            cfg.logs.lastSentAt = new Date().toISOString();
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            cfg.logs.failures.unshift({ at: new Date().toISOString(), event: incident.event, reason });
            cfg.logs.failures = cfg.logs.failures.slice(0, 20);
            logger_1.logger.error('Falha ao enviar log do Discord.', { guildId: guild.id, channelId, event: incident.event, reason });
        }
    }
}
//# sourceMappingURL=logManager.js.map