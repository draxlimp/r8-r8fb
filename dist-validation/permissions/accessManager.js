"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canAccessPanel = canAccessPanel;
const discord_js_1 = require("discord.js");
function canAccessPanel(member, channelId, app, cfg) {
    const userId = member.user.id;
    const roleIds = new Set(member.roles.cache.map((r) => r.id));
    if (app.owners.includes(userId))
        return { allowed: true, reason: 'global_owner' };
    if (cfg.access.blockedUsers.includes(userId))
        return { allowed: false, reason: 'blocked_user' };
    if (cfg.access.blockedRoles.some(id => roleIds.has(id)))
        return { allowed: false, reason: 'blocked_role' };
    if (cfg.access.blockedChannels.includes(channelId))
        return { allowed: false, reason: 'blocked_channel' };
    if (cfg.access.allowedChannels.length && !cfg.access.allowedChannels.includes(channelId))
        return { allowed: false, reason: 'channel_not_allowed' };
    if (cfg.access.ownersOnly)
        return { allowed: false, reason: 'owners_only' };
    if (cfg.access.allowedUsers.includes(userId))
        return { allowed: true, reason: 'allowed_user' };
    if (cfg.access.allowedRoles.some(id => roleIds.has(id)))
        return { allowed: true, reason: 'allowed_role' };
    if (cfg.access.allowGuildOwner && member.guild.ownerId === userId)
        return { allowed: true, reason: 'guild_owner' };
    if (cfg.access.allowAdministrators && member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator))
        return { allowed: true, reason: 'administrator' };
    return { allowed: false, reason: 'access_denied' };
}
//# sourceMappingURL=accessManager.js.map