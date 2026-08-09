"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logsPage = logsPage;
const discord_js_1 = require("discord.js");
const defaults_1 = require("../../config/defaults");
const common_1 = require("../components/common");
const CATEGORY_LABELS = {
    security: 'Segurança', community: 'Comunidade', moderation: 'Moderação', tickets: 'Tickets', voice: 'Voz', server: 'Servidor', system: 'Sistema'
};
function logsPage(session, ids, config) {
    const category = String(session.state.logCategory ?? 'home');
    if (category === 'home')
        return renderHome(session, ids, config);
    const events = defaults_1.LOG_CATEGORIES[category];
    if (!events) {
        session.state.logCategory = 'home';
        return renderHome(session, ids, config);
    }
    const page = Math.max(0, Math.min(Number(session.state.logsPage ?? 0), Math.max(0, Math.ceil(events.length / 3) - 1)));
    session.state.logsPage = page;
    const container = (0, common_1.baseContainer)(config.panel.color, `Logs de ${CATEGORY_LABELS[category] ?? category}`, `Cada evento possui seu próprio canal. Página ${page + 1} de ${Math.max(1, Math.ceil(events.length / 3))}.`);
    for (const event of events.slice(page * 3, page * 3 + 3)) {
        const item = config.logs.events[event];
        const destination = item.mode === 'disabled' ? 'desativado' : item.mode === 'specific' && item.channelId ? `<#${item.channelId}>` : config.logs.defaultChannelId ? `canal padrão <#${config.logs.defaultChannelId}>` : 'canal padrão não configurado';
        container.addSectionComponents(new discord_js_1.SectionBuilder()
            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`**${friendly(event)}**\nDestino: ${destination}`))
            .setButtonAccessory(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'logchoosechannel', event)).setLabel('Escolher canal').setStyle(discord_js_1.ButtonStyle.Primary)));
        container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'logeventmode', `${event}:default`)).setLabel('Usar padrão').setStyle(item.mode === 'default' ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'logeventmode', `${event}:disabled`)).setLabel('Desativar').setStyle(item.mode === 'disabled' ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'logtestevent', event)).setLabel('Testar').setStyle(discord_js_1.ButtonStyle.Secondary)));
    }
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'logpage', 'prev')).setLabel('Anterior').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(page === 0), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'logpage', 'next')).setLabel('Próxima').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled((page + 1) * 3 >= events.length), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'logcategorybutton', 'home')).setLabel('Voltar às categorias').setStyle(discord_js_1.ButtonStyle.Secondary)));
    return (0, common_1.navigation)((0, common_1.r8Footer)(container), ids, session);
}
function renderHome(session, ids, config) {
    const active = Object.values(config.logs.events).filter(item => item.mode !== 'disabled').length;
    const specific = Object.values(config.logs.events).filter(item => item.mode === 'specific').length;
    const container = (0, common_1.baseContainer)(config.panel.color, 'Logs', `Canal padrão: ${config.logs.defaultChannelId ? `<#${config.logs.defaultChannelId}>` : 'não configurado'} • Ativos: **${active}** • Específicos: **${specific}**`);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('Escolha uma categoria no menu. Depois, configure cada evento pelo botão ao lado.'));
    const categoryMenu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(ids.encode(session.id, 'logcategory'))
        .setPlaceholder('Selecionar categoria de logs')
        .setMinValues(1).setMaxValues(1)
        .addOptions(...Object.entries(CATEGORY_LABELS).map(([value, label]) => new discord_js_1.StringSelectMenuOptionBuilder().setLabel(label).setValue(value)));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(categoryMenu), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id, 'logdefault')).setPlaceholder('Selecionar canal padrão de logs').setChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1)), row(button(ids, session, 'logall', 'on', 'Ativar todos', discord_js_1.ButtonStyle.Success), button(ids, session, 'logall', 'default', 'Aplicar padrão em todos', discord_js_1.ButtonStyle.Primary), button(ids, session, 'logall', 'off', 'Desativar todos', discord_js_1.ButtonStyle.Danger), button(ids, session, 'logvalidate', '', 'Validar canais')));
    return (0, common_1.navigation)((0, common_1.r8Footer)(container), ids, session);
}
function friendly(value) { return value.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '); }
function button(ids, session, action, arg, label, style = discord_js_1.ButtonStyle.Secondary) { return new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, action, arg)).setLabel(label).setStyle(style); }
function row(...buttons) { return new discord_js_1.ActionRowBuilder().addComponents(...buttons); }
//# sourceMappingURL=logsPage.js.map