"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canManageMember = canManageMember;
exports.canManageRole = canManageRole;
function canManageMember(guild, member) {
    const me = guild.members.me;
    if (!me)
        return { ok: false, reason: 'bot_member_unavailable' };
    if (member.id === guild.ownerId)
        return { ok: false, reason: 'target_is_guild_owner' };
    if (member.id === me.id)
        return { ok: false, reason: 'target_is_bot' };
    if (me.roles.highest.comparePositionTo(member.roles.highest) <= 0)
        return { ok: false, reason: 'role_hierarchy' };
    return { ok: true, reason: 'ok' };
}
function canManageRole(guild, role) {
    const me = guild.members.me;
    if (!me)
        return { ok: false, reason: 'bot_member_unavailable' };
    if (role.id === guild.id || role.managed)
        return { ok: false, reason: 'unmanageable_role' };
    if (me.roles.highest.comparePositionTo(role) <= 0)
        return { ok: false, reason: 'role_hierarchy' };
    return { ok: true, reason: 'ok' };
}
//# sourceMappingURL=hierarchyChecker.js.map