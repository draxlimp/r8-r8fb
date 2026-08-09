"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelloynService = void 0;
const discord_js_1 = require("discord.js");
const guildConfigStore_1 = require("../storage/guildConfigStore");
const communityLogger_1 = require("./communityLogger");
const telloynCanvas_1 = require("./telloynCanvas");
const templateRenderer_1 = require("./templateRenderer");
class TelloynService {
    async handleInteraction(interaction) {
        if (!interaction.customId?.startsWith('tl|'))
            return false;
        const [, action] = interaction.customId.split('|');
        if (!interaction.guild)
            return false;
        if (action === 'open' && interaction.isButton()) {
            const config = await guildConfigStore_1.guildConfigStore.get(interaction.guild.id);
            const item = config.community.telloyn;
            if (!item.enabled) {
                await interaction.reply({ content: 'O Telloyn está desativado.', flags: discord_js_1.MessageFlags.Ephemeral });
                return true;
            }
            await interaction.showModal(this.createSendModal(item));
            return true;
        }
        if (action === 'submit' && interaction.isModalSubmit()) {
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                await this.submit(interaction);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Erro interno ao enviar o Telloyn.';
                await interaction.editReply({ content: message, allowedMentions: { parse: [] } }).catch(() => undefined);
            }
            return true;
        }
        return false;
    }
    async publishPanel(guild, item) {
        if (!item.channelId)
            throw new Error('Selecione o canal do Telloyn.');
        const channel = await guild.channels.fetch(item.channelId);
        if (!channel?.isTextBased?.() || !('send' in channel))
            throw new Error('O canal do Telloyn não é válido.');
        if (item.publishMessageId) {
            const old = await channel.messages.fetch(item.publishMessageId).catch(() => null);
            if (old)
                await old.delete().catch(() => undefined);
        }
        const message = await channel.send(this.panelPayload(item, guild));
        return { channelId: channel.id, messageId: message.id };
    }
    panelPayload(item, guild) {
        const appearance = item.appearance;
        const context = { user: guild.members?.me?.user ?? guild.client?.user ?? { username: 'Comunidade' }, guild };
        const title = (0, templateRenderer_1.renderCommunityTemplate)(appearance.title, context) || 'Telloyn';
        const description = (0, templateRenderer_1.renderCommunityTemplate)(appearance.description, context) || 'Envie uma mensagem para a comunidade.';
        const container = new discord_js_1.ContainerBuilder()
            .setAccentColor(normalizeColor(appearance.color))
            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`## ${title.slice(0, 256)}\n${description.slice(0, 3500)}`));
        const thumbnail = (0, templateRenderer_1.renderCommunityTemplate)(appearance.thumbnailUrl ?? '', context);
        if (isHttp(thumbnail)) {
            const section = new discord_js_1.SectionBuilder()
                .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('Escolha como deseja enviar, mencione alguém opcionalmente e escreva sua mensagem.'))
                .setThumbnailAccessory(new discord_js_1.ThumbnailBuilder().setURL(thumbnail));
            container.addSectionComponents(section);
        }
        if (appearance.showSeparator) {
            container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small));
        }
        const image = (0, templateRenderer_1.renderCommunityTemplate)(appearance.imageUrl ?? '', context);
        if (isHttp(image))
            container.addMediaGalleryComponents(new discord_js_1.MediaGalleryBuilder().addItems(new discord_js_1.MediaGalleryItemBuilder().setURL(image).setDescription('Imagem do painel Telloyn')));
        container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(applyButtonStyle(new discord_js_1.ButtonBuilder().setCustomId('tl|open').setLabel(appearance.buttonLabel || 'Enviar Telloyn'), appearance.buttonStyle)));
        return { components: [container], flags: discord_js_1.MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
    }
    createSendModal(item) {
        const options = [];
        if (item.allowPublic)
            options.push(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Público').setDescription('Mostra seu nome, usuário e foto.').setValue('public'));
        if (item.allowAnonymous)
            options.push(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Anônimo').setDescription('Oculta sua identidade na publicação.').setValue('anonymous'));
        if (!options.length)
            options.push(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Público').setValue('public'));
        const modal = new discord_js_1.ModalBuilder().setCustomId('tl|submit').setTitle('Telloyn').addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Como deseja enviar?').setStringSelectMenuComponent(new discord_js_1.StringSelectMenuBuilder().setCustomId('mode').setPlaceholder('Selecione uma opção').setMinValues(1).setMaxValues(1).addOptions(options)));
        if (item.allowMentions) {
            modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Mencionar alguém? (opcional)').setUserSelectMenuComponent(new discord_js_1.UserSelectMenuBuilder().setCustomId('mention').setPlaceholder('Selecione uma pessoa').setRequired(false).setMaxValues(1)));
        }
        modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Sua mensagem').setTextInputComponent(new discord_js_1.TextInputBuilder().setCustomId('message').setStyle(discord_js_1.TextInputStyle.Paragraph).setRequired(true).setMinLength(1).setMaxLength(Math.min(4000, Math.max(50, item.maximumMessageLength))).setPlaceholder('Escreva sua mensagem aqui')));
        return modal;
    }
    async submit(interaction) {
        const config = await guildConfigStore_1.guildConfigStore.get(interaction.guild.id);
        const item = config.community.telloyn;
        if (!item.enabled || !item.channelId)
            throw new Error('O Telloyn não está configurado corretamente.');
        const mode = interaction.fields.getStringSelectValues('mode')[0] ?? 'public';
        const anonymous = mode === 'anonymous';
        if (anonymous && !item.allowAnonymous)
            throw new Error('Envios anônimos estão desativados.');
        if (!anonymous && !item.allowPublic)
            throw new Error('Envios públicos estão desativados.');
        const message = interaction.fields.getTextInputValue('message').trim();
        if (!message)
            throw new Error('Escreva uma mensagem.');
        if (message.length > item.maximumMessageLength)
            throw new Error(`A mensagem deve ter no máximo ${item.maximumMessageLength} caracteres.`);
        const selectedUsers = item.allowMentions ? interaction.fields.getSelectedUsers('mention', false) : null;
        const mentioned = selectedUsers?.first?.() ?? null;
        const member = interaction.member;
        const authorDisplayName = member?.displayName ?? interaction.user.globalName ?? interaction.user.username;
        const mentionedMember = mentioned ? await interaction.guild.members.fetch(mentioned.id).catch(() => null) : null;
        const image = await (0, telloynCanvas_1.createTelloynCard)({
            anonymous,
            authorName: authorDisplayName,
            authorUsername: interaction.user.username,
            authorAvatarUrl: anonymous ? null : interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
            mentionedName: mentioned ? (mentionedMember?.displayName ?? mentioned.globalName ?? mentioned.username) : null,
            mentionedUsername: mentioned?.username ?? null,
            mentionedAvatarUrl: mentioned?.displayAvatarURL?.({ extension: 'png', size: 128 }) ?? null,
            message,
            guildName: interaction.guild.name
        });
        const fileName = `telloyn-${Date.now()}.png`;
        const attachment = new discord_js_1.AttachmentBuilder(image, { name: fileName });
        const container = new discord_js_1.ContainerBuilder()
            .setAccentColor(normalizeColor(item.appearance.color))
            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`## Telloyn\n**${interaction.guild.name}**`));
        if (mentioned)
            container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`**Mencionado:** <@${mentioned.id}>`));
        container.addMediaGalleryComponents(new discord_js_1.MediaGalleryBuilder().addItems(new discord_js_1.MediaGalleryItemBuilder().setURL(`attachment://${fileName}`).setDescription('Mensagem do Telloyn')));
        const channel = await interaction.guild.channels.fetch(item.channelId).catch(() => null);
        if (!channel?.isTextBased?.() || !('send' in channel))
            throw new Error('O canal configurado para o Telloyn não está disponível.');
        await channel.send({
            components: [container],
            files: [attachment],
            flags: discord_js_1.MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [], users: mentioned ? [mentioned.id] : [] }
        });
        await (0, communityLogger_1.logCommunityEvent)({
            guild: interaction.guild,
            config,
            event: anonymous ? 'telloyn_anonymous_sent' : 'telloyn_sent',
            module: 'community_telloyn',
            executorId: interaction.user.id,
            targetId: mentioned?.id ?? null,
            severity: 'info',
            actionResult: 'success',
            details: { anonymous }
        });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        await interaction.editReply({ content: 'Seu Telloyn foi enviado com sucesso.', allowedMentions: { parse: [] } });
    }
}
exports.TelloynService = TelloynService;
function normalizeColor(value) {
    const clean = value.replace('#', '');
    return /^[0-9a-f]{6}$/i.test(clean) ? Number.parseInt(clean, 16) : 0x111111;
}
function isHttp(value) { return /^https?:\/\//i.test(value); }
function applyButtonStyle(button, style) {
    const map = { primary: discord_js_1.ButtonStyle.Primary, secondary: discord_js_1.ButtonStyle.Secondary, success: discord_js_1.ButtonStyle.Success, danger: discord_js_1.ButtonStyle.Danger };
    return button.setStyle(map[style] ?? discord_js_1.ButtonStyle.Primary);
}
//# sourceMappingURL=telloynService.js.map