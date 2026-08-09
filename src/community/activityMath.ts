import type { GuildConfig } from '../types/guildConfig';

export function voiceSeconds(config: GuildConfig, userId: string, now = Date.now()): number {
  const base = config.community.voiceActivity.totalsSeconds[userId] ?? 0;
  const active = config.community.voiceActivity.activeSince[userId];
  return base + (active ? Math.max(0, Math.floor((now - Date.parse(active)) / 1000)) : 0);
}

export function voiceLeaderboard(config: GuildConfig, limit = 10, now = Date.now()): Array<{ userId: string; seconds: number }> {
  const ids = new Set([
    ...Object.keys(config.community.voiceActivity.totalsSeconds),
    ...Object.keys(config.community.voiceActivity.activeSince)
  ]);
  return [...ids]
    .map(userId => ({ userId, seconds: voiceSeconds(config, userId, now) }))
    .filter(item => item.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, Math.max(1, limit));
}

export function formatVoiceTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = safe % 60;
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}
