import { PermissionFlagsBits } from 'discord.js';
import type { GuildConfig, ProtectionConfig, PunishmentType } from '../types/guildConfig';
import type { Incident } from '../types/incident';
import { canManageMember, canManageRole } from '../permissions/hierarchyChecker';
import { retry } from '../utils/retry';

const dangerous = [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageWebhooks, PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers];
export async function executePunishment(guild: any, member: any | null, protection: ProtectionConfig, cfg: GuildConfig, incident: Incident): Promise<string> {
  if (!member) return 'target_member_unavailable';
  const hierarchy = canManageMember(guild, member); if (!hierarchy.ok) return `blocked:${hierarchy.reason}`;
  const action = protection.punishment.type;
  const run = async (type: PunishmentType): Promise<void> => {
    switch (type) {
      case 'none': case 'log': return;
      case 'warn': await member.send(protection.punishment.dmMessage).catch(() => undefined); return;
      case 'dm': await member.send(protection.punishment.dmMessage); return;
      case 'timeout': await member.timeout(protection.punishment.timeoutSeconds * 1000, `${protection.punishment.reason} | ${incident.id}`); return;
      case 'quarantine': await applyQuarantine(guild, member, cfg, incident); return;
      case 'remove_dangerous_roles': await removeDangerousRoles(guild, member, cfg); return;
      case 'remove_roles': await removeAllRoles(guild, member, cfg); return;
      case 'kick': await member.kick(`${protection.punishment.reason} | ${incident.id}`); return;
      case 'ban': await member.ban({ reason: `${protection.punishment.reason} | ${incident.id}`, deleteMessageSeconds: protection.punishment.deleteMessageSeconds }); return;
      case 'sequence': for (const step of protection.punishment.sequence) { try { await run(step); } catch (error) { if (!protection.punishment.continueOnFailure) throw error; } } return;
    }
  };
  try { await retry(() => run(action), protection.punishment.retries + 1, protection.punishment.retryDelayMs); return 'success'; }
  catch (error) { return `failure:${error instanceof Error ? error.message : String(error)}`; }
}
async function removeDangerousRoles(guild: any, member: any, cfg: GuildConfig): Promise<void> {
  const removable = member.roles.cache.filter((role: any) => !cfg.quarantine.protectedRoles.includes(role.id) && dangerous.some(bit => role.permissions.has(bit)) && canManageRole(guild,role).ok);
  if (removable.size) await member.roles.remove([...removable.keys()], 'Proteção automática: remoção de cargos perigosos');
}
async function removeAllRoles(guild: any, member: any, cfg: GuildConfig): Promise<void> {
  const removable = member.roles.cache.filter((role: any) => !cfg.quarantine.protectedRoles.includes(role.id) && canManageRole(guild,role).ok);
  if (removable.size) await member.roles.remove([...removable.keys()], 'Proteção automática: remoção de cargos');
}
async function applyQuarantine(guild: any, member: any, cfg: GuildConfig, incident: Incident): Promise<void> {
  let role = cfg.quarantine.roleId ? guild.roles.cache.get(cfg.quarantine.roleId) : null;
  if (!role && cfg.quarantine.createAutomatically) {
    role = await guild.roles.create({ name: 'Quarentena', permissions: [], reason: 'Cargo de quarentena criado pela proteção automática' }); cfg.quarantine.roleId = role.id;
    for (const channel of guild.channels.cache.values()) await channel.permissionOverwrites?.edit(role, { SendMessages:false, AddReactions:false, Speak:false, Connect:false }).catch(() => undefined);
  }
  if (!role) throw new Error('Cargo de quarentena não configurado');
  const previousRoles = member.roles.cache.filter((r: any) => r.id !== guild.id && canManageRole(guild,r).ok && !cfg.quarantine.protectedRoles.includes(r.id)).map((r:any)=>r.id);
  if (previousRoles.length) await member.roles.remove(previousRoles, `Quarentena automática | ${incident.id}`);
  await member.roles.add(role, `Quarentena automática | ${incident.id}`);
  cfg.quarantine.active[member.id] = { previousRoles, expiresAt: null, incidentId: incident.id };
}
