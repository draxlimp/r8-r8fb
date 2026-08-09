"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerEvents = registerEvents;
const painel_1 = require("../commands/painel");
const protectionEngine_1 = require("../protection/protectionEngine");
const logger_1 = require("../utils/logger");
function registerEvents(client, app, panel, engine, community) {
    const run = (name, promise, meta = {}) => {
        void promise.catch(error => logger_1.logger.error(`Falha no evento ${name}.`, { ...meta, error: error instanceof Error ? error.message : String(error) }));
    };
    client.on('interactionCreate', async (interaction) => {
        try {
            const customId = 'customId' in interaction && typeof interaction.customId === 'string'
                ? interaction.customId
                : null;
            if (customId?.startsWith('p|')) {
                await panel.handle(interaction);
                return;
            }
            if (await community.handleInteraction(interaction))
                return;
            await panel.handle(interaction);
        }
        catch (error) {
            logger_1.logger.error('Falha no evento de interação.', { error: String(error) });
        }
    });
    client.on('messageCreate', async (message) => {
        try {
            if (message.guild && message.content.trim().toLowerCase() === `${app.prefix}painel`)
                await (0, painel_1.runPanelCommand)(message, panel);
            else if (await community.handleMessage(message))
                return;
            else
                await engine.handleMessage(message);
        }
        catch (error) {
            logger_1.logger.error('Falha no evento de mensagem.', { guildId: message.guildId, error: String(error) });
        }
    });
    client.on('messageDelete', message => {
        if (!message.guild)
            return;
        run('messageDelete', engine.logPassiveEvent(message.guild, 'message_delete', message.author?.id ?? null, { messageId: message.id, authorId: message.author?.id ?? null, attachments: message.attachments?.size ?? 0 }, 'info', message.channelId), { guildId: message.guild.id });
    });
    client.on('messageUpdate', (oldMessage, newMessage) => {
        if (!newMessage.guild || oldMessage.content === newMessage.content)
            return;
        run('messageUpdate', engine.logPassiveEvent(newMessage.guild, 'message_update', newMessage.author?.id ?? null, { messageId: newMessage.id, authorId: newMessage.author?.id ?? null }, 'info', newMessage.channelId), { guildId: newMessage.guild.id });
    });
    client.on('messageDeleteBulk', messages => {
        const first = messages.first?.();
        if (!first?.guild)
            return;
        run('messageDeleteBulk', engine.logPassiveEvent(first.guild, 'bulk_message_delete', null, { count: messages.size, channelId: first.channelId }, 'medium', first.channelId), { guildId: first.guild.id });
    });
    client.on('guildMemberAdd', member => {
        run('guildMemberAddProtection', engine.handleMemberJoin(member), { guildId: member.guild.id });
        run('guildMemberAddCommunity', community.handleMemberAdd(member), { guildId: member.guild.id });
    });
    client.on('guildMemberRemove', member => {
        run('guildMemberRemoveProtection', engine.handleAdministrativeEvent({ guild: member.guild, module: 'anti_mass_kick', event: 'member_kick', targetId: member.id, target: member.user, auditType: protectionEngine_1.destructiveAuditTypes.memberKick, severity: 'critical' }), { guildId: member.guild.id });
        run('guildMemberRemoveLog', engine.logPassiveEvent(member.guild, 'member_leave', member.id, { bot: member.user.bot }), { guildId: member.guild.id });
        run('guildMemberRemoveCommunity', community.handleMemberRemove(member), { guildId: member.guild.id });
    });
    client.on('guildMemberUpdate', (oldMember, newMember) => {
        run('guildMemberUpdateProtection', engine.handleMemberUpdate(oldMember, newMember), { guildId: newMember.guild.id });
        run('guildMemberUpdateModeration', community.handleModerationMemberUpdate(oldMember, newMember), { guildId: newMember.guild.id });
    });
    client.on('guildBanAdd', ban => {
        run('guildBanAddProtection', engine.handleAdministrativeEvent({ guild: ban.guild, module: 'anti_mass_ban', event: 'member_ban', targetId: ban.user.id, target: ban.user, auditType: protectionEngine_1.destructiveAuditTypes.memberBanAdd, severity: 'critical' }), { guildId: ban.guild.id });
        run('guildBanAddLog', engine.logPassiveEvent(ban.guild, 'member_ban', ban.user.id), { guildId: ban.guild.id });
        run('guildBanAddModeration', community.handleGuildBanAdd(ban), { guildId: ban.guild.id });
    });
    client.on('guildBanRemove', ban => {
        run('guildBanRemoveLog', engine.logPassiveEvent(ban.guild, 'member_unban', ban.user.id), { guildId: ban.guild.id });
        run('guildBanRemoveModeration', community.handleGuildBanRemove(ban), { guildId: ban.guild.id });
    });
    client.on('channelDelete', channel => {
        if (!('guild' in channel))
            return;
        const guild = channel.guild;
        const module = channel.type === 4 ? 'anti_category_delete' : 'anti_channel_delete';
        const event = channel.type === 4 ? 'category_delete' : 'channel_delete';
        run('channelDelete', engine.handleAdministrativeEvent({ guild, module, event, targetId: channel.id, target: channel, auditType: protectionEngine_1.destructiveAuditTypes.channelDelete, severity: 'critical', restoreKind: 'channel' }), { guildId: guild.id });
    });
    client.on('channelCreate', channel => {
        if (!('guild' in channel))
            return;
        const guild = channel.guild;
        const module = channel.type === 4 ? 'anti_category_create' : 'anti_channel_create';
        const event = channel.type === 4 ? 'category_create' : 'channel_create';
        run('channelCreate', engine.handleAdministrativeEvent({ guild, module, event, targetId: channel.id, target: channel, auditType: protectionEngine_1.destructiveAuditTypes.channelCreate, severity: 'medium' }), { guildId: guild.id });
    });
    client.on('channelUpdate', (oldChannel, newChannel) => {
        if (!('guild' in newChannel))
            return;
        run('channelUpdate', engine.handleChannelUpdate(oldChannel, newChannel), { guildId: newChannel.guild.id });
    });
    client.on('threadDelete', thread => run('threadDelete', engine.handleAdministrativeEvent({ guild: thread.guild, module: 'anti_thread_delete', event: 'thread_delete', targetId: thread.id, target: thread, auditType: protectionEngine_1.destructiveAuditTypes.threadDelete, severity: 'high' }), { guildId: thread.guild.id }));
    client.on('threadCreate', thread => run('threadCreate', engine.logPassiveEvent(thread.guild, 'thread_create', thread.id, { parentId: thread.parentId }, 'info', thread.id), { guildId: thread.guild.id }));
    client.on('threadUpdate', (oldThread, newThread) => run('threadUpdate', engine.logPassiveEvent(newThread.guild, 'thread_update', newThread.id, { parentId: newThread.parentId }, 'info', newThread.id), { guildId: newThread.guild.id }));
    client.on('roleDelete', role => run('roleDelete', engine.handleAdministrativeEvent({ guild: role.guild, module: 'anti_role_delete', event: 'role_delete', targetId: role.id, target: role, auditType: protectionEngine_1.destructiveAuditTypes.roleDelete, severity: 'critical', restoreKind: 'role' }), { guildId: role.guild.id }));
    client.on('roleCreate', role => run('roleCreate', engine.handleAdministrativeEvent({ guild: role.guild, module: 'anti_role_create', event: 'role_create', targetId: role.id, target: role, auditType: protectionEngine_1.destructiveAuditTypes.roleCreate, severity: 'medium' }), { guildId: role.guild.id }));
    client.on('roleUpdate', (oldRole, newRole) => run('roleUpdate', engine.handleRoleUpdate(oldRole, newRole), { guildId: newRole.guild.id }));
    client.on('guildUpdate', (oldGuild, newGuild) => run('guildUpdate', engine.handleGuildUpdate(oldGuild, newGuild), { guildId: newGuild.id }));
    client.on('voiceStateUpdate', (oldState, newState) => {
        run('voiceProtection', engine.handleVoiceStateUpdate(oldState, newState), { guildId: newState.guild.id });
        run('voiceCommunity', community.handleVoiceStateUpdate(oldState, newState), { guildId: newState.guild.id });
        if (!oldState.channelId && newState.channelId)
            run('voiceJoinLog', engine.logPassiveEvent(newState.guild, 'voice_join', newState.id, { channelId: newState.channelId }, 'info', newState.channelId), { guildId: newState.guild.id });
        else if (oldState.channelId && !newState.channelId)
            run('voiceLeaveLog', engine.logPassiveEvent(newState.guild, 'voice_leave', newState.id, { channelId: oldState.channelId }, 'info', oldState.channelId), { guildId: newState.guild.id });
        else if (oldState.channelId !== newState.channelId)
            run('voiceMoveLog', engine.logPassiveEvent(newState.guild, 'voice_move', newState.id, { oldChannelId: oldState.channelId, newChannelId: newState.channelId }, 'info', newState.channelId), { guildId: newState.guild.id });
    });
    client.on('webhooksUpdate', channel => {
        run('webhooksUpdateProtection', engine.handleAdministrativeEvent({ guild: channel.guild, module: 'anti_webhook', event: 'webhook_update', targetId: channel.id, target: channel, auditType: protectionEngine_1.destructiveAuditTypes.webhookUpdate, severity: 'high' }), { guildId: channel.guild.id });
        run('webhooksUpdateLog', engine.logPassiveEvent(channel.guild, 'webhook_update', channel.id, {}, 'medium', channel.id), { guildId: channel.guild.id });
    });
    client.on('guildIntegrationsUpdate', guild => run('guildIntegrationsUpdate', engine.handleAdministrativeEvent({ guild, module: 'anti_suspicious_integration', event: 'integration_create', targetId: guild.id, target: guild, auditType: protectionEngine_1.destructiveAuditTypes.integrationCreate, severity: 'high' }), { guildId: guild.id }));
    client.on('autoModerationRuleDelete', rule => run('autoModerationRuleDelete', engine.handleAdministrativeEvent({ guild: rule.guild, module: 'anti_automod_delete', event: 'automod_delete', targetId: rule.id, target: rule, auditType: protectionEngine_1.destructiveAuditTypes.autoModDelete, severity: 'critical' }), { guildId: rule.guild.id }));
    client.on('autoModerationRuleUpdate', (oldRule, newRule) => run('autoModerationRuleUpdate', engine.handleAdministrativeEvent({ guild: newRule.guild, module: 'anti_automod_update', event: 'automod_update', targetId: newRule.id, target: newRule, auditType: protectionEngine_1.destructiveAuditTypes.autoModUpdate, severity: 'high' }), { guildId: newRule.guild.id }));
    client.on('guildScheduledEventDelete', event => {
        const guild = event.guild;
        if (!guild)
            return;
        run('guildScheduledEventDelete', engine.handleAdministrativeEvent({ guild, module: 'anti_event_delete', event: 'security_update', targetId: event.id, target: event, auditType: protectionEngine_1.destructiveAuditTypes.eventDelete, severity: 'high' }), { guildId: guild.id });
    });
    client.on('emojiDelete', emoji => run('emojiDelete', engine.handleAdministrativeEvent({ guild: emoji.guild, module: 'anti_emoji_delete', event: 'emoji_delete', targetId: emoji.id, target: emoji, auditType: protectionEngine_1.destructiveAuditTypes.emojiDelete, severity: 'high' }), { guildId: emoji.guild.id }));
    client.on('emojiCreate', emoji => run('emojiCreate', engine.logPassiveEvent(emoji.guild, 'emoji_create', emoji.id), { guildId: emoji.guild.id }));
    client.on('emojiUpdate', (oldEmoji, newEmoji) => run('emojiUpdate', engine.logPassiveEvent(newEmoji.guild, 'emoji_update', newEmoji.id), { guildId: newEmoji.guild.id }));
    client.on('stickerDelete', sticker => {
        const guild = sticker.guild;
        if (!guild)
            return;
        run('stickerDelete', engine.handleAdministrativeEvent({ guild, module: 'anti_sticker_delete', event: 'sticker_delete', targetId: sticker.id, target: sticker, auditType: protectionEngine_1.destructiveAuditTypes.stickerDelete, severity: 'high' }), { guildId: guild.id });
    });
    client.on('stickerCreate', sticker => {
        const guild = sticker.guild;
        if (!guild)
            return;
        run('stickerCreate', engine.logPassiveEvent(guild, 'sticker_create', sticker.id), { guildId: guild.id });
    });
    client.on('stickerUpdate', (oldSticker, newSticker) => {
        const guild = newSticker.guild;
        if (!guild)
            return;
        run('stickerUpdate', engine.logPassiveEvent(guild, 'sticker_update', newSticker.id), { guildId: guild.id });
    });
    client.on('guildSoundboardSoundDelete', sound => {
        const guild = sound.guild;
        if (!guild)
            return;
        run('soundDelete', engine.handleAdministrativeEvent({ guild, module: 'anti_sound_delete', event: 'sound_delete', targetId: String(sound.soundId), target: sound, auditType: protectionEngine_1.destructiveAuditTypes.soundDelete, severity: 'high' }), { guildId: guild.id });
    });
    client.on('guildSoundboardSoundCreate', sound => {
        const guild = sound.guild;
        if (!guild)
            return;
        run('soundCreate', engine.logPassiveEvent(guild, 'sound_create', String(sound.soundId)), { guildId: guild.id });
    });
    client.on('guildSoundboardSoundUpdate', (oldSound, newSound) => {
        const guild = newSound.guild;
        if (!guild)
            return;
        run('soundUpdate', engine.logPassiveEvent(guild, 'sound_update', String(newSound.soundId)), { guildId: guild.id });
    });
    client.on('inviteCreate', invite => { if (invite.guild)
        run('inviteCreate', engine.logPassiveEvent(invite.guild, 'invite_create', invite.code, { channelId: invite.channelId }, 'info', invite.channelId), { guildId: invite.guild.id }); });
    client.on('inviteDelete', invite => { if (invite.guild)
        run('inviteDelete', engine.logPassiveEvent(invite.guild, 'invite_delete', invite.code, { channelId: invite.channelId }, 'info', invite.channelId), { guildId: invite.guild.id }); });
    client.on('error', error => logger_1.logger.error('Erro do cliente Discord.', { error: error.message }));
    client.on('warn', message => logger_1.logger.warn('Aviso do cliente Discord.', { message }));
}
//# sourceMappingURL=registerEvents.js.map