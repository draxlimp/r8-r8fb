"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketService = void 0;
const discord_js_1 = require("discord.js");
const emojis_1 = require("../ui/emojis");
const guildConfigStore_1 = require("../storage/guildConfigStore");
const ids_1 = require("../utils/ids");
const logger_1 = require("../utils/logger");
const communityLogger_1 = require("../community/communityLogger");
const transcriptService_1 = require("./transcriptService");
const templateRenderer_1 = require("./templateRenderer");
class TicketService {
    app;
    constructor(app) {
        this.app = app;
    }
    async handleInteraction(interaction) {
        if (!interaction.customId?.startsWith('t|'))
            return false;
        const [prefix, action, ticketOrPanelId] = interaction.customId.split('|');
        if (prefix !== 't' || !action || !ticketOrPanelId || !interaction.guild)
            return false;
        try {
            if (interaction.isStringSelectMenu?.()) {
                if (action === 'openmenu')
                    await this.openTicket(interaction, interaction.values?.[0] ?? ticketOrPanelId);
                else
                    return false;
            }
            else if (interaction.isButton()) {
                if (action === 'open')
                    await this.openTicket(interaction, ticketOrPanelId);
                else if (action === 'claim')
                    await this.claimTicket(interaction, ticketOrPanelId);
                else if (action === 'unclaim')
                    await this.unclaimTicket(interaction, ticketOrPanelId);
                else if (action === 'close')
                    await this.closeTicket(interaction, ticketOrPanelId);
                else if (action === 'reopen')
                    await this.reopenTicket(interaction, ticketOrPanelId);
                else if (action === 'delete')
                    await this.deleteTicket(interaction, ticketOrPanelId);
                else if (action === 'call')
                    await this.createVoiceChannel(interaction, ticketOrPanelId);
                else if (action === 'add')
                    await this.showAddMemberModal(interaction, ticketOrPanelId);
                else if (action === 'remove')
                    await this.showRemoveMemberModal(interaction, ticketOrPanelId);
                else if (action === 'transfer')
                    await this.showTransferModal(interaction, ticketOrPanelId);
                else if (action === 'priority')
                    await this.cyclePriority(interaction, ticketOrPanelId);
                else if (action === 'rename')
                    await this.showRenameModal(interaction, ticketOrPanelId);
                else if (action === 'transcript')
                    await this.sendTranscript(interaction, ticketOrPanelId);
                else if (action.startsWith('rate'))
                    await this.rateTicket(interaction, ticketOrPanelId, Number(action.slice(4)));
                else
                    return false;
            }
            else if (interaction.isModalSubmit()) {
                if (action === 'openform')
                    await this.openTicket(interaction, ticketOrPanelId, this.readQuestionAnswers(interaction));
                else if (action === 'addmodal')
                    await this.addMember(interaction, ticketOrPanelId);
                else if (action === 'removemodal')
                    await this.removeMember(interaction, ticketOrPanelId);
                else if (action === 'transfermodal')
                    await this.transferTicket(interaction, ticketOrPanelId);
                else if (action === 'renamemodal')
                    await this.renameTicket(interaction, ticketOrPanelId);
                else
                    return false;
            }
            else
                return false;
        }
        catch (error) {
            logger_1.logger.error('Falha em interação de ticket.', { guildId: interaction.guildId, action, id: ticketOrPanelId, error: String(error) });
            await this.safeReply(interaction, `Não foi possível concluir a ação do ticket. ${error instanceof Error ? error.message : 'Erro interno.'}`);
        }
        return true;
    }
    async publishPanel(guild, panel) {
        if (!panel.publishChannelId)
            throw new Error('Selecione o canal onde o painel externo será publicado.');
        const channel = await guild.channels.fetch(panel.publishChannelId);
        if (!channel?.isTextBased?.() || !('send' in channel))
            throw new Error('O canal de publicação não é um canal de texto válido.');
        if (panel.publishMessageId) {
            const previous = await channel.messages.fetch(panel.publishMessageId).catch(() => null);
            if (previous)
                await previous.delete().catch(() => undefined);
        }
        const context = { guild, panel };
        const components = panel.openComponent === 'select'
            ? [new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                    .setCustomId(`t|openmenu|${panel.id}`)
                    .setPlaceholder(panel.external.buttonLabel || 'Selecione um atendimento')
                    .setMinValues(1)
                    .setMaxValues(1)
                    .addOptions(new discord_js_1.StringSelectMenuOptionBuilder()
                    .setLabel(panel.name.slice(0, 100))
                    .setDescription((panel.external.description || 'Abrir atendimento').replace(/[*_`#]/g, '').slice(0, 100))
                    .setValue(panel.id)))]
            : [new discord_js_1.ActionRowBuilder().addComponents(this.applyButtonAppearance(new discord_js_1.ButtonBuilder().setCustomId(`t|open|${panel.id}`).setLabel(panel.external.buttonLabel || 'Abrir ticket'), panel.external))];
        const message = await channel.send({
            embeds: [this.buildEmbed(panel.external, context)],
            components,
            allowedMentions: { parse: [] }
        });
        return { channelId: channel.id, messageId: message.id };
    }
    async trackMessage(message) {
        if (!message.guild || message.author?.bot)
            return;
        const config = await guildConfigStore_1.guildConfigStore.get(message.guild.id);
        const ticket = Object.values(config.community.tickets.openTickets).find(item => item.channelId === message.channelId && !item.closedAt);
        if (!ticket)
            return;
        ticket.lastActivityAt = new Date().toISOString();
        await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
    }
    async maintainGuild(guild) {
        const config = await guildConfigStore_1.guildConfigStore.get(guild.id);
        let changed = false;
        for (const ticket of Object.values(config.community.tickets.openTickets)) {
            if (ticket.closedAt || ticket.autoClosePaused)
                continue;
            const panel = config.community.tickets.panels.find(item => item.id === ticket.panelId);
            if (!panel?.autoCloseMinutes)
                continue;
            const inactiveMs = Date.now() - Date.parse(ticket.lastActivityAt || ticket.createdAt);
            if (inactiveMs < panel.autoCloseMinutes * 60_000)
                continue;
            const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
            if (!channel?.isTextBased?.() || !('messages' in channel))
                continue;
            const transcript = await (0, transcriptService_1.createHtmlTranscript)(channel, ticket.id).catch(() => null);
            const destinationId = panel.transcriptChannelId ?? panel.logChannelId ?? config.logs.defaultChannelId;
            if (transcript && destinationId) {
                const destination = await guild.channels.fetch(destinationId).catch(() => null);
                if (destination?.isTextBased?.() && 'send' in destination)
                    await destination.send({ content: `Fechamento automático do ticket **${ticket.id}** por inatividade.`, files: [transcript.attachment], allowedMentions: { parse: [] } }).catch(() => undefined);
            }
            ticket.closedAt = new Date().toISOString();
            ticket.lastActivityAt = ticket.closedAt;
            if (!channel.isThread?.() && 'permissionOverwrites' in channel)
                await channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: false, AttachFiles: false }, { reason: 'Fechamento automático por inatividade' }).catch(() => undefined);
            const closedButtons = [];
            if (panel.allowReopen && panel.internalButtons.reopen)
                closedButtons.push(new discord_js_1.ButtonBuilder().setCustomId(`t|reopen|${ticket.id}`).setLabel('Reabrir').setStyle(discord_js_1.ButtonStyle.Success));
            if (panel.internalButtons.delete)
                closedButtons.push(new discord_js_1.ButtonBuilder().setCustomId(`t|delete|${ticket.id}`).setLabel('Excluir').setStyle(discord_js_1.ButtonStyle.Danger));
            if (panel.internalButtons.transcript)
                closedButtons.push(new discord_js_1.ButtonBuilder().setCustomId(`t|transcript|${ticket.id}`).setLabel('Transcript').setStyle(discord_js_1.ButtonStyle.Secondary));
            await channel.send({
                content: `Ticket fechado automaticamente após ${panel.autoCloseMinutes} minuto(s) de inatividade.`,
                components: closedButtons.length ? [new discord_js_1.ActionRowBuilder().addComponents(...closedButtons)] : [],
                allowedMentions: { parse: [] }
            }).catch(() => undefined);
            if (panel.ratingEnabled) {
                await channel.send({
                    content: `<@${ticket.ownerId}>, avalie este atendimento:`,
                    components: [this.buildRatingRow(ticket.id)],
                    allowedMentions: { users: [ticket.ownerId] }
                }).catch(() => undefined);
            }
            if (channel.isThread?.())
                await channel.setArchived(true, 'Fechamento automático por inatividade').catch(() => undefined);
            await (0, communityLogger_1.logCommunityEvent)({ guild, config, event: 'ticket_closed', module: 'community_tickets', executorId: guild.client.user.id, targetId: ticket.ownerId, channelId: ticket.channelId, severity: 'medium', details: { ticketId: ticket.id, automatic: true } }).catch(() => undefined);
            changed = true;
            if (!panel.allowReopen) {
                const deleteDelay = panel.ratingEnabled ? 60_000 : 5_000;
                setTimeout(() => void channel.delete(`Ticket ${ticket.id} fechado automaticamente`).catch(() => undefined), deleteDelay);
            }
        }
        if (changed)
            await guildConfigStore_1.guildConfigStore.set(guild.id, config);
    }
    async handleCommand(message, command, args, suppliedConfig) {
        const config = suppliedConfig ?? await guildConfigStore_1.guildConfigStore.get(message.guild.id);
        if (command === 'ticket') {
            const panels = config.community.tickets.panels.filter(panel => panel.enabled && this.memberCanOpen(message.member, panel) && !panel.blockedUserIds.includes(message.author.id));
            const own = Object.values(config.community.tickets.openTickets).filter(ticket => ticket.ownerId === message.author.id && !ticket.closedAt);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('Central de tickets')
                .setDescription(`${panels.length ? 'Selecione abaixo o setor que deseja abrir.' : 'Não há painéis disponíveis para você.'}\n\nTickets abertos: ${own.length ? own.map(item => `<#${item.channelId}>`).join(', ') : 'nenhum'}`)
                .setColor(0x111111)
                .setTimestamp();
            const components = panels.length ? [new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                    .setCustomId('t|openmenu|command')
                    .setPlaceholder('Selecione um setor de atendimento')
                    .setMinValues(1)
                    .setMaxValues(1)
                    .addOptions(...panels.slice(0, 25).map(panel => new discord_js_1.StringSelectMenuOptionBuilder()
                    .setLabel(panel.name.slice(0, 100))
                    .setDescription((panel.external.description || 'Abrir atendimento').replace(/[*_`#]/g, '').slice(0, 100))
                    .setValue(panel.id))))] : [];
            await message.reply({ embeds: [embed], components, allowedMentions: { parse: [] } });
            return;
        }
        if (command === 'tickets') {
            const userId = extractSnowflake(args[0]) ?? message.author.id;
            if (userId !== message.author.id && !message.member.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels))
                throw new Error('Você precisa de Gerenciar Canais para consultar tickets de outra pessoa');
            const tickets = Object.values(config.community.tickets.openTickets).filter(ticket => ticket.ownerId === userId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 20);
            const embed = new discord_js_1.EmbedBuilder().setTitle('Tickets do usuário').setDescription(tickets.length
                ? tickets.map(item => `**${item.id}** — <#${item.channelId}> — ${item.closedAt ? 'fechado' : 'aberto'} — <t:${Math.floor(Date.parse(item.createdAt) / 1000)}:R>`).join('\n')
                : 'Nenhum ticket foi encontrado.').setColor(0x111111).setTimestamp();
            await message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
            return;
        }
        if (command === 'ticketsearch') {
            const query = String(args[0] ?? '').toLowerCase();
            if (!query)
                throw new Error('Informe o número ou ID do ticket');
            const ticket = Object.values(config.community.tickets.openTickets).find(item => item.id.toLowerCase() === query || item.channelId === extractSnowflake(query));
            if (!ticket)
                throw new Error('Ticket não encontrado');
            const panel = config.community.tickets.panels.find(item => item.id === ticket.panelId);
            if (ticket.ownerId !== message.author.id && (!panel || !this.memberCanManageTicket(message.member, panel, ticket)))
                throw new Error('Você não possui acesso a este ticket');
            await message.reply({ embeds: [this.commandTicketInfoEmbed(ticket, panel)], allowedMentions: { parse: [] } });
            return;
        }
        const resolved = this.currentTicketForChannel(config, message.channelId);
        if (!resolved)
            throw new Error('Este comando deve ser usado dentro de um ticket');
        const { ticket, panel } = resolved;
        const canManage = this.memberCanManageTicket(message.member, panel, ticket);
        if (command === 'ticketinfo') {
            if (!canManage)
                throw new Error('Você não possui acesso a este ticket');
            await message.reply({ embeds: [this.commandTicketInfoEmbed(ticket, panel)], allowedMentions: { parse: [] } });
            return;
        }
        if (command === 'ticketclaim') {
            if (!this.memberIsSupport(message.member, panel))
                throw new Error('Somente a equipe responsável pode assumir este ticket');
            if (ticket.claimedBy && ticket.claimedBy !== message.author.id)
                throw new Error(`Este ticket já foi assumido por <@${ticket.claimedBy}>`);
            ticket.claimedBy = message.author.id;
            ticket.lastActivityAt = new Date().toISOString();
            await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
            await message.reply({ content: `Ticket assumido por ${message.author}.`, allowedMentions: { users: [message.author.id] } });
            return;
        }
        if (command === 'ticketunclaim') {
            if (!this.memberIsSupport(message.member, panel))
                throw new Error('Somente a equipe responsável pode liberar este ticket');
            if (ticket.claimedBy && ticket.claimedBy !== message.author.id && !message.member.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels))
                throw new Error('Este ticket foi assumido por outra pessoa');
            ticket.claimedBy = null;
            await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
            await message.reply('O atendimento foi liberado para a equipe.');
            return;
        }
        if (command === 'ticketadd' || command === 'ticketremove') {
            if (!canManage)
                throw new Error('Você não possui permissão para gerenciar membros neste ticket');
            const userId = extractSnowflake(args[0]);
            if (!userId)
                throw new Error('Mencione o usuário');
            const channel = await message.guild.channels.fetch(ticket.channelId);
            if (!channel)
                throw new Error('Canal do ticket indisponível');
            if (command === 'ticketadd') {
                if (channel.isThread?.())
                    await channel.members.add(userId);
                else if ('permissionOverwrites' in channel)
                    await channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true }, { reason: `Adicionado por ${message.author.tag}` });
                if (!ticket.addedMemberIds.includes(userId))
                    ticket.addedMemberIds.push(userId);
            }
            else {
                if (userId === ticket.ownerId)
                    throw new Error('O proprietário do ticket não pode ser removido');
                if (channel.isThread?.())
                    await channel.members.remove(userId);
                else if ('permissionOverwrites' in channel)
                    await channel.permissionOverwrites.delete(userId, `Removido por ${message.author.tag}`);
                ticket.addedMemberIds = ticket.addedMemberIds.filter(id => id !== userId);
            }
            await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
            await message.reply({ content: `<@${userId}> foi ${command === 'ticketadd' ? 'adicionado ao' : 'removido do'} ticket.`, allowedMentions: { users: [userId] } });
            return;
        }
        if (command === 'ticketclose') {
            if (!canManage)
                throw new Error('Você não possui permissão para fechar este ticket');
            if (ticket.closedAt)
                throw new Error('Este ticket já está fechado');
            const reason = args.join(' ').trim() || 'Sem motivo informado';
            const channel = await message.guild.channels.fetch(ticket.channelId);
            if (!channel)
                throw new Error('Canal do ticket indisponível');
            const transcript = channel.isTextBased?.() && 'messages' in channel ? await (0, transcriptService_1.createHtmlTranscript)(channel, ticket.id).catch(() => null) : null;
            const destinationId = panel.transcriptChannelId ?? panel.logChannelId ?? config.logs.defaultChannelId;
            if (transcript && destinationId) {
                const destination = await message.guild.channels.fetch(destinationId).catch(() => null);
                if (destination?.isTextBased?.() && 'send' in destination)
                    await destination.send({ content: `Transcript de **${ticket.id}**. Motivo: ${reason}`, files: [transcript.attachment], allowedMentions: { parse: [] } }).catch(() => undefined);
            }
            ticket.closedAt = new Date().toISOString();
            ticket.lastActivityAt = ticket.closedAt;
            if (channel.isThread?.())
                await channel.setArchived(true, `Ticket fechado por ${message.author.tag}`).catch(() => undefined);
            else if ('permissionOverwrites' in channel)
                await channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: false, AttachFiles: false }, { reason: `Ticket fechado por ${message.author.tag}` });
            await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
            await message.reply({ embeds: [new discord_js_1.EmbedBuilder().setTitle('Ticket fechado').setDescription(`Motivo: ${reason}\nResponsável: ${message.author}`).setColor(0xe67e22).setTimestamp()] });
            return;
        }
        if (command === 'ticketreopen') {
            if (!canManage)
                throw new Error('Você não possui permissão para reabrir este ticket');
            if (!panel.allowReopen)
                throw new Error('A reabertura está desativada neste painel');
            if (!ticket.closedAt)
                throw new Error('Este ticket já está aberto');
            const channel = await message.guild.channels.fetch(ticket.channelId);
            if (!channel)
                throw new Error('Canal do ticket indisponível');
            if (channel.isThread?.()) {
                await channel.setArchived(false, `Ticket reaberto por ${message.author.tag}`);
                await channel.setLocked(false, `Ticket reaberto por ${message.author.tag}`).catch(() => undefined);
            }
            else if ('permissionOverwrites' in channel)
                await channel.permissionOverwrites.edit(ticket.ownerId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true }, { reason: `Ticket reaberto por ${message.author.tag}` });
            ticket.closedAt = null;
            ticket.lastActivityAt = new Date().toISOString();
            await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
            await message.reply('Ticket reaberto.');
            return;
        }
        if (command === 'ticketdelete') {
            if (!canManage || !message.member.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels))
                throw new Error('Você precisa de Gerenciar Canais para excluir este ticket');
            const channel = await message.guild.channels.fetch(ticket.channelId).catch(() => null);
            delete config.community.tickets.openTickets[ticket.id];
            await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
            await message.reply('O ticket será excluído em 5 segundos.');
            setTimeout(() => void channel?.delete(`Ticket ${ticket.id} excluído por ${message.author.tag}`).catch(() => undefined), 5_000);
            return;
        }
        if (command === 'ticketrename') {
            if (!canManage)
                throw new Error('Você não possui permissão para renomear este ticket');
            const name = sanitizeChannelName(args.join(' '));
            if (!name)
                throw new Error('Informe o novo nome');
            const channel = await message.guild.channels.fetch(ticket.channelId);
            if (!channel || typeof channel.setName !== 'function')
                throw new Error('Canal do ticket indisponível');
            await channel.setName(name, `Ticket renomeado por ${message.author.tag}`);
            await message.reply(`Ticket renomeado para **${name}**.`);
            return;
        }
        if (command === 'ticketpriority') {
            if (!canManage)
                throw new Error('Você não possui permissão para alterar a prioridade');
            const aliases = { baixa: 'low', low: 'low', normal: 'normal', alta: 'high', high: 'high', urgente: 'urgent', urgent: 'urgent' };
            const priority = aliases[String(args[0] ?? '').toLowerCase()];
            if (!priority)
                throw new Error('Use baixa, normal, alta ou urgente');
            ticket.priority = priority;
            await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
            await message.reply(`Prioridade alterada para **${priorityLabel(priority)}**.`);
            return;
        }
        if (command === 'tickettransfer') {
            if (!canManage)
                throw new Error('Você não possui permissão para transferir este ticket');
            const query = args.join(' ').trim().toLowerCase();
            const destination = config.community.tickets.panels.find(item => item.id.toLowerCase() === query || item.name.toLowerCase() === query);
            if (!destination)
                throw new Error('Informe o nome ou ID de um painel de destino');
            ticket.panelId = destination.id;
            ticket.claimedBy = null;
            await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
            await message.reply(`Ticket transferido para **${destination.name}**.`);
            return;
        }
        if (command === 'ticketpause' || command === 'ticketresume') {
            if (!canManage)
                throw new Error('Você não possui permissão para alterar o fechamento automático');
            ticket.autoClosePaused = command === 'ticketpause';
            ticket.lastActivityAt = new Date().toISOString();
            await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
            await message.reply(command === 'ticketpause' ? 'Fechamento automático pausado.' : 'Fechamento automático reativado.');
            return;
        }
        if (command === 'tickettranscript') {
            if (!canManage)
                throw new Error('Você não possui permissão para gerar o transcript');
            const channel = await message.guild.channels.fetch(ticket.channelId);
            if (!channel?.isTextBased?.() || !('messages' in channel))
                throw new Error('Canal do ticket indisponível');
            const transcript = await (0, transcriptService_1.createHtmlTranscript)(channel, ticket.id);
            await message.reply({ content: `Transcript de **${ticket.id}** com ${transcript.messageCount} mensagem(ns).`, files: [transcript.attachment], allowedMentions: { parse: [] } });
            return;
        }
        if (command === 'ticketblock' || command === 'ticketunblock') {
            if (!this.memberIsSupport(message.member, panel))
                throw new Error('Somente a equipe pode gerenciar bloqueios');
            const userId = extractSnowflake(args[0]);
            if (!userId)
                throw new Error('Mencione o usuário');
            if (command === 'ticketblock') {
                if (!panel.blockedUserIds.includes(userId))
                    panel.blockedUserIds.push(userId);
            }
            else
                panel.blockedUserIds = panel.blockedUserIds.filter(id => id !== userId);
            panel.updatedAt = new Date().toISOString();
            await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
            await message.reply({ content: `<@${userId}> foi ${command === 'ticketblock' ? 'bloqueado de abrir tickets neste painel' : 'desbloqueado'}.`, allowedMentions: { users: [userId] } });
            return;
        }
        throw new Error('Ação de ticket desconhecida');
    }
    currentTicketForChannel(config, channelId) {
        const ticket = Object.values(config.community.tickets.openTickets).find(item => item.channelId === channelId);
        if (!ticket)
            return null;
        const panel = config.community.tickets.panels.find(item => item.id === ticket.panelId);
        return panel ? { ticket, panel } : null;
    }
    commandTicketInfoEmbed(ticket, panel) {
        return new discord_js_1.EmbedBuilder()
            .setTitle(`Ticket ${ticket.id}`)
            .setDescription(`Setor: **${panel?.name ?? ticket.panelId}**\nCanal: <#${ticket.channelId}>\nProprietário: <@${ticket.ownerId}>\nResponsável: ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'não assumido'}\nPrioridade: **${priorityLabel(ticket.priority)}**\nEstado: **${ticket.closedAt ? 'fechado' : 'aberto'}**\nFechamento automático: **${ticket.autoClosePaused ? 'pausado' : 'ativo'}**\nCriado: <t:${Math.floor(Date.parse(ticket.createdAt) / 1000)}:F>`)
            .setColor(0x111111)
            .setTimestamp();
    }
    async openTicket(interaction, panelId, answers) {
        const config = await guildConfigStore_1.guildConfigStore.get(interaction.guild.id);
        const panel = config.community.tickets.panels.find(item => item.id === panelId);
        if (!panel || !panel.enabled)
            throw new Error('Este painel está desativado ou não existe.');
        if (!this.memberCanOpen(interaction.member, panel))
            throw new Error('Você não possui acesso a este painel de ticket.');
        if (panel.blockedUserIds.includes(interaction.user.id))
            throw new Error('Você está bloqueado neste painel de atendimento.');
        const current = Object.values(config.community.tickets.openTickets).filter(ticket => !ticket.closedAt && ticket.panelId === panel.id && ticket.ownerId === interaction.user.id);
        if (current.length >= panel.maxOpenPerUser)
            throw new Error(`Você já atingiu o limite de ${panel.maxOpenPerUser} ticket(s) aberto(s) neste painel.`);
        if (panel.questions.length && !answers) {
            const modal = new discord_js_1.ModalBuilder().setCustomId(`t|openform|${panel.id}`).setTitle(`Abrir ${panel.name}`.slice(0, 45));
            for (const question of panel.questions.slice(0, 5)) {
                modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder().setCustomId(`q_${question.id}`).setLabel(question.label.slice(0, 45)).setPlaceholder(question.placeholder.slice(0, 100)).setRequired(question.required).setStyle(question.paragraph ? discord_js_1.TextInputStyle.Paragraph : discord_js_1.TextInputStyle.Short).setMaxLength(question.paragraph ? 1000 : 300)));
            }
            await interaction.showModal(modal);
            return;
        }
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        const number = config.community.tickets.nextTicketNumber++;
        const ticketId = `T-${String(number).padStart(5, '0')}-${(0, ids_1.randomId)(2)}`;
        const channelName = sanitizeChannelName((0, templateRenderer_1.renderTicketTemplate)(panel.ticketNamePattern, {
            user: interaction.user, guild: interaction.guild, panel, ticketId, createdAt: new Date()
        }) || `ticket-${number}`);
        const permissionOverwrites = [
            { id: interaction.guild.id, deny: [discord_js_1.PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ReadMessageHistory, discord_js_1.PermissionFlagsBits.AttachFiles, discord_js_1.PermissionFlagsBits.EmbedLinks] },
            { id: interaction.guild.client.user.id, allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ReadMessageHistory, discord_js_1.PermissionFlagsBits.ManageChannels, discord_js_1.PermissionFlagsBits.ManageMessages] },
            ...panel.supportRoleIds.map(roleId => ({ id: roleId, allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ReadMessageHistory, discord_js_1.PermissionFlagsBits.ManageMessages] }))
        ];
        let ticketChannel;
        if (panel.creationMode === 'thread') {
            const parentId = panel.threadParentChannelId ?? panel.publishChannelId;
            if (!parentId)
                throw new Error('Selecione o canal pai dos tópicos.');
            const parent = await interaction.guild.channels.fetch(parentId).catch(() => null);
            if (!parent?.isTextBased?.() || !('threads' in parent))
                throw new Error('O canal pai dos tópicos não é válido.');
            ticketChannel = await parent.threads.create({
                name: channelName,
                type: discord_js_1.ChannelType.PrivateThread,
                invitable: false,
                reason: `Ticket ${ticketId} aberto por ${interaction.user.tag}`
            });
            await ticketChannel.members.add(interaction.user.id);
            await ticketChannel.members.add(interaction.guild.client.user.id).catch(() => undefined);
            await interaction.guild.members.fetch().catch(() => undefined);
            const supportMemberIds = new Set();
            for (const roleId of panel.supportRoleIds) {
                const role = interaction.guild.roles.cache.get(roleId);
                for (const member of role?.members?.values?.() ?? [])
                    supportMemberIds.add(member.id);
            }
            for (const memberId of [...supportMemberIds].slice(0, 100))
                await ticketChannel.members.add(memberId).catch(() => undefined);
        }
        else {
            ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: discord_js_1.ChannelType.GuildText,
                parent: panel.categoryId ?? undefined,
                permissionOverwrites,
                reason: `Ticket ${ticketId} aberto por ${interaction.user.tag}`
            });
        }
        const record = {
            id: ticketId,
            panelId: panel.id,
            channelId: ticketChannel.id,
            ownerId: interaction.user.id,
            claimedBy: null,
            voiceChannelId: null,
            addedMemberIds: [],
            answers: answers ?? {},
            priority: 'normal',
            createdAt: new Date().toISOString(),
            lastActivityAt: new Date().toISOString(),
            autoClosePaused: false,
            closedAt: null
        };
        config.community.tickets.openTickets[ticketId] = record;
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        const context = { user: interaction.user, owner: interaction.user, guild: interaction.guild, channel: ticketChannel, panel, ticketId, ticketNumber: number, priority: record.priority, reason: Object.values(record.answers)[0] ?? '', createdAt: new Date(record.createdAt) };
        const buttons = this.buildInternalButtons(panel, ticketId);
        const answerText = Object.entries(record.answers).map(([questionId, value]) => {
            const question = panel.questions.find(item => item.id === questionId);
            return `**${question?.label ?? questionId}:**\n${value || 'Não informado'}`;
        }).join('\n\n');
        await ticketChannel.send({
            content: panel.supportRoleIds.map(id => `<@&${id}>`).join(' ') || undefined,
            embeds: [this.buildEmbed(panel.internal, context)],
            components: buttons,
            allowedMentions: { roles: panel.supportRoleIds, users: [interaction.user.id] }
        });
        if (answerText)
            await ticketChannel.send({ content: `### Respostas do formulário\n${answerText}`.slice(0, 2000), allowedMentions: { parse: [] } });
        if (panel.businessHoursEnabled && panel.businessHoursText.trim()) {
            await ticketChannel.send({
                content: (0, templateRenderer_1.renderTicketTemplate)(panel.businessHoursText, context).slice(0, 2000),
                allowedMentions: { users: [interaction.user.id], roles: panel.supportRoleIds }
            });
        }
        await interaction.editReply(`Ticket criado: ${ticketChannel}`);
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'ticket_opened', module: 'community_tickets', executorId: interaction.user.id, targetId: interaction.user.id, channelId: ticketChannel.id, severity: 'info', details: { ticketId, panelId } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
    }
    async claimTicket(interaction, ticketId) {
        const { config, panel, ticket } = await this.resolveTicket(interaction.guild, ticketId);
        if (!this.memberIsSupport(interaction.member, panel))
            throw new Error('Somente a equipe responsável pode assumir este ticket.');
        if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id)
            throw new Error(`Este ticket já foi assumido por <@${ticket.claimedBy}>.`);
        ticket.claimedBy = interaction.user.id;
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        await interaction.reply({ content: `Ticket assumido por ${interaction.user}.`, allowedMentions: { users: [interaction.user.id] } });
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'ticket_claimed', module: 'community_tickets', executorId: interaction.user.id, targetId: ticket.ownerId, channelId: ticket.channelId, details: { ticketId } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
    }
    async unclaimTicket(interaction, ticketId) {
        const { config, panel, ticket } = await this.resolveTicket(interaction.guild, ticketId);
        if (!this.memberIsSupport(interaction.member, panel))
            throw new Error('Somente a equipe responsável pode deixar o atendimento.');
        if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id && !interaction.member.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels))
            throw new Error('Este atendimento pertence a outro membro da equipe.');
        ticket.claimedBy = null;
        ticket.lastActivityAt = new Date().toISOString();
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        await interaction.reply({ content: 'O ticket voltou para a fila de atendimento.', allowedMentions: { parse: [] } });
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'ticket_unclaimed', module: 'community_tickets', executorId: interaction.user.id, targetId: ticket.ownerId, channelId: ticket.channelId, details: { ticketId } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
    }
    async createVoiceChannel(interaction, ticketId) {
        const { config, panel, ticket } = await this.resolveTicket(interaction.guild, ticketId);
        if (!this.memberCanManageTicket(interaction.member, panel, ticket))
            throw new Error('Você não possui permissão para criar a call deste ticket.');
        if (ticket.voiceChannelId) {
            const existing = await interaction.guild.channels.fetch(ticket.voiceChannelId).catch(() => null);
            if (existing) {
                await this.safeReply(interaction, `A call deste ticket já existe: ${existing}`);
                return;
            }
            ticket.voiceChannelId = null;
        }
        const voice = await interaction.guild.channels.create({
            name: `call-${sanitizeChannelName(ticket.id).toLowerCase()}`,
            type: discord_js_1.ChannelType.GuildVoice,
            parent: panel.categoryId ?? interaction.channel?.parentId ?? undefined,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.Connect] },
                { id: ticket.ownerId, allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.Connect, discord_js_1.PermissionFlagsBits.Speak] },
                { id: interaction.guild.client.user.id, allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.Connect, discord_js_1.PermissionFlagsBits.ManageChannels] },
                ...panel.supportRoleIds.map(roleId => ({ id: roleId, allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.Connect, discord_js_1.PermissionFlagsBits.Speak] })),
                ...ticket.addedMemberIds.map(memberId => ({ id: memberId, allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.Connect, discord_js_1.PermissionFlagsBits.Speak] }))
            ],
            reason: `Call do ticket ${ticket.id}`
        });
        ticket.voiceChannelId = voice.id;
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        await this.safeReply(interaction, `Call criada: ${voice}`);
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'ticket_call_created', module: 'community_tickets', executorId: interaction.user.id, targetId: ticket.ownerId, channelId: ticket.channelId, details: { ticketId, voiceChannelId: voice.id } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
    }
    async showAddMemberModal(interaction, ticketId) {
        const { panel, ticket } = await this.resolveTicket(interaction.guild, ticketId);
        if (!this.memberCanManageTicket(interaction.member, panel, ticket))
            throw new Error('Você não possui permissão para adicionar membros.');
        const modal = new discord_js_1.ModalBuilder().setCustomId(`t|addmodal|${ticketId}`).setTitle('Adicionar membro ao ticket').addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Selecione um membro').setDescription('O membro receberá acesso ao canal e à call do ticket.').setUserSelectMenuComponent(new discord_js_1.UserSelectMenuBuilder().setCustomId('member').setMinValues(1).setMaxValues(1).setRequired(true)));
        await interaction.showModal(modal);
    }
    async addMember(interaction, ticketId) {
        const { config, panel, ticket } = await this.resolveTicket(interaction.guild, ticketId);
        if (!this.memberCanManageTicket(interaction.member, panel, ticket))
            throw new Error('Você não possui permissão para adicionar membros.');
        const selected = interaction.fields.getSelectedUsers('member', true);
        const memberId = selected.first()?.id;
        if (!memberId)
            throw new Error('Selecione um membro válido.');
        const member = await interaction.guild.members.fetch(memberId).catch(() => null);
        if (!member)
            throw new Error('O membro não foi encontrado no servidor.');
        const channel = await interaction.guild.channels.fetch(ticket.channelId);
        if (!channel)
            throw new Error('O canal do ticket não existe mais.');
        if (channel.isThread?.())
            await channel.members.add(member.id);
        else if ('permissionOverwrites' in channel)
            await channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true });
        else
            throw new Error('O canal do ticket não pode receber novos membros.');
        if (!ticket.addedMemberIds.includes(member.id))
            ticket.addedMemberIds.push(member.id);
        if (ticket.voiceChannelId) {
            const voice = await interaction.guild.channels.fetch(ticket.voiceChannelId).catch(() => null);
            if (voice && 'permissionOverwrites' in voice)
                await voice.permissionOverwrites.edit(member.id, { ViewChannel: true, Connect: true, Speak: true });
        }
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        await interaction.reply({ content: `${member} foi adicionado ao ticket.`, flags: discord_js_1.MessageFlags.Ephemeral, allowedMentions: { users: [member.id] } });
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'ticket_member_added', module: 'community_tickets', executorId: interaction.user.id, targetId: member.id, channelId: ticket.channelId, details: { ticketId } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
    }
    async showRemoveMemberModal(interaction, ticketId) {
        const { panel, ticket } = await this.resolveTicket(interaction.guild, ticketId);
        if (!this.memberCanManageTicket(interaction.member, panel, ticket))
            throw new Error('Você não possui permissão para remover membros.');
        await interaction.showModal(new discord_js_1.ModalBuilder().setCustomId(`t|removemodal|${ticketId}`).setTitle('Remover membro do ticket').addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Selecione um membro').setDescription('O acesso ao ticket e à call será removido.').setUserSelectMenuComponent(new discord_js_1.UserSelectMenuBuilder().setCustomId('member').setMinValues(1).setMaxValues(1).setRequired(true))));
    }
    async removeMember(interaction, ticketId) {
        const { config, panel, ticket } = await this.resolveTicket(interaction.guild, ticketId);
        if (!this.memberCanManageTicket(interaction.member, panel, ticket))
            throw new Error('Você não possui permissão para remover membros.');
        const memberId = interaction.fields.getSelectedUsers('member', true).first()?.id;
        if (!memberId || memberId === ticket.ownerId)
            throw new Error('O proprietário do ticket não pode ser removido.');
        const channel = await interaction.guild.channels.fetch(ticket.channelId);
        if (!channel)
            throw new Error('Canal do ticket indisponível.');
        if (channel.isThread?.())
            await channel.members.remove(memberId).catch(() => undefined);
        else if ('permissionOverwrites' in channel)
            await channel.permissionOverwrites.delete(memberId, `Removido do ticket por ${interaction.user.tag}`).catch(() => undefined);
        else
            throw new Error('Canal do ticket indisponível.');
        ticket.addedMemberIds = ticket.addedMemberIds.filter(id => id !== memberId);
        if (ticket.voiceChannelId) {
            const voice = await interaction.guild.channels.fetch(ticket.voiceChannelId).catch(() => null);
            if (voice && 'permissionOverwrites' in voice)
                await voice.permissionOverwrites.delete(memberId).catch(() => undefined);
        }
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        await interaction.reply({ content: `<@${memberId}> foi removido do ticket.`, flags: discord_js_1.MessageFlags.Ephemeral, allowedMentions: { users: [memberId] } });
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'ticket_member_removed', module: 'community_tickets', executorId: interaction.user.id, targetId: memberId, channelId: ticket.channelId, details: { ticketId } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
    }
    async showTransferModal(interaction, ticketId) {
        const { panel, ticket } = await this.resolveTicket(interaction.guild, ticketId);
        if (!this.memberCanManageTicket(interaction.member, panel, ticket))
            throw new Error('Você não possui permissão para transferir o ticket.');
        await interaction.showModal(new discord_js_1.ModalBuilder().setCustomId(`t|transfermodal|${ticketId}`).setTitle('Transferir atendimento').addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Novo departamento').setDescription('Selecione o cargo que receberá acesso ao ticket.').setRoleSelectMenuComponent(new discord_js_1.RoleSelectMenuBuilder().setCustomId('role').setMinValues(1).setMaxValues(1).setRequired(true))));
    }
    async transferTicket(interaction, ticketId) {
        const { config, panel, ticket } = await this.resolveTicket(interaction.guild, ticketId);
        if (!this.memberCanManageTicket(interaction.member, panel, ticket))
            throw new Error('Você não possui permissão para transferir o ticket.');
        const roleId = interaction.fields.getSelectedRoles('role', true).first()?.id;
        if (!roleId)
            throw new Error('Selecione um cargo válido.');
        const channel = await interaction.guild.channels.fetch(ticket.channelId);
        if (!channel)
            throw new Error('Canal do ticket indisponível.');
        if (channel.isThread?.()) {
            await interaction.guild.members.fetch().catch(() => undefined);
            const role = interaction.guild.roles.cache.get(roleId);
            for (const member of [...(role?.members?.values?.() ?? [])].slice(0, 100))
                await channel.members.add(member.id).catch(() => undefined);
        }
        else if ('permissionOverwrites' in channel) {
            await channel.permissionOverwrites.edit(roleId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, ManageMessages: true });
        }
        else
            throw new Error('Canal do ticket indisponível.');
        ticket.lastActivityAt = new Date().toISOString();
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        await interaction.reply({ content: `Ticket transferido para <@&${roleId}>.`, allowedMentions: { roles: [roleId] } });
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'ticket_transferred', module: 'community_tickets', executorId: interaction.user.id, targetId: roleId, channelId: ticket.channelId, details: { ticketId } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
    }
    async cyclePriority(interaction, ticketId) {
        const { config, panel, ticket } = await this.resolveTicket(interaction.guild, ticketId);
        if (!this.memberCanManageTicket(interaction.member, panel, ticket))
            throw new Error('Você não possui permissão para alterar a prioridade.');
        const priorities = ['low', 'normal', 'high', 'urgent'];
        ticket.priority = priorities[(priorities.indexOf(ticket.priority) + 1) % priorities.length];
        ticket.lastActivityAt = new Date().toISOString();
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        await interaction.reply({ content: `Prioridade alterada para **${ticket.priority}**.`, allowedMentions: { parse: [] } });
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'ticket_priority', module: 'community_tickets', executorId: interaction.user.id, targetId: ticket.ownerId, channelId: ticket.channelId, details: { ticketId, priority: ticket.priority } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
    }
    async showRenameModal(interaction, ticketId) {
        const { panel, ticket } = await this.resolveTicket(interaction.guild, ticketId);
        if (!this.memberCanManageTicket(interaction.member, panel, ticket))
            throw new Error('Você não possui permissão para renomear o ticket.');
        await interaction.showModal(new discord_js_1.ModalBuilder().setCustomId(`t|renamemodal|${ticketId}`).setTitle('Renomear ticket').addComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder().setCustomId('name').setLabel('Novo nome do canal').setStyle(discord_js_1.TextInputStyle.Short).setRequired(true).setMaxLength(90))));
    }
    async renameTicket(interaction, ticketId) {
        const { config, panel, ticket } = await this.resolveTicket(interaction.guild, ticketId);
        if (!this.memberCanManageTicket(interaction.member, panel, ticket))
            throw new Error('Você não possui permissão para renomear o ticket.');
        const name = sanitizeChannelName(interaction.fields.getTextInputValue('name'));
        const channel = await interaction.guild.channels.fetch(ticket.channelId);
        if (!channel || typeof channel.setName !== 'function')
            throw new Error('Canal do ticket indisponível.');
        await channel.setName(name, `Renomeado por ${interaction.user.tag}`);
        ticket.lastActivityAt = new Date().toISOString();
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        await interaction.reply({ content: `Ticket renomeado para **${name}**.`, flags: discord_js_1.MessageFlags.Ephemeral });
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'ticket_renamed', module: 'community_tickets', executorId: interaction.user.id, targetId: ticket.ownerId, channelId: ticket.channelId, details: { ticketId, name } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
    }
    async closeTicket(interaction, ticketId) {
        const { config, panel, ticket } = await this.resolveTicket(interaction.guild, ticketId);
        if (!this.memberCanManageTicket(interaction.member, panel, ticket))
            throw new Error('Você não possui permissão para fechar este ticket.');
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        const channel = await interaction.guild.channels.fetch(ticket.channelId);
        if (!channel?.isTextBased?.() || !('messages' in channel))
            throw new Error('O canal do ticket não está disponível.');
        const transcript = await (0, transcriptService_1.createHtmlTranscript)(channel, ticket.id);
        const destinationId = panel.transcriptChannelId ?? panel.logChannelId ?? config.logs.defaultChannelId;
        let transcriptDelivered = false;
        if (destinationId) {
            const destination = await interaction.guild.channels.fetch(destinationId).catch(() => null);
            if (destination?.isTextBased?.() && 'send' in destination) {
                transcriptDelivered = await destination.send({
                    content: `Transcript do ticket **${ticket.id}** | Dono: <@${ticket.ownerId}> | Fechado por: <@${interaction.user.id}> | Mensagens: ${transcript.messageCount}`,
                    files: [transcript.attachment],
                    allowedMentions: { parse: [] }
                }).then(() => true).catch(() => false);
            }
        }
        ticket.closedAt = new Date().toISOString();
        ticket.lastActivityAt = ticket.closedAt;
        if (ticket.voiceChannelId) {
            const voice = await interaction.guild.channels.fetch(ticket.voiceChannelId).catch(() => null);
            if (voice)
                await voice.delete(`Ticket ${ticket.id} fechado`).catch(() => undefined);
        }
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'ticket_transcript', module: 'community_tickets', executorId: interaction.user.id, targetId: ticket.ownerId, channelId: ticket.channelId, details: { ticketId, messages: transcript.messageCount, filePath: transcript.filePath } });
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'ticket_closed', module: 'community_tickets', executorId: interaction.user.id, targetId: ticket.ownerId, channelId: ticket.channelId, severity: 'medium', details: { ticketId } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        if (!channel.isThread?.() && 'permissionOverwrites' in channel)
            await channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: false, AttachFiles: false }, { reason: `Ticket fechado por ${interaction.user.tag}` }).catch(() => undefined);
        if (panel.allowReopen) {
            const closeButtons = [];
            if (panel.internalButtons.reopen)
                closeButtons.push(new discord_js_1.ButtonBuilder().setCustomId(`t|reopen|${ticketId}`).setLabel('Reabrir').setStyle(discord_js_1.ButtonStyle.Success));
            if (panel.internalButtons.delete)
                closeButtons.push(new discord_js_1.ButtonBuilder().setCustomId(`t|delete|${ticketId}`).setLabel('Excluir').setStyle(discord_js_1.ButtonStyle.Danger));
            if (panel.internalButtons.transcript)
                closeButtons.push(new discord_js_1.ButtonBuilder().setCustomId(`t|transcript|${ticketId}`).setLabel('Transcript').setStyle(discord_js_1.ButtonStyle.Secondary));
            await channel.send({
                content: `Ticket fechado por ${interaction.user}.`,
                components: closeButtons.length ? [new discord_js_1.ActionRowBuilder().addComponents(...closeButtons)] : [],
                allowedMentions: { users: [interaction.user.id] }
            });
            if (transcriptDelivered)
                await interaction.editReply('Transcript enviado e ticket fechado. O canal permanece disponível para reabertura ou exclusão.');
            else
                await interaction.editReply({ content: 'Ticket fechado. Como não há canal de transcript válido, o arquivo está anexado nesta resposta privada.', files: [transcript.attachment] });
        }
        else {
            const deleteDelaySeconds = panel.ratingEnabled ? 60 : 5;
            if (transcriptDelivered)
                await interaction.editReply(`Transcript enviado e ticket encerrado. O canal será excluído em ${deleteDelaySeconds} segundos.`);
            else
                await interaction.editReply({ content: `Ticket encerrado. O transcript está anexado nesta resposta privada e o canal será excluído em ${deleteDelaySeconds} segundos.`, files: [transcript.attachment] });
            setTimeout(() => void channel.delete(`Ticket ${ticket.id} fechado por ${interaction.user.tag}`).catch(() => undefined), deleteDelaySeconds * 1_000);
        }
        if (panel.ratingEnabled) {
            await channel.send({ content: `<@${ticket.ownerId}>, avalie este atendimento:`, components: [this.buildRatingRow(ticketId)], allowedMentions: { users: [ticket.ownerId] } }).catch(() => undefined);
        }
        if (channel.isThread?.())
            await channel.setArchived(true, `Ticket fechado por ${interaction.user.tag}`).catch(() => undefined);
    }
    async rateTicket(interaction, ticketId, score) {
        if (!Number.isInteger(score) || score < 1 || score > 5)
            throw new Error('Avaliação inválida.');
        const { config, panel, ticket } = await this.resolveTicket(interaction.guild, ticketId, true);
        if (!panel.ratingEnabled)
            throw new Error('A avaliação está desativada.');
        if (interaction.user.id !== ticket.ownerId)
            throw new Error('Somente o proprietário pode avaliar este ticket.');
        await interaction.reply({ content: `Avaliação registrada: **${score}/5**.`, flags: discord_js_1.MessageFlags.Ephemeral });
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'ticket_rating', module: 'community_tickets', executorId: interaction.user.id, targetId: ticket.claimedBy, channelId: ticket.channelId, details: { ticketId, score } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
    }
    async reopenTicket(interaction, ticketId) {
        const { config, panel, ticket } = await this.resolveTicket(interaction.guild, ticketId, true);
        if (!panel.allowReopen)
            throw new Error('A reabertura está desativada neste painel.');
        if (!this.memberCanManageTicket(interaction.member, panel, ticket))
            throw new Error('Você não possui permissão para reabrir este ticket.');
        if (!ticket.closedAt)
            throw new Error('Este ticket já está aberto.');
        const channel = await interaction.guild.channels.fetch(ticket.channelId);
        if (!channel)
            throw new Error('Canal do ticket indisponível.');
        if (channel.isThread?.()) {
            await channel.setArchived(false, `Ticket reaberto por ${interaction.user.tag}`);
            await channel.setLocked(false, `Ticket reaberto por ${interaction.user.tag}`).catch(() => undefined);
            await channel.members.add(ticket.ownerId).catch(() => undefined);
        }
        else if ('permissionOverwrites' in channel) {
            await channel.permissionOverwrites.edit(ticket.ownerId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true }, { reason: `Ticket reaberto por ${interaction.user.tag}` });
        }
        else
            throw new Error('Canal do ticket indisponível.');
        ticket.closedAt = null;
        ticket.lastActivityAt = new Date().toISOString();
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        await interaction.reply({ content: `Ticket reaberto por ${interaction.user}.`, allowedMentions: { users: [interaction.user.id] } });
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'ticket_reopened', module: 'community_tickets', executorId: interaction.user.id, targetId: ticket.ownerId, channelId: ticket.channelId, details: { ticketId } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
    }
    async deleteTicket(interaction, ticketId) {
        const { config, panel, ticket } = await this.resolveTicket(interaction.guild, ticketId, true);
        if (!this.memberCanManageTicket(interaction.member, panel, ticket))
            throw new Error('Você não possui permissão para excluir este ticket.');
        await interaction.reply({ content: 'O canal será excluído em 3 segundos.', flags: discord_js_1.MessageFlags.Ephemeral });
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'ticket_deleted', module: 'community_tickets', executorId: interaction.user.id, targetId: ticket.ownerId, channelId: ticket.channelId, severity: 'medium', details: { ticketId } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        const channel = await interaction.guild.channels.fetch(ticket.channelId).catch(() => null);
        setTimeout(() => void channel?.delete(`Ticket ${ticket.id} excluído por ${interaction.user.tag}`).catch(() => undefined), 3000);
    }
    async sendTranscript(interaction, ticketId) {
        const { config, panel, ticket } = await this.resolveTicket(interaction.guild, ticketId, true);
        if (!this.memberCanManageTicket(interaction.member, panel, ticket))
            throw new Error('Você não possui permissão para gerar o transcript.');
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        const channel = await interaction.guild.channels.fetch(ticket.channelId);
        if (!channel?.isTextBased?.() || !('messages' in channel))
            throw new Error('Canal do ticket indisponível.');
        const transcript = await (0, transcriptService_1.createHtmlTranscript)(channel, ticket.id);
        await interaction.editReply({ content: `Transcript atual de **${ticket.id}** com ${transcript.messageCount} mensagem(ns).`, files: [transcript.attachment] });
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'ticket_transcript', module: 'community_tickets', executorId: interaction.user.id, targetId: ticket.ownerId, channelId: ticket.channelId, details: { ticketId, messages: transcript.messageCount, manual: true } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
    }
    buildEmbed(appearance, context) {
        const description = appearance.description;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle((0, templateRenderer_1.renderTicketTemplate)(appearance.title, context).slice(0, 256))
            .setDescription((0, templateRenderer_1.renderTicketTemplate)(description, context).slice(0, 4096))
            .setColor(normalizeColor(appearance.color))
            .setTimestamp();
        if (appearance.footer)
            embed.setFooter({ text: (0, templateRenderer_1.renderTicketTemplate)(appearance.footer, context).slice(0, 2048) });
        if (appearance.imageUrl)
            embed.setImage(appearance.imageUrl);
        if (appearance.thumbnailUrl)
            embed.setThumbnail(appearance.thumbnailUrl);
        if (appearance.authorName)
            embed.setAuthor({ name: (0, templateRenderer_1.renderTicketTemplate)(appearance.authorName, context).slice(0, 256) });
        return embed;
    }
    buildInternalButtons(panel, ticketId) {
        const definitions = [
            ['claim', 'claim', 'Assumir', discord_js_1.ButtonStyle.Primary], ['unclaim', 'unclaim', 'Deixar atendimento', discord_js_1.ButtonStyle.Secondary], ['addMember', 'add', 'Adicionar membro', discord_js_1.ButtonStyle.Secondary], ['removeMember', 'remove', 'Remover membro', discord_js_1.ButtonStyle.Secondary],
            ['createVoice', 'call', 'Criar call', discord_js_1.ButtonStyle.Secondary], ['transfer', 'transfer', 'Transferir', discord_js_1.ButtonStyle.Secondary], ['priority', 'priority', 'Prioridade', discord_js_1.ButtonStyle.Secondary], ['rename', 'rename', 'Renomear', discord_js_1.ButtonStyle.Secondary],
            ['transcript', 'transcript', 'Transcript', discord_js_1.ButtonStyle.Secondary], ['close', 'close', 'Fechar', discord_js_1.ButtonStyle.Danger]
        ];
        const enabled = definitions.filter(([key]) => panel.internalButtons[key]);
        const rows = [];
        for (let index = 0; index < enabled.length; index += 5) {
            rows.push(new discord_js_1.ActionRowBuilder().addComponents(...enabled.slice(index, index + 5).map(([, action, label, style]) => new discord_js_1.ButtonBuilder().setCustomId(`t|${action}|${ticketId}`).setLabel(label).setStyle(style))));
        }
        return rows;
    }
    buildRatingRow(ticketId) {
        return new discord_js_1.ActionRowBuilder().addComponents(...[1, 2, 3, 4, 5].map(score => new discord_js_1.ButtonBuilder()
            .setCustomId(`t|rate${score}|${ticketId}`)
            .setLabel(String(score))
            .setStyle(discord_js_1.ButtonStyle.Secondary)));
    }
    applyButtonAppearance(button, appearance) {
        const styles = { primary: discord_js_1.ButtonStyle.Primary, secondary: discord_js_1.ButtonStyle.Secondary, success: discord_js_1.ButtonStyle.Success, danger: discord_js_1.ButtonStyle.Danger };
        button.setStyle(styles[appearance.buttonStyle] ?? discord_js_1.ButtonStyle.Primary);
        const configuredEmoji = (0, emojis_1.resolveConfiguredEmoji)(appearance.buttonEmoji);
        if (configuredEmoji)
            button.setEmoji(configuredEmoji);
        return button;
    }
    readQuestionAnswers(interaction) {
        const answers = {};
        for (const row of interaction.components ?? []) {
            for (const component of row.components ?? []) {
                const id = String(component.customId ?? component.custom_id ?? '');
                if (id.startsWith('q_'))
                    answers[id.slice(2)] = interaction.fields.getTextInputValue(id).trim();
            }
        }
        return answers;
    }
    memberCanOpen(member, panel) {
        if (panel.blockedRoleIds.some(roleId => member.roles.cache.has(roleId)))
            return false;
        if (!panel.allowedRoleIds.length)
            return true;
        return panel.allowedRoleIds.some(roleId => member.roles.cache.has(roleId));
    }
    memberIsSupport(member, panel) {
        return member.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels) || panel.supportRoleIds.some(roleId => member.roles.cache.has(roleId));
    }
    memberCanManageTicket(member, panel, ticket) {
        return member.id === ticket.ownerId || this.memberIsSupport(member, panel);
    }
    async resolveTicket(guild, ticketId, includeClosed = false) {
        const config = await guildConfigStore_1.guildConfigStore.get(guild.id);
        const ticket = config.community.tickets.openTickets[ticketId];
        if (!ticket || (!includeClosed && ticket.closedAt))
            throw new Error('Este ticket já foi encerrado ou não existe.');
        const panel = config.community.tickets.panels.find(item => item.id === ticket.panelId);
        if (!panel)
            throw new Error('A configuração deste painel não existe mais.');
        return { config, panel, ticket };
    }
    async safeReply(interaction, content) {
        if (interaction.deferred || interaction.replied)
            await interaction.followUp({ content, flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => undefined);
        else
            await interaction.reply({ content, flags: discord_js_1.MessageFlags.Ephemeral }).catch(() => undefined);
    }
}
exports.TicketService = TicketService;
function extractSnowflake(raw) { return raw?.match(/\d{16,22}/)?.[0] ?? null; }
function priorityLabel(value) { return { low: 'baixa', normal: 'normal', high: 'alta', urgent: 'urgente' }[value]; }
function sanitizeChannelName(value) {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'ticket';
}
function normalizeColor(value) {
    const clean = value.replace('#', '');
    return /^[0-9a-f]{6}$/i.test(clean) ? Number.parseInt(clean, 16) : 0x111111;
}
//# sourceMappingURL=ticketService.js.map