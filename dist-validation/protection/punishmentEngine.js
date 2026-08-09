"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executePunishment = executePunishment;
const discord_js_1 = require("discord.js");
const hierarchyChecker_1 = require("../permissions/hierarchyChecker");
const retry_1 = require("../utils/retry");
const dangerous = [discord_js_1.PermissionFlagsBits.Administrator, discord_js_1.PermissionFlagsBits.ManageGuild, discord_js_1.PermissionFlagsBits.ManageChannels, discord_js_1.PermissionFlagsBits.ManageRoles, discord_js_1.PermissionFlagsBits.ManageWebhooks, discord_js_1.PermissionFlagsBits.BanMembers, discord_js_1.PermissionFlagsBits.KickMembers, discord_js_1.PermissionFlagsBits.ModerateMembers];
async function executePunishment(guild, member, protection, cfg, incident) {
    if (!member)
        return 'target_member_unavailable';
    const hierarchy = (0, hierarchyChecker_1.canManageMember)(guild, member);
    if (!hierarchy.ok)
        return `blocked:${hierarchy.reason}`;
    const action = protection.punishment.type;
    const run = async (type) => {
        switch (type) {
            case 'none':
            case 'log': return;
            case 'warn':
                await member.send(protection.punishment.dmMessage).catch(() => undefined);
                return;
            case 'dm':
                await member.send(protection.punishment.dmMessage);
                return;
            case 'timeout':
                await member.timeout(protection.punishment.timeoutSeconds * 1000, `${protection.punishment.reason} | ${incident.id}`);
                return;
            case 'quarantine':
                await applyQuarantine(guild, member, cfg, incident);
                return;
            case 'remove_dangerous_roles':
                await removeDangerousRoles(guild, member, cfg);
                return;
            case 'remove_roles':
                await removeAllRoles(guild, member, cfg);
                return;
            case 'kick':
                await member.kick(`${protection.punishment.reason} | ${incident.id}`);
                return;
            case 'ban':
                await member.ban({ reason: `${protection.punishment.reason} | ${incident.id}`, deleteMessageSeconds: protection.punishment.deleteMessageSeconds });
                return;
            case 'sequence':
                for (const step of protection.punishment.sequence) {
                    try {
                        await run(step);
                    }
                    catch (error) {
                        if (!protection.punishment.continueOnFailure)
                            throw error;
                    }
                }
                return;
        }
    };
    try {
        await (0, retry_1.retry)(() => run(action), protection.punishment.retries + 1, protection.punishment.retryDelayMs);
        return 'success';
    }
    catch (error) {
        return `failure:${error instanceof Error ? error.message : String(error)}`;
    }
}
async function removeDangerousRoles(guild, member, cfg) {
    const removable = member.roles.cache.filter((role) => !cfg.quarantine.protectedRoles.includes(role.id) && dangerous.some(bit => role.permissions.has(bit)) && (0, hierarchyChecker_1.canManageRole)(guild, role).ok);
    if (removable.size)
        await member.roles.remove([...removable.keys()], 'Proteção automática: remoção de cargos perigosos');
}
async function removeAllRoles(guild, member, cfg) {
    const removable = member.roles.cache.filter((role) => !cfg.quarantine.protectedRoles.includes(role.id) && (0, hierarchyChecker_1.canManageRole)(guild, role).ok);
    if (removable.size)
        await member.roles.remove([...removable.keys()], 'Proteção automática: remoção de cargos');
}
async function applyQuarantine(guild, member, cfg, incident) {
    let role = cfg.quarantine.roleId ? guild.roles.cache.get(cfg.quarantine.roleId) : null;
    if (!role && cfg.quarantine.createAutomatically) {
        role = await guild.roles.create({ name: 'Quarentena', permissions: [], reason: 'Cargo de quarentena criado pela proteção automática' });
        cfg.quarantine.roleId = role.id;
        for (const channel of guild.channels.cache.values())
            await channel.permissionOverwrites?.edit(role, { SendMessages: false, AddReactions: false, Speak: false, Connect: false }).catch(() => undefined);
    }
    if (!role)
        throw new Error('Cargo de quarentena não configurado');
    const previousRoles = member.roles.cache.filter((r) => r.id !== guild.id && (0, hierarchyChecker_1.canManageRole)(guild, r).ok && !cfg.quarantine.protectedRoles.includes(r.id)).map((r) => r.id);
    if (previousRoles.length)
        await member.roles.remove(previousRoles, `Quarentena automática | ${incident.id}`);
    await member.roles.add(role, `Quarentena automática | ${incident.id}`);
    cfg.quarantine.active[member.id] = { previousRoles, expiresAt: null, incidentId: incident.id };
}
//# sourceMappingURL=punishmentEngine.js.map