"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandManager = void 0;
const discord_js_1 = require("discord.js");
const guildConfigStore_1 = require("../storage/guildConfigStore");
const communityLogger_1 = require("../community/communityLogger");
const ids_1 = require("../utils/ids");
const logger_1 = require("../utils/logger");
const shipCanvas_1 = require("../community/shipCanvas");
const funCanvas_1 = require("../community/funCanvas");
const activityService_1 = require("../community/activityService");
const reputationService_1 = require("../community/reputationService");
const conversationService_1 = require("../community/conversationService");
const emojis_1 = require("../ui/emojis");
const HELP_CATEGORIES = {
    moderation: 'Moderação',
    community: 'Comunidade',
    information: 'Informações',
    utility: 'Utilidades',
    protection: 'Proteção'
};
class CommandManager {
    app;
    tickets;
    activity;
    roleBackups;
    commands = new Map();
    cooldowns = new Map();
    startedAt = Date.now();
    constructor(app, tickets, activity, roleBackups) {
        this.app = app;
        this.tickets = tickets;
        this.activity = activity;
        this.roleBackups = roleBackups;
        for (const command of this.createCommands())
            this.commands.set(command.name, command);
    }
    async handleMessage(message) {
        if (!message.guild || !message.member || message.author?.bot)
            return false;
        const config = await guildConfigStore_1.guildConfigStore.get(message.guild.id);
        await this.handleAfkActivity(message, config);
        if (!message.content.startsWith(this.app.prefix))
            return false;
        const body = message.content.slice(this.app.prefix.length).trim();
        if (!body)
            return false;
        const [usedNameRaw, ...args] = body.split(/\s+/);
        const usedName = usedNameRaw?.toLowerCase();
        if (!usedName || usedName === 'painel' || usedName === 'cl')
            return false;
        const canonical = this.resolveCommand(usedName, config);
        if (!canonical)
            return false;
        const command = this.commands.get(canonical);
        if (!command)
            return false;
        const permission = config.commands.permissions[canonical];
        if (!permission?.enabled || config.commands.disabled.includes(canonical)) {
            await this.replyTemporary(message, { embeds: [this.noticeEmbed('Comando desativado', 'Este comando está desativado neste servidor.', 0xe67e22)] });
            return true;
        }
        if (!this.canUseConfiguredCommand(message.member, message.channelId, permission)) {
            await this.replyTemporary(message, { embeds: [this.noticeEmbed('Acesso negado', 'Você não possui acesso a este comando neste canal.', 0xe74c3c)] });
            await this.logCommand(message, config, 'command_denied', canonical, 'configured_permission');
            return true;
        }
        if (command.permission && !message.member.permissions.has(command.permission)) {
            await this.replyTemporary(message, { embeds: [this.noticeEmbed('Permissão insuficiente', `Você precisa de **${permissionLabel(command.permission)}** para usar este comando.`, 0xe74c3c)] });
            await this.logCommand(message, config, 'command_denied', canonical, 'discord_permission');
            return true;
        }
        const cooldownKey = `${message.guild.id}:${message.author.id}:${canonical}`;
        const now = Date.now();
        const availableAt = this.cooldowns.get(cooldownKey) ?? 0;
        if (availableAt > now) {
            await this.replyTemporary(message, { embeds: [this.noticeEmbed('Aguarde um momento', `Tente novamente em **${Math.ceil((availableAt - now) / 1000)} segundo(s)**.`, 0xe67e22)] });
            return true;
        }
        this.cooldowns.set(cooldownKey, now + Math.max(0, permission.cooldownSeconds) * 1000);
        try {
            await command.execute(message, args, config);
            if (permission.deleteCommandMessage && message.deletable)
                await message.delete().catch(() => undefined);
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            const errorCode = (0, ids_1.randomId)(4);
            logger_1.logger.error('Falha em comando de comunidade.', { command: canonical, guildId: message.guild.id, error: reason, errorCode });
            await this.replyTemporary(message, { embeds: [this.noticeEmbed('Não foi possível executar o comando', `${friendlyError(reason)}\n\nCódigo: \`${errorCode}\``, 0xe74c3c)] });
            await this.logCommand(message, config, 'command_error', canonical, reason);
        }
        return true;
    }
    async handleInteraction(interaction) {
        const customId = typeof interaction.customId === 'string' ? interaction.customId : '';
        if (!customId.startsWith('help|') && !customId.startsWith('groles|') && !customId.startsWith('nuke|') && !customId.startsWith('staffcase|') && !customId.startsWith('staffback|') && !customId.startsWith('staffrevoke|'))
            return false;
        if (customId.startsWith('help|')) {
            const [, userId, category, pageRaw] = customId.split('|');
            if (interaction.user.id !== userId) {
                await interaction.reply({ content: 'Este menu de ajuda pertence a outro usuário.', flags: discord_js_1.MessageFlags.Ephemeral });
                return true;
            }
            if (!interaction.guildId || !interaction.guild)
                return true;
            const page = Math.max(0, Number.isFinite(Number(pageRaw)) ? Number(pageRaw) : 0);
            await interaction.deferUpdate();
            const [config, member] = await Promise.all([
                guildConfigStore_1.guildConfigStore.get(interaction.guildId),
                interaction.guild.members.fetch(interaction.user.id)
            ]);
            await interaction.editReply(this.helpPayload(member, config, category || 'home', page));
            return true;
        }
        if (customId.startsWith('staffcase|') || customId.startsWith('staffback|') || customId.startsWith('staffrevoke|')) {
            return this.handleStaffLogInteraction(interaction);
        }
        if (customId.startsWith('nuke|'))
            return this.handleNukeInteraction(interaction);
        return this.handleGuildRolesInteraction(interaction);
    }
    async handleStaffLogInteraction(interaction) {
        const customId = String(interaction.customId ?? '');
        const parts = customId.split('|');
        const action = parts[0];
        const ownerId = parts[1];
        const moderatorId = parts[2];
        const caseId = action === 'staffrevoke' ? parts[3] : (interaction.values?.[0] ?? null);
        if (!ownerId || !moderatorId || !interaction.guildId || !interaction.guild)
            return true;
        if (interaction.user.id !== ownerId) {
            await interaction.reply({ content: 'Este painel de staff pertence a outro usuário.', flags: discord_js_1.MessageFlags.Ephemeral });
            return true;
        }
        await interaction.deferUpdate();
        const config = await guildConfigStore_1.guildConfigStore.get(interaction.guildId);
        const moderator = await interaction.guild.members.fetch(moderatorId).catch(() => null);
        if (!moderator) {
            await interaction.editReply({ embeds: [this.noticeEmbed('Staff não encontrado', 'Não consegui localizar esse membro no servidor.', 0xe74c3c)], components: [] });
            return true;
        }
        if (action === 'staffback') {
            await interaction.editReply(await this.staffLogPayload(ownerId, moderator, config, interaction.guild));
            return true;
        }
        const item = caseId ? config.moderation.cases.find(entry => entry.id === caseId && entry.moderatorId === moderatorId) : null;
        if (!item) {
            await interaction.editReply(await this.staffLogPayload(ownerId, moderator, config, interaction.guild));
            return true;
        }
        if (action === 'staffrevoke') {
            if (['ban', 'tempban'].includes(item.action)) {
                if (!interaction.member?.permissions?.has(discord_js_1.PermissionFlagsBits.BanMembers)) {
                    await interaction.followUp({ content: 'Você precisa da permissão Banir Membros para revogar este banimento.', flags: discord_js_1.MessageFlags.Ephemeral });
                    return true;
                }
                const ban = await interaction.guild.bans.fetch(item.targetId).catch(() => null);
                if (ban)
                    await interaction.guild.bans.remove(item.targetId, `Revogado por ${interaction.user.tag ?? interaction.user.id} via Staff Log`);
                config.moderation.temporaryBans = config.moderation.temporaryBans.filter(record => record.userId !== item.targetId);
                item.revokedAt = new Date().toISOString();
                item.revokedBy = interaction.user.id;
                this.appendModerationCase(config, 'unban', item.targetId, interaction.user.id, `Revogação de ${item.id} pelo Staff Log`, null);
            }
            else if (item.action === 'timeout') {
                if (!interaction.member?.permissions?.has(discord_js_1.PermissionFlagsBits.ModerateMembers)) {
                    await interaction.followUp({ content: 'Você precisa da permissão Moderar Membros para remover este timeout.', flags: discord_js_1.MessageFlags.Ephemeral });
                    return true;
                }
                const member = await interaction.guild.members.fetch(item.targetId).catch(() => null);
                if (member && Number(member.communicationDisabledUntilTimestamp ?? 0) > Date.now()) {
                    await member.timeout(null, `Revogado por ${interaction.user.tag ?? interaction.user.id} via Staff Log`);
                }
                item.revokedAt = new Date().toISOString();
                item.revokedBy = interaction.user.id;
                this.appendModerationCase(config, 'untimeout', item.targetId, interaction.user.id, `Revogação de ${item.id} pelo Staff Log`, null);
            }
            await guildConfigStore_1.guildConfigStore.set(interaction.guildId, config);
            await interaction.editReply(await this.staffCasePayload(ownerId, moderator, item, config, interaction.guild));
            return true;
        }
        await interaction.editReply(await this.staffCasePayload(ownerId, moderator, item, config, interaction.guild));
        return true;
    }
    async staffLogPayload(ownerId, moderator, config, guild) {
        const cases = config.moderation.cases.filter(item => item.moderatorId === moderator.id).slice().reverse();
        const warnings = config.moderation.warnings.filter(item => item.moderatorId === moderator.id);
        const bans = cases.filter(item => ['ban', 'tempban', 'softban'].includes(item.action));
        const timeouts = cases.filter(item => item.action === 'timeout');
        const kicks = cases.filter(item => item.action === 'kick');
        const reversals = cases.filter(item => ['unban', 'untimeout'].includes(item.action));
        const recent = cases.filter(item => ['ban', 'tempban', 'softban', 'timeout', 'kick', 'unban', 'untimeout'].includes(item.action)).slice(0, 25);
        let activeBans = 0;
        let activeTimeouts = 0;
        for (const item of recent.filter(entry => ['ban', 'tempban', 'timeout'].includes(entry.action) && !entry.revokedAt).slice(0, 12)) {
            if (await this.isModerationCaseActive(guild, item)) {
                if (item.action === 'timeout')
                    activeTimeouts++;
                else
                    activeBans++;
            }
        }
        const container = new discord_js_1.ContainerBuilder().setAccentColor(0x111111)
            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`## Staff Log\n**${escapeMarkdown(moderator.displayName)}** • <@${moderator.id}>\nAções registradas desta pessoa em **${escapeMarkdown(guild.name)}**.`))
            .addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small))
            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`**Resumo**\nBanimentos: **${bans.length}** • Timeouts: **${timeouts.length}** • Expulsões: **${kicks.length}** • Advertências: **${warnings.length}**\nAtivos entre os casos recentes: **${activeBans} ban(s)** • **${activeTimeouts} timeout(s)** • Revogações registradas: **${reversals.length}**`));
        if (recent.length) {
            const preview = await Promise.all(recent.slice(0, 8).map(async (item) => {
                const target = await guild.client.users.fetch(item.targetId).catch(() => null);
                const targetName = target?.tag ?? item.targetId;
                return `**${staffActionLabel(item.action)}** • ${escapeMarkdown(targetName)} • **${item.id}** • <t:${Math.floor(new Date(item.createdAt).getTime() / 1000)}:R>`;
            }));
            container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small));
            container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`**Últimas ações**\n${preview.join('\n')}`));
            const names = new Map();
            await Promise.all(recent.map(async (item) => {
                if (names.has(item.targetId))
                    return;
                const target = await guild.client.users.fetch(item.targetId).catch(() => null);
                names.set(item.targetId, target?.tag ?? item.targetId);
            }));
            const menu = new discord_js_1.StringSelectMenuBuilder()
                .setCustomId(`staffcase|${ownerId}|${moderator.id}`)
                .setPlaceholder('Abrir uma ação da staff')
                .setMinValues(1).setMaxValues(1)
                .addOptions(...recent.map(item => new discord_js_1.StringSelectMenuOptionBuilder()
                .setLabel(`${item.id} • ${staffActionLabel(item.action)}`.slice(0, 100))
                .setDescription(`${names.get(item.targetId) ?? item.targetId} • ${new Date(item.createdAt).toLocaleDateString('pt-BR')}`.slice(0, 100))
                .setValue(item.id).setEmoji(emojis_1.UI_EMOJIS.stafflog)));
            container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(menu));
        }
        else {
            container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('Nenhuma ação de moderação registrada para esta pessoa.'));
        }
        return { components: [container], flags: discord_js_1.MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
    }
    async staffCasePayload(ownerId, moderator, item, config, guild) {
        const active = await this.isModerationCaseActive(guild, item);
        const user = await guild.client.users.fetch(item.targetId).catch(() => null);
        const targetName = user?.tag ?? item.targetId;
        const source = item.source === 'discord' ? 'Discord / Audit Log' : 'Comando do bot';
        const state = item.revokedAt ? `Revogada <t:${Math.floor(new Date(item.revokedAt).getTime() / 1000)}:R>` : active ? 'Ativa agora' : 'Encerrada';
        const container = new discord_js_1.ContainerBuilder().setAccentColor(0x111111)
            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`## ${item.id}\n**${staffActionLabel(item.action)}** aplicada por <@${moderator.id}>`))
            .addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small))
            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`**Alvo**\n${escapeMarkdown(targetName)} • <@${item.targetId}> • \`${item.targetId}\`\n\n` +
            `**Motivo**\n${escapeMarkdown(item.reason || 'Sem motivo informado')}\n\n` +
            `**Data**\n<t:${Math.floor(new Date(item.createdAt).getTime() / 1000)}:F>\n\n` +
            `**Estado**\n${state}\n\n` +
            `**Origem**\n${source}${item.durationSeconds ? `\n\n**Duração registrada**\n${formatDuration(item.durationSeconds * 1000)}` : ''}`));
        const buttons = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`staffback|${ownerId}|${moderator.id}`).setLabel('Voltar ao histórico').setEmoji(emojis_1.UI_EMOJIS.home).setStyle(discord_js_1.ButtonStyle.Secondary));
        const revocable = active && !item.revokedAt && ['ban', 'tempban', 'timeout'].includes(item.action);
        if (revocable) {
            buttons.addComponents(new discord_js_1.ButtonBuilder().setCustomId(`staffrevoke|${ownerId}|${moderator.id}|${item.id}`).setLabel('Revogar punição').setEmoji(emojis_1.UI_EMOJIS.revoke).setStyle(discord_js_1.ButtonStyle.Danger));
        }
        container.addActionRowComponents(buttons);
        return { components: [container], flags: discord_js_1.MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
    }
    async syncModeratorAuditHistory(guild, moderatorId, config) {
        const me = guild.members?.me;
        if (me?.permissions?.has && !me.permissions.has(discord_js_1.PermissionFlagsBits.ViewAuditLog))
            return;
        const imported = [];
        const add = (action, entry, durationSeconds = null) => {
            const targetId = String(entry.targetId ?? entry.target?.id ?? '');
            const executorId = String(entry.executorId ?? entry.executor?.id ?? '');
            const createdTimestamp = Number(entry.createdTimestamp ?? Date.now());
            if (!targetId || executorId !== moderatorId)
                return;
            const duplicate = config.moderation.cases.some(item => item.action === action && item.targetId === targetId && item.moderatorId === moderatorId &&
                Math.abs(new Date(item.createdAt).getTime() - createdTimestamp) <= 5_000);
            if (duplicate)
                return;
            const number = config.moderation.nextCaseNumber++;
            imported.push({
                id: `CASE-${String(number).padStart(6, '0')}`,
                action, targetId, moderatorId,
                reason: String(entry.reason || (action === 'ban' ? 'Banimento registrado pelo Audit Log' : action === 'kick' ? 'Expulsão registrada pelo Audit Log' : action === 'timeout' ? 'Timeout registrado pelo Audit Log' : 'Revogação registrada pelo Audit Log')),
                durationSeconds,
                createdAt: new Date(createdTimestamp).toISOString(),
                revokedAt: null, revokedBy: null, source: 'discord'
            });
        };
        try {
            const [banLogs, unbanLogs, kickLogs, memberLogs] = await Promise.all([
                guild.fetchAuditLogs({ type: discord_js_1.AuditLogEvent.MemberBanAdd, limit: 100 }).catch(() => null),
                guild.fetchAuditLogs({ type: discord_js_1.AuditLogEvent.MemberBanRemove, limit: 100 }).catch(() => null),
                guild.fetchAuditLogs({ type: discord_js_1.AuditLogEvent.MemberKick, limit: 100 }).catch(() => null),
                guild.fetchAuditLogs({ type: discord_js_1.AuditLogEvent.MemberUpdate, limit: 100 }).catch(() => null)
            ]);
            for (const entry of [...(banLogs?.entries?.values?.() ?? [])])
                add('ban', entry);
            for (const entry of [...(kickLogs?.entries?.values?.() ?? [])])
                add('kick', entry);
            for (const entry of [...(unbanLogs?.entries?.values?.() ?? [])]) {
                const targetId = String(entry.targetId ?? entry.target?.id ?? '');
                const executorId = String(entry.executorId ?? entry.executor?.id ?? '');
                if (executorId !== moderatorId || !targetId)
                    continue;
                add('unban', entry);
                const revokedAtMs = Number(entry.createdTimestamp ?? Date.now());
                const original = [...config.moderation.cases, ...imported].filter(item => item.targetId === targetId && ['ban', 'tempban'].includes(item.action) && !item.revokedAt && Date.parse(item.createdAt) <= revokedAtMs).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
                if (original) {
                    original.revokedAt = new Date(revokedAtMs).toISOString();
                    original.revokedBy = moderatorId;
                }
            }
            for (const entry of [...(memberLogs?.entries?.values?.() ?? [])]) {
                const executorId = String(entry.executorId ?? entry.executor?.id ?? '');
                if (executorId !== moderatorId)
                    continue;
                const changes = Array.isArray(entry.changes) ? entry.changes : [];
                const timeoutChange = changes.find((change) => change?.key === 'communication_disabled_until');
                if (!timeoutChange)
                    continue;
                const targetId = String(entry.targetId ?? entry.target?.id ?? '');
                if (!targetId)
                    continue;
                if (timeoutChange.new) {
                    const until = Date.parse(String(timeoutChange.new));
                    const created = Number(entry.createdTimestamp ?? Date.now());
                    const duration = Number.isFinite(until) && until > created ? Math.max(1, Math.ceil((until - created) / 1000)) : null;
                    add('timeout', entry, duration);
                }
                else if (timeoutChange.old) {
                    add('untimeout', entry);
                    const revokedAtMs = Number(entry.createdTimestamp ?? Date.now());
                    const original = [...config.moderation.cases, ...imported].filter(item => item.targetId === targetId && item.action === 'timeout' && !item.revokedAt && Date.parse(item.createdAt) <= revokedAtMs).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
                    if (original) {
                        original.revokedAt = new Date(revokedAtMs).toISOString();
                        original.revokedBy = moderatorId;
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.debug('Não foi possível importar o histórico do Audit Log para o Staff Log.', { guildId: guild.id, moderatorId, error: String(error) });
        }
        if (imported.length) {
            config.moderation.cases.push(...imported);
            config.moderation.cases.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
            config.moderation.cases = config.moderation.cases.slice(-1000);
            await guildConfigStore_1.guildConfigStore.set(guild.id, config);
        }
    }
    async isModerationCaseActive(guild, item) {
        if (item.revokedAt)
            return false;
        if (['ban', 'tempban'].includes(item.action))
            return Boolean(await guild.bans.fetch(item.targetId).catch(() => null));
        if (item.action === 'timeout') {
            const member = await guild.members.fetch(item.targetId).catch(() => null);
            return Boolean(member && Number(member.communicationDisabledUntilTimestamp ?? 0) > Date.now());
        }
        return false;
    }
    appendModerationCase(config, action, targetId, moderatorId, reason, durationSeconds) {
        const number = config.moderation.nextCaseNumber++;
        const item = {
            id: `CASE-${String(number).padStart(6, '0')}`,
            action,
            targetId,
            moderatorId,
            reason,
            durationSeconds,
            createdAt: new Date().toISOString(),
            revokedAt: null,
            revokedBy: null,
            source: 'command'
        };
        config.moderation.cases.push(item);
        config.moderation.cases = config.moderation.cases.slice(-1000);
        return item;
    }
    async handleAfkActivity(message, config) {
        let changed = false;
        const current = config.community.afkUsers[message.author.id];
        const isAfkCommand = message.content.toLowerCase().startsWith(`${this.app.prefix}afk`) || message.content.toLowerCase().startsWith(`${this.app.prefix}ausente`);
        if (current && !isAfkCommand) {
            delete config.community.afkUsers[message.author.id];
            changed = true;
            await message.reply(`Seu modo AFK foi removido após ${formatDuration(Date.now() - new Date(current.since).getTime())}.`).catch(() => undefined);
            await (0, communityLogger_1.logCommunityEvent)({ guild: message.guild, config, event: 'afk_removed', module: 'community_afk', executorId: message.author.id, targetId: message.author.id, channelId: message.channelId, severity: 'info', details: { reason: current.reason } }).catch(() => undefined);
        }
        const notices = [];
        const mentionedUsers = message.mentions?.users?.values ? [...message.mentions.users.values()] : [];
        for (const user of mentionedUsers) {
            if (user.id === message.author.id)
                continue;
            const record = config.community.afkUsers[user.id];
            if (!record)
                continue;
            const elapsed = formatDuration(Date.now() - new Date(record.since).getTime());
            notices.push(`<@${user.id}> está AFK há ${elapsed}. Motivo: ${record.reason}`);
        }
        if (notices.length)
            await message.reply({ content: notices.slice(0, 5).join('\n'), allowedMentions: { parse: [] } }).catch(() => undefined);
        if (changed)
            await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
    }
    resolveCommand(usedName, config) {
        if (this.commands.has(usedName))
            return usedName;
        for (const [canonical, aliases] of Object.entries(config.commands.aliases)) {
            if (aliases.map(alias => alias.toLowerCase()).includes(usedName) && this.commands.has(canonical))
                return canonical;
        }
        return null;
    }
    canUseConfiguredCommand(member, channelId, permission) {
        if (!permission)
            return false;
        if (permission.allowedChannelIds.length && !permission.allowedChannelIds.includes(channelId))
            return false;
        if (!permission.allowedRoleIds.length && !permission.allowedUserIds.length)
            return true;
        if (permission.allowedUserIds.includes(member.id))
            return true;
        return member.roles.cache.some((role) => permission.allowedRoleIds.includes(role.id));
    }
    createCommands() {
        return [
            this.command('help', 'utility', 'Mostra a central de ajuda organizada por categorias.', 'help', async (m, _a, c) => m.channel.send(this.helpPayload(m.member, c, 'home', 0))),
            this.command('ping', 'utility', 'Mostra a latência do bot.', 'ping', async (m) => {
                const sent = await m.reply({ embeds: [this.noticeEmbed('Latência', 'Calculando a resposta do bot...', 0x5865f2)] });
                const messageLatency = Math.max(0, sent.createdTimestamp - m.createdTimestamp);
                await sent.edit({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: m.client.user.username, iconURL: m.client.user.displayAvatarURL() }).setTitle('Latência do bot').addFields({ name: 'Mensagem', value: `**${messageLatency} ms**`, inline: true }, { name: 'WebSocket', value: `**${Math.round(m.client.ws.ping)} ms**`, inline: true }).setColor(0x5865f2).setTimestamp()] });
            }),
            this.command('uptime', 'utility', 'Mostra há quanto tempo o bot está ligado.', 'uptime', async (m) => m.reply({ embeds: [new discord_js_1.EmbedBuilder()
                        .setAuthor({ name: m.client.user.username, iconURL: m.client.user.displayAvatarURL() })
                        .setTitle('Tempo de atividade').setDescription(`O bot está ligado há **${formatDuration(Date.now() - this.startedAt)}**.`)
                        .setColor(0x111111).setTimestamp()] })),
            this.command('avatar', 'information', 'Mostra o avatar de um usuário.', 'avatar [@usuário]', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                const url = member.user.displayAvatarURL({ size: 1024 });
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() }).setTitle(`Avatar de ${member.displayName}`).setImage(url).setColor(0x111111).setTimestamp()] });
            }),
            this.command('banner', 'information', 'Mostra o banner de um usuário, quando disponível.', 'banner [@usuário]', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                const user = await m.client.users.fetch(member.id, { force: true });
                const url = user.bannerURL({ size: 1024 });
                await m.reply({ embeds: [url ? new discord_js_1.EmbedBuilder().setAuthor({ name: user.username, iconURL: user.displayAvatarURL() }).setTitle(`Banner de ${member.displayName}`).setImage(url).setColor(0x111111).setTimestamp() : this.noticeEmbed('Banner indisponível', 'Esse usuário não possui um banner público.', 0xe67e22)] });
            }),
            this.command('userinfo', 'information', 'Mostra informações de um usuário.', 'userinfo [@usuário]', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                const roles = [...member.roles.cache.values()].filter((role) => role.id !== m.guild.id).sort((x, y) => y.position - x.position).slice(0, 12).map((role) => `<@&${role.id}>`).join(' ') || 'Nenhum cargo';
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() }).setTitle(`Informações de ${member.displayName}`).setThumbnail(member.user.displayAvatarURL({ size: 512 })).addFields({ name: 'Usuário', value: `${member}\n\`${member.id}\``, inline: true }, { name: 'Conta criada', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: true }, { name: 'Entrou no servidor', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'Desconhecido', inline: false }, { name: `Cargos (${Math.max(0, member.roles.cache.size - 1)})`, value: roles.slice(0, 1024), inline: false }).setColor(member.displayColor || 0x111111).setTimestamp()] });
            }),
            this.command('serverinfo', 'information', 'Mostra informações do servidor.', 'serverinfo', async (m) => {
                const owner = await m.guild.fetchOwner().catch(() => null);
                const embed = new discord_js_1.EmbedBuilder().setTitle(m.guild.name).setDescription(m.guild.description || 'Informações gerais do servidor.').addFields({ name: 'Servidor', value: `\`${m.guild.id}\``, inline: true }, { name: 'Proprietário', value: owner ? `${owner}\n\`${owner.id}\`` : `<@${m.guild.ownerId}>`, inline: true }, { name: 'Membros', value: `**${m.guild.memberCount}**`, inline: true }, { name: 'Canais', value: `**${m.guild.channels.cache.size}**`, inline: true }, { name: 'Cargos', value: `**${m.guild.roles.cache.size}**`, inline: true }, { name: 'Criado em', value: `<t:${Math.floor(m.guild.createdTimestamp / 1000)}:F>`, inline: false }).setColor(0x111111).setTimestamp();
                const icon = m.guild.iconURL({ size: 512 });
                if (icon)
                    embed.setThumbnail(icon);
                await m.reply({ embeds: [embed] });
            }),
            this.command('roleinfo', 'information', 'Mostra informações de um cargo.', 'roleinfo @cargo', async (m, a) => {
                const role = resolveRole(m, a[0]);
                const perms = this.rolePermissionSummary(role);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(role.name).setDescription(`${role}\n\`${role.id}\``).addFields({ name: 'Membros', value: String(role.members.size), inline: true }, { name: 'Posição', value: String(role.position), inline: true }, { name: 'Cor', value: role.hexColor, inline: true }, { name: 'Gerenciado', value: role.managed ? 'Sim' : 'Não', inline: true }, { name: 'Permissões principais', value: perms, inline: false }).setColor(role.color || 0x111111).setTimestamp()] });
            }),
            this.command('channelinfo', 'information', 'Mostra informações do canal atual ou marcado.', 'channelinfo [#canal]', async (m, a) => {
                const channel = resolveChannel(m, a[0]) ?? m.channel;
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Informações de #${channel.name ?? 'canal'}`).setDescription(`${channel}\n\`${channel.id}\``).addFields({ name: 'Tipo', value: channelTypeLabel(channel.type), inline: true }, { name: 'Categoria', value: channel.parent ? `${channel.parent}` : 'Nenhuma', inline: true }, { name: 'Criado em', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:F>`, inline: false }).setColor(0x111111).setTimestamp()] });
            }),
            this.command('botinfo', 'information', 'Mostra informações do bot.', 'botinfo', async (m) => {
                const user = m.client.user;
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() }).setTitle('Informações do bot').setThumbnail(user.displayAvatarURL({ size: 512 })).addFields({ name: 'Usuário', value: `${user}\n\`${user.id}\``, inline: true }, { name: 'Servidores', value: String(m.client.guilds.cache.size), inline: true }, { name: 'Latência', value: `${Math.round(m.client.ws.ping)} ms`, inline: true }, { name: 'Tempo ligado', value: formatDuration(Date.now() - this.startedAt), inline: true }, { name: 'Biblioteca', value: 'discord.js', inline: true }, { name: 'Prefixo', value: `\`${this.app.prefix}\``, inline: true }).setColor(0x5865f2).setTimestamp()] });
            }),
            this.command('icon', 'information', 'Mostra o ícone do servidor.', 'icon', async (m) => {
                const url = m.guild.iconURL({ size: 1024 });
                await m.reply({ embeds: [url ? new discord_js_1.EmbedBuilder().setTitle(`Ícone de ${m.guild.name}`).setImage(url).setColor(0x111111).setTimestamp() : this.noticeEmbed('Ícone indisponível', 'Este servidor não possui ícone.', 0xe67e22)] });
            }),
            this.command('permissions', 'information', 'Mostra as permissões principais de um usuário.', 'permissions [@usuário]', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                const entries = [['Administrador', discord_js_1.PermissionFlagsBits.Administrator, 'Controle total do servidor'], ['Gerenciar servidor', discord_js_1.PermissionFlagsBits.ManageGuild, 'Alterar configurações do servidor'], ['Gerenciar canais', discord_js_1.PermissionFlagsBits.ManageChannels, 'Criar, editar e excluir canais'], ['Gerenciar cargos', discord_js_1.PermissionFlagsBits.ManageRoles, 'Adicionar e editar cargos'], ['Gerenciar mensagens', discord_js_1.PermissionFlagsBits.ManageMessages, 'Apagar e fixar mensagens'], ['Banir membros', discord_js_1.PermissionFlagsBits.BanMembers, 'Banir e desbanir usuários'], ['Expulsar membros', discord_js_1.PermissionFlagsBits.KickMembers, 'Expulsar usuários'], ['Moderar membros', discord_js_1.PermissionFlagsBits.ModerateMembers, 'Aplicar timeouts']];
                const enabled = entries.filter(([, flag]) => member.permissions.has(flag));
                const description = enabled.length ? enabled.map(([name, , desc]) => `**${name}**\n${desc}`).join('\n\n') : 'Nenhuma permissão administrativa principal.';
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() }).setTitle(`Permissões de ${member.displayName}`).setDescription(description).setThumbnail(member.user.displayAvatarURL({ size: 256 })).setColor(member.displayColor || 0x111111).setTimestamp()] });
            }),
            this.command('membercount', 'information', 'Mostra membros, pessoas e bots do servidor.', 'membercount', async (m) => {
                await m.guild.members.fetch().catch(() => undefined);
                const humans = m.guild.members.cache.filter((member) => !member.user.bot).size;
                const bots = m.guild.members.cache.filter((member) => member.user.bot).size;
                const online = m.guild.members.cache.filter((member) => member.presence?.status && member.presence.status !== 'offline').size;
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: m.guild.name, iconURL: m.guild.iconURL({ size: 256 }) ?? undefined }).setTitle('Contagem de membros').addFields({ name: 'Total', value: `**${m.guild.memberCount}**`, inline: true }, { name: 'Pessoas', value: `**${humans}**`, inline: true }, { name: 'Bots', value: `**${bots}**`, inline: true }, { name: 'Online em cache', value: `**${online}**`, inline: true }).setColor(0x111111).setTimestamp()] });
            }),
            this.command('boostinfo', 'information', 'Mostra o nível, quantidade e membros que impulsionam o servidor.', 'boostinfo', async (m) => {
                await m.guild.members.fetch().catch(() => undefined);
                const boosters = [...m.guild.members.cache.values()].filter((member) => Boolean(member.premiumSince));
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: m.guild.name, iconURL: m.guild.iconURL({ size: 256 }) ?? undefined }).setTitle('Impulsos do servidor').addFields({ name: 'Nível', value: `**${m.guild.premiumTier}**`, inline: true }, { name: 'Impulsos', value: `**${m.guild.premiumSubscriptionCount ?? 0}**`, inline: true }, { name: 'Boosters', value: boosters.length ? boosters.slice(0, 20).map((member) => `${member}`).join(', ').slice(0, 1024) : 'Nenhum booster em cache.', inline: false }).setColor(0xf47fff).setTimestamp()] });
            }),
            this.command('inviteinfo', 'information', 'Mostra informações de um convite do Discord.', 'inviteinfo código ou link', async (m, a) => {
                const code = extractInviteCode(a[0]);
                if (!code)
                    throw new Error('Informe um código ou link de convite');
                const invite = await m.client.fetchInvite(code);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Convite ${invite.code}`).addFields({ name: 'Servidor', value: invite.guild ? `${invite.guild.name}\n\`${invite.guild.id}\`` : 'Desconhecido', inline: true }, { name: 'Canal', value: invite.channel ? `${invite.channel.name ?? 'Canal'}\n\`${invite.channel.id}\`` : 'Desconhecido', inline: true }, { name: 'Criador', value: invite.inviter ? `${invite.inviter}\n\`${invite.inviter.id}\`` : 'Desconhecido', inline: true }, { name: 'Usos', value: String(invite.uses ?? 'Desconhecido'), inline: true }, { name: 'Membros aproximados', value: String(invite.memberCount ?? 'Desconhecido'), inline: true }, { name: 'Expiração', value: invite.expiresTimestamp ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>` : 'Não expira', inline: true }).setColor(0x5865f2).setTimestamp()] });
            }),
            this.command('joined', 'information', 'Mostra quando um membro entrou no servidor.', 'joined [@usuário]', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() }).setTitle('Entrada no servidor').setDescription(member.joinedTimestamp ? `${member} entrou em <t:${Math.floor(member.joinedTimestamp / 1000)}:F>\nHá <t:${Math.floor(member.joinedTimestamp / 1000)}:R>.` : 'Data de entrada indisponível.').setThumbnail(member.user.displayAvatarURL({ size: 256 })).setColor(member.displayColor || 0x111111).setTimestamp()] });
            }),
            this.command('created', 'information', 'Mostra quando uma conta foi criada.', 'created [@usuário]', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() }).setTitle('Criação da conta').setDescription(`${member} criou a conta em <t:${Math.floor(member.user.createdTimestamp / 1000)}:F>\nHá <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>.`).setThumbnail(member.user.displayAvatarURL({ size: 256 })).setColor(member.displayColor || 0x111111).setTimestamp()] });
            }),
            this.command('mutualroles', 'information', 'Mostra cargos em comum entre dois membros.', 'mutualroles @usuário @usuário', async (m, a) => {
                const ids = [...new Set((m.mentions?.users ? [...m.mentions.users.keys()] : []))];
                const first = await m.guild.members.fetch(ids[0] ?? m.author.id);
                const secondId = ids[1] ?? (ids[0] && ids[0] !== m.author.id ? m.author.id : null);
                if (!secondId)
                    throw new Error('Mencione pelo menos uma pessoa');
                const second = await m.guild.members.fetch(secondId);
                const roles = [...first.roles.cache.values()].filter((role) => role.id !== m.guild.id && second.roles.cache.has(role.id)).sort((x, y) => y.position - x.position);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Cargos em comum').setDescription(`${first} e ${second} possuem **${roles.length}** cargo(s) em comum.\n\n${roles.length ? roles.map((role) => `${role}`).join(' ').slice(0, 3500) : 'Nenhum cargo em comum.'}`).setColor(0x111111).setTimestamp()] });
            }),
            this.command('invitecount', 'information', 'Mostra quantas entradas foram atribuídas aos convites de um membro.', 'invitecount [@usuário]', async (m, a, c) => {
                const member = await resolveMember(m, a[0]);
                const total = c.community.inviteJoins[member.id] ?? 0;
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() }).setTitle('Convites registrados').setDescription(`${member} possui **${total}** entrada(s) atribuída(s) desde que o módulo começou a acompanhar os convites.`).setColor(0x5865f2).setTimestamp()] });
            }),
            this.command('topvoice', 'information', 'Mostra o ranking de tempo em canais de voz.', 'topvoice', async (m, _a, c) => {
                const top = this.activity.topVoice(c, 10);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: m.guild.name, iconURL: m.guild.iconURL({ size: 256 }) ?? undefined }).setTitle('Ranking de voz').setDescription(top.length ? top.map((item, index) => `**${index + 1}.** <@${item.userId}> — **${(0, activityService_1.formatVoiceTime)(item.seconds)}**`).join('\n') : 'Ainda não há atividade de voz registrada.').setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('activity', 'information', 'Mostra a atividade registrada de um membro.', 'activity [@usuário]', async (m, a, c) => {
                const member = await resolveMember(m, a[0]);
                const voice = this.activity.getVoiceSeconds(c, member.id);
                const cases = c.moderation.cases.filter(item => item.targetId === member.id).length;
                const warnings = c.moderation.warnings.filter(item => item.userId === member.id && !item.removedAt).length;
                const invites = c.community.inviteJoins[member.id] ?? 0;
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() }).setTitle(`Atividade de ${member.displayName}`).setThumbnail(member.user.displayAvatarURL({ size: 256 })).addFields({ name: 'Tempo em voz', value: (0, activityService_1.formatVoiceTime)(voice), inline: true }, { name: 'Convites registrados', value: String(invites), inline: true }, { name: 'Casos de moderação', value: String(cases), inline: true }, { name: 'Advertências ativas', value: String(warnings), inline: true }, { name: 'Entrou', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Desconhecido', inline: true }).setColor(member.displayColor || 0x111111).setTimestamp()] });
            }),
            this.command('ban', 'moderation', 'Bane um membro, envia aviso por DM e registra um caso.', 'ban @usuário [motivo]', discord_js_1.PermissionFlagsBits.BanMembers, async (m, a, c) => {
                const member = await resolveMember(m, a.shift());
                this.ensureTargetHierarchy(m, member, 'ban');
                const reason = a.join(' ') || 'Sem motivo informado';
                const targetUser = member.user;
                await member.ban({ reason });
                const item = await this.createCase(m, c, 'ban', member.id, reason, null);
                await this.sendModerationNotification(m, targetUser, 'ban', reason, item, null);
                await this.logModeration(m, c, 'member_ban', member.id, { reason, caseId: item.id });
            }),
            this.command('softban', 'moderation', 'Bane e desbane imediatamente para remover mensagens recentes.', 'softban @usuário [motivo]', discord_js_1.PermissionFlagsBits.BanMembers, async (m, a, c) => {
                const member = await resolveMember(m, a.shift());
                this.ensureTargetHierarchy(m, member, 'ban');
                const reason = a.join(' ') || 'Softban aplicado pela moderação';
                const targetUser = member.user;
                await targetUser.send({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: m.guild.name, iconURL: m.guild.iconURL({ size: 256 }) ?? undefined }).setTitle('Softban aplicado').setDescription(`Você recebeu um softban em **${m.guild.name}**.\nMotivo: ${reason}`).setColor(0xe67e22).setTimestamp()] }).catch(() => undefined);
                await member.ban({ deleteMessageSeconds: 7 * 86400, reason });
                await m.guild.bans.remove(member.id, `Softban concluído | ${reason}`);
                const item = await this.createCase(m, c, 'softban', member.id, reason, null);
                await this.replyTemporary(m, { embeds: [new discord_js_1.EmbedBuilder().setTitle('Softban concluído').setDescription(`${targetUser} teve mensagens recentes removidas e não permaneceu banido.\nCaso: **${item.id}**`).setThumbnail(targetUser.displayAvatarURL({ size: 256 })).setColor(0xe67e22).setTimestamp()] }, 10_000);
                await this.logModeration(m, c, 'member_ban', member.id, { reason, caseId: item.id, softban: true });
            }),
            this.command('tempban', 'moderation', 'Bane um usuário temporariamente e remove o banimento ao expirar.', 'tempban @usuário duração [motivo]', discord_js_1.PermissionFlagsBits.BanMembers, async (m, a, c) => {
                const member = await resolveMember(m, a.shift());
                this.ensureTargetHierarchy(m, member, 'ban');
                const duration = parseDuration(a.shift() ?? '');
                if (duration === null)
                    throw new Error('Duração inválida; use 10m, 1h, 1d ou 1w');
                const reason = a.join(' ') || 'Banimento temporário';
                const targetUser = member.user;
                const item = await this.createCase(m, c, 'tempban', member.id, reason, duration);
                await this.sendModerationNotification(m, targetUser, 'ban', reason, item, duration);
                await member.ban({ reason: `${reason} | expira em ${new Date(Date.now() + duration * 1000).toISOString()}` });
                c.moderation.temporaryBans.push({ userId: member.id, moderatorId: m.author.id, reason, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + duration * 1000).toISOString() });
                c.moderation.temporaryBans = c.moderation.temporaryBans.slice(-1000);
                await this.logModeration(m, c, 'member_ban', member.id, { reason, caseId: item.id, durationSeconds: duration, temporary: true });
            }),
            this.command('unban', 'moderation', 'Remove um banimento e registra um caso.', 'unban ID [motivo]', discord_js_1.PermissionFlagsBits.BanMembers, async (m, a, c) => {
                const id = extractId(a.shift());
                if (!id)
                    throw new Error('Informe o ID do usuário banido');
                const reason = a.join(' ') || 'Sem motivo informado';
                const user = await m.guild.bans.remove(id, reason);
                c.moderation.temporaryBans = c.moderation.temporaryBans.filter(record => record.userId !== id);
                const original = [...c.moderation.cases].reverse().find(item => item.targetId === id && ['ban', 'tempban'].includes(item.action) && !item.revokedAt);
                if (original) {
                    original.revokedAt = new Date().toISOString();
                    original.revokedBy = m.author.id;
                }
                const item = await this.createCase(m, c, 'unban', id, reason, null);
                await this.sendModerationNotification(m, user, 'unban', reason, item, null);
                await this.logModeration(m, c, 'member_unban', id, { reason, caseId: item.id });
            }),
            this.command('kick', 'moderation', 'Expulsa um membro, envia aviso por DM e registra um caso.', 'kick @usuário [motivo]', discord_js_1.PermissionFlagsBits.KickMembers, async (m, a, c) => {
                const member = await resolveMember(m, a.shift());
                this.ensureTargetHierarchy(m, member, 'kick');
                const reason = a.join(' ') || 'Sem motivo informado';
                const targetUser = member.user;
                await member.kick(reason);
                const item = await this.createCase(m, c, 'kick', member.id, reason, null);
                await this.sendModerationNotification(m, targetUser, 'kick', reason, item, null);
                await this.logModeration(m, c, 'member_kick', member.id, { reason, caseId: item.id });
            }),
            this.command('mute', 'moderation', 'Aplica timeout em um membro.', 'mute @usuário [duração] [motivo]', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => this.timeoutCommand(m, a, c, 'timeout_add')),
            this.command('timeout', 'moderation', 'Aplica timeout em um membro.', 'timeout @usuário [duração] [motivo]', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => this.timeoutCommand(m, a, c, 'timeout_add')),
            this.command('unmute', 'moderation', 'Remove o timeout de um membro.', 'unmute @usuário [motivo]', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => this.removeTimeoutCommand(m, a, c)),
            this.command('untimeout', 'moderation', 'Remove o timeout de um membro.', 'untimeout @usuário [motivo]', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => this.removeTimeoutCommand(m, a, c)),
            this.command('warn', 'moderation', 'Registra uma advertência.', 'warn @usuário motivo', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => { const member = await resolveMember(m, a.shift()); const reason = a.join(' ') || 'Sem motivo informado'; const warning = { id: `WARN-${(0, ids_1.randomId)(6)}`, userId: member.id, moderatorId: m.author.id, reason, createdAt: new Date().toISOString(), removedAt: null, removedBy: null }; c.moderation.warnings.push(warning); c.moderation.warnings = c.moderation.warnings.slice(-1000); await guildConfigStore_1.guildConfigStore.set(m.guild.id, c); const active = c.moderation.warnings.filter(w => w.userId === member.id && !w.removedAt).length; await this.replyTemporary(m, { embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() }).setTitle('Advertência aplicada').setDescription(`${member} recebeu uma advertência.`).addFields({ name: 'ID', value: `\`${warning.id}\``, inline: true }, { name: 'Advertências ativas', value: `**${active}**`, inline: true }, { name: 'Motivo', value: reason.slice(0, 1024), inline: false }, { name: 'Responsável', value: `${m.author}`, inline: true }).setColor(0xe67e22).setTimestamp()], allowedMentions: { parse: [] } }); await this.logModeration(m, c, 'member_warn', member.id, { warningId: warning.id, reason }); }),
            this.command('warnings', 'moderation', 'Lista advertências ativas.', 'warnings [@usuário]', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => { const member = await resolveMember(m, a[0]); const list = c.moderation.warnings.filter(w => w.userId === member.id && !w.removedAt).slice(-15).reverse(); const description = list.length ? list.map((w, index) => `**${index + 1}. ${w.id}**\n${escapeMarkdown(w.reason).slice(0, 250)}\nResponsável: <@${w.moderatorId}> • <t:${Math.floor(Date.parse(w.createdAt) / 1000)}:R>`).join('\n\n') : 'Nenhuma advertência ativa.'; await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() }).setTitle(`Advertências de ${member.displayName}`).setDescription(description.slice(0, 4096)).setThumbnail(member.user.displayAvatarURL({ size: 256 })).setFooter({ text: `Ativas: ${list.length}` }).setColor(list.length ? 0xe67e22 : 0x2ecc71).setTimestamp()], allowedMentions: { parse: [] } }); }),
            this.command('unwarn', 'moderation', 'Remove uma advertência pelo ID.', 'unwarn ID', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => { const warning = c.moderation.warnings.find(w => w.id.toLowerCase() === String(a[0] ?? '').toLowerCase() && !w.removedAt); if (!warning)
                throw new Error('Advertência não encontrada'); warning.removedAt = new Date().toISOString(); warning.removedBy = m.author.id; await guildConfigStore_1.guildConfigStore.set(m.guild.id, c); await this.replyTemporary(m, { embeds: [new discord_js_1.EmbedBuilder().setTitle('Advertência removida').setDescription(`A advertência **${warning.id}** foi encerrada.`).addFields({ name: 'Usuário', value: `<@${warning.userId}>`, inline: true }, { name: 'Responsável pela remoção', value: `${m.author}`, inline: true }, { name: 'Motivo original', value: warning.reason.slice(0, 1024), inline: false }).setColor(0x2ecc71).setTimestamp()], allowedMentions: { parse: [] } }); await this.logModeration(m, c, 'warning_remove', warning.userId, { warningId: warning.id }); }),
            this.command('history', 'moderation', 'Mostra punições e advertências registradas de um membro.', 'history @usuário', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => {
                const member = await resolveMember(m, a[0]);
                const cases = c.moderation.cases.filter(item => item.targetId === member.id).slice(-12).reverse();
                const warnings = c.moderation.warnings.filter(item => item.userId === member.id).slice(-8).reverse();
                const embed = new discord_js_1.EmbedBuilder().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() }).setTitle(`Histórico de ${member.displayName}`).setThumbnail(member.user.displayAvatarURL({ size: 256 })).setColor(member.displayColor || 0x111111).setTimestamp();
                embed.addFields({ name: `Casos (${cases.length})`, value: cases.length ? cases.map(formatCaseLine).join('\n').slice(0, 1024) : 'Nenhum caso registrado.' }, { name: `Advertências (${warnings.length})`, value: warnings.length ? warnings.map(item => `**${item.id}** — ${item.reason} — ${item.removedAt ? 'removida' : 'ativa'}`).join('\n').slice(0, 1024) : 'Nenhuma advertência registrada.' });
                await m.reply({ embeds: [embed], allowedMentions: { parse: [] } });
            }),
            this.command('stafflog', 'moderation', 'Abre o histórico de ações de uma pessoa da staff.', 'stafflog @staff', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => {
                const moderator = await resolveMember(m, a[0]);
                await this.syncModeratorAuditHistory(m.guild, moderator.id, c);
                await m.reply(await this.staffLogPayload(m.author.id, moderator, c, m.guild));
            }),
            this.command('staffstats', 'moderation', 'Mostra um resumo das ações registradas de uma pessoa da staff.', 'staffstats [@staff]', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => {
                const moderator = await resolveMember(m, a[0]);
                const cases = c.moderation.cases.filter(item => item.moderatorId === moderator.id);
                const warnings = c.moderation.warnings.filter(item => item.moderatorId === moderator.id);
                const count = (...actions) => cases.filter(item => actions.includes(item.action)).length;
                const embed = new discord_js_1.EmbedBuilder().setAuthor({ name: moderator.user.tag, iconURL: moderator.user.displayAvatarURL() }).setTitle(`Atividade da staff: ${moderator.displayName}`).addFields({ name: 'Banimentos', value: String(count('ban', 'tempban', 'softban')), inline: true }, { name: 'Timeouts', value: String(count('timeout')), inline: true }, { name: 'Expulsões', value: String(count('kick')), inline: true }, { name: 'Advertências', value: String(warnings.length), inline: true }, { name: 'Revogações', value: String(count('unban', 'untimeout')), inline: true }, { name: 'Total de casos', value: String(cases.length), inline: true }).setColor(moderator.displayColor || 0x111111).setTimestamp();
                await m.reply({ embeds: [embed], allowedMentions: { parse: [] } });
            }),
            this.command('modtop', 'moderation', 'Mostra a equipe com mais ações de moderação registradas.', 'modtop', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, _a, c) => {
                const counts = new Map();
                for (const item of c.moderation.cases) {
                    if (!['ban', 'tempban', 'softban', 'timeout', 'kick'].includes(item.action))
                        continue;
                    counts.set(item.moderatorId, (counts.get(item.moderatorId) ?? 0) + 1);
                }
                for (const warning of c.moderation.warnings)
                    counts.set(warning.moderatorId, (counts.get(warning.moderatorId) ?? 0) + 1);
                const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Atividade da equipe').setDescription(top.length ? top.map(([id, total], index) => `**${index + 1}.** <@${id}> — **${total}** ação(ões)`).join('\n') : 'Ainda não há ações de moderação registradas.').setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('activepunishments', 'moderation', 'Lista banimentos e timeouts ativos entre os casos recentes.', 'activepunishments', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, _a, c) => {
                const recent = c.moderation.cases.filter(item => ['ban', 'tempban', 'timeout'].includes(item.action) && !item.revokedAt).slice(-60).reverse();
                const active = [];
                for (const item of recent) {
                    if (active.length >= 15)
                        break;
                    if (await this.isModerationCaseActive(m.guild, item))
                        active.push(item);
                }
                const lines = active.map(item => `**${item.id}** — ${staffActionLabel(item.action)} — <@${item.targetId}> — por <@${item.moderatorId}>`);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Punições ativas').setDescription(lines.length ? lines.join('\n') : 'Nenhum banimento ou timeout ativo encontrado entre os casos recentes.').setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('reason', 'moderation', 'Altera o motivo de um caso de moderação.', 'reason CASE-000001 novo motivo', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => {
                const caseId = String(a.shift() ?? '').toUpperCase();
                const reason = a.join(' ').trim();
                if (!reason)
                    throw new Error('Informe o novo motivo');
                const item = c.moderation.cases.find(entry => entry.id.toUpperCase() === caseId);
                if (!item)
                    throw new Error('Caso de moderação não encontrado');
                const previous = item.reason;
                item.reason = reason.slice(0, 1000);
                await guildConfigStore_1.guildConfigStore.set(m.guild.id, c);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Motivo atualizado').setDescription(`Caso: **${item.id}**\nAnterior: ${previous}\nNovo: ${item.reason}`).setColor(0x2ecc71).setTimestamp()] });
            }),
            this.command('clear', 'moderation', 'Apaga uma quantidade de mensagens recentes.', 'clear quantidade', discord_js_1.PermissionFlagsBits.ManageMessages, async (m, a, c) => { const amount = Math.min(100, Math.max(1, Number(a[0] ?? 0))); if (!Number.isFinite(amount))
                throw new Error('Quantidade inválida'); const deleted = await m.channel.bulkDelete(amount, true); await this.replyTemporary(m, { embeds: [new discord_js_1.EmbedBuilder().setTitle('Limpeza concluída').setDescription(`Foram removidas **${deleted.size}** mensagem(ns) de ${m.channel}.`).addFields({ name: 'Solicitado', value: String(amount), inline: true }, { name: 'Removido', value: String(deleted.size), inline: true }, { name: 'Responsável', value: `${m.author}`, inline: true }).setColor(0x2ecc71).setTimestamp()], allowedMentions: { parse: [] } }); await this.logModeration(m, c, 'message_clear', null, { amount: deleted.size }); }),
            this.command('purgeuser', 'moderation', 'Apaga mensagens recentes de um usuário específico.', 'purgeuser @usuário [quantidade]', discord_js_1.PermissionFlagsBits.ManageMessages, async (m, a, c) => {
                const userId = extractId(a.shift());
                if (!userId)
                    throw new Error('Mencione o usuário');
                const amount = normalizePurgeAmount(a[0]);
                const deleted = await this.purgeMessages(m, amount, (msg) => msg.author?.id === userId);
                await this.replyTemporary(m, { embeds: [this.noticeEmbed('Limpeza concluída', `${deleted} mensagem(ns) de <@${userId}> removida(s).`, 0x2ecc71)], allowedMentions: { parse: [] } });
                await this.logModeration(m, c, 'message_clear', userId, { amount: deleted, filter: 'user' });
            }),
            this.command('purgebots', 'moderation', 'Apaga mensagens recentes enviadas por bots.', 'purgebots [quantidade]', discord_js_1.PermissionFlagsBits.ManageMessages, async (m, a, c) => {
                const amount = normalizePurgeAmount(a[0]);
                const deleted = await this.purgeMessages(m, amount, (msg) => Boolean(msg.author?.bot));
                await this.replyTemporary(m, { embeds: [this.noticeEmbed('Limpeza concluída', `${deleted} mensagem(ns) de bots removida(s).`, 0x2ecc71)] });
                await this.logModeration(m, c, 'message_clear', null, { amount: deleted, filter: 'bots' });
            }),
            this.command('purgelinks', 'moderation', 'Apaga mensagens recentes que contêm links.', 'purgelinks [quantidade]', discord_js_1.PermissionFlagsBits.ManageMessages, async (m, a, c) => {
                const amount = normalizePurgeAmount(a[0]);
                const deleted = await this.purgeMessages(m, amount, (msg) => /(?:https?:\/\/|www\.|discord\.gg\/)/i.test(msg.content ?? ''));
                await this.replyTemporary(m, { embeds: [this.noticeEmbed('Limpeza concluída', `${deleted} mensagem(ns) com links removida(s).`, 0x2ecc71)] });
                await this.logModeration(m, c, 'message_clear', null, { amount: deleted, filter: 'links' });
            }),
            this.command('purgeattachments', 'moderation', 'Apaga mensagens recentes que possuem arquivos.', 'purgeattachments [quantidade]', discord_js_1.PermissionFlagsBits.ManageMessages, async (m, a, c) => {
                const amount = normalizePurgeAmount(a[0]);
                const deleted = await this.purgeMessages(m, amount, (msg) => (msg.attachments?.size ?? 0) > 0);
                await this.replyTemporary(m, { embeds: [this.noticeEmbed('Limpeza concluída', `${deleted} mensagem(ns) com anexos removida(s).`, 0x2ecc71)] });
                await this.logModeration(m, c, 'message_clear', null, { amount: deleted, filter: 'attachments' });
            }),
            this.command('purgementions', 'moderation', 'Apaga mensagens recentes que possuem menções.', 'purgementions [quantidade]', discord_js_1.PermissionFlagsBits.ManageMessages, async (m, a, c) => {
                const amount = normalizePurgeAmount(a[0]);
                const deleted = await this.purgeMessages(m, amount, (msg) => (msg.mentions?.users?.size ?? 0) > 0 || (msg.mentions?.roles?.size ?? 0) > 0 || Boolean(msg.mentions?.everyone));
                await this.replyTemporary(m, { embeds: [this.noticeEmbed('Limpeza concluída', `${deleted} mensagem(ns) com menções removida(s).`, 0x2ecc71)] });
                await this.logModeration(m, c, 'message_clear', null, { amount: deleted, filter: 'mentions' });
            }),
            this.command('purgecontains', 'moderation', 'Apaga mensagens recentes que contêm uma palavra ou frase.', 'purgecontains texto | [quantidade]', discord_js_1.PermissionFlagsBits.ManageMessages, async (m, a, c) => {
                const input = a.join(' ').trim();
                if (!input)
                    throw new Error('Informe o texto que deve ser encontrado');
                const [needleRaw, countRaw] = input.split('|').map((value) => value.trim());
                const needle = needleRaw?.toLowerCase();
                if (!needle)
                    throw new Error('Informe o texto que deve ser encontrado');
                const amount = normalizePurgeAmount(countRaw);
                const deleted = await this.purgeMessages(m, amount, (msg) => String(msg.content ?? '').toLowerCase().includes(needle));
                await this.replyTemporary(m, { embeds: [this.noticeEmbed('Limpeza concluída', `${deleted} mensagem(ns) contendo **${escapeMarkdown(needle).slice(0, 100)}** removida(s).`, 0x2ecc71)] });
                await this.logModeration(m, c, 'message_clear', null, { amount: deleted, filter: 'contains' });
            }),
            this.command('cl', 'moderation', 'Limpa suas mensagens ou, com autorização, as mensagens do usuário mencionado.', 'cl [@usuário]', async () => undefined),
            this.command('lock', 'moderation', 'Bloqueia mensagens no canal atual.', 'lock', discord_js_1.PermissionFlagsBits.ManageChannels, async (m, _a, c) => { await m.channel.permissionOverwrites.edit(m.guild.roles.everyone, { SendMessages: false }, { reason: `Canal bloqueado por ${m.author.tag}` }); await this.replyTemporary(m, { embeds: [new discord_js_1.EmbedBuilder().setTitle('Canal bloqueado').setDescription(`${m.channel} não aceita novas mensagens de @everyone.`).addFields({ name: 'Responsável', value: `${m.author}`, inline: true }, { name: 'Canal', value: `\`${m.channel.id}\``, inline: true }).setColor(0xe67e22).setTimestamp()], allowedMentions: { parse: [] } }); await this.logModeration(m, c, 'channel_lock', m.channel.id, {}); }),
            this.command('unlock', 'moderation', 'Desbloqueia mensagens no canal atual.', 'unlock', discord_js_1.PermissionFlagsBits.ManageChannels, async (m, _a, c) => { await m.channel.permissionOverwrites.edit(m.guild.roles.everyone, { SendMessages: null }, { reason: `Canal desbloqueado por ${m.author.tag}` }); await this.replyTemporary(m, { embeds: [new discord_js_1.EmbedBuilder().setTitle('Canal liberado').setDescription(`${m.channel} voltou a usar as permissões normais de envio de mensagens.`).addFields({ name: 'Responsável', value: `${m.author}`, inline: true }, { name: 'Canal', value: `\`${m.channel.id}\``, inline: true }).setColor(0x2ecc71).setTimestamp()], allowedMentions: { parse: [] } }); await this.logModeration(m, c, 'channel_unlock', m.channel.id, {}); }),
            this.command('nuke', 'moderation', 'Recria o canal atual após confirmação, preservando nome, categoria e permissões.', 'nuke', discord_js_1.PermissionFlagsBits.ManageChannels, async (m, _a, c) => this.requestChannelNuke(m, c)),
            this.command('slowmode', 'moderation', 'Altera o modo lento do canal.', 'slowmode segundos', discord_js_1.PermissionFlagsBits.ManageChannels, async (m, a, c) => { const seconds = Math.min(21600, Math.max(0, Number(a[0] ?? 0))); if (!Number.isFinite(seconds) || typeof m.channel.setRateLimitPerUser !== 'function')
                throw new Error('Valor ou canal inválido'); await m.channel.setRateLimitPerUser(seconds, `Alterado por ${m.author.tag}`); await this.replyTemporary(m, { embeds: [new discord_js_1.EmbedBuilder().setTitle('Modo lento atualizado').setDescription(seconds ? `Agora é necessário aguardar **${formatDuration(seconds * 1000)}** entre mensagens em ${m.channel}.` : `O modo lento foi **desativado** em ${m.channel}.`).addFields({ name: 'Responsável', value: `${m.author}`, inline: true }).setColor(seconds ? 0x5865f2 : 0x2ecc71).setTimestamp()], allowedMentions: { parse: [] } }); await this.logModeration(m, c, 'slowmode_update', m.channel.id, { seconds }); }),
            this.command('nick', 'moderation', 'Altera o apelido de um membro.', 'nick @usuário novo apelido', discord_js_1.PermissionFlagsBits.ManageNicknames, async (m, a, c) => { const member = await resolveMember(m, a.shift()); const previous = member.displayName; const nick = a.join(' ').trim() || null; await member.setNickname(nick, `Alterado por ${m.author.tag}`); await this.replyTemporary(m, { embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() }).setTitle('Apelido atualizado').addFields({ name: 'Antes', value: escapeMarkdown(previous).slice(0, 1024), inline: true }, { name: 'Agora', value: escapeMarkdown(nick ?? member.user.globalName ?? member.user.username).slice(0, 1024), inline: true }, { name: 'Responsável', value: `${m.author}`, inline: false }).setColor(0x2ecc71).setTimestamp()] }); await this.logModeration(m, c, 'nickname_update', member.id, { nickname: nick }); }),
            this.command('addrole', 'moderation', 'Adiciona um cargo a um membro.', 'addrole @usuário @cargo', discord_js_1.PermissionFlagsBits.ManageRoles, async (m, a, c) => { const member = await resolveMember(m, a.shift()); const role = resolveRole(m, a.shift()); this.ensureRoleManageable(m, member, role); if (member.roles.cache.has(role.id))
                throw new Error('Esse membro já possui o cargo informado'); await member.roles.add(role, `Adicionado por ${m.author.tag}`); await this.replyTemporary(m, { embeds: [new discord_js_1.EmbedBuilder().setTitle('Cargo adicionado').setDescription(`${role} foi adicionado a ${member}.`).addFields({ name: 'Membro', value: `\`${member.id}\``, inline: true }, { name: 'Cargo', value: `\`${role.id}\``, inline: true }, { name: 'Responsável', value: `${m.author}`, inline: true }).setColor(role.color || 0x2ecc71).setTimestamp()], allowedMentions: { parse: [] } }); await this.logModeration(m, c, 'member_role_add', member.id, { roleId: role.id }); }),
            this.command('removerole', 'moderation', 'Remove um cargo de um membro.', 'removerole @usuário @cargo', discord_js_1.PermissionFlagsBits.ManageRoles, async (m, a, c) => { const member = await resolveMember(m, a.shift()); const role = resolveRole(m, a.shift()); this.ensureRoleManageable(m, member, role); if (!member.roles.cache.has(role.id))
                throw new Error('Esse membro não possui o cargo informado'); await member.roles.remove(role, `Removido por ${m.author.tag}`); await this.replyTemporary(m, { embeds: [new discord_js_1.EmbedBuilder().setTitle('Cargo removido').setDescription(`${role} foi removido de ${member}.`).addFields({ name: 'Membro', value: `\`${member.id}\``, inline: true }, { name: 'Cargo', value: `\`${role.id}\``, inline: true }, { name: 'Responsável', value: `${m.author}`, inline: true }).setColor(0xe67e22).setTimestamp()], allowedMentions: { parse: [] } }); await this.logModeration(m, c, 'member_role_remove', member.id, { roleId: role.id }); }),
            this.command('groles', 'moderation', 'Abre um painel para adicionar ou remover apenas cargos abaixo de você.', 'groles @usuário', discord_js_1.PermissionFlagsBits.ManageRoles, async (m, a, c) => this.openGuildRoles(m, a, c)),
            this.command('voicemute', 'moderation', 'Silencia um membro conectado em voz.', 'voicemute @usuário', discord_js_1.PermissionFlagsBits.MuteMembers, async (m, a, c) => {
                const member = await resolveMember(m, a[0]);
                if (!member.voice.channelId)
                    throw new Error('O membro não está em um canal de voz');
                await member.voice.setMute(true, `Silenciado por ${m.author.tag}`);
                await this.replyTemporary(m, { embeds: [this.noticeEmbed('Voz silenciada', `${member} foi silenciado no servidor.`, 0xe67e22)], allowedMentions: { users: [member.id] } });
                await this.logModeration(m, c, 'voice_mute', member.id, {});
            }),
            this.command('voiceunmute', 'moderation', 'Remove o silêncio de voz aplicado pelo servidor.', 'voiceunmute @usuário', discord_js_1.PermissionFlagsBits.MuteMembers, async (m, a, c) => {
                const member = await resolveMember(m, a[0]);
                if (!member.voice.channelId)
                    throw new Error('O membro não está em um canal de voz');
                await member.voice.setMute(false, `Silêncio removido por ${m.author.tag}`);
                await this.replyTemporary(m, { embeds: [this.noticeEmbed('Voz liberada', `O silêncio de ${member} foi removido.`, 0x2ecc71)], allowedMentions: { users: [member.id] } });
                await this.logModeration(m, c, 'voice_unmute', member.id, {});
            }),
            this.command('voicedeafen', 'moderation', 'Impede um membro de ouvir o canal de voz.', 'voicedeafen @usuário', discord_js_1.PermissionFlagsBits.DeafenMembers, async (m, a, c) => {
                const member = await resolveMember(m, a[0]);
                if (!member.voice.channelId)
                    throw new Error('O membro não está em um canal de voz');
                await member.voice.setDeaf(true, `Ensurdado por ${m.author.tag}`);
                await this.replyTemporary(m, { embeds: [this.noticeEmbed('Áudio bloqueado', `${member} não poderá ouvir o canal até a remoção do deaf.`, 0xe67e22)], allowedMentions: { users: [member.id] } });
                await this.logModeration(m, c, 'voice_deaf', member.id, {});
            }),
            this.command('move', 'moderation', 'Move um membro para outro canal de voz.', 'move @usuário #canal', discord_js_1.PermissionFlagsBits.MoveMembers, async (m, a, c) => {
                const member = await resolveMember(m, a.shift());
                const channel = resolveChannel(m, a[0]);
                if (!channel?.isVoiceBased?.())
                    throw new Error('Selecione um canal de voz');
                await member.voice.setChannel(channel, `Movido por ${m.author.tag}`);
                await this.replyTemporary(m, { embeds: [this.noticeEmbed('Membro movido', `${member} foi movido para ${channel}.`, 0x2ecc71)], allowedMentions: { users: [member.id] } });
                await this.logModeration(m, c, 'voice_move', member.id, { channelId: channel.id });
            }),
            this.command('voicelock', 'moderation', 'Bloqueia novas entradas no canal de voz atual ou marcado.', 'voicelock [#canal]', discord_js_1.PermissionFlagsBits.ManageChannels, async (m, a, c) => {
                const channel = resolveChannel(m, a[0]) ?? m.member.voice.channel;
                if (!channel?.isVoiceBased?.())
                    throw new Error('Entre em uma call ou mencione um canal de voz');
                await channel.permissionOverwrites.edit(m.guild.roles.everyone, { Connect: false }, { reason: `Call bloqueada por ${m.author.tag}` });
                await this.replyTemporary(m, { embeds: [this.noticeEmbed('Call bloqueada', `Novas entradas em ${channel} foram bloqueadas.`, 0xe67e22)] });
                await this.logModeration(m, c, 'channel_lock', channel.id, {});
            }),
            this.command('voiceunlock', 'moderation', 'Libera novas entradas no canal de voz atual ou marcado.', 'voiceunlock [#canal]', discord_js_1.PermissionFlagsBits.ManageChannels, async (m, a, c) => {
                const channel = resolveChannel(m, a[0]) ?? m.member.voice.channel;
                if (!channel?.isVoiceBased?.())
                    throw new Error('Entre em uma call ou mencione um canal de voz');
                await channel.permissionOverwrites.edit(m.guild.roles.everyone, { Connect: null }, { reason: `Call desbloqueada por ${m.author.tag}` });
                await this.replyTemporary(m, { embeds: [this.noticeEmbed('Call liberada', `Novas entradas em ${channel} foram liberadas.`, 0x2ecc71)] });
                await this.logModeration(m, c, 'channel_unlock', channel.id, {});
            }),
            this.command('voiceinfo', 'information', 'Mostra informações completas de uma call.', 'voiceinfo [#canal]', async (m, a) => {
                const channel = resolveChannel(m, a[0]) ?? m.member.voice.channel;
                if (!channel?.isVoiceBased?.())
                    throw new Error('Entre em uma call ou mencione um canal de voz');
                const members = [...channel.members.values()];
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Informações de ${channel.name}`).setDescription(`${channel}\n\`${channel.id}\``).addFields({ name: 'Membros', value: `**${members.length}**`, inline: true }, { name: 'Limite', value: channel.userLimit ? String(channel.userLimit) : 'Sem limite', inline: true }, { name: 'Bitrate', value: `${Math.round(channel.bitrate / 1000)} kbps`, inline: true }, { name: 'Conectados', value: members.length ? members.slice(0, 20).map((member) => `${member}`).join(', ').slice(0, 1024) : 'Ninguém conectado.', inline: false }).setColor(0x111111).setTimestamp()] });
            }),
            this.command('security', 'protection', 'Mostra o estado das proteções e permissões do bot.', 'security', discord_js_1.PermissionFlagsBits.ManageGuild, async (m, _a, c) => {
                const values = Object.values(c.protections);
                const active = values.filter(item => item.mode === 'enabled').length;
                const monitor = values.filter(item => item.mode === 'monitor' || item.mode === 'test').length;
                const disabled = values.filter(item => item.mode === 'disabled').length;
                const required = [['Gerenciar canais', discord_js_1.PermissionFlagsBits.ManageChannels], ['Gerenciar cargos', discord_js_1.PermissionFlagsBits.ManageRoles], ['Banir membros', discord_js_1.PermissionFlagsBits.BanMembers], ['Expulsar membros', discord_js_1.PermissionFlagsBits.KickMembers], ['Moderar membros', discord_js_1.PermissionFlagsBits.ModerateMembers], ['Ver auditoria', discord_js_1.PermissionFlagsBits.ViewAuditLog], ['Gerenciar webhooks', discord_js_1.PermissionFlagsBits.ManageWebhooks]];
                const missing = required.filter(([, permission]) => !m.guild.members.me?.permissions.has(permission)).map(([name]) => name);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: m.guild.name, iconURL: m.guild.iconURL({ size: 256 }) ?? undefined }).setTitle('Estado da segurança').addFields({ name: 'Proteções', value: `Ativas: **${active}**\nMonitoramento/teste: **${monitor}**\nDesativadas: **${disabled}**`, inline: true }, { name: 'Modo raid', value: `**${c.raid.state}**${c.raid.activeUntil ? `\nAté <t:${Math.floor(Date.parse(c.raid.activeUntil) / 1000)}:R>` : ''}`, inline: true }, { name: 'Permissões ausentes', value: missing.length ? missing.join(', ') : 'Nenhuma permissão principal ausente.', inline: false }).setColor(missing.length ? 0xe67e22 : 0x2ecc71).setTimestamp()] });
            }),
            this.command('raidmode', 'protection', 'Altera rapidamente o modo raid.', 'raidmode off|automatic|manual|emergency', discord_js_1.PermissionFlagsBits.ManageGuild, async (m, a, c) => {
                const raw = String(a[0] ?? '').toLowerCase();
                const map = { off: 'disabled', desativado: 'disabled', automatic: 'automatic', automatico: 'automatic', manual: 'manual', emergency: 'emergency', emergencia: 'emergency' };
                const state = map[raw];
                if (!state)
                    throw new Error('Use off, automatic, manual ou emergency');
                c.raid.state = state;
                c.raid.activeUntil = state === 'manual' || state === 'emergency' ? new Date(Date.now() + c.raid.durationSeconds * 1000).toISOString() : null;
                await guildConfigStore_1.guildConfigStore.set(m.guild.id, c);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Modo raid atualizado').setDescription(`Novo estado: **${state}**${c.raid.activeUntil ? `\nEncerramento automático: <t:${Math.floor(Date.parse(c.raid.activeUntil) / 1000)}:R>` : ''}`).setColor(state === 'emergency' ? 0xe74c3c : 0x111111).setTimestamp()] });
            }),
            this.command('risk', 'protection', 'Analisa sinais de risco de uma conta do servidor.', 'risk @usuário', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => {
                const member = await resolveMember(m, a[0]);
                const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
                const dangerous = [discord_js_1.PermissionFlagsBits.Administrator, discord_js_1.PermissionFlagsBits.ManageGuild, discord_js_1.PermissionFlagsBits.ManageChannels, discord_js_1.PermissionFlagsBits.ManageRoles, discord_js_1.PermissionFlagsBits.BanMembers].filter(flag => member.permissions.has(flag)).length;
                const cases = c.moderation.cases.filter(item => item.targetId === member.id && Date.now() - Date.parse(item.createdAt) < 30 * 86400000).length;
                const warnings = c.moderation.warnings.filter(item => item.userId === member.id && !item.removedAt).length;
                let score = 0;
                const factors = [];
                if (ageDays < 1) {
                    score += 45;
                    factors.push('conta criada há menos de 1 dia');
                }
                else if (ageDays < 7) {
                    score += 30;
                    factors.push('conta criada há menos de 7 dias');
                }
                else if (ageDays < 30) {
                    score += 15;
                    factors.push('conta recente');
                }
                if (dangerous) {
                    score += Math.min(30, dangerous * 8);
                    factors.push(`${dangerous} permissão(ões) administrativa(s)`);
                }
                if (cases) {
                    score += Math.min(20, cases * 4);
                    factors.push(`${cases} caso(s) nos últimos 30 dias`);
                }
                if (warnings) {
                    score += Math.min(15, warnings * 3);
                    factors.push(`${warnings} advertência(s) ativa(s)`);
                }
                score = Math.min(100, score);
                const level = score >= 70 ? 'Alto' : score >= 35 ? 'Médio' : 'Baixo';
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() }).setTitle('Análise de risco').setThumbnail(member.user.displayAvatarURL({ size: 256 })).addFields({ name: 'Pontuação', value: `**${score}/100 — ${level}**`, inline: true }, { name: 'Idade da conta', value: `${ageDays} dia(s)`, inline: true }, { name: 'Fatores encontrados', value: factors.length ? factors.join('\n') : 'Nenhum sinal relevante encontrado.', inline: false }).setColor(score >= 70 ? 0xe74c3c : score >= 35 ? 0xe67e22 : 0x2ecc71).setTimestamp()] });
            }),
            this.command('webhookcheck', 'protection', 'Lista webhooks do servidor e seus canais.', 'webhookcheck', discord_js_1.PermissionFlagsBits.ManageWebhooks, async (m) => {
                const hooks = await m.guild.fetchWebhooks();
                const lines = [...hooks.values()].slice(0, 30).map((hook) => `**${escapeMarkdown(hook.name ?? 'Webhook')}** — <#${hook.channelId}> — \`${hook.id}\` — ${hook.owner ? `${hook.owner}` : 'sem proprietário visível'}`);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: m.guild.name, iconURL: m.guild.iconURL({ size: 256 }) ?? undefined }).setTitle('Webhooks do servidor').setDescription(lines.length ? lines.join('\n').slice(0, 4000) : 'Nenhum webhook encontrado.').setColor(lines.length ? 0xe67e22 : 0x2ecc71).setTimestamp()] });
            }),
            this.command('temprole', 'moderation', 'Adiciona um cargo temporário e remove automaticamente ao expirar.', 'temprole @usuário @cargo duração [motivo]', discord_js_1.PermissionFlagsBits.ManageRoles, async (m, a, c) => {
                const member = await resolveMember(m, a.shift());
                const role = resolveRole(m, a.shift());
                this.ensureRoleManageable(m, member, role);
                const duration = parseDuration(a.shift() ?? '');
                if (duration === null)
                    throw new Error('Duração inválida; use 10m, 1h, 1d ou 1w');
                const reason = a.join(' ') || 'Cargo temporário';
                await member.roles.add(role, `${reason} | por ${m.author.tag}`);
                const record = { id: `TR-${(0, ids_1.randomId)(8)}`, userId: member.id, roleId: role.id, moderatorId: m.author.id, reason, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + duration * 1000).toISOString() };
                c.community.temporaryRoles.push(record);
                c.community.temporaryRoles = c.community.temporaryRoles.slice(-2000);
                await guildConfigStore_1.guildConfigStore.set(m.guild.id, c);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Cargo temporário aplicado').setDescription(`${role} foi adicionado a ${member}.\nExpira: <t:${Math.floor(Date.parse(record.expiresAt) / 1000)}:R>\nMotivo: ${reason}`).setColor(0x2ecc71).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('roleexpires', 'moderation', 'Mostra cargos temporários de um membro.', 'roleexpires [@usuário]', discord_js_1.PermissionFlagsBits.ManageRoles, async (m, a, c) => {
                const userId = extractId(a[0]) ?? m.author.id;
                const list = c.community.temporaryRoles.filter(item => item.userId === userId).sort((x, y) => Date.parse(x.expiresAt) - Date.parse(y.expiresAt));
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Cargos temporários').setDescription(list.length ? list.map(item => `<@&${item.roleId}> — expira <t:${Math.floor(Date.parse(item.expiresAt) / 1000)}:R> — **${item.id}**`).join('\n').slice(0, 4000) : 'Nenhum cargo temporário ativo para este usuário.').setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('rolebackup', 'moderation', 'Abre o painel unificado de backup e restauração de cargos.', 'rolebackup', discord_js_1.PermissionFlagsBits.ManageRoles, async (m, _a, c) => {
                await m.reply(this.roleBackups.commandPayload(m.author.id, c));
            }),
            this.command('serverbanner', 'information', 'Mostra o banner do servidor, quando disponível.', 'serverbanner', async (m) => {
                const url = m.guild.bannerURL({ size: 1024 });
                await m.reply({ embeds: [url ? new discord_js_1.EmbedBuilder().setTitle(`Banner de ${m.guild.name}`).setImage(url).setColor(0x111111).setTimestamp() : this.noticeEmbed('Banner indisponível', 'Este servidor não possui banner configurado.', 0xe67e22)] });
            }),
            this.command('serveravatar', 'information', 'Mostra o avatar que um membro usa neste servidor.', 'serveravatar [@usuário]', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                const url = member.displayAvatarURL({ extension: 'png', size: 1024, forceStatic: false });
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Avatar de ${member.displayName}`).setDescription(`${member}`).setImage(url).setColor(member.displayColor || 0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('bots', 'information', 'Lista os bots presentes no servidor.', 'bots', async (m) => {
                await m.guild.members.fetch().catch(() => undefined);
                const bots = [...m.guild.members.cache.values()].filter((member) => member.user.bot).sort((a, b) => (a.joinedTimestamp ?? 0) - (b.joinedTimestamp ?? 0));
                const lines = bots.slice(0, 35).map((member, index) => `**${index + 1}.** ${member.user.tag} — entrou <t:${Math.floor((member.joinedTimestamp ?? Date.now()) / 1000)}:R>`);
                const extra = bots.length > 35 ? `\n\nMais **${bots.length - 35}** bot(s) não exibido(s).` : '';
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Bots de ${m.guild.name}`).setDescription(`${lines.join('\n') || 'Nenhum bot encontrado.'}${extra}`.slice(0, 4096)).setFooter({ text: `Total: ${bots.length}` }).setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('serveradmins', 'information', 'Lista membros com permissão de administrador.', 'serveradmins', discord_js_1.PermissionFlagsBits.ManageGuild, async (m) => {
                await m.guild.members.fetch().catch(() => undefined);
                const admins = [...m.guild.members.cache.values()].filter((member) => !member.user.bot && member.permissions?.has?.(discord_js_1.PermissionFlagsBits.Administrator)).sort((a, b) => b.roles.highest.position - a.roles.highest.position);
                const lines = admins.slice(0, 30).map((member, index) => `**${index + 1}.** ${member} — ${escapeMarkdown(member.displayName)}`);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Administradores de ${m.guild.name}`).setDescription(lines.join('\n') || 'Nenhum administrador foi encontrado.').setFooter({ text: `Total: ${admins.length}` }).setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('membersearch', 'information', 'Busca membros por nome, apelido ou usuário.', 'membersearch nome', discord_js_1.PermissionFlagsBits.ManageMessages, async (m, a) => {
                const query = a.join(' ').trim().toLowerCase();
                if (query.length < 2)
                    throw new Error('Informe pelo menos 2 caracteres para buscar');
                await m.guild.members.fetch().catch(() => undefined);
                const matches = [...m.guild.members.cache.values()].filter((member) => [member.displayName, member.user.username, member.user.globalName ?? '', member.user.tag].some((value) => String(value).toLowerCase().includes(query))).slice(0, 20);
                const lines = matches.map((member, index) => `**${index + 1}.** ${member} — ${escapeMarkdown(member.user.tag)} — \`${member.id}\``);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Busca de membros').setDescription(lines.join('\n') || 'Nenhum membro encontrado com esse termo.').setFooter({ text: `Busca: ${query.slice(0, 80)}` }).setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('rolecount', 'information', 'Mostra quantos membros possuem um cargo.', 'rolecount @cargo', async (m, a) => {
                const role = resolveRole(m, a[0]);
                await m.guild.members.fetch().catch(() => undefined);
                const total = role.members.size;
                const humans = role.members.filter((member) => !member.user.bot).size;
                const bots = total - humans;
                const percent = m.guild.memberCount ? ((total / m.guild.memberCount) * 100).toFixed(1) : '0.0';
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Membros em ${role.name}`).setDescription(`${role}\n\nTotal: **${total}**\nPessoas: **${humans}**\nBots: **${bots}**\nServidor: **${percent}%** dos membros`).setColor(role.color || 0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('boosters', 'information', 'Lista os membros que estão impulsionando o servidor.', 'boosters', async (m) => {
                await m.guild.members.fetch().catch(() => undefined);
                const list = [...m.guild.members.cache.values()].filter((member) => Boolean(member.premiumSinceTimestamp)).sort((a, b) => (a.premiumSinceTimestamp ?? 0) - (b.premiumSinceTimestamp ?? 0));
                const description = list.length ? list.slice(0, 30).map((member, index) => `**${index + 1}.** ${member} — desde <t:${Math.floor((member.premiumSinceTimestamp ?? Date.now()) / 1000)}:R>`).join('\n') : 'Nenhum impulsionador encontrado no momento.';
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Impulsionadores de ${m.guild.name}`).setDescription(description.slice(0, 4000)).setColor(0xf47fff).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('emojiinfo', 'information', 'Mostra dados e a imagem de um emoji personalizado.', 'emojiinfo <:emoji:id>', async (m, a) => {
                const raw = a.join(' ').trim();
                const parsed = parseCustomEmoji(raw);
                if (!parsed)
                    throw new Error('Envie um emoji personalizado do Discord');
                const extension = parsed.animated ? 'gif' : 'png';
                const url = `https://cdn.discordapp.com/emojis/${parsed.id}.${extension}?size=512&quality=lossless`;
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Emoji ${parsed.name}`).setDescription(`Nome: **${escapeMarkdown(parsed.name)}**\nID: \`${parsed.id}\`\nAnimado: **${parsed.animated ? 'Sim' : 'Não'}**`).setImage(url).setColor(0x111111).setTimestamp()] });
            }),
            this.command('roles', 'information', 'Lista os principais cargos do servidor.', 'roles', async (m) => {
                const roles = [...m.guild.roles.cache.values()].filter((role) => role.id !== m.guild.id).sort((a, b) => b.position - a.position);
                const lines = roles.slice(0, 35).map((role, index) => `**${index + 1}.** ${role} — ${role.members.size} membro(s)`);
                const extra = roles.length > 35 ? `\n\nMais **${roles.length - 35}** cargo(s) não exibido(s).` : '';
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Cargos de ${m.guild.name}`).setDescription(`${lines.join('\n') || 'Nenhum cargo encontrado.'}${extra}`.slice(0, 4096)).setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('inrole', 'information', 'Lista os membros que possuem um cargo.', 'inrole @cargo', async (m, a) => {
                const role = resolveRole(m, a[0]);
                await m.guild.members.fetch().catch(() => undefined);
                const members = [...role.members.values()].sort((x, y) => String(x.displayName).localeCompare(String(y.displayName), 'pt-BR'));
                const shown = members.slice(0, 40).map((member, index) => `**${index + 1}.** ${member} — ${escapeMarkdown(member.displayName)}`);
                const extra = members.length > 40 ? `\n\nMais **${members.length - 40}** membro(s) não exibido(s).` : '';
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Membros em ${role.name}`).setDescription(`${shown.join('\n') || 'Nenhum membro possui este cargo.'}${extra}`.slice(0, 4096)).setColor(role.color || 0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('randommember', 'community', 'Escolhe aleatoriamente uma pessoa do servidor.', 'randommember', async (m) => {
                await m.guild.members.fetch().catch(() => undefined);
                const members = [...m.guild.members.cache.values()].filter((member) => !member.user.bot);
                if (!members.length)
                    throw new Error('Não encontrei membros disponíveis para escolher');
                const member = members[Math.floor(Math.random() * members.length)];
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Membro escolhido').setDescription(`${member}\n**${escapeMarkdown(member.displayName)}**`).setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 })).setColor(member.displayColor || 0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('calc', 'utility', 'Calcula expressões matemáticas básicas sem executar código.', 'calc (10 + 5) * 2', async (m, a) => {
                const expression = a.join(' ').trim();
                if (!expression)
                    throw new Error('Informe uma expressão matemática');
                const value = evaluateMathExpression(expression);
                const formatted = Number.isInteger(value) ? String(value) : Number(value.toFixed(10)).toString();
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Calculadora').addFields({ name: 'Expressão', value: `\`${expression.slice(0, 500)}\`` }, { name: 'Resultado', value: `**${formatted}**` }).setColor(0x111111).setTimestamp()] });
            }),
            this.command('timestamp', 'utility', 'Gera formatos de horário do Discord para agora ou para uma duração futura.', 'timestamp [agora|10m|1h|1d]', async (m, a) => {
                const input = a.join(' ').trim() || 'agora';
                const time = parseTimestampInput(input);
                const unix = Math.floor(time.getTime() / 1000);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Timestamp do Discord').setDescription([
                            `Data: <t:${unix}:F>`,
                            `Relativo: <t:${unix}:R>`,
                            `Curto: <t:${unix}:f>`,
                            `Somente data: <t:${unix}:D>`,
                            `Somente hora: <t:${unix}:T>`,
                            '',
                            `Código: \`<t:${unix}:F>\``
                        ].join('\n')).setColor(0x111111).setTimestamp()] });
            }),
            this.command('suggest', 'community', 'Envia uma sugestão ao canal configurado.', 'suggest texto da sugestão', async (m, a, c) => { if (!c.community.suggestions.enabled || !c.community.suggestions.channelId)
                throw new Error('Sistema de sugestões não configurado'); const text = a.join(' ').trim(); if (!text)
                throw new Error('Informe a sugestão'); const channel = await m.guild.channels.fetch(c.community.suggestions.channelId); if (!channel?.isTextBased?.() || !('send' in channel))
                throw new Error('Canal de sugestões inválido'); const embed = new discord_js_1.EmbedBuilder().setTitle('Nova sugestão').setDescription(text.slice(0, 4096)).setColor(0x111111).setFooter({ text: c.community.suggestions.allowAnonymous ? 'Sugestão anônima' : `Enviada por ${m.author.tag}` }).setTimestamp(); const sent = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }); if (c.community.suggestions.createThread && typeof sent.startThread === 'function')
                await sent.startThread({ name: `Discussão ${sent.id.slice(-6)}`, autoArchiveDuration: 1440 }).catch(() => undefined); await m.reply(`Sugestão enviada em ${channel}.`); await (0, communityLogger_1.logCommunityEvent)({ guild: m.guild, config: c, event: 'suggestion_created', module: 'community_suggestions', executorId: m.author.id, targetId: sent.id, channelId: channel.id, details: { anonymous: c.community.suggestions.allowAnonymous } }); await guildConfigStore_1.guildConfigStore.set(m.guild.id, c); }),
            this.command('announce', 'community', 'Envia um anúncio no canal atual.', 'announce texto', discord_js_1.PermissionFlagsBits.ManageMessages, async (m, a) => { const text = a.join(' ').trim(); if (!text)
                throw new Error('Informe o texto'); await m.channel.send({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Anúncio').setDescription(text.slice(0, 4096)).setColor(0x111111).setFooter({ text: `Publicado por ${m.author.tag}` }).setTimestamp()] }); }),
            this.command('afk', 'community', 'Ativa o modo AFK até você voltar a conversar.', 'afk [motivo]', async (m, a, c) => {
                const reason = (a.join(' ').trim() || 'Não informado').slice(0, 300);
                c.community.afkUsers[m.author.id] = { reason, since: new Date().toISOString() };
                await guildConfigStore_1.guildConfigStore.set(m.guild.id, c);
                await m.reply(`Modo AFK ativado. Motivo: ${reason}.`);
                await (0, communityLogger_1.logCommunityEvent)({ guild: m.guild, config: c, event: 'afk_set', module: 'community_afk', executorId: m.author.id, targetId: m.author.id, channelId: m.channelId, severity: 'info', details: { reason } }).catch(() => undefined);
            }),
            this.command('poll', 'community', 'Cria uma enquete simples com votação positiva ou negativa.', 'poll pergunta', async (m, a) => {
                const question = a.join(' ').trim();
                if (!question)
                    throw new Error('Informe a pergunta da enquete');
                await m.channel.send({
                    poll: {
                        question: { text: question.slice(0, 300) },
                        answers: [{ text: 'Sim' }, { text: 'Não' }],
                        duration: 24,
                        allowMultiselect: false
                    },
                    allowedMentions: { parse: [] }
                });
            }),
            this.command('ship', 'community', 'Gera uma imagem de compatibilidade entre duas pessoas.', 'ship @usuário [@usuário]', async (m, a, c) => {
                const ids = [...new Set((m.mentions?.users ? [...m.mentions.users.keys()] : []).filter((id) => id !== m.client.user.id))];
                const firstId = ids.length >= 2 ? ids[0] : m.author.id;
                const secondId = ids.length >= 2 ? ids[1] : ids[0];
                if (!secondId)
                    throw new Error('Mencione pelo menos uma pessoa para calcular a compatibilidade');
                if (firstId === secondId)
                    throw new Error('Escolha duas pessoas diferentes');
                const [firstMember, secondMember] = await Promise.all([m.guild.members.fetch(firstId), m.guild.members.fetch(secondId)]);
                const result = await (0, shipCanvas_1.createShipCard)({ id: firstMember.id, displayName: firstMember.displayName, username: firstMember.user.username, avatarUrl: firstMember.user.displayAvatarURL({ extension: 'png', size: 512 }) }, { id: secondMember.id, displayName: secondMember.displayName, username: secondMember.user.username, avatarUrl: secondMember.user.displayAvatarURL({ extension: 'png', size: 512 }) }, m.guild.id, m.guild.name);
                const file = new discord_js_1.AttachmentBuilder(result.buffer, { name: 'ship.png' });
                const embed = new discord_js_1.EmbedBuilder().setTitle(`Compatibilidade: ${result.percentage}%`).setDescription(`${firstMember} + ${secondMember}`).setImage('attachment://ship.png').setColor(result.percentage >= 75 ? 0x57f287 : result.percentage >= 45 ? 0xfee75c : 0xed4245).setTimestamp();
                await m.reply({ embeds: [embed], files: [file], allowedMentions: { parse: [] } });
                await (0, communityLogger_1.logCommunityEvent)({ guild: m.guild, config: c, event: 'ship_used', module: 'community_fun', executorId: m.author.id, targetId: secondMember.id, channelId: m.channelId, severity: 'info', details: { firstId, secondId, percentage: result.percentage } }).catch(() => undefined);
                await guildConfigStore_1.guildConfigStore.set(m.guild.id, c).catch(() => undefined);
            }),
            this.command('wanted', 'community', 'Cria um cartaz de procurado com o avatar de uma pessoa.', 'wanted [@usuário]', async (m, a, c) => {
                const member = await resolveMember(m, a[0]);
                const buffer = await (0, funCanvas_1.createWantedCard)({ id: member.id, displayName: member.displayName, username: member.user.username, avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 512 }) });
                const file = new discord_js_1.AttachmentBuilder(buffer, { name: 'wanted.png' });
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Procurado').setDescription(`${member} entrou para o cartaz de procurados.`).setImage('attachment://wanted.png').setColor(0x9b7b45).setTimestamp()], files: [file], allowedMentions: { parse: [] } });
                await (0, communityLogger_1.logCommunityEvent)({ guild: m.guild, config: c, event: 'fun_canvas_used', module: 'community_fun', executorId: m.author.id, targetId: member.id, channelId: m.channelId, severity: 'info', details: { effect: 'wanted' } }).catch(() => undefined);
                await guildConfigStore_1.guildConfigStore.set(m.guild.id, c).catch(() => undefined);
            }),
            this.command('jail', 'community', 'Cria uma imagem de prisão com o avatar de uma pessoa.', 'jail [@usuário]', async (m, a, c) => {
                const member = await resolveMember(m, a[0]);
                const buffer = await (0, funCanvas_1.createJailCard)({ id: member.id, displayName: member.displayName, username: member.user.username, avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 512 }) }, m.guild.name);
                const file = new discord_js_1.AttachmentBuilder(buffer, { name: 'jail.png' });
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Prisão').setDescription(`${member} foi colocado atrás das grades.`).setImage('attachment://jail.png').setColor(0x36393f).setTimestamp()], files: [file], allowedMentions: { parse: [] } });
                await (0, communityLogger_1.logCommunityEvent)({ guild: m.guild, config: c, event: 'fun_canvas_used', module: 'community_fun', executorId: m.author.id, targetId: member.id, channelId: m.channelId, severity: 'info', details: { effect: 'jail' } }).catch(() => undefined);
                await guildConfigStore_1.guildConfigStore.set(m.guild.id, c).catch(() => undefined);
            }),
            this.command('profilecard', 'community', 'Gera um cartão visual do perfil de um membro.', 'profilecard [@usuário]', async (m, a, c) => {
                const member = await resolveMember(m, a[0]);
                const joinedText = member.joinedTimestamp ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(member.joinedTimestamp)) : 'Data desconhecida';
                const buffer = await (0, funCanvas_1.createProfileCard)({ id: member.id, displayName: member.displayName, username: member.user.username, avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 512 }) }, { guildName: m.guild.name, joinedText, roleCount: Math.max(0, member.roles.cache.size - 1) });
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Cartão de perfil').setDescription(`Perfil comunitário de ${member}.`).setImage('attachment://profile-card.png').setColor(0x5865f2).setTimestamp()], files: [new discord_js_1.AttachmentBuilder(buffer, { name: 'profile-card.png' })], allowedMentions: { parse: [] } });
                await (0, communityLogger_1.logCommunityEvent)({ guild: m.guild, config: c, event: 'fun_canvas_used', module: 'community_fun', executorId: m.author.id, targetId: member.id, channelId: m.channelId, severity: 'info', details: { effect: 'profilecard' } }).catch(() => undefined);
            }),
            this.command('quote', 'community', 'Transforma a mensagem respondida em uma imagem de citação.', 'quote respondendo a uma mensagem', async (m, a, c) => {
                const messageId = m.reference?.messageId;
                if (!messageId)
                    throw new Error('Responda a uma mensagem para criar a citação');
                const quoted = await m.channel.messages.fetch(messageId).catch(() => null);
                if (!quoted)
                    throw new Error('A mensagem respondida não foi encontrada');
                const text = String(quoted.content ?? '').trim();
                if (!text)
                    throw new Error('A mensagem precisa possuir texto');
                const member = quoted.member ?? await m.guild.members.fetch(quoted.author.id).catch(() => null);
                const buffer = await (0, funCanvas_1.createQuoteCard)({ id: quoted.author.id, displayName: member?.displayName ?? quoted.author.globalName ?? quoted.author.username, username: quoted.author.username, avatarUrl: quoted.author.displayAvatarURL({ extension: 'png', size: 512 }) }, text, m.guild.name);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Citação').setDescription(`Mensagem de <@${quoted.author.id}>`).setImage('attachment://quote.png').setColor(0x3b82f6).setTimestamp()], files: [new discord_js_1.AttachmentBuilder(buffer, { name: 'quote.png' })], allowedMentions: { parse: [] } });
                await (0, communityLogger_1.logCommunityEvent)({ guild: m.guild, config: c, event: 'fun_canvas_used', module: 'community_fun', executorId: m.author.id, targetId: quoted.author.id, channelId: m.channelId, severity: 'info', details: { effect: 'quote', messageId } }).catch(() => undefined);
            }),
            this.command('blur', 'community', 'Aplica desfoque ao avatar de um membro.', 'blur [@usuário]', async (m, a, c) => {
                await this.sendAvatarEffect(m, a, c, 'blur', 'Desfoque');
            }),
            this.command('pixelate', 'community', 'Transforma o avatar em arte pixelada.', 'pixelate [@usuário]', async (m, a, c) => {
                await this.sendAvatarEffect(m, a, c, 'pixelate', 'Pixelado');
            }),
            this.command('grayscale', 'community', 'Transforma o avatar em preto e branco.', 'grayscale [@usuário]', async (m, a, c) => {
                await this.sendAvatarEffect(m, a, c, 'grayscale', 'Preto e branco');
            }),
            this.command('invert', 'community', 'Inverte as cores do avatar.', 'invert [@usuário]', async (m, a, c) => {
                await this.sendAvatarEffect(m, a, c, 'invert', 'Cores invertidas');
            }),
            this.command('achievement', 'community', 'Cria um cartão de conquista personalizado.', 'achievement texto da conquista', async (m, a, c) => {
                const text = a.join(' ').trim();
                if (!text)
                    throw new Error('Informe o texto da conquista');
                const member = m.member;
                const buffer = await (0, funCanvas_1.createAchievementCard)({ id: member.id, displayName: member.displayName, username: member.user.username, avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 512 }) }, text);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Conquista desbloqueada').setImage('attachment://achievement.png').setColor(0xf59e0b).setTimestamp()], files: [new discord_js_1.AttachmentBuilder(buffer, { name: 'achievement.png' })], allowedMentions: { parse: [] } });
                await (0, communityLogger_1.logCommunityEvent)({ guild: m.guild, config: c, event: 'fun_canvas_used', module: 'community_fun', executorId: m.author.id, targetId: m.author.id, channelId: m.channelId, severity: 'info', details: { effect: 'achievement' } }).catch(() => undefined);
            }),
            this.command('rate', 'community', 'Dá uma nota divertida e consistente para um usuário ou texto.', 'rate [@usuário ou texto]', async (m, a) => {
                const targetId = extractId(a[0]);
                const label = targetId ? `<@${targetId}>` : (a.join(' ').trim() || m.author.username);
                const seed = `${m.guild.id}:${targetId ?? label.toLowerCase()}`;
                const value = Math.abs([...seed].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) | 0, 7)) % 101;
                const filled = Math.round(value / 10);
                const meter = `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Avaliação divertida').setDescription(`${label}\n\n**${value}/100**\n\`${meter}\``).setColor(value >= 75 ? 0x57f287 : value >= 40 ? 0xfee75c : 0xed4245).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('highfive', 'community', 'Manda um toca aqui para outro membro.', 'highfive @usuário', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                if (member.id === m.author.id)
                    throw new Error('Mencione outra pessoa');
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Toca aqui').setDescription(`${m.author} e ${member} deram um toca aqui.`).setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 })).setColor(0x57f287).setTimestamp()], allowedMentions: { users: [member.id, m.author.id], parse: [] } });
            }),
            this.command('pat', 'community', 'Envia um gesto amigável para outro membro.', 'pat @usuário', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                if (member.id === m.author.id)
                    throw new Error('Mencione outra pessoa');
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Carinho').setDescription(`${m.author} fez um carinho amigável em ${member}.`).setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 })).setColor(0xf472b6).setTimestamp()], allowedMentions: { users: [member.id, m.author.id], parse: [] } });
            }),
            this.command('hug', 'community', 'Envia um abraço para outro membro.', 'hug @usuário', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                if (member.id === m.author.id)
                    throw new Error('Mencione outra pessoa');
                await m.reply({ embeds: [socialInteractionEmbed('Abraço', `${m.author} deu um abraço em ${member}.`, member, 0x8b5cf6)], allowedMentions: { users: [member.id, m.author.id], parse: [] } });
            }),
            this.command('wave', 'community', 'Acena para outro membro.', 'wave @usuário', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                if (member.id === m.author.id)
                    throw new Error('Mencione outra pessoa');
                await m.reply({ embeds: [socialInteractionEmbed('Aceno', `${m.author} acenou para ${member}.`, member, 0x3b82f6)], allowedMentions: { users: [member.id, m.author.id], parse: [] } });
            }),
            this.command('poke', 'community', 'Cutuca outro membro.', 'poke @usuário', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                if (member.id === m.author.id)
                    throw new Error('Mencione outra pessoa');
                await m.reply({ embeds: [socialInteractionEmbed('Cutucão', `${m.author} cutucou ${member}.`, member, 0xf59e0b)], allowedMentions: { users: [member.id, m.author.id], parse: [] } });
            }),
            this.command('applaud', 'community', 'Aplaude outro membro.', 'applaud @usuário', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                if (member.id === m.author.id)
                    throw new Error('Mencione outra pessoa');
                await m.reply({ embeds: [socialInteractionEmbed('Aplausos', `${m.author} aplaudiu ${member}.`, member, 0x22c55e)], allowedMentions: { users: [member.id, m.author.id], parse: [] } });
            }),
            this.command('rep', 'community', 'Dá um ponto de reputação para um membro da comunidade.', 'rep @usuário [motivo]', async (m, a, c) => {
                const member = await resolveMember(m, a[0]);
                if (member.user.bot)
                    throw new Error('Escolha uma pessoa da comunidade');
                const reason = a.slice(1).join(' ').trim().slice(0, 240);
                const result = (0, reputationService_1.giveReputation)(c, m.author.id, member.id);
                if (!result.ok)
                    throw new Error(`Você já deu reputação recentemente. Tente novamente em ${formatDuration(result.remainingMs)}`);
                await guildConfigStore_1.guildConfigStore.set(m.guild.id, c);
                const description = [`${member} recebeu um ponto de reputação de ${m.author}.`, `Agora possui **${result.score}** ponto${result.score === 1 ? '' : 's'} de reputação neste servidor.`];
                if (reason)
                    description.push(`Motivo: ${escapeMarkdown(reason)}`);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Reputação').setDescription(description.join('\n')).setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 })).setColor(0x22c55e).setTimestamp()], allowedMentions: { users: [member.id, m.author.id], parse: [] } });
                await (0, communityLogger_1.logCommunityEvent)({ guild: m.guild, config: c, event: 'reputation_given', module: 'community_reputation', executorId: m.author.id, targetId: member.id, channelId: m.channelId, severity: 'info', details: { score: result.score, reason: reason || null } }).catch(() => undefined);
            }),
            this.command('repinfo', 'community', 'Mostra a reputação de um membro neste servidor.', 'repinfo [@usuário]', async (m, a, c) => {
                const member = await resolveMember(m, a[0]);
                const score = (0, reputationService_1.getReputation)(c, member.id);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Reputação de ${member.displayName}`).setDescription(`${member} possui **${score}** ponto${score === 1 ? '' : 's'} de reputação em **${escapeMarkdown(m.guild.name)}**.`).setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 })).setColor(member.displayColor || 0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('reptop', 'community', 'Mostra o ranking de reputação do servidor.', 'reptop', async (m, _a, c) => {
                const ranking = (0, reputationService_1.topReputation)(c, 10);
                if (!ranking.length)
                    throw new Error('Ainda não há reputações registradas neste servidor');
                const lines = ranking.map((entry, index) => `**${index + 1}.** <@${entry.userId}> — **${entry.score}** ponto${entry.score === 1 ? '' : 's'}`);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Reputação em ${m.guild.name}`).setDescription(lines.join('\n')).setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('topic', 'community', 'Sorteia um assunto leve para movimentar o chat.', 'topic', async (m) => {
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Assunto para o chat').setDescription((0, conversationService_1.randomCommunityTopic)()).setColor(0x5865f2).setTimestamp()] });
            }),
            this.command('wouldyourather', 'community', 'Cria uma escolha rápida entre duas opções.', 'wouldyourather', async (m) => {
                const choice = (0, conversationService_1.randomWouldYouRather)();
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Você escolheria...').addFields({ name: 'Opção A', value: choice.first }, { name: 'Opção B', value: choice.second }).setColor(0x5865f2).setFooter({ text: 'Responda A ou B no chat' }).setTimestamp()] });
            }),
            this.command('rps', 'community', 'Joga pedra, papel ou tesoura.', 'rps pedra|papel|tesoura', async (m, a) => {
                const player = normalizeRpsChoice(a[0]);
                if (!player)
                    throw new Error('Escolha pedra, papel ou tesoura');
                const options = ['pedra', 'papel', 'tesoura'];
                const opponent = options[Math.floor(Math.random() * options.length)];
                const result = rpsResult(player, opponent);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Pedra, papel ou tesoura').addFields({ name: 'Você', value: capitalize(player), inline: true }, { name: 'Resultado', value: result, inline: true }, { name: 'Adversário', value: capitalize(opponent), inline: true }).setColor(result === 'Você ganhou' ? 0x22c55e : result === 'Empate' ? 0x5865f2 : 0xef4444).setTimestamp()] });
            }),
            this.command('coinflip', 'community', 'Joga uma moeda virtual.', 'coinflip', async (m) => {
                const result = Math.random() < 0.5 ? 'Cara' : 'Coroa';
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Cara ou coroa').setDescription(`O resultado foi **${result}**.`).setColor(0x5865f2).setTimestamp()] });
            }),
            this.command('dice', 'community', 'Rola um dado com a quantidade de lados escolhida.', 'dice [lados]', async (m, a) => {
                const sides = a[0] ? Number(a[0]) : 6;
                if (!Number.isInteger(sides) || sides < 2 || sides > 1000)
                    throw new Error('Informe uma quantidade de lados entre 2 e 1000');
                const result = Math.floor(Math.random() * sides) + 1;
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Dado').setDescription(`Resultado: **${result}** de **${sides}**.`).setColor(0x5865f2).setTimestamp()] });
            }),
            this.command('choose', 'community', 'Escolhe uma opção entre alternativas separadas por barra vertical.', 'choose opção 1 | opção 2', async (m, a) => {
                const options = a.join(' ').split('|').map((value) => value.trim()).filter(Boolean);
                if (options.length < 2 || options.length > 20)
                    throw new Error('Informe de 2 a 20 opções separadas por |');
                const selected = options[Math.floor(Math.random() * options.length)];
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Escolha').setDescription(`Minha escolha foi: **${escapeMarkdown(selected).slice(0, 1900)}**`).setColor(0x5865f2).setTimestamp()] });
            }),
            this.command('eightball', 'community', 'Responde uma pergunta de forma divertida.', 'eightball sua pergunta', async (m, a) => {
                const question = a.join(' ').trim();
                if (!question)
                    throw new Error('Escreva uma pergunta');
                const answers = ['Sim.', 'Não.', 'Provavelmente.', 'Melhor não contar com isso.', 'Os sinais são bons.', 'Tente novamente mais tarde.', 'Pode dar certo.', 'Ainda está incerto.'];
                const index = Math.abs([...question].reduce((total, char) => total + char.charCodeAt(0), 0) + Date.now()) % answers.length;
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Bola 8').addFields({ name: 'Pergunta', value: question.slice(0, 1024) }, { name: 'Resposta', value: answers[index] }).setColor(0x5865f2).setTimestamp()] });
            }),
            this.command('say', 'community', 'Faz o bot enviar uma mensagem simples no canal.', 'say texto', discord_js_1.PermissionFlagsBits.ManageMessages, async (m, a) => {
                const text = a.join(' ').trim();
                if (!text)
                    throw new Error('Informe a mensagem');
                await m.channel.send({ content: text.slice(0, 2000), allowedMentions: { parse: [] } });
                if (m.deletable)
                    await m.delete().catch(() => undefined);
            }),
            this.command('sayembed', 'community', 'Faz o bot enviar uma mensagem em embed.', 'sayembed texto', discord_js_1.PermissionFlagsBits.ManageMessages, async (m, a) => {
                const text = a.join(' ').trim();
                if (!text)
                    throw new Error('Informe a mensagem');
                await m.channel.send({ embeds: [new discord_js_1.EmbedBuilder().setDescription(text.slice(0, 4096)).setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
                if (m.deletable)
                    await m.delete().catch(() => undefined);
            }),
            this.command('joinposition', 'information', 'Mostra a posição aproximada de entrada de um membro no servidor.', 'joinposition [@usuário]', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                await m.guild.members.fetch().catch(() => undefined);
                const ordered = [...m.guild.members.cache.values()].filter((item) => item.joinedTimestamp).sort((x, y) => (x.joinedTimestamp ?? 0) - (y.joinedTimestamp ?? 0));
                const index = ordered.findIndex((item) => item.id === member.id);
                if (index < 0)
                    throw new Error('Não consegui determinar a posição de entrada desse membro');
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() }).setTitle('Posição de entrada').setThumbnail(member.user.displayAvatarURL({ size: 256 })).addFields({ name: 'Membro', value: `${member}\n\`${member.id}\``, inline: true }, { name: 'Posição', value: `**#${index + 1}** de **${ordered.length}**`, inline: true }, { name: 'Entrou', value: `<t:${Math.floor((member.joinedTimestamp ?? Date.now()) / 1000)}:F>`, inline: false }).setColor(member.displayColor || 0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('memberroles', 'information', 'Mostra os cargos de um membro em ordem de hierarquia.', 'memberroles [@usuário]', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                const roles = [...member.roles.cache.values()].filter((role) => role.id !== m.guild.id).sort((x, y) => y.position - x.position);
                const lines = roles.slice(0, 35).map((role, index) => `**${index + 1}.** ${role} — posição **${role.position}**`);
                const extra = roles.length > 35 ? `\n\nMais **${roles.length - 35}** cargo(s) não exibido(s).` : '';
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() }).setTitle(`Cargos de ${member.displayName}`).setDescription(`${lines.join('\n') || 'Nenhum cargo além de @everyone.'}${extra}`.slice(0, 4096)).setFooter({ text: `Total: ${roles.length}` }).setColor(member.displayColor || 0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('rolecompare', 'information', 'Compara cargos em comum e exclusivos entre dois membros.', 'rolecompare @usuário @usuário', async (m, a) => {
                const first = await resolveMember(m, a.shift());
                const second = await resolveMember(m, a.shift());
                if (first.id === second.id)
                    throw new Error('Mencione dois membros diferentes');
                const firstRoles = [...first.roles.cache.values()].filter((role) => role.id !== m.guild.id && !role.managed);
                const secondIds = new Set([...second.roles.cache.keys()]);
                const common = firstRoles.filter((role) => secondIds.has(role.id));
                const firstOnly = firstRoles.filter((role) => !secondIds.has(role.id));
                const firstIds = new Set(firstRoles.map((role) => role.id));
                const secondOnly = [...second.roles.cache.values()].filter((role) => role.id !== m.guild.id && !role.managed && !firstIds.has(role.id));
                const show = (roles) => roles.slice(0, 15).map((role) => `${role}`).join(' ') || 'Nenhum';
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Comparação de cargos').setDescription(`**${escapeMarkdown(first.displayName)}** × **${escapeMarkdown(second.displayName)}**`).addFields({ name: `Em comum (${common.length})`, value: show(common), inline: false }, { name: `Só ${escapeMarkdown(first.displayName)} (${firstOnly.length})`, value: show(firstOnly), inline: false }, { name: `Só ${escapeMarkdown(second.displayName)} (${secondOnly.length})`, value: show(secondOnly), inline: false }).setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('voicewho', 'information', 'Lista quem está conectado em uma call.', 'voicewho [#canal]', async (m, a) => {
                const channel = resolveChannel(m, a[0]) ?? m.member.voice.channel;
                if (!channel?.isVoiceBased?.())
                    throw new Error('Entre em uma call ou mencione um canal de voz');
                const members = [...channel.members.values()].sort((x, y) => x.displayName.localeCompare(y.displayName));
                const lines = members.slice(0, 35).map((member, index) => `**${index + 1}.** ${member} — ${member.voice.serverMute ? 'mute servidor' : member.voice.selfMute ? 'mutado' : 'falando disponível'}${member.voice.serverDeaf ? ' • deaf servidor' : ''}`);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Membros em ${channel.name}`).setDescription(lines.join('\n') || 'Ninguém conectado nesta call.').addFields({ name: 'Total', value: `**${members.length}** membro(s)`, inline: true }, { name: 'Limite', value: channel.userLimit ? `**${channel.userLimit}**` : 'Sem limite', inline: true }).setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('serversecurity', 'information', 'Mostra um diagnóstico rápido das configurações nativas de segurança do servidor.', 'serversecurity', discord_js_1.PermissionFlagsBits.ManageGuild, async (m) => {
                const automod = await m.guild.autoModerationRules?.fetch?.().catch(() => null);
                const bot = m.guild.members.me;
                const important = [['Ver auditoria', discord_js_1.PermissionFlagsBits.ViewAuditLog], ['Gerenciar cargos', discord_js_1.PermissionFlagsBits.ManageRoles], ['Gerenciar canais', discord_js_1.PermissionFlagsBits.ManageChannels], ['Banir membros', discord_js_1.PermissionFlagsBits.BanMembers], ['Moderar membros', discord_js_1.PermissionFlagsBits.ModerateMembers], ['Gerenciar webhooks', discord_js_1.PermissionFlagsBits.ManageWebhooks]];
                const missing = important.filter(([, flag]) => !bot?.permissions?.has(flag)).map(([name]) => name);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: m.guild.name, iconURL: m.guild.iconURL({ size: 256 }) ?? undefined }).setTitle('Diagnóstico do servidor').addFields({ name: 'Verificação', value: `Nível: **${String(m.guild.verificationLevel)}**\nMFA da moderação: **${String(m.guild.mfaLevel)}**`, inline: true }, { name: 'Conteúdo', value: `Filtro explícito: **${String(m.guild.explicitContentFilter)}**\nNotificações padrão: **${String(m.guild.defaultMessageNotifications)}**`, inline: true }, { name: 'AutoMod', value: automod ? `**${automod.size}** regra(s) encontrada(s)` : 'Não foi possível consultar', inline: true }, { name: 'Permissões importantes do bot', value: missing.length ? `Faltando: ${missing.join(', ')}` : 'Todas as permissões principais estão disponíveis.', inline: false }).setColor(missing.length ? 0xe67e22 : 0x2ecc71).setTimestamp()] });
            }),
            this.command('stafflist', 'information', 'Lista membros com permissões administrativas ou de moderação.', 'stafflist', discord_js_1.PermissionFlagsBits.ManageGuild, async (m) => {
                await m.guild.members.fetch().catch(() => undefined);
                const flags = [discord_js_1.PermissionFlagsBits.Administrator, discord_js_1.PermissionFlagsBits.ManageGuild, discord_js_1.PermissionFlagsBits.BanMembers, discord_js_1.PermissionFlagsBits.KickMembers, discord_js_1.PermissionFlagsBits.ModerateMembers];
                const staff = [...m.guild.members.cache.values()].filter((member) => !member.user.bot && flags.some(flag => member.permissions.has(flag))).sort((x, y) => y.roles.highest.position - x.roles.highest.position);
                const lines = staff.slice(0, 30).map((member, index) => {
                    const powers = [];
                    if (member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator))
                        powers.push('Admin');
                    else {
                        if (member.permissions.has(discord_js_1.PermissionFlagsBits.ManageGuild))
                            powers.push('Gerenciar servidor');
                        if (member.permissions.has(discord_js_1.PermissionFlagsBits.BanMembers))
                            powers.push('Ban');
                        if (member.permissions.has(discord_js_1.PermissionFlagsBits.KickMembers))
                            powers.push('Kick');
                        if (member.permissions.has(discord_js_1.PermissionFlagsBits.ModerateMembers))
                            powers.push('Moderar');
                    }
                    return `**${index + 1}.** ${member} — ${powers.join(', ') || 'Staff'}`;
                });
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Equipe de ${m.guild.name}`).setDescription(lines.join('\n') || 'Nenhum membro da equipe encontrado.').setFooter({ text: `Total encontrado: ${staff.length}` }).setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('permissionshere', 'information', 'Mostra as permissões efetivas de um membro no canal atual.', 'permissionshere [@usuário]', async (m, a) => {
                const member = await resolveMember(m, a[0]);
                const perms = m.channel.permissionsFor?.(member);
                if (!perms)
                    throw new Error('Não foi possível calcular as permissões neste canal');
                const checks = [['Ver canal', discord_js_1.PermissionFlagsBits.ViewChannel], ['Enviar mensagens', discord_js_1.PermissionFlagsBits.SendMessages], ['Gerenciar mensagens', discord_js_1.PermissionFlagsBits.ManageMessages], ['Gerenciar canal', discord_js_1.PermissionFlagsBits.ManageChannels], ['Conectar', discord_js_1.PermissionFlagsBits.Connect], ['Falar', discord_js_1.PermissionFlagsBits.Speak], ['Mover membros', discord_js_1.PermissionFlagsBits.MoveMembers], ['Mencionar everyone', discord_js_1.PermissionFlagsBits.MentionEveryone]];
                const allowed = checks.filter(([, flag]) => perms.has(flag)).map(([name]) => name);
                const denied = checks.filter(([, flag]) => !perms.has(flag)).map(([name]) => name);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() }).setTitle(`Permissões em #${m.channel.name ?? 'canal'}`).addFields({ name: 'Permitidas', value: allowed.join('\n') || 'Nenhuma', inline: true }, { name: 'Sem acesso', value: denied.join('\n') || 'Nenhuma', inline: true }).setColor(member.displayColor || 0x111111).setTimestamp()] });
            }),
            this.command('serveremojis', 'information', 'Lista os emojis personalizados do servidor.', 'serveremojis', async (m) => {
                const collection = await m.guild.emojis.fetch().catch(() => m.guild.emojis.cache);
                const emojis = [...collection.values()];
                const staticCount = emojis.filter((emoji) => !emoji.animated).length;
                const animatedCount = emojis.filter((emoji) => emoji.animated).length;
                const lines = emojis.slice(0, 40).map((emoji) => `${emoji} \`${emoji.name}\` — \`${emoji.id}\``);
                const extra = emojis.length > 40 ? `\n\nMais **${emojis.length - 40}** não exibido(s).` : '';
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Emojis de ${m.guild.name}`).setDescription(`${lines.join('\n') || 'Nenhum emoji personalizado encontrado.'}${extra}`.slice(0, 4096)).addFields({ name: 'Estáticos', value: String(staticCount), inline: true }, { name: 'Animados', value: String(animatedCount), inline: true }, { name: 'Total', value: String(emojis.length), inline: true }).setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('serverstickers', 'information', 'Lista os stickers personalizados do servidor.', 'serverstickers', async (m) => {
                const collection = await m.guild.stickers.fetch().catch(() => m.guild.stickers.cache);
                const stickers = [...collection.values()];
                const lines = stickers.slice(0, 35).map((sticker, index) => `**${index + 1}.** ${escapeMarkdown(sticker.name)} — \`${sticker.id}\`${sticker.description ? `\n${escapeMarkdown(sticker.description).slice(0, 120)}` : ''}`);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Stickers de ${m.guild.name}`).setDescription(lines.join('\n') || 'Nenhum sticker personalizado encontrado.').setFooter({ text: `Total: ${stickers.length}` }).setColor(0x111111).setTimestamp()] });
            }),
            this.command('snowflake', 'utility', 'Mostra quando um ID do Discord foi criado.', 'snowflake ID', async (m, a) => {
                const id = extractId(a[0]) ?? String(a[0] ?? '').trim();
                if (!/^\d{16,22}$/.test(id))
                    throw new Error('Informe um ID válido do Discord');
                let created;
                try {
                    created = Number((BigInt(id) >> 22n) + 1420070400000n);
                }
                catch {
                    throw new Error('ID inválido');
                }
                if (!Number.isFinite(created) || created < Date.UTC(2015, 0, 1) || created > Date.now() + 86400000)
                    throw new Error('Esse ID não parece ser um snowflake válido do Discord');
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Informações do ID').addFields({ name: 'Snowflake', value: `\`${id}\``, inline: false }, { name: 'Criado em', value: `<t:${Math.floor(created / 1000)}:F>`, inline: true }, { name: 'Relativo', value: `<t:${Math.floor(created / 1000)}:R>`, inline: true }).setColor(0x111111).setTimestamp()] });
            }),
            this.command('countdown', 'utility', 'Cria uma contagem regressiva usando o horário nativo do Discord.', 'countdown duração [texto]', async (m, a) => {
                const duration = parseDuration(a.shift() ?? '');
                if (duration === null || duration < 1)
                    throw new Error('Use uma duração como 30s, 10m, 2h, 3d ou 1w');
                const label = a.join(' ').trim().slice(0, 200);
                const when = Date.now() + duration * 1000;
                const unix = Math.floor(when / 1000);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(label || 'Contagem regressiva').setDescription(`Termina <t:${unix}:R>\n<t:${unix}:F>`).setFooter({ text: `Criado por ${m.author.username}` }).setColor(0x5865f2).setTimestamp()] });
            }),
            this.command('massmove', 'moderation', 'Move todos os membros de uma call para outra.', 'massmove #origem #destino', discord_js_1.PermissionFlagsBits.MoveMembers, async (m, a, c) => {
                const first = resolveChannel(m, a[0]);
                const second = resolveChannel(m, a[1]);
                const source = second ? first : m.member.voice.channel;
                const destination = second ?? first;
                if (!source?.isVoiceBased?.() || !destination?.isVoiceBased?.())
                    throw new Error('Informe canais de voz válidos ou entre na call de origem e mencione o destino');
                if (source.id === destination.id)
                    throw new Error('A origem e o destino precisam ser diferentes');
                const members = [...source.members.values()];
                if (!members.length)
                    throw new Error('Não há membros na call de origem');
                const progress = await m.reply({ embeds: [this.noticeEmbed('Movendo membros', `${emojis_1.UI_LOADING_MENTION} Processando **${members.length}** membro(s) de ${source} para ${destination}...`, 0x5865f2)], allowedMentions: { parse: [] } });
                let moved = 0;
                const failed = [];
                for (const member of members) {
                    try {
                        await member.voice.setChannel(destination, `Movido em massa por ${m.author.tag}`);
                        moved++;
                    }
                    catch {
                        failed.push(member.user.tag);
                    }
                }
                await progress.edit({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Movimentação concluída').addFields({ name: 'Origem', value: `${source}`, inline: true }, { name: 'Destino', value: `${destination}`, inline: true }, { name: 'Movidos', value: `**${moved}**`, inline: true }, { name: 'Erros', value: `**${failed.length}**`, inline: true }, ...(failed.length ? [{ name: 'Não movidos', value: failed.slice(0, 15).map(name => `\`${escapeMarkdown(name)}\``).join(', ').slice(0, 1024), inline: false }] : [])).setColor(failed.length ? 0xe67e22 : 0x2ecc71).setTimestamp()], allowedMentions: { parse: [] } });
                await this.logModeration(m, c, 'voice_move', null, { sourceId: source.id, destinationId: destination.id, moved, failed: failed.length, mass: true });
            }),
            this.command('disconnectvoice', 'moderation', 'Desconecta um membro da call atual.', 'disconnectvoice @usuário', discord_js_1.PermissionFlagsBits.MoveMembers, async (m, a, c) => {
                const member = await resolveMember(m, a[0]);
                if (!member.voice.channelId)
                    throw new Error('Esse membro não está em uma call');
                const channelId = member.voice.channelId;
                await member.voice.disconnect(`Desconectado por ${m.author.tag}`);
                await this.replyTemporary(m, { embeds: [new discord_js_1.EmbedBuilder().setTitle('Membro desconectado').setDescription(`${member} foi desconectado da call.`).addFields({ name: 'Responsável', value: `${m.author}`, inline: true }, { name: 'Canal anterior', value: `<#${channelId}>`, inline: true }).setColor(0x2ecc71).setTimestamp()], allowedMentions: { parse: [] } });
                await this.logModeration(m, c, 'voice_move', member.id, { disconnected: true, channelId });
            }),
            this.command('serverstats', 'information', 'Mostra estatísticas resumidas do servidor.', 'serverstats', async (m) => {
                await m.guild.members.fetch().catch(() => undefined);
                const channels = m.guild.channels.cache;
                const members = m.guild.members.cache;
                const humans = members.filter((member) => !member.user.bot).size;
                const bots = members.filter((member) => member.user.bot).size;
                const textChannels = channels.filter((channel) => channel.isTextBased?.() && !channel.isThread?.() && !channel.isVoiceBased?.()).size;
                const voiceChannels = channels.filter((channel) => channel.isVoiceBased?.()).size;
                const categories = channels.filter((channel) => channel.type === discord_js_1.ChannelType.GuildCategory).size;
                const threads = channels.filter((channel) => channel.isThread?.()).size;
                const inVoice = members.filter((member) => Boolean(member.voice?.channelId)).size;
                const embed = new discord_js_1.EmbedBuilder().setAuthor({ name: m.guild.name, iconURL: m.guild.iconURL({ size: 256 }) ?? undefined }).setTitle('Estatísticas do servidor').addFields({ name: 'Membros', value: `Total: **${m.guild.memberCount}**\nPessoas: **${humans}**\nBots: **${bots}**`, inline: true }, { name: 'Canais', value: `Texto: **${textChannels}**\nVoz: **${voiceChannels}**\nCategorias: **${categories}**`, inline: true }, { name: 'Comunidade', value: `Em call: **${inVoice}**\nThreads: **${threads}**\nCargos: **${Math.max(0, m.guild.roles.cache.size - 1)}**`, inline: true }, { name: 'Impulsos', value: `**${m.guild.premiumSubscriptionCount ?? 0}** boost(s) • nível **${m.guild.premiumTier}**`, inline: false }).setColor(0x111111).setTimestamp();
                const icon = m.guild.iconURL({ size: 512 });
                if (icon)
                    embed.setThumbnail(icon);
                await m.reply({ embeds: [embed] });
            }),
            this.command('serverage', 'information', 'Mostra há quanto tempo o servidor foi criado.', 'serverage', async (m) => {
                const created = m.guild.createdTimestamp;
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Idade de ${m.guild.name}`).setDescription(`Criado em <t:${Math.floor(created / 1000)}:F>\nIsso foi <t:${Math.floor(created / 1000)}:R>.`).setColor(0x111111).setTimestamp()] });
            }),
            this.command('oldest', 'information', 'Mostra as contas mais antigas presentes no servidor.', 'oldest', async (m) => {
                await m.guild.members.fetch().catch(() => undefined);
                const members = [...m.guild.members.cache.values()].filter((member) => !member.user.bot).sort((a, b) => a.user.createdTimestamp - b.user.createdTimestamp).slice(0, 10);
                if (!members.length)
                    throw new Error('Não encontrei membros para listar');
                const lines = members.map((member, index) => `**${index + 1}.** ${member} — <t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Contas mais antigas').setDescription(lines.join('\n')).setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('newest', 'information', 'Mostra as contas mais novas presentes no servidor.', 'newest', async (m) => {
                await m.guild.members.fetch().catch(() => undefined);
                const members = [...m.guild.members.cache.values()].filter((member) => !member.user.bot).sort((a, b) => b.user.createdTimestamp - a.user.createdTimestamp).slice(0, 10);
                if (!members.length)
                    throw new Error('Não encontrei membros para listar');
                const lines = members.map((member, index) => `**${index + 1}.** ${member} — <t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Contas mais novas').setDescription(lines.join('\n')).setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('toproles', 'information', 'Mostra os cargos com mais membros.', 'toproles', async (m) => {
                await m.guild.members.fetch().catch(() => undefined);
                const roles = [...m.guild.roles.cache.values()].filter((role) => role.id !== m.guild.id && !role.managed).sort((a, b) => b.members.size - a.members.size || b.position - a.position).slice(0, 10);
                if (!roles.length)
                    throw new Error('Não há cargos para listar');
                const lines = roles.map((role, index) => `**${index + 1}.** ${role} — **${role.members.size}** membro${role.members.size === 1 ? '' : 's'}`);
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(`Cargos mais usados em ${m.guild.name}`).setDescription(lines.join('\n')).setColor(0x111111).setTimestamp()], allowedMentions: { parse: [] } });
            }),
            this.command('randomnumber', 'utility', 'Gera um número aleatório dentro de um intervalo.', 'randomnumber [mínimo] [máximo]', async (m, a) => {
                const minimum = a[0] === undefined ? 1 : Number(a[0]);
                const maximum = a[1] === undefined ? 100 : Number(a[1]);
                if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum))
                    throw new Error('Use apenas números inteiros');
                if (minimum > maximum)
                    throw new Error('O valor mínimo precisa ser menor ou igual ao máximo');
                if (maximum - minimum > 1_000_000_000)
                    throw new Error('Use um intervalo de até 1 bilhão');
                const value = Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
                await m.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Número aleatório').setDescription(`Entre **${minimum}** e **${maximum}**, saiu **${value}**.`).setColor(0x5865f2).setTimestamp()] });
            }),
            this.command('case', 'moderation', 'Consulta um caso de moderação pelo identificador.', 'case CASE-000001', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => {
                const query = String(a[0] ?? '').toUpperCase();
                const item = c.moderation.cases.find(entry => entry.id.toUpperCase() === query);
                if (!item)
                    throw new Error('Caso de moderação não encontrado');
                await m.reply({ embeds: [moderationCaseEmbed(item)] });
            }),
            this.command('cases', 'moderation', 'Lista os casos recentes de um usuário.', 'cases [@usuário]', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => {
                const targetId = extractId(a[0]);
                const list = c.moderation.cases.filter(item => !targetId || item.targetId === targetId).slice(-10).reverse();
                await m.reply(list.length ? `Casos recentes${targetId ? ` de <@${targetId}>` : ''}:
${list.map(formatCaseLine).join('\n')}` : 'Nenhum caso de moderação encontrado.');
            }),
            this.command('modlogs', 'moderation', 'Mostra os casos de moderação mais recentes.', 'modlogs', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, _a, c) => {
                const list = c.moderation.cases.slice(-15).reverse();
                await m.reply(list.length ? `Últimos casos de moderação:
${list.map(formatCaseLine).join('\n')}` : 'Nenhum caso de moderação registrado.');
            }),
            this.command('ticket', 'community', 'Abre a central com os painéis de ticket disponíveis.', 'ticket', async (m, a, c) => this.tickets.handleCommand(m, 'ticket', a, c)),
            this.command('ticketadd', 'community', 'Adiciona um membro ao ticket atual.', 'ticketadd @usuário', async (m, a, c) => this.tickets.handleCommand(m, 'ticketadd', a, c)),
            this.command('ticketremove', 'community', 'Remove um membro do ticket atual.', 'ticketremove @usuário', async (m, a, c) => this.tickets.handleCommand(m, 'ticketremove', a, c)),
            this.command('ticketclaim', 'community', 'Assume o atendimento do ticket atual.', 'ticketclaim', async (m, a, c) => this.tickets.handleCommand(m, 'ticketclaim', a, c)),
            this.command('ticketunclaim', 'community', 'Libera o atendimento do ticket atual.', 'ticketunclaim', async (m, a, c) => this.tickets.handleCommand(m, 'ticketunclaim', a, c)),
            this.command('ticketclose', 'community', 'Fecha o ticket atual e gera transcript quando configurado.', 'ticketclose [motivo]', async (m, a, c) => this.tickets.handleCommand(m, 'ticketclose', a, c)),
            this.command('ticketreopen', 'community', 'Reabre o ticket atual.', 'ticketreopen', async (m, a, c) => this.tickets.handleCommand(m, 'ticketreopen', a, c)),
            this.command('ticketdelete', 'community', 'Exclui o ticket atual após aviso.', 'ticketdelete', discord_js_1.PermissionFlagsBits.ManageChannels, async (m, a, c) => this.tickets.handleCommand(m, 'ticketdelete', a, c)),
            this.command('ticketrename', 'community', 'Altera o nome do ticket atual.', 'ticketrename novo nome', async (m, a, c) => this.tickets.handleCommand(m, 'ticketrename', a, c)),
            this.command('ticketpriority', 'community', 'Altera a prioridade do ticket.', 'ticketpriority baixa|normal|alta|urgente', async (m, a, c) => this.tickets.handleCommand(m, 'ticketpriority', a, c)),
            this.command('tickettransfer', 'community', 'Transfere o ticket para outro painel ou setor.', 'tickettransfer nome do setor', async (m, a, c) => this.tickets.handleCommand(m, 'tickettransfer', a, c)),
            this.command('ticketpause', 'community', 'Pausa o fechamento automático por inatividade.', 'ticketpause', async (m, a, c) => this.tickets.handleCommand(m, 'ticketpause', a, c)),
            this.command('ticketresume', 'community', 'Reativa o fechamento automático.', 'ticketresume', async (m, a, c) => this.tickets.handleCommand(m, 'ticketresume', a, c)),
            this.command('ticketinfo', 'community', 'Mostra informações do ticket atual.', 'ticketinfo', async (m, a, c) => this.tickets.handleCommand(m, 'ticketinfo', a, c)),
            this.command('tickettranscript', 'community', 'Gera o transcript HTML do ticket atual.', 'tickettranscript', async (m, a, c) => this.tickets.handleCommand(m, 'tickettranscript', a, c)),
            this.command('tickets', 'community', 'Lista tickets de um usuário.', 'tickets [@usuário]', async (m, a, c) => this.tickets.handleCommand(m, 'tickets', a, c)),
            this.command('ticketsearch', 'community', 'Procura um ticket pelo número ou ID.', 'ticketsearch ID', async (m, a, c) => this.tickets.handleCommand(m, 'ticketsearch', a, c)),
            this.command('ticketblock', 'community', 'Bloqueia um usuário de abrir tickets no painel atual.', 'ticketblock @usuário', async (m, a, c) => this.tickets.handleCommand(m, 'ticketblock', a, c)),
            this.command('ticketunblock', 'community', 'Remove o bloqueio de abertura no painel atual.', 'ticketunblock @usuário', async (m, a, c) => this.tickets.handleCommand(m, 'ticketunblock', a, c)),
            this.command('quarantine', 'protection', 'Aplica o cargo de quarentena configurado.', 'quarantine @usuário [motivo]', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => { const member = await resolveMember(m, a.shift()); if (!c.quarantine.roleId)
                throw new Error('Cargo de quarentena não configurado'); const role = m.guild.roles.cache.get(c.quarantine.roleId); if (!role)
                throw new Error('Cargo de quarentena inexistente'); const previous = member.roles.cache.filter((r) => r.id !== m.guild.id && !r.managed).map((r) => r.id); await member.roles.add(role, `Quarentena por ${m.author.tag}`); c.quarantine.active[member.id] = { previousRoles: previous, expiresAt: null, incidentId: `MANUAL-${(0, ids_1.randomId)(6)}` }; await guildConfigStore_1.guildConfigStore.set(m.guild.id, c); await this.replyTemporary(m, { content: `${member} foi colocado em quarentena.`, allowedMentions: { users: [member.id] } }); }),
            this.command('unquarantine', 'protection', 'Remove a quarentena e restaura cargos possíveis.', 'unquarantine @usuário', discord_js_1.PermissionFlagsBits.ModerateMembers, async (m, a, c) => { const member = await resolveMember(m, a.shift()); const active = c.quarantine.active[member.id]; if (c.quarantine.roleId)
                await member.roles.remove(c.quarantine.roleId, `Quarentena removida por ${m.author.tag}`).catch(() => undefined); if (active && c.quarantine.restorePreviousRoles)
                await member.roles.add(active.previousRoles, `Restauração por ${m.author.tag}`).catch(() => undefined); delete c.quarantine.active[member.id]; await guildConfigStore_1.guildConfigStore.set(m.guild.id, c); await this.replyTemporary(m, { content: `Quarentena removida de ${member}.`, allowedMentions: { users: [member.id] } }); })
        ];
    }
    async purgeMessages(message, amount, predicate) {
        if (!message.channel?.messages?.fetch || typeof message.channel.bulkDelete !== 'function')
            throw new Error('Este canal não suporta limpeza em massa');
        const fetched = await message.channel.messages.fetch({ limit: 100 });
        const selected = fetched.filter((item) => item.id !== message.id && predicate(item)).first(amount);
        if (!selected.length)
            return 0;
        const deleted = await message.channel.bulkDelete(selected, true);
        return deleted.size;
    }
    async sendAvatarEffect(message, args, config, effect, title) {
        const member = await resolveMember(message, args[0]);
        const buffer = await (0, funCanvas_1.createAvatarEffectCard)({ id: member.id, displayName: member.displayName, username: member.user.username, avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 512 }) }, effect);
        await message.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle(title).setDescription(`Efeito aplicado ao avatar de ${member}.`).setImage(`attachment://${effect}.png`).setColor(0x5865f2).setTimestamp()], files: [new discord_js_1.AttachmentBuilder(buffer, { name: `${effect}.png` })], allowedMentions: { parse: [] } });
        await (0, communityLogger_1.logCommunityEvent)({ guild: message.guild, config, event: 'fun_canvas_used', module: 'community_fun', executorId: message.author.id, targetId: member.id, channelId: message.channelId, severity: 'info', details: { effect } }).catch(() => undefined);
    }
    async openGuildRoles(message, args, config) {
        const targetId = extractId(args.shift());
        if (!targetId)
            throw new Error('Mencione o usuário que terá os cargos gerenciados');
        const target = await message.guild.members.fetch(targetId).catch(() => null);
        if (!target)
            throw new Error('Membro não encontrado');
        this.ensureTargetHierarchy(message, target, 'role');
        const roles = this.availableGuildRoles(message.guild, message.member);
        if (!roles.length)
            throw new Error('Não existem cargos gerenciáveis abaixo do seu maior cargo');
        await message.channel.send(this.guildRolesPayload(message.member, target, roles, 0));
        await this.logModeration(message, config, 'groles_opened', target.id, { availableRoles: roles.length });
    }
    async requestChannelNuke(message, config) {
        const channel = message.channel;
        if (!channel || channel.isThread?.() || typeof channel.clone !== 'function')
            throw new Error('O comando nuke só pode ser usado em um canal normal do servidor');
        const botMember = message.guild.members.me;
        if (!botMember?.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels))
            throw new Error('O bot precisa da permissão Gerenciar Canais');
        const expiresAt = Date.now() + 30_000;
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`nuke|${message.author.id}|${channel.id}|confirm|${expiresAt}`).setLabel('Confirmar recriação').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId(`nuke|${message.author.id}|${channel.id}|cancel|${expiresAt}`).setLabel('Cancelar').setStyle(discord_js_1.ButtonStyle.Secondary));
        const sent = await message.reply({
            embeds: [new discord_js_1.EmbedBuilder()
                    .setTitle('Confirmar recriação do canal')
                    .setDescription('O canal atual será clonado com o mesmo nome, categoria e permissões. O canal antigo será excluído junto com as mensagens dele. Esta confirmação expira em 30 segundos.')
                    .addFields({ name: 'Canal', value: `${channel}\n\`${channel.id}\``, inline: true }, { name: 'Responsável', value: `${message.author}`, inline: true })
                    .setColor(0xed4245)
                    .setTimestamp()],
            components: [row],
            allowedMentions: { parse: [] }
        });
        setTimeout(() => void sent.edit({
            embeds: [this.noticeEmbed('Confirmação expirada', 'Execute o comando novamente para recriar o canal.', 0xe67e22)],
            components: []
        }).catch(() => undefined), 30_000);
        await this.logCommand(message, config, 'config_update', 'nuke', 'confirmation_requested');
    }
    async handleNukeInteraction(interaction) {
        const [, ownerId, channelId, action, expiresRaw] = String(interaction.customId).split('|');
        if (!ownerId || !channelId || !action)
            return false;
        if (interaction.user.id !== ownerId) {
            await interaction.reply({ embeds: [this.noticeEmbed('Acesso negado', 'Somente quem executou o comando pode confirmar esta ação.', 0xe74c3c)], flags: discord_js_1.MessageFlags.Ephemeral });
            return true;
        }
        if (!interaction.guild || !interaction.guildId)
            return true;
        if (Date.now() > Number(expiresRaw ?? 0)) {
            await interaction.update({ embeds: [this.noticeEmbed('Confirmação expirada', 'Execute o comando novamente para recriar o canal.', 0xe67e22)], components: [] }).catch(() => undefined);
            return true;
        }
        if (action === 'cancel') {
            await interaction.update({ embeds: [this.noticeEmbed('Operação cancelada', 'O canal não foi alterado.', 0x5865f2)], components: [] });
            return true;
        }
        if (action !== 'confirm')
            return false;
        await interaction.deferUpdate();
        try {
            const [actor, config, channel] = await Promise.all([
                interaction.guild.members.fetch(interaction.user.id),
                guildConfigStore_1.guildConfigStore.get(interaction.guildId),
                interaction.guild.channels.fetch(channelId)
            ]);
            if (!actor.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels))
                throw new Error('Você não possui mais a permissão Gerenciar Canais');
            const botMember = interaction.guild.members.me;
            if (!botMember?.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels))
                throw new Error('O bot precisa da permissão Gerenciar Canais');
            if (!channel || channel.isThread?.() || typeof channel.clone !== 'function')
                throw new Error('O canal não está mais disponível para recriação');
            const oldPosition = channel.position ?? 0;
            const oldName = channel.name ?? 'canal';
            const newChannel = await channel.clone({ reason: `Canal recriado por ${interaction.user.tag} via !nuke` });
            if (typeof newChannel.setPosition === 'function')
                await newChannel.setPosition(oldPosition).catch(() => undefined);
            await (0, communityLogger_1.logCommunityEvent)({
                guild: interaction.guild,
                config,
                event: 'channel_nuke',
                module: 'moderation_commands',
                executorId: interaction.user.id,
                targetId: channelId,
                channelId: newChannel.id,
                severity: 'high',
                details: { oldChannelId: channelId, newChannelId: newChannel.id, oldName }
            }).catch(() => undefined);
            await guildConfigStore_1.guildConfigStore.set(interaction.guildId, config).catch(() => undefined);
            await channel.delete(`Canal recriado por ${interaction.user.tag} via !nuke`);
            if (newChannel.isTextBased?.() && 'send' in newChannel) {
                const notice = await newChannel.send({
                    embeds: [new discord_js_1.EmbedBuilder().setTitle('Canal recriado').setDescription(`Este canal foi recriado por ${interaction.user}.`).setColor(0x57f287).setTimestamp()],
                    allowedMentions: { users: [interaction.user.id] }
                }).catch(() => null);
                if (notice)
                    setTimeout(() => void notice.delete().catch(() => undefined), 10_000);
            }
        }
        catch (error) {
            await interaction.followUp({
                embeds: [this.noticeEmbed('Não foi possível recriar o canal', friendlyError(error instanceof Error ? error.message : String(error)), 0xe74c3c)],
                flags: discord_js_1.MessageFlags.Ephemeral
            }).catch(() => undefined);
        }
        return true;
    }
    async handleGuildRolesInteraction(interaction) {
        const [, ownerId, targetId, currentPageRaw, action, value] = String(interaction.customId).split('|');
        if (!ownerId || !targetId || !action)
            return false;
        if (interaction.user.id !== ownerId) {
            await interaction.reply({ content: 'Somente quem abriu este painel pode gerenciar os cargos.', flags: discord_js_1.MessageFlags.Ephemeral });
            return true;
        }
        if (!interaction.guild || !interaction.guildId) {
            await interaction.reply({ content: 'Este painel só funciona dentro de um servidor.', flags: discord_js_1.MessageFlags.Ephemeral });
            return true;
        }
        await interaction.deferUpdate();
        try {
            if (action === 'close') {
                await interaction.deleteReply();
                return true;
            }
            const [actor, target, config] = await Promise.all([
                interaction.guild.members.fetch(ownerId),
                interaction.guild.members.fetch(targetId),
                guildConfigStore_1.guildConfigStore.get(interaction.guildId)
            ]);
            if (!actor.permissions.has(discord_js_1.PermissionFlagsBits.ManageRoles))
                throw new Error('Você não possui mais a permissão Gerenciar Cargos');
            this.ensureInteractionTargetHierarchy(interaction.guild, actor, target);
            const roles = this.availableGuildRoles(interaction.guild, actor);
            let page = Math.max(0, Number(currentPageRaw) || 0);
            if (action === 'prev' || action === 'next')
                page = Math.max(0, Number(value) || 0);
            if (action === 'toggle' || action === 'select') {
                const selectedRoleId = action === 'select' ? String(interaction.values?.[0] ?? '') : String(value ?? '');
                const role = roles.find((item) => item.id === selectedRoleId);
                if (!role)
                    throw new Error('Esse cargo não está disponível para você ou está acima da sua hierarquia');
                const removing = target.roles.cache.has(role.id);
                if (removing)
                    await target.roles.remove(role, `Removido por ${interaction.user.tag} via !groles`);
                else
                    await target.roles.add(role, `Adicionado por ${interaction.user.tag} via !groles`);
                const roleIndex = roles.findIndex((item) => item.id === role.id);
                if (roleIndex >= 0)
                    page = Math.floor(roleIndex / 5);
                await (0, communityLogger_1.logCommunityEvent)({
                    guild: interaction.guild,
                    config,
                    event: removing ? 'member_role_remove' : 'member_role_add',
                    module: 'moderation_groles',
                    executorId: interaction.user.id,
                    targetId: target.id,
                    channelId: interaction.channelId,
                    severity: 'medium',
                    details: { roleId: role.id, source: action === 'select' ? 'groles_search' : 'groles' }
                });
                await guildConfigStore_1.guildConfigStore.set(interaction.guildId, config);
            }
            const refreshedTarget = await interaction.guild.members.fetch(targetId);
            await interaction.editReply(this.guildRolesPayload(actor, refreshedTarget, roles, page));
        }
        catch (error) {
            await interaction.followUp({
                embeds: [this.noticeEmbed('Não foi possível atualizar os cargos', friendlyError(error instanceof Error ? error.message : 'Tente novamente.'), 0xe74c3c)],
                flags: discord_js_1.MessageFlags.Ephemeral
            }).catch(() => undefined);
        }
        return true;
    }
    guildRolesPayload(actor, target, roles, requestedPage) {
        const pageSize = 5;
        const pageCount = Math.max(1, Math.ceil(roles.length / pageSize));
        const page = Math.min(Math.max(0, requestedPage), pageCount - 1);
        const visible = roles.slice(page * pageSize, page * pageSize + pageSize);
        const container = new discord_js_1.ContainerBuilder().setAccentColor(0x111111);
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`## Gerenciamento de cargos\nAlvo: **${escapeMarkdown(target.displayName ?? target.user.username)}** — <@${target.id}>\nExecutor: <@${actor.id}>\nPágina **${page + 1}/${pageCount}** • somente cargos abaixo do executor e do bot.`));
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small));
        container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder()
            .setCustomId(`groles|${actor.id}|${target.id}|${page}|select|0`)
            .setPlaceholder('Pesquisar ou selecionar um cargo')
            .setMinValues(1)
            .setMaxValues(1)));
        for (const role of visible) {
            const hasRole = target.roles.cache.has(role.id);
            container.addSectionComponents(new discord_js_1.SectionBuilder()
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`### ${escapeMarkdown(role.name)}\n<@&${role.id}> • posição ${role.position}\nPermissões: ${this.rolePermissionSummary(role)}`))
                .setButtonAccessory(new discord_js_1.ButtonBuilder()
                .setCustomId(`groles|${actor.id}|${target.id}|${page}|toggle|${role.id}`)
                .setLabel(hasRole ? 'Remover' : 'Adicionar')
                .setEmoji(hasRole ? emojis_1.UI_EMOJIS.subtract : emojis_1.UI_EMOJIS.add)
                .setStyle(hasRole ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Success)));
        }
        const navigation = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`groles|${actor.id}|${target.id}|${page}|prev|${Math.max(0, page - 1)}`).setLabel('Anterior').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(page === 0), new discord_js_1.ButtonBuilder().setCustomId(`groles|${actor.id}|${target.id}|${page}|next|${Math.min(pageCount - 1, page + 1)}`).setLabel('Próxima').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(page >= pageCount - 1), new discord_js_1.ButtonBuilder().setCustomId(`groles|${actor.id}|${target.id}|${page}|close|0`).setEmoji(emojis_1.UI_EMOJIS.close).setStyle(discord_js_1.ButtonStyle.Danger));
        container.addActionRowComponents(navigation);
        return { components: [container], flags: discord_js_1.MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
    }
    availableGuildRoles(guild, actor) {
        const botMember = guild.members.me;
        if (!botMember)
            return [];
        const actorLimit = actor.id === guild.ownerId ? Number.POSITIVE_INFINITY : actor.roles.highest.position;
        const botLimit = botMember.roles.highest.position;
        return [...guild.roles.cache.values()]
            .filter((role) => role.id !== guild.id && !role.managed && role.position > 0 && role.position < actorLimit && role.position < botLimit)
            .sort((a, b) => b.position - a.position);
    }
    rolePermissionSummary(role) {
        const labels = {
            Administrator: 'Administrador', ManageGuild: 'Gerenciar servidor', ManageChannels: 'Gerenciar canais',
            ManageRoles: 'Gerenciar cargos', ManageMessages: 'Gerenciar mensagens', BanMembers: 'Banir membros',
            KickMembers: 'Expulsar membros', ModerateMembers: 'Moderar membros', MentionEveryone: 'Mencionar todos',
            ManageWebhooks: 'Gerenciar webhooks', ViewAuditLog: 'Ver auditoria'
        };
        const permissions = typeof role.permissions?.toArray === 'function' ? role.permissions.toArray() : [];
        const highlighted = permissions.filter(name => labels[name]).slice(0, 6).map(name => labels[name]);
        return highlighted.length ? highlighted.join(', ') : 'sem permissões administrativas destacadas';
    }
    ensureTargetHierarchy(message, target, action) {
        const actor = message.member;
        if (target.id === message.guild.ownerId)
            throw new Error('O proprietário do servidor não pode ser moderado');
        if (target.id !== actor.id && actor.id !== message.guild.ownerId && target.roles.highest.position >= actor.roles.highest.position) {
            throw new Error('Você não pode moderar um membro com cargo igual ou superior ao seu');
        }
        const botMember = message.guild.members.me;
        if (!botMember || target.roles.highest.position >= botMember.roles.highest.position)
            throw new Error('O cargo do bot está abaixo do alvo');
        if (action === 'ban' && !target.bannable)
            throw new Error('Esse membro não pode ser banido pelo bot');
        if (action === 'kick' && !target.kickable)
            throw new Error('Esse membro não pode ser expulso pelo bot');
        if (action === 'mute' && !target.moderatable)
            throw new Error('Esse membro não pode receber timeout do bot');
    }
    ensureInteractionTargetHierarchy(guild, actor, target) {
        if (target.id === guild.ownerId)
            throw new Error('O proprietário do servidor não pode ter cargos alterados');
        if (target.id !== actor.id && actor.id !== guild.ownerId && target.roles.highest.position >= actor.roles.highest.position) {
            throw new Error('Você não pode alterar cargos de um membro com cargo igual ou superior ao seu');
        }
        const botMember = guild.members.me;
        if (!botMember || target.roles.highest.position >= botMember.roles.highest.position)
            throw new Error('O cargo do bot está abaixo do alvo');
    }
    ensureRoleManageable(message, target, role) {
        this.ensureTargetHierarchy(message, target, 'role');
        if (role.id === message.guild.id || role.managed)
            throw new Error('Esse cargo não pode ser gerenciado');
        if (message.member.id !== message.guild.ownerId && role.position >= message.member.roles.highest.position) {
            throw new Error('Você só pode gerenciar cargos abaixo do seu maior cargo');
        }
        const botMember = message.guild.members.me;
        if (!botMember || role.position >= botMember.roles.highest.position)
            throw new Error('O cargo está acima ou no mesmo nível do bot');
    }
    async sendModerationNotification(message, targetUser, action, reason, item, durationSeconds) {
        const labels = {
            ban: ['Membro banido', 'Você foi banido'],
            unban: ['Membro desbanido', 'Seu banimento foi removido'],
            kick: ['Membro expulso', 'Você foi expulso'],
            mute: ['Membro silenciado', 'Você recebeu um timeout'],
            unmute: ['Timeout removido', 'Seu timeout foi removido']
        };
        const createEmbed = (direct) => new discord_js_1.EmbedBuilder()
            .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL({ size: 256 }) ?? undefined })
            .setTitle(direct ? labels[action][1] : labels[action][0])
            .setDescription(direct ? `Esta ação foi aplicada em **${message.guild.name}**.` : `A ação foi concluída e registrada no caso **${item.id}**.`)
            .addFields({ name: 'Usuário', value: `**${escapeMarkdown(targetUser.globalName ?? targetUser.username)}**\n\`${targetUser.id}\``, inline: true }, { name: 'Responsável', value: `${message.author}\n\`${message.author.id}\``, inline: true }, { name: 'Horário', value: `<t:${Math.floor(new Date(item.createdAt).getTime() / 1000)}:F>`, inline: false }, { name: 'Motivo', value: reason.slice(0, 1024), inline: false }, ...(durationSeconds === null ? [] : [{ name: 'Duração', value: formatDuration(durationSeconds * 1000), inline: true }]), { name: 'Caso', value: `\`${item.id}\``, inline: true })
            .setThumbnail(targetUser.displayAvatarURL({ size: 512 }))
            .setColor(action === 'unban' || action === 'unmute' ? 0x2ecc71 : 0xe74c3c)
            .setTimestamp(new Date(item.createdAt));
        await targetUser.send({ embeds: [createEmbed(true)], allowedMentions: { parse: [] } }).catch((error) => {
            logger_1.logger.warn('Não foi possível enviar a notificação de moderação por DM.', {
                guildId: message.guild.id,
                targetId: targetUser.id,
                action,
                error: error instanceof Error ? error.message : String(error)
            });
        });
        const sent = await message.channel.send({ embeds: [createEmbed(false)], allowedMentions: { parse: [] } });
        setTimeout(() => void sent.delete().catch(() => undefined), 10_000);
    }
    async replyTemporary(message, payload, delayMs = 5_000) {
        const sent = await message.reply(payload).catch(() => null);
        if (sent && delayMs > 0)
            setTimeout(() => void sent.delete().catch(() => undefined), delayMs);
        return sent;
    }
    noticeEmbed(title, description, color = 0x111111) {
        return new discord_js_1.EmbedBuilder().setTitle(title).setDescription(description.slice(0, 4096)).setColor(color).setTimestamp();
    }
    command(name, category, description, usage, permissionOrExecute, maybeExecute) {
        const permission = typeof permissionOrExecute === 'bigint' ? permissionOrExecute : undefined;
        const execute = typeof permissionOrExecute === 'function' ? permissionOrExecute : maybeExecute;
        return { name, category, description, usage, permission, execute };
    }
    helpPayload(member, config, category, page = 0) {
        const container = new discord_js_1.ContainerBuilder().setAccentColor(0x111111);
        const enabledCommands = [...this.commands.values()].filter(command => !config.commands.disabled.includes(command.name) && config.commands.permissions[command.name]?.enabled);
        if (category === 'home') {
            container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`## Central de ajuda\nEscolha uma categoria para ver os comandos disponíveis neste servidor.\n\nComandos ativos: **${enabledCommands.length}**`));
            const row = new discord_js_1.ActionRowBuilder();
            for (const [value, label] of Object.entries(HELP_CATEGORIES)) {
                const emoji = value === 'moderation' ? emojis_1.UI_EMOJIS.moderation : value === 'community' ? emojis_1.UI_EMOJIS.community : value === 'information' ? emojis_1.UI_EMOJIS.member : value === 'utility' ? emojis_1.UI_EMOJIS.tools : emojis_1.UI_EMOJIS.shield;
                row.addComponents(new discord_js_1.ButtonBuilder().setCustomId(`help|${member.id}|${value}|0`).setLabel(label).setEmoji(emoji).setStyle(discord_js_1.ButtonStyle.Secondary));
            }
            container.addActionRowComponents(row);
        }
        else {
            const commands = enabledCommands.filter(command => command.category === category);
            const perPage = 6;
            const totalPages = Math.max(1, Math.ceil(commands.length / perPage));
            const safePage = Math.min(Math.max(0, page), totalPages - 1);
            const visible = commands.slice(safePage * perPage, safePage * perPage + perPage);
            const categoryLabel = HELP_CATEGORIES[category] ?? 'Ajuda';
            const lines = visible.map(command => {
                const hasDiscordPermission = !command.permission || member.permissions.has(command.permission);
                const configured = config.commands.permissions[command.name];
                const restricted = Boolean(configured?.allowedRoleIds.length || configured?.allowedUserIds.length || configured?.allowedChannelIds.length);
                const status = hasDiscordPermission ? (restricted ? 'Acesso configurado' : 'Disponível') : `Requer ${permissionLabel(command.permission)}`;
                const aliases = config.commands.aliases[command.name]?.length
                    ? `\nAliases: ${config.commands.aliases[command.name].map(alias => `\`${this.app.prefix}${alias}\``).join(', ')}`
                    : '';
                return `### ${this.app.prefix}${command.name}\n${command.description}\n**Uso:** \`${this.app.prefix}${command.usage}\` • **Acesso:** ${status}${aliases}`;
            });
            const body = lines.length ? lines.join('\n\n') : 'Nenhum comando ativo nesta categoria.';
            container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`## ${categoryLabel}\n**${commands.length} comando(s)** • Página **${safePage + 1}/${totalPages}**\n\n${body}`));
            const row = new discord_js_1.ActionRowBuilder();
            row.addComponents(new discord_js_1.ButtonBuilder().setCustomId(`help|${member.id}|home|0`).setLabel('Categorias').setEmoji(emojis_1.UI_EMOJIS.home).setStyle(discord_js_1.ButtonStyle.Secondary));
            if (totalPages > 1) {
                row.addComponents(new discord_js_1.ButtonBuilder().setCustomId(`help|${member.id}|${category}|${Math.max(0, safePage - 1)}`).setEmoji(emojis_1.UI_EMOJIS.left).setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(safePage === 0), new discord_js_1.ButtonBuilder().setCustomId(`helpindicator|${member.id}|${category}|${safePage}`).setLabel(`${safePage + 1}/${totalPages}`).setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(true), new discord_js_1.ButtonBuilder().setCustomId(`help|${member.id}|${category}|${Math.min(totalPages - 1, safePage + 1)}`).setEmoji(emojis_1.UI_EMOJIS.right).setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(safePage >= totalPages - 1));
            }
            container.addActionRowComponents(row);
        }
        return { components: [container], flags: discord_js_1.MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
    }
    async timeoutCommand(message, args, config, event) {
        const member = await resolveMember(message, args.shift());
        this.ensureTargetHierarchy(message, member, 'mute');
        const duration = parseDuration(args[0] ?? '10m');
        if (duration === null)
            throw new Error('Duração inválida; use 10m, 1h, 1d');
        args.shift();
        const reason = args.join(' ') || 'Sem motivo informado';
        await member.timeout(duration * 1000, reason);
        const item = await this.createCase(message, config, 'timeout', member.id, reason, duration);
        await this.sendModerationNotification(message, member.user, 'mute', reason, item, duration);
        await this.logModeration(message, config, event, member.id, { reason, durationSeconds: duration, caseId: item.id });
    }
    async removeTimeoutCommand(message, args, config) {
        const member = await resolveMember(message, args.shift());
        this.ensureTargetHierarchy(message, member, 'mute');
        const reason = args.join(' ') || 'Sem motivo informado';
        await member.timeout(null, reason);
        const original = [...config.moderation.cases].reverse().find(item => item.targetId === member.id && item.action === 'timeout' && !item.revokedAt);
        if (original) {
            original.revokedAt = new Date().toISOString();
            original.revokedBy = message.author.id;
        }
        const item = await this.createCase(message, config, 'untimeout', member.id, reason, null);
        await this.sendModerationNotification(message, member.user, 'unmute', reason, item, null);
        await this.logModeration(message, config, 'timeout_remove', member.id, { reason, caseId: item.id });
    }
    async createCase(message, config, action, targetId, reason, durationSeconds) {
        const number = config.moderation.nextCaseNumber++;
        const item = { id: `CASE-${String(number).padStart(6, '0')}`, action, targetId, moderatorId: message.author.id, reason, durationSeconds, createdAt: new Date().toISOString(), revokedAt: null, revokedBy: null, source: 'command' };
        config.moderation.cases.push(item);
        config.moderation.cases = config.moderation.cases.slice(-1000);
        await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
        return item;
    }
    async logModeration(message, config, event, targetId, details) {
        await (0, communityLogger_1.logCommunityEvent)({ guild: message.guild, config, event, module: 'moderation_commands', executorId: message.author.id, targetId, channelId: message.channelId, severity: 'medium', details });
        await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
    }
    async logCommand(message, config, event, command, reason) {
        await (0, communityLogger_1.logCommunityEvent)({ guild: message.guild, config, event, module: 'commands', executorId: message.author.id, channelId: message.channelId, severity: 'medium', details: { command, reason } }).catch(() => undefined);
        await guildConfigStore_1.guildConfigStore.set(message.guild.id, config).catch(() => undefined);
    }
}
exports.CommandManager = CommandManager;
function staffActionLabel(action) {
    const labels = {
        ban: 'Banimento', tempban: 'Banimento temporário', softban: 'Softban', unban: 'Desbanimento',
        timeout: 'Timeout', untimeout: 'Timeout removido', kick: 'Expulsão', warn: 'Advertência'
    };
    return labels[action] ?? action;
}
function moderationCaseEmbed(item) {
    return new discord_js_1.EmbedBuilder()
        .setTitle(item.id)
        .setDescription(`Ação: ${item.action}\nAlvo: <@${item.targetId}> (\`${item.targetId}\`)\nModerador: <@${item.moderatorId}>\nMotivo: ${item.reason}\nDuração: ${item.durationSeconds === null ? 'não aplicável' : formatDuration(item.durationSeconds * 1000)}\nCriado: <t:${Math.floor(new Date(item.createdAt).getTime() / 1000)}:F>\nRevogado: ${item.revokedAt ? `sim, <t:${Math.floor(new Date(item.revokedAt).getTime() / 1000)}:R>` : 'não'}`)
        .setColor(0x111111);
}
function formatCaseLine(item) {
    return `**${item.id}** — ${item.action} — <@${item.targetId}> — <t:${Math.floor(new Date(item.createdAt).getTime() / 1000)}:R>`;
}
async function resolveMember(message, raw) {
    const id = extractId(raw) ?? message.author.id;
    const member = await message.guild.members.fetch(id).catch(() => null);
    if (!member)
        throw new Error('Membro não encontrado');
    return member;
}
function resolveRole(message, raw) {
    const id = extractId(raw);
    const role = id ? message.guild.roles.cache.get(id) : null;
    if (!role)
        throw new Error('Cargo não encontrado');
    return role;
}
function resolveChannel(message, raw) {
    const id = extractId(raw);
    return id ? message.guild.channels.cache.get(id) : null;
}
function extractId(raw) { return raw?.match(/\d{16,22}/)?.[0] ?? null; }
function chunkHelpLines(lines, maximum) {
    const chunks = [];
    let current = '';
    for (const line of lines) {
        const next = current ? `${current}\n\n${line}` : line;
        if (next.length > maximum && current) {
            chunks.push(current);
            current = line;
        }
        else
            current = next;
    }
    if (current)
        chunks.push(current);
    return chunks;
}
function normalizePurgeAmount(raw) {
    const value = raw ? Number(raw) : 100;
    if (!Number.isInteger(value) || value < 1)
        throw new Error('Informe uma quantidade entre 1 e 100');
    return Math.min(100, value);
}
function extractInviteCode(raw) {
    if (!raw)
        return null;
    const clean = raw.trim();
    const match = clean.match(/(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)?([A-Za-z0-9-]{2,32})/i);
    return match?.[1] ?? null;
}
function parseCustomEmoji(raw) {
    const match = raw.match(/^<(a?):([A-Za-z0-9_]{2,32}):(\d{16,22})>$/);
    if (!match)
        return null;
    return { animated: match[1] === 'a', name: match[2], id: match[3] };
}
function parseTimestampInput(raw) {
    const clean = raw.trim().toLowerCase();
    if (!clean || clean === 'agora' || clean === 'now')
        return new Date();
    const duration = parseDuration(clean);
    if (duration !== null)
        return new Date(Date.now() + duration * 1000);
    const iso = new Date(raw);
    if (!Number.isNaN(iso.getTime()))
        return iso;
    throw new Error('Use agora, uma duração como 10m, 2h, 3d ou uma data ISO válida');
}
function evaluateMathExpression(raw) {
    const expression = raw.replace(/(\d),(\d)/g, '$1.$2').replace(/\s+/g, '');
    if (!expression || expression.length > 120 || /[^0-9+\-*/%^().]/.test(expression))
        throw new Error('Expressão inválida');
    let index = 0;
    const peek = () => expression[index] ?? '';
    const take = () => expression[index++] ?? '';
    const parseNumber = () => {
        const start = index;
        let dots = 0;
        while (/[0-9.]/.test(peek())) {
            if (peek() === '.')
                dots += 1;
            take();
        }
        if (index === start || dots > 1)
            throw new Error('Número inválido na expressão');
        const value = Number(expression.slice(start, index));
        if (!Number.isFinite(value))
            throw new Error('Número inválido na expressão');
        return value;
    };
    const primary = () => {
        if (peek() === '(') {
            take();
            const value = expressionLevel();
            if (take() !== ')')
                throw new Error('Parênteses não fechados');
            return value;
        }
        return parseNumber();
    };
    const unary = () => {
        if (peek() === '+') {
            take();
            return unary();
        }
        if (peek() === '-') {
            take();
            return -unary();
        }
        return primary();
    };
    const power = () => {
        let value = unary();
        if (peek() === '^') {
            take();
            value = value ** power();
        }
        return value;
    };
    const term = () => {
        let value = power();
        while (['*', '/', '%'].includes(peek())) {
            const operator = take();
            const right = power();
            if ((operator === '/' || operator === '%') && right === 0)
                throw new Error('Divisão por zero não é permitida');
            value = operator === '*' ? value * right : operator === '/' ? value / right : value % right;
        }
        return value;
    };
    const expressionLevel = () => {
        let value = term();
        while (peek() === '+' || peek() === '-') {
            const operator = take();
            const right = term();
            value = operator === '+' ? value + right : value - right;
        }
        return value;
    };
    const result = expressionLevel();
    if (index !== expression.length)
        throw new Error('Expressão inválida');
    if (!Number.isFinite(result) || Math.abs(result) > 1e15)
        throw new Error('Resultado fora do limite permitido');
    return result;
}
function socialInteractionEmbed(title, description, member, color) {
    return new discord_js_1.EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 }))
        .setColor(color)
        .setTimestamp();
}
function normalizeRpsChoice(value) {
    const clean = String(value ?? '').trim().toLowerCase();
    return clean === 'pedra' || clean === 'papel' || clean === 'tesoura' ? clean : null;
}
function rpsResult(player, opponent) {
    if (player === opponent)
        return 'Empate';
    if ((player === 'pedra' && opponent === 'tesoura') || (player === 'papel' && opponent === 'pedra') || (player === 'tesoura' && opponent === 'papel'))
        return 'Você ganhou';
    return 'Você perdeu';
}
function capitalize(value) { return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value; }
function permissionLabel(permission) {
    if (!permission)
        return 'nenhuma permissão especial';
    const labels = [
        [discord_js_1.PermissionFlagsBits.Administrator, 'Administrador'],
        [discord_js_1.PermissionFlagsBits.BanMembers, 'Banir Membros'],
        [discord_js_1.PermissionFlagsBits.KickMembers, 'Expulsar Membros'],
        [discord_js_1.PermissionFlagsBits.ModerateMembers, 'Moderar Membros'],
        [discord_js_1.PermissionFlagsBits.ManageRoles, 'Gerenciar Cargos'],
        [discord_js_1.PermissionFlagsBits.ManageChannels, 'Gerenciar Canais'],
        [discord_js_1.PermissionFlagsBits.ManageMessages, 'Gerenciar Mensagens'],
        [discord_js_1.PermissionFlagsBits.ManageNicknames, 'Gerenciar Apelidos']
    ];
    return labels.find(([value]) => value === permission)?.[1] ?? 'uma permissão específica';
}
function escapeMarkdown(value) {
    return String(value).replace(/[\\`*_{}\[\]()#+\-.!|>~]/g, '\\$&');
}
function parseDuration(raw) {
    const match = raw.toLowerCase().match(/^(\d+)(s|m|h|d|w)$/);
    if (!match)
        return null;
    const value = Number(match[1]);
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
    return Math.min(value * multipliers[match[2]], 28 * 86400);
}
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days)
        return `${days}d ${hours}h`;
    if (hours)
        return `${hours}h ${minutes}m`;
    if (minutes)
        return `${minutes}m`;
    return `${Math.max(1, seconds)}s`;
}
function friendlyError(value) {
    const clean = String(value).replace(/^DiscordAPIError\[[^\]]+\]:\s*/i, '').split('\n')[0]?.trim() || 'Ocorreu um erro inesperado.';
    const map = [
        [/Invalid Form Body/i, 'O painel enviado ao Discord contém uma configuração inválida.'],
        [/Missing Permissions|Missing Access/i, 'O bot não possui as permissões necessárias para concluir esta ação.'],
        [/Unknown Member|Membro não encontrado/i, 'O membro informado não foi encontrado no servidor.'],
        [/Unknown Role|Cargo não encontrado/i, 'O cargo informado não foi encontrado.'],
        [/hierarchy|cargo do bot|cargo igual ou superior/i, 'A hierarquia de cargos não permite executar esta ação.']
    ];
    return map.find(([pattern]) => pattern.test(clean))?.[1] ?? clean.slice(0, 1000);
}
function channelTypeLabel(type) {
    const labels = { '0': 'Texto', '2': 'Voz', '4': 'Categoria', '5': 'Anúncios', '10': 'Thread de anúncio', '11': 'Thread pública', '12': 'Thread privada', '13': 'Palco', '15': 'Fórum', '16': 'Mídia' };
    return labels[String(type)] ?? String(type);
}
//# sourceMappingURL=commandManager.js.map