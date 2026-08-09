import type { Incident } from '../types/incident';
import type { GuildConfig } from '../types/guildConfig';
import { resolveLogDestination } from './logRouter';
import { renderIncident } from './logRenderer';
import { logger } from '../utils/logger';
export async function sendIncidentLog(guild: any, cfg: GuildConfig, incident: Incident): Promise<void> {
  const destination = resolveLogDestination(cfg, incident.event, incident.severity); if (!destination.enabled) return;
  for (const channelId of destination.channelIds) {
    try { const channel = await guild.channels.fetch(channelId); if (!channel?.isTextBased?.()) throw new Error('Canal não é textual ou não existe'); await channel.send(renderIncident(incident, guild.name)); cfg.logs.lastSentAt = new Date().toISOString(); }
    catch (error) { const reason = error instanceof Error ? error.message : String(error); cfg.logs.failures.unshift({ at: new Date().toISOString(), event: incident.event, reason }); cfg.logs.failures = cfg.logs.failures.slice(0,20); logger.error('Falha ao enviar log do Discord.', { guildId: guild.id, channelId, event: incident.event, reason }); }
  }
}
