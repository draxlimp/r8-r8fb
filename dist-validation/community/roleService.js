"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyAutoroles = applyAutoroles;
exports.canUseMassRoles = canUseMassRoles;
exports.executeMassRoleOperation = executeMassRoleOperation;
const discord_js_1 = require("discord.js");
const guildConfigStore_1 = require("../storage/guildConfigStore");
const hierarchyChecker_1 = require("../permissions/hierarchyChecker");
const communityLogger_1 = require("./communityLogger");
async function applyAutoroles(member) {
    const config = await guildConfigStore_1.guildConfigStore.get(member.guild.id);
    const roleIds = new Set([
        ...config.community.autorole.everyoneRoleIds,
        ...(member.user.bot ? config.community.autorole.botRoleIds : config.community.autorole.memberRoleIds)
    ]);
    if (!roleIds.size)
        return;
    const added = [];
    const failed = [];
    for (const roleId of roleIds) {
        const role = member.guild.roles.cache.get(roleId);
        if (!role || !(0, hierarchyChecker_1.canManageRole)(member.guild, role).ok) {
            failed.push(roleId);
            continue;
        }
        const ok = await member.roles.add(role, 'Autorole configurado no painel da comunidade').then(() => true).catch(() => false);
        ok ? added.push(roleId) : failed.push(roleId);
    }
    await (0, communityLogger_1.logCommunityEvent)({
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
    await guildConfigStore_1.guildConfigStore.set(member.guild.id, config);
}
function canUseMassRoles(member, config) {
    if (member.guild.ownerId === member.id)
        return true;
    if (config.community.massRoles.allowAdministrators && member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator))
        return true;
    return member.roles.cache.some((role) => config.community.massRoles.allowedRoleIds.includes(role.id));
}
async function executeMassRoleOperation(input) {
    const { guild, actor, config, operation, roleId, onProgress } = input;
    if (!canUseMassRoles(actor, config))
        throw new Error('Você não possui acesso às ações em massa de cargos.');
    const members = await guild.members.fetch();
    const manageableRole = roleId ? guild.roles.cache.get(roleId) : null;
    if (operation !== 'clear' && (!manageableRole || !(0, hierarchyChecker_1.canManageRole)(guild, manageableRole).ok)) {
        throw new Error('O cargo selecionado não existe ou está acima do cargo do bot.');
    }
    let processed = 0;
    let changed = 0;
    let affectedMembers = 0;
    let unchangedMembers = 0;
    let failed = 0;
    const failures = [];
    const memberList = [...members.values()].filter((member) => member.id !== guild.client.user.id);
    for (const member of memberList) {
        let memberChanged = false;
        try {
            if (operation === 'add' && manageableRole && !member.roles.cache.has(manageableRole.id)) {
                await member.roles.add(manageableRole, `Ação em massa solicitada por ${actor.user.tag}`);
                changed++;
                memberChanged = true;
            }
            else if (operation === 'remove' && manageableRole && member.roles.cache.has(manageableRole.id)) {
                await member.roles.remove(manageableRole, `Ação em massa solicitada por ${actor.user.tag}`);
                changed++;
                memberChanged = true;
            }
            else if (operation === 'clear') {
                const removable = member.roles.cache.filter((role) => role.id !== guild.id && !role.managed && (0, hierarchyChecker_1.canManageRole)(guild, role).ok);
                if (removable.size) {
                    await member.roles.remove([...removable.values()], `Remoção em massa solicitada por ${actor.user.tag}`);
                    changed += removable.size;
                    memberChanged = true;
                }
            }
            if (memberChanged)
                affectedMembers++;
            else
                unchangedMembers++;
        }
        catch (error) {
            failed++;
            if (failures.length < 15)
                failures.push({
                    memberId: member.id,
                    memberName: String(member.displayName ?? member.user?.username ?? member.id).slice(0, 80),
                    reason: (error instanceof Error ? error.message : String(error)).slice(0, 180)
                });
        }
        processed++;
        if (onProgress && (processed % 25 === 0 || processed === memberList.length)) {
            await onProgress(processed, memberList.length, changed, failed);
        }
        if (config.community.massRoles.batchDelayMs > 0)
            await delay(config.community.massRoles.batchDelayMs);
    }
    const event = operation === 'add' ? 'mass_role_add' : operation === 'remove' ? 'mass_role_remove' : 'mass_role_clear';
    await (0, communityLogger_1.logCommunityEvent)({
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
    await guildConfigStore_1.guildConfigStore.set(guild.id, config);
    return { total: memberList.length, processed, changed, affectedMembers, unchangedMembers, failed, failures };
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=roleService.js.map