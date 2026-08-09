"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.botConfigPage = botConfigPage;
const discord_js_1 = require("discord.js");
const defaults_1 = require("../../config/defaults");
const common_1 = require("../components/common");
const emojis_1 = require("../../ui/emojis");
function botConfigPage(session, ids, config, client) {
    const section = String(session.state.botConfigSection ?? 'home');
    if (section === 'aliases')
        return renderAliases(session, ids, config);
    if (section === 'commands')
        return renderCommands(session, ids, config);
    if (section === 'commandaccess')
        return renderCommandAccess(session, ids, config);
    const container = (0, common_1.baseContainer)(config.panel.color, 'Config Bot', 'Perfil, acesso, comandos, aliases e aparência do painel.');
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Bot: **${client.user?.tag ?? 'indisponível'}**
Prefixo: **!**
Usuários autorizados: **${config.access.allowedUsers.length}** • Cargos autorizados: **${config.access.allowedRoles.length}**`));
    const menu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(ids.encode(session.id, 'botconfigsection'))
        .setPlaceholder('Selecionar configuração do bot')
        .setMinValues(1).setMaxValues(1)
        .addOptions(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Perfil do bot').setDescription('Nome, avatar, presença e atividade.').setValue('profile').setEmoji(emojis_1.UI_EMOJIS.bot), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Acesso ao painel').setDescription('Usuários, cargos e canais autorizados.').setValue('access').setEmoji(emojis_1.UI_EMOJIS.shield), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Comandos').setDescription('Ativação, cooldown e permissões.').setValue('commands').setEmoji(emojis_1.UI_EMOJIS.tools), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Aliases').setDescription('Nomes alternativos dos comandos.').setValue('aliases').setEmoji(emojis_1.UI_EMOJIS.aliases), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Aparência do painel').setDescription('Título, cor e comportamento do painel.').setValue('settings').setEmoji(emojis_1.UI_EMOJIS.palette));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(menu));
    return (0, common_1.navigation)((0, common_1.r8Footer)(container), ids, session);
}
function renderAliases(session, ids, config) {
    const selected = String(session.state.selectedCommand ?? 'help');
    const page = Math.max(0, Math.min(Number(session.state.commandPage ?? 0), Math.ceil(defaults_1.COMMAND_NAMES.length / 10) - 1));
    session.state.commandPage = page;
    const container = (0, common_1.baseContainer)(config.panel.color, 'Aliases', 'Selecione um comando e edite seus nomes alternativos.');
    for (let index = page * 10; index < Math.min(defaults_1.COMMAND_NAMES.length, page * 10 + 10); index += 5) {
        container.addActionRowComponents(row(...defaults_1.COMMAND_NAMES.slice(index, index + 5).map(name => button(ids, session, 'commandselect', name, name, name === selected ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary))));
    }
    const aliases = config.commands.aliases[selected] ?? [];
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Comando: **!${selected}**\nAliases: ${aliases.length ? aliases.map(alias => `\`!${alias}\``).join(', ') : 'nenhum'}`));
    container.addActionRowComponents(row(button(ids, session, 'aliasedit', selected, 'Editar aliases', discord_js_1.ButtonStyle.Primary), button(ids, session, 'aliasreset', selected, 'Restaurar padrão'), button(ids, session, 'commandpage', 'prev', 'Anterior', discord_js_1.ButtonStyle.Secondary, page === 0), button(ids, session, 'commandpage', 'next', 'Próxima', discord_js_1.ButtonStyle.Secondary, (page + 1) * 10 >= defaults_1.COMMAND_NAMES.length)), row(button(ids, session, 'botconfigopen', 'home', 'Voltar')));
    return (0, common_1.r8Footer)(container);
}
function renderCommands(session, ids, config) {
    const page = Math.max(0, Math.min(Number(session.state.commandPage ?? 0), Math.ceil(defaults_1.COMMAND_NAMES.length / 5) - 1));
    session.state.commandPage = page;
    const container = (0, common_1.baseContainer)(config.panel.color, 'Comandos', 'Ative, desative e abra as permissões de cada comando.');
    for (const name of defaults_1.COMMAND_NAMES.slice(page * 5, page * 5 + 5)) {
        const permission = config.commands.permissions[name];
        container.addSectionComponents(new discord_js_1.SectionBuilder()
            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`**!${name}**\nStatus: ${permission?.enabled && !config.commands.disabled.includes(name) ? 'ativado' : 'desativado'} | Cooldown: ${permission?.cooldownSeconds ?? 0}s`))
            .setButtonAccessory(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'commandaccess', name)).setLabel('Configurar').setStyle(discord_js_1.ButtonStyle.Primary)));
    }
    container.addActionRowComponents(row(button(ids, session, 'commandpage', 'prev', 'Anterior', discord_js_1.ButtonStyle.Secondary, page === 0), button(ids, session, 'commandpage', 'next', 'Próxima', discord_js_1.ButtonStyle.Secondary, (page + 1) * 5 >= defaults_1.COMMAND_NAMES.length), button(ids, session, 'botconfigopen', 'home', 'Voltar')));
    return (0, common_1.r8Footer)(container);
}
function renderCommandAccess(session, ids, config) {
    const name = String(session.state.selectedCommand ?? 'help');
    const item = config.commands.permissions[name] ?? (config.commands.permissions[name] = (0, defaults_1.defaultCommandPermission)());
    const container = (0, common_1.baseContainer)(config.panel.color, `Configurar !${name}`, 'Permissões, canais, cooldown e comportamento do comando.');
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Status: **${item.enabled ? 'ativado' : 'desativado'}**\nCooldown: **${item.cooldownSeconds}s**\n` +
        `Cargos: ${mentions(item.allowedRoleIds, 'role')}\nUsuários: ${mentions(item.allowedUserIds, 'user')}\nCanais: ${mentions(item.allowedChannelIds, 'channel')}\n` +
        `Excluir mensagem do comando: **${item.deleteCommandMessage ? 'sim' : 'não'}**`));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'commandrole', name)).setPlaceholder('Adicionar/remover cargo autorizado')), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.UserSelectMenuBuilder().setCustomId(ids.encode(session.id, 'commanduser', name)).setPlaceholder('Adicionar/remover usuário autorizado')), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id, 'commandchannel', name)).setPlaceholder('Adicionar/remover canal permitido').setChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement)), row(button(ids, session, 'commandtoggle', name, item.enabled ? 'Desativar' : 'Ativar', item.enabled ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Success), button(ids, session, 'commandcooldown', name, 'Editar cooldown'), button(ids, session, 'commanddelete', name, 'Alternar exclusão'), button(ids, session, 'commandclearaccess', name, 'Limpar acesso', discord_js_1.ButtonStyle.Danger)), row(button(ids, session, 'botconfigopen', 'commands', 'Voltar')));
    return (0, common_1.r8Footer)(container);
}
function button(ids, session, action, arg, label, style = discord_js_1.ButtonStyle.Secondary, disabled = false) { return new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, action, arg)).setLabel(label).setStyle(style).setDisabled(disabled); }
function row(...buttons) { return new discord_js_1.ActionRowBuilder().addComponents(...buttons); }
function mentions(values, kind) { if (!values.length)
    return 'nenhum'; return values.map(id => kind === 'role' ? `<@&${id}>` : kind === 'user' ? `<@${id}>` : `<#${id}>`).join(', '); }
//# sourceMappingURL=botConfigPage.js.map