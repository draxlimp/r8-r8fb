import type { GuildConfig } from '../types/guildConfig';

export const REPUTATION_COOLDOWN_MS = 12 * 60 * 60 * 1000;

export interface ReputationResult {
  ok: boolean;
  score: number;
  remainingMs: number;
}

export function getReputation(config: GuildConfig, userId: string): number {
  const value = Number(config.community.reputation.scores[userId] ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function giveReputation(config: GuildConfig, giverId: string, targetId: string, now = new Date()): ReputationResult {
  if (giverId === targetId) throw new Error('Você não pode dar reputação para si mesmo');

  const last = config.community.reputation.lastGivenAt[giverId];
  const lastTime = last ? Date.parse(last) : 0;
  const remainingMs = Math.max(0, REPUTATION_COOLDOWN_MS - (now.getTime() - lastTime));
  if (remainingMs > 0) return { ok: false, score: getReputation(config, targetId), remainingMs };

  const score = getReputation(config, targetId) + 1;
  config.community.reputation.scores[targetId] = score;
  config.community.reputation.lastGivenAt[giverId] = now.toISOString();
  return { ok: true, score, remainingMs: 0 };
}

export function topReputation(config: GuildConfig, limit = 10): Array<{ userId: string; score: number }> {
  return Object.entries(config.community.reputation.scores)
    .map(([userId, score]) => ({ userId, score: Math.max(0, Math.floor(Number(score) || 0)) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId))
    .slice(0, Math.max(1, Math.min(25, limit)));
}
