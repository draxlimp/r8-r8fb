import { ActivityType } from 'discord.js';
import type { AppConfig, ActivityTypeName } from '../types/config';

const activityMap: Record<string, any> = {
  playing: ActivityType.Playing,
  streaming: ActivityType.Streaming,
  listening: ActivityType.Listening,
  watching: ActivityType.Watching,
  competing: ActivityType.Competing,
  custom: ActivityType.Custom
};

export interface PresenceActivityConfig {
  activityType: ActivityTypeName;
  activityText: string;
  streamUrl?: string;
}

export function renderPresenceText(client: any, config: AppConfig, template: string): string {
  const guilds = [...(client.guilds?.cache?.values?.() ?? [])];
  const members = guilds.reduce((total: number, guild: any) => total + Number(guild.memberCount ?? 0), 0);
  const channels = guilds.reduce((total: number, guild: any) => total + Number(guild.channels?.cache?.size ?? 0), 0);
  const uptimeMs = Number(client.uptime ?? 0);
  const uptime = formatShortUptime(uptimeMs);
  const replacements: Record<string, string> = {
    members: String(members),
    servers: String(guilds.length),
    channels: String(channels),
    prefix: config.prefix,
    bot: String(client.user?.username ?? 'bot'),
    ping: String(Math.max(0, Math.round(Number(client.ws?.ping ?? 0)))),
    uptime
  };
  return String(template ?? '').replace(/\[([a-z]+)\]/gi, (full, key: string) => replacements[key.toLowerCase()] ?? full).slice(0, 128);
}

export function applyPresence(client: any, config: AppConfig, activity?: PresenceActivityConfig): void {
  const selected = activity ?? config.defaultPresence;
  const type = selected.activityType;
  const text = renderPresenceText(client, config, selected.activityText ?? '');
  client.user?.setPresence({
    status: config.defaultPresence.status,
    activities: type === 'none' || !text ? [] : [{
      name: text,
      type: activityMap[type] ?? ActivityType.Watching,
      url: type === 'streaming' ? selected.streamUrl : undefined
    }]
  });
}

export function startPresenceRotation(client: any, config: AppConfig): NodeJS.Timeout | null {
  let index = 0;
  let nextAt = 0;
  let lastRotationEnabled: boolean | null = null;

  const update = () => {
    const rotation = Array.isArray(config.defaultPresence.rotationActivities)
      ? config.defaultPresence.rotationActivities.filter(item => item && item.activityType !== 'none' && String(item.activityText ?? '').trim())
      : [];
    const enabled = Boolean(config.defaultPresence.rotationEnabled && rotation.length);

    if (enabled) {
      if (lastRotationEnabled === false) index = 0;
      applyPresence(client, config, rotation[index % rotation.length]);
      index = (index + 1) % rotation.length;
    } else {
      applyPresence(client, config);
      index = 0;
    }
    lastRotationEnabled = enabled;
    nextAt = Date.now() + normalizeRotationInterval(config.defaultPresence.rotationIntervalSeconds) * 1000;
  };

  update();
  const timer = setInterval(() => {
    if (Date.now() >= nextAt) update();
  }, 1000);
  timer.unref();
  return timer;
}

export function parsePresenceRotation(raw: string): PresenceActivityConfig[] {
  const result: PresenceActivityConfig[] = [];
  for (const line of String(raw ?? '').split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean) continue;
    const [typeRaw, ...textParts] = clean.split('|');
    const activityType = String(typeRaw ?? '').trim().toLowerCase() as ActivityTypeName;
    const activityText = textParts.join('|').trim();
    if (!['playing','streaming','listening','watching','competing','custom'].includes(activityType)) continue;
    if (!activityText) continue;
    result.push({ activityType, activityText: activityText.slice(0, 128) });
    if (result.length >= 10) break;
  }
  return result;
}

export function normalizeRotationInterval(value: unknown): number {
  const number = Number(value ?? 5);
  if (!Number.isFinite(number)) return 5;
  return Math.min(300, Math.max(5, Math.floor(number)));
}

function formatShortUptime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
