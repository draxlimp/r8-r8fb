export function canManageMember(guild: any, member: any): { ok: boolean; reason: string } {
  const me = guild.members.me;
  if (!me) return { ok: false, reason: 'bot_member_unavailable' };
  if (member.id === guild.ownerId) return { ok: false, reason: 'target_is_guild_owner' };
  if (member.id === me.id) return { ok: false, reason: 'target_is_bot' };
  if (me.roles.highest.comparePositionTo(member.roles.highest) <= 0) return { ok: false, reason: 'role_hierarchy' };
  return { ok: true, reason: 'ok' };
}
export function canManageRole(guild: any, role: any): { ok: boolean; reason: string } {
  const me = guild.members.me;
  if (!me) return { ok: false, reason: 'bot_member_unavailable' };
  if (role.id === guild.id || role.managed) return { ok: false, reason: 'unmanageable_role' };
  if (me.roles.highest.comparePositionTo(role) <= 0) return { ok: false, reason: 'role_hierarchy' };
  return { ok: true, reason: 'ok' };
}
