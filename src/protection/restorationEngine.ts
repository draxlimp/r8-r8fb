import { ChannelType, PermissionsBitField } from 'discord.js';
import type { ChannelSnapshot } from '../snapshots/channelSnapshot';
import type { GuildSnapshot } from '../snapshots/guildSnapshot';
import type { RoleSnapshot } from '../snapshots/roleSnapshot';

export interface StructureRestoreSummary {
  rolesCreated: number;
  channelsCreated: number;
  skipped: number;
  failures: string[];
  roleIdMap: Record<string,string>;
  channelIdMap: Record<string,string>;
}

export async function restoreChannel(
  guild: any,
  snapshot: ChannelSnapshot,
  options: { parentId?:string|null; roleIdMap?:Record<string,string> } = {}
): Promise<any> {
  const allowed = [
    ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory,
    ChannelType.GuildAnnouncement, ChannelType.GuildStageVoice, ChannelType.GuildForum
  ];
  if (!allowed.includes(snapshot.type as any)) throw new Error(`Tipo de canal não restaurável: ${snapshot.type}`);
  const parentCandidate = options.parentId === undefined ? snapshot.parentId : options.parentId;
  const parent = parentCandidate && guild.channels.cache.has(parentCandidate) ? parentCandidate : null;
  const roleIdMap = options.roleIdMap ?? {};
  const permissionOverwrites = snapshot.permissionOverwrites
    .map(overwrite => ({
      id: roleIdMap[overwrite.id] ?? overwrite.id,
      type: overwrite.type,
      allow: BigInt(overwrite.allow),
      deny: BigInt(overwrite.deny)
    }))
    .filter(overwrite => overwrite.id === guild.id || guild.roles.cache.has(overwrite.id) || guild.members.cache.has(overwrite.id));

  const channel = await guild.channels.create({
    name:snapshot.name,
    type:snapshot.type,
    parent,
    topic:snapshot.topic ?? undefined,
    nsfw:snapshot.nsfw,
    rateLimitPerUser:snapshot.rateLimitPerUser,
    bitrate:snapshot.bitrate,
    userLimit:snapshot.userLimit,
    permissionOverwrites,
    reason:'Restauração automática da proteção do servidor'
  });
  await channel.setPosition(snapshot.position).catch(() => undefined);
  return channel;
}

export async function restoreRole(guild: any, snapshot: RoleSnapshot): Promise<any> {
  const role = await guild.roles.create({
    name:snapshot.name,
    color:snapshot.color,
    permissions:new PermissionsBitField(BigInt(snapshot.permissions)),
    hoist:snapshot.hoist,
    mentionable:snapshot.mentionable,
    icon:snapshot.icon ?? undefined,
    unicodeEmoji:snapshot.unicodeEmoji ?? undefined,
    reason:'Restauração automática da proteção do servidor'
  });
  const max = Math.max(1, (guild.members.me?.roles.highest.position ?? 1) - 1);
  await role.setPosition(Math.min(snapshot.position, max)).catch(() => undefined);
  return role;
}

export async function restoreGuildStructure(guild: any, snapshot: GuildSnapshot): Promise<StructureRestoreSummary> {
  const summary: StructureRestoreSummary = { rolesCreated:0, channelsCreated:0, skipped:0, failures:[], roleIdMap:{}, channelIdMap:{} };

  const roles = Object.values(snapshot.roles).sort((a, b) => a.position - b.position);
  for (const roleSnapshot of roles) {
    if (guild.roles.cache.has(roleSnapshot.id)) { summary.skipped++; continue; }
    try {
      const role = await restoreRole(guild, roleSnapshot);
      summary.roleIdMap[roleSnapshot.id] = role.id;
      summary.rolesCreated++;
    } catch (error) {
      summary.failures.push(`cargo:${roleSnapshot.id}:${message(error)}`);
    }
  }

  const channels = Object.values(snapshot.channels);
  const categories = channels.filter(channel => channel.type === ChannelType.GuildCategory).sort((a,b) => a.position - b.position);
  const others = channels.filter(channel => channel.type !== ChannelType.GuildCategory).sort((a,b) => a.position - b.position);
  for (const channelSnapshot of [...categories, ...others]) {
    if (guild.channels.cache.has(channelSnapshot.id)) { summary.skipped++; continue; }
    try {
      const mappedParent = channelSnapshot.parentId ? summary.channelIdMap[channelSnapshot.parentId] ?? channelSnapshot.parentId : null;
      const channel = await restoreChannel(guild, channelSnapshot, { parentId:mappedParent, roleIdMap:summary.roleIdMap });
      summary.channelIdMap[channelSnapshot.id] = channel.id;
      summary.channelsCreated++;
    } catch (error) {
      summary.failures.push(`canal:${channelSnapshot.id}:${message(error)}`);
    }
  }
  return summary;
}

function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
