import { PermissionFlagsBits } from 'discord.js';
const required = [
  ['ViewAuditLog', PermissionFlagsBits.ViewAuditLog], ['ManageChannels', PermissionFlagsBits.ManageChannels],
  ['ManageRoles', PermissionFlagsBits.ManageRoles], ['BanMembers', PermissionFlagsBits.BanMembers],
  ['KickMembers', PermissionFlagsBits.KickMembers], ['ModerateMembers', PermissionFlagsBits.ModerateMembers],
  ['ManageWebhooks', PermissionFlagsBits.ManageWebhooks], ['ManageGuild', PermissionFlagsBits.ManageGuild],
  ['SendMessages', PermissionFlagsBits.SendMessages]
] as const;
export function diagnosePermissions(guild: any): Array<{ name: string; ok: boolean }> {
  const me = guild.members.me;
  return required.map(([name, bit]) => ({ name, ok: Boolean(me?.permissions.has(bit)) }));
}
