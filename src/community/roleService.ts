import { PermissionFlagsBits } from 'discord.js';
import type { GuildConfig } from '../types/guildConfig';
import { guildConfigStore } from '../storage/guildConfigStore';
import { canManageRole } from '../permissions/hierarchyChecker';
import { logCommunityEvent } from './communityLogger';

export type MassRoleOperation = 'add' | 'remove' | 'clear';

export interface MassRoleFailure {
  memberId: string;
  memberName: string;
  reason: string;
}

export interface MassRoleResult {
  total: number;
  processed: number;
  changed: number;
  affectedMembers: number;
  unchangedMembers: number;
  failed: number;
  failures: MassRoleFailure[];
}

export async function applyAutoroles(member: any): Promise<void> {
  const config = await guildConfigStore.get(member.guild.id);
  const roleIds = new Set<string>([
    ...config.community.autorole.everyoneRoleIds,
    ...(member.user.bot ? config.community.autorole.botRoleIds : config.community.autorole.memberRoleIds)
  ]);

  if (!roleIds.size) return;
  const added: string[] = [];
  const failed: string[] = [];
  for (const roleId of roleIds) {
    const role = member.guild.roles.cache.get(roleId);
    if (!role || !canManageRole(member.guild, role).ok) {
      failed.push(roleId);
      continue;
    }
    const ok = await member.roles.add(role, 'Autorole configurado no painel da comunidade').then(() => true).catch(() => false);
    ok ? added.push(roleId) : failed.push(roleId);
  }

  await logCommunityEvent({
    guild: member.guild,
    config,
    event: failed.length ? 'autorole_failed' : 'autorole_applied',
    module: 'community_autorole',
    executorId: member.guild.client.user.id,
    targetId: member.id,
    severity: failed.length ? 'medium' : 'info',
    actionResult: failed.length ? 'partial' : 'success',
    details: { added, failed, bot: member.user.bot }
  });
  await guildConfigStore.set(member.guild.id, config);
}

export function canUseMassRoles(member: any, config: GuildConfig): boolean {
  if (member.guild.ownerId === member.id) return true;
  if (config.community.massRoles.allowAdministrators && member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.some((role: any) => config.community.massRoles.allowedRoleIds.includes(role.id));
}

export async function executeMassRoleOperation(input: {
  guild: any;
  actor: any;
  config: GuildConfig;
  operation: MassRoleOperation;
  roleId?: string;
  onProgress?: (processed: number, total: number, changed: number, failed: number) => Promise<void>;
}): Promise<MassRoleResult> {
  const { guild, actor, config, operation, roleId, onProgress } = input;
  if (!canUseMassRoles(actor, config)) throw new Error('Você não possui acesso às ações em massa de cargos.');

  const members = await guild.members.fetch();
  const manageableRole = roleId ? guild.roles.cache.get(roleId) : null;
  if (operation !== 'clear' && (!manageableRole || !canManageRole(guild, manageableRole).ok)) {
    throw new Error('O cargo selecionado não existe ou está acima do cargo do bot.');
  }

  let processed = 0;
  let changed = 0;
  let affectedMembers = 0;
  let unchangedMembers = 0;
  let failed = 0;
  const failures: MassRoleFailure[] = [];
  const memberList = [...members.values()].filter((member: any) => member.id !== guild.client.user.id);

  for (const member of memberList) {
    let memberChanged = false;
    try {
      if (operation === 'add' && manageableRole && !member.roles.cache.has(manageableRole.id)) {
        await member.roles.add(manageableRole, `Ação em massa solicitada por ${actor.user.tag}`);
        changed++;
        memberChanged = true;
      } else if (operation === 'remove' && manageableRole && member.roles.cache.has(manageableRole.id)) {
        await member.roles.remove(manageableRole, `Ação em massa solicitada por ${actor.user.tag}`);
        changed++;
        memberChanged = true;
      } else if (operation === 'clear') {
        const removable = member.roles.cache.filter((role: any) => role.id !== guild.id && !role.managed && canManageRole(guild, role).ok);
        if (removable.size) {
          await member.roles.remove([...removable.values()], `Remoção em massa solicitada por ${actor.user.tag}`);
          changed += removable.size;
          memberChanged = true;
        }
      }
      if (memberChanged) affectedMembers++;
      else unchangedMembers++;
    } catch (error) {
      failed++;
      if (failures.length < 15) failures.push({
        memberId: member.id,
        memberName: String(member.displayName ?? member.user?.username ?? member.id).slice(0, 80),
        reason: (error instanceof Error ? error.message : String(error)).slice(0, 180)
      });
    }
    processed++;
    if (onProgress && (processed % 25 === 0 || processed === memberList.length)) {
      await onProgress(processed, memberList.length, changed, failed);
    }
    if (config.community.massRoles.batchDelayMs > 0) await delay(config.community.massRoles.batchDelayMs);
  }

  const event = operation === 'add' ? 'mass_role_add' : operation === 'remove' ? 'mass_role_remove' : 'mass_role_clear';
  await logCommunityEvent({
    guild,
    config,
    event,
    module: 'community_mass_roles',
    executorId: actor.id,
    targetId: roleId ?? null,
    severity: operation === 'clear' ? 'critical' : 'high',
    actionResult: failed ? 'partial' : 'success',
    details: { operation, roleId: roleId ?? null, total: memberList.length, processed, changed, affectedMembers, unchangedMembers, failed, failures }
  });
  await guildConfigStore.set(guild.id, config);
  return { total: memberList.length, processed, changed, affectedMembers, unchangedMembers, failed, failures };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
