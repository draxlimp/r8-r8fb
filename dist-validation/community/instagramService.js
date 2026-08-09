"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstagramService = void 0;
const discord_js_1 = require("discord.js");
const guildConfigStore_1 = require("../storage/guildConfigStore");
const emojis_1 = require("../ui/emojis");
const ids_1 = require("../utils/ids");
const communityLogger_1 = require("./communityLogger");
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
class InstagramService {
    async handleMessage(message) {
        if (!message.guild || message.author?.bot || message.webhookId)
            return false;
        const config = await guildConfigStore_1.guildConfigStore.get(message.guild.id);
        const item = config.community.instagram;
        if (!item.enabled || !item.channelId || message.channelId !== item.channelId)
            return false;
        const member = message.member;
        const allowed = Boolean(member && item.allowedRoleId && member.roles?.cache?.has(item.allowedRoleId));
        if (!allowed) {
            if (item.deleteUnauthorizedMessages && message.deletable)
                await message.delete().catch(() => undefined);
            await this.notice(message.channel, message.author.id, 'Você não possui o cargo configurado para publicar neste canal.');
            await (0, communityLogger_1.logCommunityEvent)({
                guild: message.guild, config, event: 'instagram_post_rejected', module: 'community_instagram',
                executorId: message.author.id, channelId: message.channelId, severity: 'low', actionResult: 'blocked'
            });
            await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
            return true;
        }
        const attachment = [...message.attachments.values()].find((entry) => this.acceptedAttachment(entry, item));
        if (!attachment && item.requireAttachment) {
            if (message.deletable)
                await message.delete().catch(() => undefined);
            await this.notice(message.channel, message.author.id, 'Envie uma foto ou vídeo permitido para publicar no Instagram.');
            return true;
        }
        if (!attachment)
            return false;
        if (Number(attachment.size ?? 0) > MAX_MEDIA_BYTES) {
            if (message.deletable)
                await message.delete().catch(() => undefined);
            await this.notice(message.channel, message.author.id, 'O arquivo ultrapassa o limite de 25 MB deste módulo.');
            return true;
        }
        const caption = String(message.content ?? '').trim().slice(0, item.maximumCaptionLength);
        try {
            const response = await fetch(attachment.url);
            if (!response.ok)
                throw new Error(`Falha ao baixar a mídia: HTTP ${response.status}`);
            const media = Buffer.from(await response.arrayBuffer());
            const safeName = this.safeFileName(attachment.name ?? `media-${Date.now()}`);
            const id = `IG-${(0, ids_1.randomId)(10)}`;
            const draft = {
                id, messageId: '', channelId: message.channelId, authorId: message.author.id, caption,
                attachmentUrl: '', attachmentName: safeName,
                mediaType: String(attachment.contentType ?? '').startsWith('video/') ? 'video' : 'image',
                likes: [], comments: [], createdAt: new Date().toISOString()
            };
            const sent = await message.channel.send({
                ...this.postPayload(draft, item, message.member, message.guild, `attachment://${safeName}`),
                files: [new discord_js_1.AttachmentBuilder(media, { name: safeName })]
            });
            draft.messageId = sent.id;
            draft.attachmentUrl = sent.attachments.first()?.url ?? attachment.url;
            item.posts[id] = draft;
            this.prunePosts(item);
            await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
            if (message.deletable)
                await message.delete().catch(() => undefined);
            await (0, communityLogger_1.logCommunityEvent)({
                guild: message.guild, config, event: 'instagram_post_created', module: 'community_instagram',
                executorId: message.author.id, channelId: message.channelId, targetId: sent.id, severity: 'info', actionResult: 'success'
            });
        }
        catch (error) {
            await this.notice(message.channel, message.author.id, 'Não foi possível publicar a mídia. Verifique as permissões e tente novamente.');
            await (0, communityLogger_1.logCommunityEvent)({
                guild: message.guild, config, event: 'instagram_post_rejected', module: 'community_instagram',
                executorId: message.author.id, channelId: message.channelId, severity: 'medium', actionResult: 'failure',
                details: { error: error instanceof Error ? error.message : String(error) }
            });
            await guildConfigStore_1.guildConfigStore.set(message.guild.id, config);
        }
        return true;
    }
    async handleInteraction(interaction) {
        if (!interaction.customId?.startsWith('ig|') || !interaction.guild)
            return false;
        const [, action, postId] = String(interaction.customId).split('|');
        if (!postId)
            return false;
        if (action === 'comment' && interaction.isButton?.()) {
            await interaction.showModal(new discord_js_1.ModalBuilder().setCustomId(`ig|commentSubmit|${postId}`).setTitle('Comentar publicação').addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Comentário').setDescription('Escreva um comentário respeitoso.').setTextInputComponent(new discord_js_1.TextInputBuilder().setCustomId('comment').setStyle(discord_js_1.TextInputStyle.Paragraph).setRequired(true).setMinLength(1).setMaxLength(800).setPlaceholder('Escreva seu comentário'))));
            return true;
        }
        if (action === 'commentSubmit' && interaction.isModalSubmit?.()) {
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            await this.addComment(interaction, postId);
            return true;
        }
        if (action === 'like' && interaction.isButton?.()) {
            await interaction.deferUpdate();
            await this.toggleLike(interaction, postId);
            return true;
        }
        if (action === 'details' && interaction.isButton?.()) {
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            await this.showDetails(interaction, postId);
            return true;
        }
        if (action === 'delete' && interaction.isButton?.()) {
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            await this.deletePost(interaction, postId);
            return true;
        }
        return false;
    }
    async toggleLike(interaction, postId) {
        const config = await guildConfigStore_1.guildConfigStore.get(interaction.guild.id);
        const post = config.community.instagram.posts[postId];
        if (!post)
            return;
        const index = post.likes.indexOf(interaction.user.id);
        if (index >= 0)
            post.likes.splice(index, 1);
        else
            post.likes.push(interaction.user.id);
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        await this.editPostMessage(interaction.guild, post, config.community.instagram);
        await (0, communityLogger_1.logCommunityEvent)({
            guild: interaction.guild, config, event: 'instagram_post_liked', module: 'community_instagram',
            executorId: interaction.user.id, targetId: post.authorId, channelId: post.channelId, severity: 'info', actionResult: index >= 0 ? 'removed' : 'added'
        });
    }
    async addComment(interaction, postId) {
        const config = await guildConfigStore_1.guildConfigStore.get(interaction.guild.id);
        const item = config.community.instagram;
        const post = item.posts[postId];
        if (!post) {
            await interaction.editReply({ content: 'Esta publicação não está mais registrada.' });
            return;
        }
        if (post.comments.length >= item.maximumCommentsPerPost) {
            await interaction.editReply({ content: 'Esta publicação atingiu o limite de comentários.' });
            return;
        }
        const content = interaction.fields.getTextInputValue('comment').trim();
        post.comments.push({ id: `C-${(0, ids_1.randomId)(8)}`, userId: interaction.user.id, content, createdAt: new Date().toISOString() });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        await this.editPostMessage(interaction.guild, post, item);
        await (0, communityLogger_1.logCommunityEvent)({
            guild: interaction.guild, config, event: 'instagram_post_commented', module: 'community_instagram',
            executorId: interaction.user.id, targetId: post.authorId, channelId: post.channelId, severity: 'info', actionResult: 'success'
        });
        await interaction.editReply({ content: 'Comentário publicado.', allowedMentions: { parse: [] } });
    }
    async showDetails(interaction, postId) {
        const config = await guildConfigStore_1.guildConfigStore.get(interaction.guild.id);
        const post = config.community.instagram.posts[postId];
        if (!post) {
            await interaction.editReply({ content: 'Esta publicação não está mais registrada.' });
            return;
        }
        const likeNames = await this.resolveUsers(interaction.guild, post.likes.slice(-30));
        const comments = [];
        for (const item of post.comments.slice(-20)) {
            const member = await interaction.guild.members.fetch(item.userId).catch(() => null);
            comments.push(`**${member?.displayName ?? item.userId}:** ${item.content}`);
        }
        const text = [
            `## Informações da publicação`,
            `**Curtidas (${post.likes.length}):** ${likeNames.length ? likeNames.join(', ') : 'nenhuma'}`,
            `**Comentários (${post.comments.length}):**`,
            comments.length ? comments.join('\n').slice(0, 3500) : 'Nenhum comentário.'
        ].join('\n');
        const container = new discord_js_1.ContainerBuilder().setAccentColor(0x111111).addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(text));
        await interaction.editReply({ components: [container], flags: discord_js_1.MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
    }
    async deletePost(interaction, postId) {
        const config = await guildConfigStore_1.guildConfigStore.get(interaction.guild.id);
        const post = config.community.instagram.posts[postId];
        if (!post) {
            await interaction.editReply({ content: 'Esta publicação não está mais registrada.' });
            return;
        }
        const member = interaction.member;
        const canDelete = interaction.user.id === post.authorId || member?.permissions?.has?.('ManageMessages') || member?.permissions?.has?.('Administrator') || interaction.guild.ownerId === interaction.user.id;
        if (!canDelete) {
            await interaction.editReply({ content: 'Somente o autor ou a moderação pode excluir esta publicação.' });
            return;
        }
        const channel = await interaction.guild.channels.fetch(post.channelId).catch(() => null);
        const message = channel?.isTextBased?.() ? await channel.messages.fetch(post.messageId).catch(() => null) : null;
        if (message)
            await message.delete().catch(() => undefined);
        delete config.community.instagram.posts[postId];
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        await (0, communityLogger_1.logCommunityEvent)({
            guild: interaction.guild, config, event: 'instagram_post_deleted', module: 'community_instagram',
            executorId: interaction.user.id, targetId: post.authorId, channelId: post.channelId, severity: 'medium', actionResult: 'success'
        });
        await interaction.editReply({ content: 'Publicação excluída.', allowedMentions: { parse: [] } });
    }
    async editPostMessage(guild, post, item) {
        const channel = await guild.channels.fetch(post.channelId).catch(() => null);
        if (!channel?.isTextBased?.())
            return;
        const message = await channel.messages.fetch(post.messageId).catch(() => null);
        if (!message)
            return;
        const member = await guild.members.fetch(post.authorId).catch(() => null);
        await message.edit(this.postPayload(post, item, member, guild, post.attachmentUrl)).catch(() => undefined);
    }
    postPayload(post, item, member, _guild, mediaUrl) {
        const displayName = member?.displayName ?? member?.user?.globalName ?? member?.user?.username ?? 'Usuário';
        const username = member?.user?.username ?? 'usuario';
        const created = Math.floor(Date.parse(post.createdAt) / 1000);
        const container = new discord_js_1.ContainerBuilder().setAccentColor(normalizeColor(item.appearance.color));
        const header = [
            `**Autor:** <@${post.authorId}>`,
            `-# ${escapeDiscord(displayName)} • @${escapeDiscord(username)} • <t:${created}:R>`
        ].join('\n');
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(header));
        if (post.caption)
            container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(post.caption.slice(0, item.maximumCaptionLength)));
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small));
        container.addMediaGalleryComponents(new discord_js_1.MediaGalleryBuilder().addItems(new discord_js_1.MediaGalleryItemBuilder().setURL(mediaUrl).setDescription(`Publicação de ${displayName}`)));
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small));
        const like = actionButton(`ig|like|${post.id}`, discord_js_1.ButtonStyle.Secondary, (0, emojis_1.resolveConfiguredEmoji)(item.emojis.like) ?? emojis_1.UI_EMOJIS.heart, 'Curtir');
        const comment = actionButton(`ig|comment|${post.id}`, discord_js_1.ButtonStyle.Secondary, (0, emojis_1.resolveConfiguredEmoji)(item.emojis.comment) ?? emojis_1.UI_EMOJIS.topic, 'Comentar');
        const details = actionButton(`ig|details|${post.id}`, discord_js_1.ButtonStyle.Secondary, (0, emojis_1.resolveConfiguredEmoji)(item.emojis.details) ?? emojis_1.UI_EMOJIS.more, 'Detalhes');
        const remove = actionButton(`ig|delete|${post.id}`, discord_js_1.ButtonStyle.Danger, (0, emojis_1.resolveConfiguredEmoji)(item.emojis.delete) ?? emojis_1.UI_EMOJIS.trash, 'Excluir');
        container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(like, comment, details, remove));
        return { components: [container], flags: discord_js_1.MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
    }
    acceptedAttachment(attachment, item) {
        const type = String(attachment.contentType ?? '').toLowerCase();
        if (item.allowImages && IMAGE_TYPES.has(type))
            return true;
        if (item.allowVideos && VIDEO_TYPES.has(type))
            return true;
        const name = String(attachment.name ?? '').toLowerCase();
        if (item.allowImages && /\.(png|jpe?g|webp|gif)$/.test(name))
            return true;
        if (item.allowVideos && /\.(mp4|webm|mov)$/.test(name))
            return true;
        return false;
    }
    async notice(channel, userId, text) {
        const sent = await channel.send({ content: `<@${userId}> ${text}`, allowedMentions: { users: [userId], parse: [] } }).catch(() => null);
        if (sent) {
            const timer = setTimeout(() => void sent.delete().catch(() => undefined), 8000);
            timer.unref?.();
        }
    }
    safeFileName(value) {
        const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
        return cleaned || `instagram-${Date.now()}.bin`;
    }
    prunePosts(item) {
        const posts = Object.values(item.posts).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        for (const post of posts.slice(500))
            delete item.posts[post.id];
    }
    async resolveUsers(guild, ids) {
        const names = [];
        for (const id of ids) {
            const member = await guild.members.fetch(id).catch(() => null);
            names.push(member?.displayName ?? id);
        }
        return names;
    }
}
exports.InstagramService = InstagramService;
function normalizeColor(value) {
    const clean = value.replace('#', '');
    return /^[0-9a-f]{6}$/i.test(clean) ? Number.parseInt(clean, 16) : 0x111111;
}
function actionButton(customId, style, configured, label) {
    const button = new discord_js_1.ButtonBuilder().setCustomId(customId).setStyle(style).setLabel(label);
    if (configured) {
        try {
            button.setEmoji(configured);
        }
        catch { /* configuração inválida é ignorada */ }
    }
    return button;
}
function escapeDiscord(value) {
    return String(value).replace(/[\`*_{}\[\]()#+\-.!|>~]/g, '\\$&');
}
//# sourceMappingURL=instagramService.js.map