"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.protectionPage = protectionPage;
const discord_js_1 = require("discord.js");
const defaults_1 = require("../../config/defaults");
const common_1 = require("../components/common");
const bypassPage_1 = require("./bypassPage");
const backupsPage_1 = require("./backupsPage");
const diagnosticsPage_1 = require("./diagnosticsPage");
const emojis_1 = require("../../ui/emojis");
const labels = {
    anti_link: 'Anti-Link', anti_invite: 'Anti-Convite', anti_spam: 'Anti-Spam', anti_flood: 'Anti-Flood', anti_caps: 'Anti-Caps',
    anti_mass_mention: 'Anti-Menção em massa', anti_new_account: 'Anti-Conta nova', anti_mass_join: 'Anti-Entrada em massa',
    anti_channel_delete: 'Anti-Exclusão de canal', anti_role_delete: 'Anti-Exclusão de cargo', anti_mass_ban: 'Anti-Ban em massa',
    anti_webhook: 'Anti-Webhook', anti_unauthorized_bot: 'Anti-Bot não autorizado'
};
function protectionPage(session, ids, cfg) {
    const section = String(session.state.protectionSection ?? 'home');
    if (section === 'modules')
        return renderModules(session, ids, cfg);
    if (section === 'bypass')
        return (0, bypassPage_1.bypassPage)(session, ids, cfg, true);
    if (section === 'backups')
        return (0, backupsPage_1.backupsPage)(session, ids, cfg, true);
    if (section === 'diagnostics')
        return (0, diagnosticsPage_1.diagnosticsPage)(session, ids, cfg, true);
    return renderProtectionHome(session, ids, cfg);
}
function renderProtectionHome(session, ids, cfg) {
    const enabled = Object.values(cfg.protections).filter(item => item.mode !== 'disabled').length;
    const activeBypasses = cfg.bypasses.filter(entry => !entry.expiresAt || Date.parse(entry.expiresAt) > Date.now()).length;
    const container = (0, common_1.baseContainer)(cfg.panel.color, 'Proteção', 'Segurança, bypass, backups e diagnóstico ficam reunidos aqui.');
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Proteções ativas: **${enabled}/${Object.keys(cfg.protections).length}**
` +
        `Bypasses ativos: **${activeBypasses}** • Backup automático: **${cfg.backups.automatic ? 'ativado' : 'desativado'}**`));
    const menu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(ids.encode(session.id, 'protectionsection'))
        .setPlaceholder('Selecionar área de proteção')
        .setMinValues(1).setMaxValues(1)
        .addOptions(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Módulos de proteção').setDescription('Anti-link, anti-raid, canais, cargos e mensagens.').setValue('modules').setEmoji(emojis_1.UI_EMOJIS.shield), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Bypass').setDescription('Usuários, cargos, bots e exceções temporárias.').setValue('bypass').setEmoji(emojis_1.UI_EMOJIS.crown), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Backups').setDescription('Cópias, snapshots e restauração.').setValue('backups').setEmoji(emojis_1.UI_EMOJIS.archive), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Diagnóstico').setDescription('Permissões, arquivos, canais e estado do bot.').setValue('diagnostics').setEmoji(emojis_1.UI_EMOJIS.chart));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(menu));
    return (0, common_1.navigation)((0, common_1.r8Footer)(container), ids, session);
}
function renderModules(session, ids, cfg) {
    const selected = String(session.state.selectedModule ?? '');
    const protection = cfg.protections[selected];
    const page = Math.max(0, Number(session.state.protectionPage ?? 0));
    const pageSize = 25;
    const maxPage = Math.max(0, Math.ceil(defaults_1.PROTECTION_MODULES.length / pageSize) - 1);
    const safePage = Math.min(page, maxPage);
    session.state.protectionPage = safePage;
    const enabled = Object.values(cfg.protections).filter(item => item.mode !== 'disabled').length;
    const container = (0, common_1.baseContainer)(cfg.panel.color, 'Módulos de proteção', `${enabled} módulos ativos de ${Object.keys(cfg.protections).length}. Página ${safePage + 1} de ${maxPage + 1}.`);
    const slice = defaults_1.PROTECTION_MODULES.slice(safePage * pageSize, (safePage + 1) * pageSize);
    const menu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(ids.encode(session.id, 'pmod'))
        .setPlaceholder('Selecionar proteção')
        .addOptions(slice.map(module => new discord_js_1.StringSelectMenuOptionBuilder()
        .setLabel((labels[module] ?? module.replaceAll('_', ' ')).slice(0, 100))
        .setValue(module)
        .setDescription(`Modo: ${cfg.protections[module].mode}`)));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(menu), row(button(ids, session, 'pprev', '', 'Página anterior', discord_js_1.ButtonStyle.Secondary, safePage === 0), button(ids, session, 'pnext', '', 'Próxima página', discord_js_1.ButtonStyle.Secondary, safePage === maxPage)));
    if (protection) {
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`### ${labels[selected] ?? selected}\n` +
            `**Modo:** ${protection.mode}\n` +
            `**Limite:** ${protection.quantity} ações em ${protection.intervalSeconds}s\n` +
            `**Detecção:** usuários ${yes(protection.detectUsers)}, bots ${yes(protection.detectBots)}, ignorar dono ${yes(protection.ignoreOwner)}\n` +
            `**Sensibilidade:** ${protection.sensitivity}\n` +
            `**Punição:** ${protection.punishment.type} | timeout ${protection.punishment.timeoutSeconds}s\n` +
            `**Restauração:** ${yes(protection.restore)}\n` +
            `**Exceções:** ${protection.ignoredChannels.length} canais, ${protection.ignoredCategories.length} categorias, ${protection.ignoredRoles.length} cargos\n` +
            `**Filtros:** ${protection.allowedDomains.length} domínios permitidos, ${protection.blockedDomains.length} bloqueados, ${protection.blockedWords.length} palavras`));
        const punishment = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(ids.encode(session.id, 'pun'))
            .setPlaceholder('Alterar punição')
            .addOptions(['none', 'log', 'warn', 'dm', 'timeout', 'quarantine', 'remove_dangerous_roles', 'remove_roles', 'kick', 'ban', 'sequence']
            .map(value => new discord_js_1.StringSelectMenuOptionBuilder().setLabel(value.replaceAll('_', ' ')).setValue(value).setDefault(protection.punishment.type === value)));
        container.addActionRowComponents(row(button(ids, session, 'mode', 'enabled', 'Ativar', discord_js_1.ButtonStyle.Success), button(ids, session, 'mode', 'monitor', 'Monitorar', discord_js_1.ButtonStyle.Primary), button(ids, session, 'mode', 'test', 'Teste', discord_js_1.ButtonStyle.Secondary), button(ids, session, 'mode', 'disabled', 'Desativar', discord_js_1.ButtonStyle.Danger)), new discord_js_1.ActionRowBuilder().addComponents(punishment), row(button(ids, session, 'limitmodal', '', 'Editar limites', discord_js_1.ButtonStyle.Primary), button(ids, session, 'pfiltersmodal', '', 'Editar filtros'), button(ids, session, 'ppunishmodal', '', 'Detalhes da punição'), button(ids, session, 'restore', '', protection.restore ? 'Desativar restauração' : 'Ativar restauração'), button(ids, session, 'preset', '', 'Restaurar padrão', discord_js_1.ButtonStyle.Danger)), row(toggle(ids, session, 'users', 'Detectar usuários', protection.detectUsers), toggle(ids, session, 'bots', 'Detectar bots', protection.detectBots), toggle(ids, session, 'owner', 'Ignorar dono', protection.ignoreOwner), button(ids, session, 'psensitivity', '', `Sensibilidade: ${protection.sensitivity}`)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id, 'pignoredchannel')).setPlaceholder('Adicionar/remover canal ignorado').setChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement, discord_js_1.ChannelType.GuildVoice, discord_js_1.ChannelType.GuildStageVoice, discord_js_1.ChannelType.GuildForum)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id, 'pignoredcategory')).setPlaceholder('Adicionar/remover categoria ignorada').setChannelTypes(discord_js_1.ChannelType.GuildCategory)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'pignoredrole')).setPlaceholder('Adicionar/remover cargo ignorado')));
    }
    container.addActionRowComponents(row(button(ids, session, 'protectionopen', 'home', 'Voltar à proteção')));
    return (0, common_1.r8Footer)(container);
}
function yes(value) { return value ? 'sim' : 'não'; }
function toggle(ids, session, key, label, enabled) {
    return button(ids, session, 'ptoggle', key, label, enabled ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary);
}
function button(ids, session, action, arg, label, style = discord_js_1.ButtonStyle.Secondary, disabled = false) {
    return new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, action, arg)).setLabel(label).setStyle(style).setDisabled(disabled);
}
function row(...buttons) { return new discord_js_1.ActionRowBuilder().addComponents(...buttons); }
//# sourceMappingURL=protectionPage.js.map