import type { GuildConfig, Severity } from '../types/guildConfig';
import { createIncident, updateIncident } from '../protection/incidentManager';
import { sendIncidentLog } from '../logs/logManager';

export async function logCommunityEvent(input: {
  guild: any;
  config: GuildConfig;
  event: string;
  module: string;
  executorId?: string | null;
  targetId?: string | null;
  channelId?: string | null;
  severity?: Severity;
  actionResult?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const incident = await createIncident({
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
  await updateIncident(incident);
  await sendIncidentLog(input.guild, input.config, incident);
}
