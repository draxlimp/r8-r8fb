import type { GuildConfig, Severity } from '../types/guildConfig';
const severityWeight: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4, emergency: 5 };
export function resolveLogDestination(cfg: GuildConfig, event: string, severity: Severity): { enabled: boolean; channelIds: string[]; mentionRoleId: string | null } {
  const item = cfg.logs.events[event]; if (!item || item.mode === 'disabled' || severityWeight[severity] < severityWeight[item.minimumSeverity]) return { enabled: false, channelIds: [], mentionRoleId: null };
  const primary = item.mode === 'specific' ? item.channelId : cfg.logs.defaultChannelId;
  return { enabled: Boolean(primary), channelIds: [primary, item.secondaryChannelId].filter((v): v is string => Boolean(v)), mentionRoleId: item.mentionRoleId && (!item.criticalOnlyMention || severityWeight[severity] >= severityWeight.critical) ? item.mentionRoleId : null };
}
