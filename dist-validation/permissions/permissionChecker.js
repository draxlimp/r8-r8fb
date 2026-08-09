"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diagnosePermissions = diagnosePermissions;
const discord_js_1 = require("discord.js");
const required = [
    ['ViewAuditLog', discord_js_1.PermissionFlagsBits.ViewAuditLog], ['ManageChannels', discord_js_1.PermissionFlagsBits.ManageChannels],
    ['ManageRoles', discord_js_1.PermissionFlagsBits.ManageRoles], ['BanMembers', discord_js_1.PermissionFlagsBits.BanMembers],
    ['KickMembers', discord_js_1.PermissionFlagsBits.KickMembers], ['ModerateMembers', discord_js_1.PermissionFlagsBits.ModerateMembers],
    ['ManageWebhooks', discord_js_1.PermissionFlagsBits.ManageWebhooks], ['ManageGuild', discord_js_1.PermissionFlagsBits.ManageGuild],
    ['SendMessages', discord_js_1.PermissionFlagsBits.SendMessages]
];
function diagnosePermissions(guild) {
    const me = guild.members.me;
    return required.map(([name, bit]) => ({ name, ok: Boolean(me?.permissions.has(bit)) }));
}
//# sourceMappingURL=permissionChecker.js.map