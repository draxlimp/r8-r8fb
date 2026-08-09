import { PermissionFlagsBits } from 'discord.js';
import type { AppConfig } from '../types/config';
import type { GuildConfig } from '../types/guildConfig';
export interface AccessResult { allowed: boolean; reason: string }
export function canAccessPanel(member: any, channelId: string, app: AppConfig, cfg: GuildConfig): AccessResult {
  const userId = member.user.id as string;
  const roleIds = new Set<string>(member.roles.cache.map((r: any) => r.id));
  if (app.owners.includes(userId)) return { allowed: true, reason: 'global_owner' };
  if (cfg.access.blockedUsers.includes(userId)) return { allowed: false, reason: 'blocked_user' };
  if (cfg.access.blockedRoles.some(id => roleIds.has(id))) return { allowed: false, reason: 'blocked_role' };
  if (cfg.access.blockedChannels.includes(channelId)) return { allowed: false, reason: 'blocked_channel' };
  if (cfg.access.allowedChannels.length && !cfg.access.allowedChannels.includes(channelId)) return { allowed: false, reason: 'channel_not_allowed' };
  if (cfg.access.ownersOnly) return { allowed: false, reason: 'owners_only' };
  if (cfg.access.allowedUsers.includes(userId)) return { allowed: true, reason: 'allowed_user' };
  if (cfg.access.allowedRoles.some(id => roleIds.has(id))) return { allowed: true, reason: 'allowed_role' };
  if (cfg.access.allowGuildOwner && member.guild.ownerId === userId) return { allowed: true, reason: 'guild_owner' };
  if (cfg.access.allowAdministrators && member.permissions.has(PermissionFlagsBits.Administrator)) return { allowed: true, reason: 'administrator' };
  return { allowed: false, reason: 'access_denied' };
}
