"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWelcome = sendWelcome;
exports.sendGoodbye = sendGoodbye;
exports.sendWelcomePreview = sendWelcomePreview;
exports.sendGoodbyePreview = sendGoodbyePreview;
exports.appearancePayload = appearancePayload;
const discord_js_1 = require("discord.js");
const guildConfigStore_1 = require("../storage/guildConfigStore");
const communityLogger_1 = require("./communityLogger");
const templateRenderer_1 = require("./templateRenderer");
async function sendWelcome(member) {
    const config = await guildConfigStore_1.guildConfigStore.get(member.guild.id);
    const welcome = config.community.welcome;
    if (!welcome.enabled)
        return;
    const payload = appearancePayload(welcome.appearance, { user: member.user, member, guild: member.guild });
    let sent = false;
    if (welcome.channelId) {
        const channel = await member.guild.channels.fetch(welcome.channelId).catch(() => null);
        if (channel?.isTextBased?.() && 'send' in channel) {
            const message = await channel.send(payload).catch(() => null);
            if (message) {
                sent = true;
                if (welcome.deleteAfterSeconds > 0)
                    setTimeout(() => void message.delete().catch(() => undefined), welcome.deleteAfterSeconds * 1000);
            }
        }
    }
    if (welcome.sendDirectMessage) {
        const direct = await member.send(payload).then(() => true).catch(() => false);
        sent ||= direct;
    }
    await (0, communityLogger_1.logCommunityEvent)({
        guild: member.guild,
        config,
        event: sent ? 'welcome_sent' : 'welcome_failed',
        module: 'community_welcome',
        executorId: member.guild.client.user.id,
        targetId: member.id,
        severity: sent ? 'info' : 'medium',
        actionResult: sent ? 'success' : 'failed'
    });
    await guildConfigStore_1.guildConfigStore.set(member.guild.id, config);
}
async function sendGoodbye(member) {
    const config = await guildConfigStore_1.guildConfigStore.get(member.guild.id);
    const goodbye = config.community.goodbye;
    if (!goodbye.enabled || !goodbye.channelId)
        return;
    const channel = await member.guild.channels.fetch(goodbye.channelId).catch(() => null);
    if (!channel?.isTextBased?.() || !('send' in channel))
        return;
    const payload = appearancePayload(goodbye.appearance, { user: member.user, member, guild: member.guild, joinedAt: member.joinedAt, leftAt: new Date() });
    const message = await channel.send(payload).catch(() => null);
    if (message && goodbye.deleteAfterSeconds > 0)
        setTimeout(() => void message.delete().catch(() => undefined), goodbye.deleteAfterSeconds * 1000);
    await (0, communityLogger_1.logCommunityEvent)({
        guild: member.guild,
        config,
        event: message ? 'goodbye_sent' : 'goodbye_failed',
        module: 'community_goodbye',
        executorId: member.guild.client.user.id,
        targetId: member.id,
        severity: message ? 'info' : 'medium',
        actionResult: message ? 'success' : 'failed'
    });
    await guildConfigStore_1.guildConfigStore.set(member.guild.id, config);
}
async function sendWelcomePreview(interaction, welcome) {
    const appearance = appearancePayload(welcome.appearance, { user: interaction.user, member: interaction.member, guild: interaction.guild, channel: interaction.channel });
    await sendPreview(interaction, 'Prévia de boas-vindas', 'Esta é uma simulação privada. Nenhum botão ou seletor desta prévia pode ser usado.', appearance.embeds[0]);
}
async function sendGoodbyePreview(interaction, goodbye) {
    const appearance = appearancePayload(goodbye.appearance, { user: interaction.user, member: interaction.member, guild: interaction.guild, channel: interaction.channel, leftAt: new Date() });
    await sendPreview(interaction, 'Prévia de saída', 'Esta é uma simulação privada. Nenhum botão ou seletor desta prévia pode ser usado.', appearance.embeds[0]);
}
async function sendPreview(interaction, title, description, previewEmbed) {
    const payload = {
        embeds: [new discord_js_1.EmbedBuilder().setTitle(title).setDescription(description).setColor(0x5865f2), previewEmbed],
        allowedMentions: { parse: [] }
    };
    if (interaction.deferred && !interaction.replied) {
        await interaction.editReply(payload);
        return;
    }
    if (interaction.replied) {
        await interaction.followUp({ ...payload, flags: discord_js_1.MessageFlags.Ephemeral });
        return;
    }
    await interaction.reply({ ...payload, flags: discord_js_1.MessageFlags.Ephemeral });
}
function appearancePayload(appearance, context) {
    const title = (0, templateRenderer_1.renderCommunityTemplate)(appearance.title, context).slice(0, 256);
    const description = (0, templateRenderer_1.renderCommunityTemplate)(appearance.description, context).slice(0, 4096);
    const embed = new discord_js_1.EmbedBuilder().setTitle(title || 'Mensagem').setDescription(description || ' ').setColor(normalizeColor(appearance.color)).setTimestamp();
    const footer = (0, templateRenderer_1.renderCommunityTemplate)(appearance.footer, context);
    const image = (0, templateRenderer_1.renderCommunityTemplate)(appearance.imageUrl ?? '', context);
    const thumbnail = (0, templateRenderer_1.renderCommunityTemplate)(appearance.thumbnailUrl ?? '', context);
    const author = (0, templateRenderer_1.renderCommunityTemplate)(appearance.authorName, context);
    if (footer)
        embed.setFooter({ text: footer.slice(0, 2048) });
    if (image && isHttp(image))
        embed.setImage(image);
    if (thumbnail && isHttp(thumbnail))
        embed.setThumbnail(thumbnail);
    if (author)
        embed.setAuthor({ name: author.slice(0, 256) });
    return { embeds: [embed], allowedMentions: { parse: [] } };
}
function normalizeColor(value) {
    const clean = value.replace('#', '');
    return /^[0-9a-f]{6}$/i.test(clean) ? Number.parseInt(clean, 16) : 0x111111;
}
function isHttp(value) { return /^https?:\/\//i.test(value); }
//# sourceMappingURL=messageService.js.map