"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bypassPage = bypassPage;
const discord_js_1 = require("discord.js");
const defaults_1 = require("../../config/defaults");
const common_1 = require("../components/common");
function bypassPage(session, ids, cfg, nested = false) {
    const active = cfg.bypasses.filter(entry => !entry.expiresAt || Date.parse(entry.expiresAt) > Date.now());
    const temporary = active.filter(entry => entry.expiresAt);
    const selectedId = String(session.state.selectedBypass ?? '');
    const selected = active.find(entry => entry.id === selectedId);
    const modulePage = Math.max(0, Number(session.state.bypassModulePage ?? 0));
    const pageSize = 25;
    const maxPage = Math.max(0, Math.ceil(defaults_1.PROTECTION_MODULES.length / pageSize) - 1);
    const safePage = Math.min(modulePage, maxPage);
    session.state.bypassModulePage = safePage;
    const container = (0, common_1.baseContainer)(cfg.panel.color, 'Bypass', `Ativos: ${active.length} | Temporários: ${temporary.length} | Bots confiáveis: ${cfg.trustedBots.length}\n` +
        'O padrão continua registrando o incidente e ignora punição e restauração.');
    if (active.length) {
        const entryMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(ids.encode(session.id, 'bypassselect'))
            .setPlaceholder('Selecionar bypass existente')
            .addOptions(active.slice(-25).map(entry => new discord_js_1.StringSelectMenuOptionBuilder()
            .setLabel(`${entry.kind}: ${entry.targetId}`.slice(0, 100))
            .setValue(entry.id)
            .setDescription(entry.modules.includes('*') ? 'Todas as proteções' : `${entry.modules.length} módulos`)
            .setDefault(entry.id === selectedId)));
        container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(entryMenu));
    }
    if (selected) {
        const scope = selected.modules.includes('*') ? 'todas as proteções' : selected.modules.join(', ');
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`### Bypass selecionado\n` +
            `**ID:** ${selected.id}\n` +
            `**Alvo:** ${mention(selected.kind, selected.targetId)}\n` +
            `**Escopo:** ${scope || 'nenhum módulo'}\n` +
            `**Expiração:** ${selected.expiresAt ? `<t:${Math.floor(Date.parse(selected.expiresAt) / 1000)}:R>` : 'manual'}\n` +
            `**Comportamento:** detecção ${state(selected.behavior.ignoreDetection)}, punição ${state(selected.behavior.ignorePunishment)}, restauração ${state(selected.behavior.ignoreRestoration)}, limite ${state(selected.behavior.ignoreLimit)}, logs ${selected.behavior.continueLogging ? 'mantidos' : 'suprimidos'}`));
        const modules = defaults_1.PROTECTION_MODULES.slice(safePage * pageSize, (safePage + 1) * pageSize);
        const moduleMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(ids.encode(session.id, 'bypassmodule'))
            .setPlaceholder(`Escolher módulo — página ${safePage + 1}/${maxPage + 1}`)
            .addOptions(modules.map(module => new discord_js_1.StringSelectMenuOptionBuilder()
            .setLabel(module.replaceAll('_', ' ').slice(0, 100))
            .setValue(module)
            .setDescription(selected.modules.includes('*') || selected.modules.includes(module) ? 'Com bypass' : 'Sem bypass')));
        const durationMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(ids.encode(session.id, 'bypassduration'))
            .setPlaceholder('Definir duração')
            .addOptions([
            ['5 minutos', '300'], ['15 minutos', '900'], ['30 minutos', '1800'], ['1 hora', '3600'],
            ['6 horas', '21600'], ['12 horas', '43200'], ['24 horas', '86400'], ['Até remoção manual', 'permanent']
        ].map(([label, value]) => new discord_js_1.StringSelectMenuOptionBuilder().setLabel(label).setValue(value)));
        container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(moduleMenu), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'bprev')).setLabel('Módulos anteriores').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(safePage === 0), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'bnext')).setLabel('Próximos módulos').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(safePage === maxPage), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'bypassall')).setLabel(selected.modules.includes('*') ? 'Usar módulos específicos' : 'Aplicar a todos').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'bypassremove')).setLabel('Remover bypass').setStyle(discord_js_1.ButtonStyle.Danger)), new discord_js_1.ActionRowBuilder().addComponents(durationMenu), new discord_js_1.ActionRowBuilder().addComponents(behavior(ids, session, 'detection', 'Ignorar detecção', selected.behavior.ignoreDetection), behavior(ids, session, 'punishment', 'Ignorar punição', selected.behavior.ignorePunishment), behavior(ids, session, 'restoration', 'Ignorar restauração', selected.behavior.ignoreRestoration), behavior(ids, session, 'limit', 'Ignorar limite', selected.behavior.ignoreLimit), behavior(ids, session, 'logging', 'Continuar logs', selected.behavior.continueLogging)));
    }
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.UserSelectMenuBuilder().setCustomId(ids.encode(session.id, 'bypassuser')).setPlaceholder('Adicionar usuário com bypass')), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'bypassrole')).setPlaceholder('Adicionar cargo com bypass')), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.UserSelectMenuBuilder().setCustomId(ids.encode(session.id, 'trustedbot')).setPlaceholder('Adicionar/remover bot confiável')), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id, 'bypasschannel')).setPlaceholder('Adicionar canal ignorado').setChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement, discord_js_1.ChannelType.GuildVoice, discord_js_1.ChannelType.GuildStageVoice, discord_js_1.ChannelType.GuildForum)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id, 'bypasscategory')).setPlaceholder('Adicionar categoria ignorada').setChannelTypes(discord_js_1.ChannelType.GuildCategory)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'bypassprune')).setLabel('Remover expirados').setStyle(discord_js_1.ButtonStyle.Secondary)));
    return nested ? (0, common_1.backOnly)((0, common_1.r8Footer)(container), ids, session, 'protectionopen', 'home') : (0, common_1.navigation)(container, ids, session);
}
function behavior(ids, session, key, label, enabled) {
    return new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'bypasstoggle', key)).setLabel(label).setStyle(enabled ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary);
}
function mention(kind, id) {
    if (kind === 'role')
        return `<@&${id}>`;
    if (kind === 'channel' || kind === 'category')
        return `<#${id}>`;
    return `<@${id}>`;
}
function state(value) { return value ? 'ignorada' : 'avaliada'; }
//# sourceMappingURL=bypassPage.js.map