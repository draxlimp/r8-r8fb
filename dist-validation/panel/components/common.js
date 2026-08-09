"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.baseContainer = baseContainer;
exports.navigation = navigation;
exports.backOnly = backOnly;
exports.r8Footer = r8Footer;
exports.mainCreditFooter = mainCreditFooter;
exports.statusPayload = statusPayload;
exports.hexToInt = hexToInt;
const discord_js_1 = require("discord.js");
const emojis_1 = require("../../ui/emojis");
function baseContainer(color, title, description) {
    const container = new discord_js_1.ContainerBuilder()
        .setAccentColor(hexToInt(color))
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`## ${title}${description ? `\n${description}` : ''}`));
    if (description)
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small));
    return container;
}
function navigation(container, ids, session, includeHome = true) {
    const row = new discord_js_1.ActionRowBuilder();
    if (includeHome)
        row.addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'home')).setLabel('Início').setEmoji(emojis_1.UI_EMOJIS.home).setStyle(discord_js_1.ButtonStyle.Secondary));
    row.addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'close')).setEmoji(emojis_1.UI_EMOJIS.close).setStyle(discord_js_1.ButtonStyle.Danger));
    container.addActionRowComponents(row);
    return container;
}
function backOnly(container, ids, session, action, arg = '') {
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, action, arg)).setLabel('Voltar').setEmoji(emojis_1.UI_EMOJIS.home).setStyle(discord_js_1.ButtonStyle.Secondary)));
    return container;
}
/** Mantido para compatibilidade: créditos não aparecem em páginas internas. */
function r8Footer(container) { return container; }
/** O crédito é exibido exclusivamente no menu principal. */
function mainCreditFooter(container) {
    container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('-# @r8fb'));
    return container;
}
function statusPayload(title, description, color = '#111111') {
    const container = baseContainer(color, title, description);
    return { components: [container], flags: discord_js_1.MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}
function hexToInt(value) {
    const clean = value.replace('#', '');
    return /^[0-9a-f]{6}$/i.test(clean) ? Number.parseInt(clean, 16) : 0x111111;
}
//# sourceMappingURL=common.js.map