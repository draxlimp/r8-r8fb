"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.destructiveAuditTypes = exports.ProtectionEngine = void 0;
const discord_js_1 = require("discord.js");
const guildConfigStore_1 = require("../storage/guildConfigStore");
const bypassEngine_1 = require("./bypassEngine");
const incidentManager_1 = require("./incidentManager");
const punishmentEngine_1 = require("./punishmentEngine");
const logManager_1 = require("../logs/logManager");
const auditLogResolver_1 = require("./auditLogResolver");
const snapshotManager_1 = require("../snapshots/snapshotManager");
const restorationEngine_1 = require("./restorationEngine");
const thresholdEngine_1 = require("./thresholdEngine");
const logger_1 = require("../utils/logger");
const THRESHOLD_MESSAGE_MODULES = new Set(['anti_spam', 'anti_flood', 'anti_repeated_message']);
const DANGEROUS_PERMISSIONS = [
    [discord_js_1.PermissionFlagsBits.Administrator, 'anti_administrator_role'],
    [discord_js_1.PermissionFlagsBits.ManageGuild, 'anti_manage_guild_role'],
    [discord_js_1.PermissionFlagsBits.ManageChannels, 'anti_manage_channels_role'],
    [discord_js_1.PermissionFlagsBits.ManageRoles, 'anti_manage_roles_role'],
    [discord_js_1.PermissionFlagsBits.ManageWebhooks, 'anti_manage_webhooks_role'],
    [discord_js_1.PermissionFlagsBits.BanMembers, 'anti_ban_permission_role'],
    [discord_js_1.PermissionFlagsBits.KickMembers, 'anti_kick_permission_role'],
    [discord_js_1.PermissionFlagsBits.ModerateMembers, 'anti_moderate_permission_role']
];
class ProtectionEngine {
    appConfig;
    constructor(appConfig) {
        this.appConfig = appConfig;
    }
    async handleMessage(message) {
        if (!message.guild || message.author.bot || !message.member)
            return;
        const cfg = await guildConfigStore_1.guildConfigStore.get(message.guild.id);
        const modules = this.detectMessageModules(message, cfg.protections);
        for (const module of modules) {
            const protection = cfg.protections[module];
            if (protection)
                await this.processMessageModule(message, module, protection);
        }
    }
    detectMessageModules(message, protections) {
        const content = String(message.content ?? '');
        const lower = content.toLowerCase();
        const found = [];
        const urls = content.match(/https?:\/\/[^\s<]+/gi) ?? [];
        const invites = content.match(/(?:discord\.gg|discord(?:app)?\.com\/invite)\/[a-z0-9-]+/gi) ?? [];
        const antiLink = protections.anti_link;
        if (this.active(antiLink) && urls.some(url => !this.isAllowedUrl(url, antiLink?.allowedDomains ?? [])))
            found.push('anti_link');
        if (invites.length && this.active(protections.anti_invite))
            found.push('anti_invite');
        if (this.active(protections.anti_spam) && (content.length > 0 || message.attachments?.size > 0 || message.stickers?.size > 0))
            found.push('anti_spam');
        if (this.active(protections.anti_flood) && (content.length > 0 || message.attachments?.size > 0))
            found.push('anti_flood');
        if (this.active(protections.anti_repeated_message) && content.trim().length > 0)
            found.push('anti_repeated_message');
        if (this.active(protections.anti_caps) && content.replace(/[^A-Za-z]/g, '').length >= 10 && (content.match(/[A-Z]/g)?.length ?? 0) / Math.max(1, content.match(/[A-Za-z]/g)?.length ?? 0) >= 0.75)
            found.push('anti_caps');
        if (this.active(protections.anti_mass_mention) && (message.mentions.users.size + message.mentions.roles.size) >= (protections.anti_mass_mention?.quantity ?? 5))
            found.push('anti_mass_mention');
        if (this.active(protections.anti_blocked_words) && (protections.anti_blocked_words?.blockedWords ?? []).some(word => word && lower.includes(word.toLowerCase())))
            found.push('anti_blocked_words');
        if (this.active(protections.anti_blocked_domain) && urls.some(url => (protections.anti_blocked_domain?.blockedDomains ?? []).some(domain => this.urlMatchesDomain(url, domain))))
            found.push('anti_blocked_domain');
        if (this.active(protections.anti_forbidden_file) && message.attachments.some((attachment) => (protections.anti_forbidden_file?.blockedExtensions ?? []).includes(String(attachment.name ?? '').split('.').pop()?.toLowerCase() ?? '')))
            found.push('anti_forbidden_file');
        if (this.active(protections.anti_invisible_character) && /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/.test(content))
            found.push('anti_invisible_character');
        if (this.active(protections.anti_phishing) && /(free\s*nitro|steamcommunity[^\s]*gift|discord[^\s]*nitro|claim\s*(?:your)?\s*gift)/i.test(content))
            found.push('anti_phishing');
        if (this.active(protections.anti_advertising) && (invites.length > 0 || /(?:siga|entre|acesse|compre|promoção).{0,40}https?:\/\//i.test(content)))
            found.push('anti_advertising');
        return [...new Set(found)];
    }
    active(protection) {
        return Boolean(protection && protection.mode !== 'disabled');
    }
    isAllowedUrl(raw, domains) {
        if (!domains.length)
            return false;
        return domains.some(domain => this.urlMatchesDomain(raw, domain));
    }
    urlMatchesDomain(raw, domain) {
        try {
            const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
            const normalized = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] ?? '';
            return host === normalized || host.endsWith(`.${normalized}`);
        }
        catch {
            return false;
        }
    }
    async processMessageModule(message, module, protection) {
        const cfg = await guildConfigStore_1.guildConfigStore.get(message.guild.id);
        const expired = (0, bypassEngine_1.pruneExpiredBypasses)(cfg);
        if (expired.length)
            await guildConfigStore_1.guildConfigStore.set(message.guild.id, cfg);
        if (protection.ignoredChannels.includes(message.channel.id) || protection.ignoredCategories.includes(message.channel.parentId) || protection.ignoredRoles.some(id => message.member.roles.cache.has(id)))
            return;
        const bypass = (0, bypassEngine_1.resolveBypass)(cfg, { botUserId: message.client.user.id, executorId: message.author.id, executorRoleIds: [...message.member.roles.cache.keys()], module, channelId: message.channel.id, categoryId: message.channel.parentId, executorIsBot: message.author.bot }, this.appConfig.owners);
        if (bypass.bypassed && bypass.behavior?.ignoreDetection) {
            if (bypass.behavior.continueLogging)
                await this.logBypassedMessage(message, module, protection, cfg, bypass);
            return;
        }
        let threshold = { exceeded: true, count: 1 };
        if (THRESHOLD_MESSAGE_MODULES.has(module)) {
            if (bypass.bypassed && bypass.behavior?.ignoreLimit)
                return;
            threshold = module === 'anti_repeated_message'
                ? thresholdEngine_1.thresholdEngine.hitRepeated(message.guild.id, module, message.author.id, protection.quantity, protection.intervalSeconds, message.content)
                : thresholdEngine_1.thresholdEngine.hit(message.guild.id, module, message.author.id, protection.quantity, protection.intervalSeconds, message.content);
            if (!threshold.exceeded)
                return;
        }
        const incident = await (0, incidentManager_1.createIncident)({ guildId: message.guild.id, module, event: protection.logEvent, severity: module === 'anti_phishing' ? 'critical' : 'medium', executorId: message.author.id, targetId: message.author.id, channelId: message.channel.id, confidence: 'confirmed', configuredAction: protection.punishment.type, details: { count: threshold.count, mode: protection.mode, content: protection.logEvent === 'anti_phishing' ? '[redacted]' : undefined } });
        if (bypass.bypassed) {
            incident.bypass = bypass.entry ? { entryId: bypass.entry.id, kind: bypass.entry.kind, targetId: bypass.entry.targetId } : null;
            if (bypass.behavior?.ignorePunishment)
                incident.actionResult = 'bypassed';
        }
        if (protection.mode === 'enabled' && !bypass.behavior?.ignorePunishment) {
            await message.delete().catch(() => undefined);
            incident.actionResult = await (0, punishmentEngine_1.executePunishment)(message.guild, message.member, protection, cfg, incident);
        }
        else
            incident.actionResult = protection.mode === 'test' ? 'simulated' : bypass.bypassed ? 'bypassed' : 'logged';
        await (0, logManager_1.sendIncidentLog)(message.guild, cfg, incident);
        await guildConfigStore_1.guildConfigStore.set(message.guild.id, cfg);
        await (0, incidentManager_1.updateIncident)(incident);
    }
    async logBypassedMessage(message, module, protection, cfg, bypass) {
        const incident = await (0, incidentManager_1.createIncident)({ guildId: message.guild.id, module, event: protection.logEvent, severity: 'info', executorId: message.author.id, targetId: message.author.id, channelId: message.channel.id, confidence: 'confirmed', configuredAction: protection.punishment.type, details: { bypassReason: bypass.reason } });
        incident.bypass = bypass.entry ? { entryId: bypass.entry.id, kind: bypass.entry.kind, targetId: bypass.entry.targetId } : null;
        incident.actionResult = 'bypassed_before_detection';
        await (0, logManager_1.sendIncidentLog)(message.guild, cfg, incident);
        await (0, incidentManager_1.updateIncident)(incident);
    }
    async handleDestructiveEvent(input) {
        await this.handleAdministrativeEvent(input);
    }
    async handleAdministrativeEvent(input) {
        const cfg = await guildConfigStore_1.guildConfigStore.get(input.guild.id);
        const protection = cfg.protections[input.module];
        if (!protection || protection.mode === 'disabled')
            return;
        const startedAt = Date.now();
        const audit = await (0, auditLogResolver_1.resolveAudit)(input.guild, input.auditType, input.targetId);
        const member = audit.executorId ? await input.guild.members.fetch(audit.executorId).catch(() => null) : null;
        if (input.module.startsWith('anti_mass_')) {
            if (!audit.executorId)
                return;
            const threshold = thresholdEngine_1.thresholdEngine.hit(input.guild.id, input.module, audit.executorId, protection.quantity, protection.intervalSeconds, input.targetId);
            if (!threshold.exceeded)
                return;
            input.details = { ...(input.details ?? {}), count: threshold.count, intervalSeconds: protection.intervalSeconds };
        }
        const bypass = (0, bypassEngine_1.resolveBypass)(cfg, { botUserId: input.guild.client.user.id, executorId: audit.executorId, executorRoleIds: member ? [...member.roles.cache.keys()] : [], module: input.module, executorIsBot: audit.executor?.bot }, this.appConfig.owners);
        if (bypass.bypassed && bypass.behavior?.ignoreDetection && !bypass.behavior.continueLogging)
            return;
        const incident = await (0, incidentManager_1.createIncident)({ guildId: input.guild.id, module: input.module, event: input.event, severity: input.severity ?? 'high', executorId: audit.executorId, targetId: input.targetId, confidence: audit.confidence, configuredAction: protection.punishment.type, details: { auditEntryId: audit.entryId, auditReason: audit.reason, ...(input.details ?? {}) }, startedAt });
        if (bypass.bypassed)
            incident.bypass = bypass.entry ? { entryId: bypass.entry.id, kind: bypass.entry.kind, targetId: bypass.entry.targetId } : null;
        const canPunish = audit.confidence === 'confirmed' && protection.mode === 'enabled' && !bypass.behavior?.ignorePunishment;
        incident.actionResult = canPunish ? await (0, punishmentEngine_1.executePunishment)(input.guild, member, protection, cfg, incident) : (protection.mode === 'test' ? 'simulated' : bypass.bypassed ? 'bypassed' : 'logged_uncertain');
        if (protection.restore && protection.mode !== 'test' && !bypass.behavior?.ignoreRestoration && input.restoreKind) {
            try {
                const snapshot = await (0, snapshotManager_1.loadGuildSnapshot)(input.guild.id);
                if (!snapshot)
                    throw new Error('Snapshot não encontrado');
                if (input.restoreKind === 'channel') {
                    const channelSnapshot = snapshot.channels[input.targetId];
                    if (!channelSnapshot)
                        throw new Error('Canal ausente no snapshot');
                    const recreated = await (0, restorationEngine_1.restoreChannel)(input.guild, channelSnapshot);
                    incident.restorationResult = `recreated:${recreated.id}`;
                }
                else {
                    const roleSnapshot = snapshot.roles[input.targetId];
                    if (!roleSnapshot)
                        throw new Error('Cargo ausente no snapshot');
                    const recreated = await (0, restorationEngine_1.restoreRole)(input.guild, roleSnapshot);
                    incident.restorationResult = `recreated:${recreated.id}`;
                }
            }
            catch (error) {
                incident.restorationResult = `failure:${error instanceof Error ? error.message : String(error)}`;
            }
        }
        await (0, logManager_1.sendIncidentLog)(input.guild, cfg, incident);
        await guildConfigStore_1.guildConfigStore.set(input.guild.id, cfg);
        await (0, incidentManager_1.updateIncident)(incident);
        await (0, snapshotManager_1.captureGuildSnapshot)(input.guild).catch(error => logger_1.logger.warn('Falha ao atualizar snapshot após incidente.', { guildId: input.guild.id, error: String(error) }));
    }
    async handleChannelUpdate(oldChannel, newChannel) {
        if (!newChannel.guild)
            return;
        if (oldChannel.parentId !== newChannel.parentId || oldChannel.rawPosition !== newChannel.rawPosition) {
            await this.handleAdministrativeEvent({ guild: newChannel.guild, module: 'anti_channel_move', event: 'channel_move', targetId: newChannel.id, target: newChannel, auditType: discord_js_1.AuditLogEvent.ChannelUpdate, severity: 'high' });
            return;
        }
        if (this.overwritesSignature(oldChannel) !== this.overwritesSignature(newChannel)) {
            await this.handleAdministrativeEvent({ guild: newChannel.guild, module: 'anti_channel_permissions', event: 'channel_permissions_update', targetId: newChannel.id, target: newChannel, auditType: discord_js_1.AuditLogEvent.ChannelOverwriteUpdate, severity: 'critical' });
            return;
        }
        if (oldChannel.nsfw !== newChannel.nsfw) {
            await this.handleAdministrativeEvent({ guild: newChannel.guild, module: 'anti_nsfw_update', event: 'channel_update', targetId: newChannel.id, target: newChannel, auditType: discord_js_1.AuditLogEvent.ChannelUpdate, severity: 'medium' });
            return;
        }
        if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
            await this.handleAdministrativeEvent({ guild: newChannel.guild, module: 'anti_slowmode_update', event: 'channel_update', targetId: newChannel.id, target: newChannel, auditType: discord_js_1.AuditLogEvent.ChannelUpdate, severity: 'medium' });
            return;
        }
        await this.handleAdministrativeEvent({ guild: newChannel.guild, module: 'anti_channel_update', event: 'channel_update', targetId: newChannel.id, target: newChannel, auditType: discord_js_1.AuditLogEvent.ChannelUpdate, severity: 'high' });
    }
    async handleRoleUpdate(oldRole, newRole) {
        if (oldRole.position !== newRole.position) {
            await this.handleAdministrativeEvent({ guild: newRole.guild, module: 'anti_role_move', event: 'role_move', targetId: newRole.id, target: newRole, auditType: discord_js_1.AuditLogEvent.RoleUpdate, severity: 'high' });
            return;
        }
        for (const [permission, module] of DANGEROUS_PERMISSIONS) {
            if (!oldRole.permissions.has(permission) && newRole.permissions.has(permission)) {
                await this.handleAdministrativeEvent({ guild: newRole.guild, module, event: permission === discord_js_1.PermissionFlagsBits.Administrator ? 'administrator_granted' : 'dangerous_permission_add', targetId: newRole.id, target: newRole, auditType: discord_js_1.AuditLogEvent.RoleUpdate, severity: 'critical', details: { permission: permission.toString() } });
                return;
            }
        }
        await this.handleAdministrativeEvent({ guild: newRole.guild, module: 'anti_role_update', event: 'role_update', targetId: newRole.id, target: newRole, auditType: discord_js_1.AuditLogEvent.RoleUpdate, severity: 'high' });
    }
    async handleGuildUpdate(oldGuild, newGuild) {
        const checks = [
            [oldGuild.name !== newGuild.name, 'anti_guild_name', 'guild_name_update', 'high'],
            [oldGuild.icon !== newGuild.icon, 'anti_guild_icon', 'guild_icon_update', 'high'],
            [oldGuild.banner !== newGuild.banner, 'anti_guild_banner', 'guild_banner_update', 'high'],
            [oldGuild.description !== newGuild.description, 'anti_guild_description', 'guild_description_update', 'medium'],
            [oldGuild.verificationLevel !== newGuild.verificationLevel, 'anti_verification_update', 'verification_level_update', 'critical'],
            [oldGuild.explicitContentFilter !== newGuild.explicitContentFilter, 'anti_content_filter_update', 'security_update', 'high'],
            [String(oldGuild.features) !== String(newGuild.features), 'anti_community_update', 'community_update', 'high'],
            [oldGuild.rulesChannelId !== newGuild.rulesChannelId || oldGuild.publicUpdatesChannelId !== newGuild.publicUpdatesChannelId, 'anti_official_channels_update', 'official_channels_update', 'high']
        ];
        const match = checks.find(([changed]) => changed);
        if (match)
            await this.handleAdministrativeEvent({ guild: newGuild, module: match[1], event: match[2], targetId: newGuild.id, target: newGuild, auditType: discord_js_1.AuditLogEvent.GuildUpdate, severity: match[3] });
    }
    async handleMemberUpdate(oldMember, newMember) {
        const oldRoles = new Set(oldMember.roles.cache.keys());
        const newRoles = new Set(newMember.roles.cache.keys());
        const added = [...newRoles].filter(id => !oldRoles.has(id));
        const removed = [...oldRoles].filter(id => !newRoles.has(id));
        if (added.length) {
            const dangerous = added.some(id => DANGEROUS_PERMISSIONS.some(([permission]) => newMember.guild.roles.cache.get(id)?.permissions.has(permission)));
            await this.handleAdministrativeEvent({ guild: newMember.guild, module: dangerous ? 'anti_dangerous_role_assignment' : 'anti_mass_role_add', event: 'member_role_add', targetId: newMember.id, target: newMember, auditType: discord_js_1.AuditLogEvent.MemberRoleUpdate, severity: dangerous ? 'critical' : 'high', details: { roleIds: added } });
            return;
        }
        if (removed.length) {
            await this.handleAdministrativeEvent({ guild: newMember.guild, module: 'anti_mass_role_remove', event: 'member_role_remove', targetId: newMember.id, target: newMember, auditType: discord_js_1.AuditLogEvent.MemberRoleUpdate, severity: 'high', details: { roleIds: removed } });
            return;
        }
        if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
            await this.handleAdministrativeEvent({ guild: newMember.guild, module: 'anti_mass_timeout', event: newMember.communicationDisabledUntilTimestamp ? 'timeout_add' : 'timeout_remove', targetId: newMember.id, target: newMember, auditType: discord_js_1.AuditLogEvent.MemberUpdate, severity: 'high' });
            return;
        }
        if (oldMember.nickname !== newMember.nickname) {
            await this.handleAdministrativeEvent({ guild: newMember.guild, module: 'anti_mass_nickname', event: 'nickname_update', targetId: newMember.id, target: newMember, auditType: discord_js_1.AuditLogEvent.MemberUpdate, severity: 'medium' });
        }
    }
    async handleVoiceStateUpdate(oldState, newState) {
        if (!oldState.channelId || oldState.channelId === newState.channelId)
            return;
        const module = newState.channelId ? 'anti_mass_voice_move' : 'anti_mass_voice_disconnect';
        const event = newState.channelId ? 'mass_voice_move' : 'mass_voice_disconnect';
        const auditType = newState.channelId ? discord_js_1.AuditLogEvent.MemberMove : discord_js_1.AuditLogEvent.MemberDisconnect;
        await this.handleAdministrativeEvent({ guild: newState.guild, module, event, targetId: newState.id, target: newState.member, auditType, severity: 'high', details: { oldChannelId: oldState.channelId, newChannelId: newState.channelId } });
    }
    async handleMemberJoin(member) {
        const cfg = await guildConfigStore_1.guildConfigStore.get(member.guild.id);
        if (member.user.bot) {
            if (cfg.trustedBots.includes(member.id)) {
                await this.logPassiveEvent(member.guild, 'bot_add', member.id, { trusted: true });
                return;
            }
            await this.handleAdministrativeEvent({ guild: member.guild, module: 'anti_unauthorized_bot', event: 'unauthorized_bot', targetId: member.id, target: member.user, auditType: discord_js_1.AuditLogEvent.BotAdd, severity: 'critical' });
            return;
        }
        const ageSeconds = (Date.now() - member.user.createdTimestamp) / 1000;
        const accountProtection = cfg.protections.anti_new_account;
        if (accountProtection && accountProtection.mode !== 'disabled' && ageSeconds < accountProtection.minimumAccountAgeSeconds) {
            const incident = await (0, incidentManager_1.createIncident)({ guildId: member.guild.id, module: 'anti_new_account', event: 'new_account', severity: 'high', executorId: member.id, targetId: member.id, confidence: 'confirmed', configuredAction: accountProtection.punishment.type, details: { accountAgeSeconds: Math.floor(ageSeconds) } });
            incident.actionResult = accountProtection.mode === 'enabled' ? await (0, punishmentEngine_1.executePunishment)(member.guild, member, accountProtection, cfg, incident) : accountProtection.mode === 'test' ? 'simulated' : 'logged';
            await (0, logManager_1.sendIncidentLog)(member.guild, cfg, incident);
            await (0, incidentManager_1.updateIncident)(incident);
        }
        else
            await this.logPassiveEvent(member.guild, 'member_join', member.id, { accountAgeSeconds: Math.floor(ageSeconds) });
        const raid = thresholdEngine_1.thresholdEngine.hit(member.guild.id, 'anti_mass_join', 'global', cfg.raid.joinCount, cfg.raid.intervalSeconds);
        if (cfg.raid.state === 'automatic' && raid.exceeded) {
            cfg.raid.activeUntil = new Date(Date.now() + cfg.raid.durationSeconds * 1000).toISOString();
            const raidProtection = cfg.protections.anti_mass_join;
            if (raidProtection) {
                const incident = await (0, incidentManager_1.createIncident)({ guildId: member.guild.id, module: 'anti_mass_join', event: 'raid_detected', severity: 'emergency', targetId: member.id, confidence: 'confirmed', configuredAction: raidProtection.punishment.type, details: { joins: raid.count } });
                incident.actionResult = raidProtection.mode === 'enabled' ? await (0, punishmentEngine_1.executePunishment)(member.guild, member, raidProtection, cfg, incident) : raidProtection.mode === 'test' ? 'simulated' : 'logged';
                await (0, logManager_1.sendIncidentLog)(member.guild, cfg, incident);
                await (0, incidentManager_1.updateIncident)(incident);
            }
        }
        await guildConfigStore_1.guildConfigStore.set(member.guild.id, cfg);
    }
    async logPassiveEvent(guild, event, targetId, details = {}, severity = 'info', channelId = null) {
        const cfg = await guildConfigStore_1.guildConfigStore.get(guild.id);
        const logConfig = cfg.logs.events[event];
        if (!logConfig || logConfig.mode === 'disabled')
            return;
        const incident = await (0, incidentManager_1.createIncident)({ guildId: guild.id, module: 'event_log', event, severity, targetId, channelId, confidence: 'confirmed', configuredAction: 'log', details });
        incident.actionResult = 'logged';
        await (0, logManager_1.sendIncidentLog)(guild, cfg, incident);
        await guildConfigStore_1.guildConfigStore.set(guild.id, cfg);
        await (0, incidentManager_1.updateIncident)(incident);
    }
    async refreshSnapshot(guild) {
        const cfg = await guildConfigStore_1.guildConfigStore.get(guild.id);
        if (!cfg.snapshots.enabled)
            return;
        await (0, snapshotManager_1.captureGuildSnapshot)(guild);
        cfg.snapshots.lastRefreshAt = new Date().toISOString();
        await guildConfigStore_1.guildConfigStore.set(guild.id, cfg);
    }
    overwritesSignature(channel) {
        const values = channel.permissionOverwrites?.cache?.map((overwrite) => `${overwrite.id}:${overwrite.allow.bitfield}:${overwrite.deny.bitfield}`) ?? [];
        return [...values].sort().join('|');
    }
}
exports.ProtectionEngine = ProtectionEngine;
exports.destructiveAuditTypes = {
    channelDelete: discord_js_1.AuditLogEvent.ChannelDelete,
    roleDelete: discord_js_1.AuditLogEvent.RoleDelete,
    channelCreate: discord_js_1.AuditLogEvent.ChannelCreate,
    roleCreate: discord_js_1.AuditLogEvent.RoleCreate,
    channelUpdate: discord_js_1.AuditLogEvent.ChannelUpdate,
    roleUpdate: discord_js_1.AuditLogEvent.RoleUpdate,
    guildUpdate: discord_js_1.AuditLogEvent.GuildUpdate,
    botAdd: discord_js_1.AuditLogEvent.BotAdd,
    webhookCreate: discord_js_1.AuditLogEvent.WebhookCreate,
    webhookUpdate: discord_js_1.AuditLogEvent.WebhookUpdate,
    webhookDelete: discord_js_1.AuditLogEvent.WebhookDelete,
    memberBanAdd: discord_js_1.AuditLogEvent.MemberBanAdd,
    memberKick: discord_js_1.AuditLogEvent.MemberKick,
    threadDelete: discord_js_1.AuditLogEvent.ThreadDelete,
    autoModDelete: discord_js_1.AuditLogEvent.AutoModerationRuleDelete,
    autoModUpdate: discord_js_1.AuditLogEvent.AutoModerationRuleUpdate,
    eventDelete: discord_js_1.AuditLogEvent.GuildScheduledEventDelete,
    emojiDelete: discord_js_1.AuditLogEvent.EmojiDelete,
    stickerDelete: discord_js_1.AuditLogEvent.StickerDelete,
    soundDelete: discord_js_1.AuditLogEvent.SoundboardSoundDelete,
    integrationCreate: discord_js_1.AuditLogEvent.IntegrationCreate,
    integrationDelete: discord_js_1.AuditLogEvent.IntegrationDelete
};
//# sourceMappingURL=protectionEngine.js.map