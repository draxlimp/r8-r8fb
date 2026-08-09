"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTicketPreview = addTicketPreview;
exports.addCommunityPreview = addCommunityPreview;
const discord_js_1 = require("discord.js");
const templateRenderer_1 = require("../../tickets/templateRenderer");
const templateRenderer_2 = require("../../community/templateRenderer");
const emojis_1 = require("../../ui/emojis");
function addTicketPreview(container, appearance, context, label) {
    container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Large));
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`## Prévia real — ${label}\n-# A prévia abaixo é apenas visual; os controles ficam desativados.`));
    const title = (0, templateRenderer_1.renderTicketTemplate)(appearance.title, context) || 'Sem título';
    const description = (0, templateRenderer_1.renderTicketTemplate)(appearance.description, context) || 'Sem descrição';
    const text = `**${title.slice(0, 256)}**\n${description.slice(0, 1800)}`;
    const thumbnail = (0, templateRenderer_1.renderTicketTemplate)(appearance.thumbnailUrl ?? '', context);
    if (isHttp(thumbnail)) {
        container.addSectionComponents(new discord_js_1.SectionBuilder()
            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(text))
            .setThumbnailAccessory(new discord_js_1.ThumbnailBuilder().setURL(thumbnail)));
    }
    else {
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(text));
    }
    if (appearance.showSeparator)
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small));
    const image = (0, templateRenderer_1.renderTicketTemplate)(appearance.imageUrl ?? '', context);
    if (isHttp(image))
        container.addMediaGalleryComponents(new discord_js_1.MediaGalleryBuilder().addItems(new discord_js_1.MediaGalleryItemBuilder().setURL(image).setDescription('Imagem da prévia')));
    if (appearance.footer)
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`-# ${(0, templateRenderer_1.renderTicketTemplate)(appearance.footer, context).slice(0, 2048)}`));
    const previewButton = new discord_js_1.ButtonBuilder()
        .setCustomId(`preview:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'ticket'}`)
        .setLabel((appearance.buttonLabel || (label.toLowerCase().includes('interno') ? 'Ação do ticket' : 'Abrir ticket')).slice(0, 80))
        .setStyle(toButtonStyle(appearance.buttonStyle))
        .setDisabled(true);
    const configuredEmoji = (0, emojis_1.resolveConfiguredEmoji)(appearance.buttonEmoji);
    if (configuredEmoji)
        previewButton.setEmoji(configuredEmoji);
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(previewButton));
}
function addCommunityPreview(container, appearance, context, label) {
    container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Large));
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`## Prévia real — ${label}\n-# Esta visualização é privada e não possui controles clicáveis.`));
    const title = (0, templateRenderer_2.renderCommunityTemplate)(appearance.title, context) || 'Sem título';
    const description = (0, templateRenderer_2.renderCommunityTemplate)(appearance.description, context) || 'Sem descrição';
    const text = `**${title.slice(0, 256)}**\n${description.slice(0, 1800)}`;
    const thumbnail = (0, templateRenderer_2.renderCommunityTemplate)(appearance.thumbnailUrl ?? '', context);
    if (isHttp(thumbnail)) {
        container.addSectionComponents(new discord_js_1.SectionBuilder()
            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(text))
            .setThumbnailAccessory(new discord_js_1.ThumbnailBuilder().setURL(thumbnail)));
    }
    else {
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(text));
    }
    if (appearance.showSeparator)
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small));
    const image = (0, templateRenderer_2.renderCommunityTemplate)(appearance.imageUrl ?? '', context);
    if (isHttp(image))
        container.addMediaGalleryComponents(new discord_js_1.MediaGalleryBuilder().addItems(new discord_js_1.MediaGalleryItemBuilder().setURL(image).setDescription('Imagem da prévia')));
    if (appearance.footer)
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`-# ${(0, templateRenderer_2.renderCommunityTemplate)(appearance.footer, context).slice(0, 2048)}`));
}
function toButtonStyle(style) {
    if (style === 'success')
        return discord_js_1.ButtonStyle.Success;
    if (style === 'danger')
        return discord_js_1.ButtonStyle.Danger;
    if (style === 'secondary')
        return discord_js_1.ButtonStyle.Secondary;
    return discord_js_1.ButtonStyle.Primary;
}
function isHttp(value) { return /^https?:\/\//i.test(value); }
//# sourceMappingURL=appearancePreview.js.map