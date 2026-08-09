import type { BypassEntry, GuildConfig } from '../types/guildConfig';
import { isExpired } from '../utils/dates';
export interface BypassContext { botUserId: string; executorId: string | null; executorRoleIds: string[]; module: string; channelId?: string | null; categoryId?: string | null; executorIsBot?: boolean }
export interface BypassDecision { bypassed: boolean; entry: BypassEntry | null; behavior: BypassEntry['behavior'] | null; reason: string }
function applies(entry: BypassEntry, module: string): boolean { return entry.modules.length === 0 || entry.modules.includes('*') || entry.modules.includes(module); }
export function resolveBypass(cfg: GuildConfig, ctx: BypassContext, globalOwners: string[] = []): BypassDecision {
  if (!ctx.executorId) return { bypassed: false, entry: null, behavior: null, reason: 'executor_unknown' };
  if (ctx.executorId === ctx.botUserId) return { bypassed: true, entry: null, behavior: { ignoreDetection: true, ignorePunishment: true, ignoreRestoration: true, ignoreLimit: true, continueLogging: false }, reason: 'self_action' };
  if (globalOwners.includes(ctx.executorId)) return { bypassed: true, entry: null, behavior: { ignoreDetection: false, ignorePunishment: true, ignoreRestoration: true, ignoreLimit: true, continueLogging: true }, reason: 'global_owner' };
  const active = cfg.bypasses.filter(e => !isExpired(e.expiresAt) && applies(e, ctx.module));
  const order = [
    (e: BypassEntry) => e.kind === 'user' && e.targetId === ctx.executorId && e.modules.includes('*'),
    (e: BypassEntry) => e.kind === 'role' && ctx.executorRoleIds.includes(e.targetId) && e.modules.includes('*'),
    (e: BypassEntry) => e.kind === 'user' && e.targetId === ctx.executorId,
    (e: BypassEntry) => e.kind === 'role' && ctx.executorRoleIds.includes(e.targetId),
    (e: BypassEntry) => e.expiresAt !== null && ((e.kind === 'user' && e.targetId === ctx.executorId) || (e.kind === 'role' && ctx.executorRoleIds.includes(e.targetId))),
    (e: BypassEntry) => e.kind === 'bot' && ctx.executorIsBot === true && e.targetId === ctx.executorId,
    (e: BypassEntry) => e.kind === 'channel' && e.targetId === ctx.channelId,
    (e: BypassEntry) => e.kind === 'category' && e.targetId === ctx.categoryId
  ];
  for (const predicate of order) { const entry = active.find(predicate); if (entry) return { bypassed: true, entry, behavior: entry.behavior, reason: `bypass_${entry.kind}` }; }
  return { bypassed: false, entry: null, behavior: null, reason: 'none' };
}
export function pruneExpiredBypasses(cfg: GuildConfig, now = Date.now()): BypassEntry[] {
  const expired = cfg.bypasses.filter(e => e.expiresAt && Date.parse(e.expiresAt) <= now);
  cfg.bypasses = cfg.bypasses.filter(e => !e.expiresAt || Date.parse(e.expiresAt) > now);
  return expired;
}
