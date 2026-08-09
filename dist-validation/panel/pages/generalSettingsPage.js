"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalSettingsPage = generalSettingsPage;
const discord_js_1 = require("discord.js");
const common_1 = require("../components/common");
function generalSettingsPage(session, ids, cfg) {
    const container = (0, common_1.baseContainer)(cfg.panel.color, 'Configurações gerais', `Título: ${cfg.panel.title}\nCor: ${cfg.panel.color}\nExpiração: ${cfg.panel.sessionTimeoutSeconds}s\n` +
        `Excluir comando: ${yes(cfg.panel.deleteCommandMessage)}\n` +
        `Dono do servidor: ${yes(cfg.access.allowGuildOwner)} | Administradores: ${yes(cfg.access.allowAdministrators)} | Somente proprietários: ${yes(cfg.access.ownersOnly)}\n` +
        `Modo raid: ${cfg.raid.state} | Quarentena: ${cfg.quarantine.roleId ? `<@&${cfg.quarantine.roleId}>` : 'não configurada'}`);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`### Controle de acesso\n` +
        `Usuários permitidos/bloqueados: ${cfg.access.allowedUsers.length}/${cfg.access.blockedUsers.length}\n` +
        `Cargos permitidos/bloqueados: ${cfg.access.allowedRoles.length}/${cfg.access.blockedRoles.length}\n` +
        `Canais permitidos/bloqueados: ${cfg.access.allowedChannels.length}/${cfg.access.blockedChannels.length}\n\n` +
        `### Histórico recente\n${cfg.history.slice(-5).map(item => `${item.at} — ${item.action}`).join('\n') || 'Sem alterações.'}`));
    const raidState = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(ids.encode(session.id, 'raidstate'))
        .setPlaceholder('Alterar modo raid')
        .addOptions(['disabled', 'automatic', 'manual', 'emergency'].map(value => new discord_js_1.StringSelectMenuOptionBuilder()
        .setLabel(value)
        .setValue(value)
        .setDefault(cfg.raid.state === value)));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'settingsmodal')).setLabel('Editar aparência').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'toggledelete')).setLabel('Alternar exclusão do comando').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'toggleowner')).setLabel('Alternar dono do servidor').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'toggleadmin')).setLabel('Alternar administradores').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'toggleownersonly')).setLabel('Somente proprietários').setStyle(discord_js_1.ButtonStyle.Danger)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.UserSelectMenuBuilder().setCustomId(ids.encode(session.id, 'allowuser')).setPlaceholder('Adicionar/remover usuário autorizado')), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.UserSelectMenuBuilder().setCustomId(ids.encode(session.id, 'blockuser')).setPlaceholder('Adicionar/remover usuário bloqueado')), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'allowrole')).setPlaceholder('Adicionar/remover cargo autorizado')), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'blockrole')).setPlaceholder('Adicionar/remover cargo bloqueado')), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id, 'allowchannel')).setPlaceholder('Adicionar/remover canal permitido').setChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id, 'blockchannel')).setPlaceholder('Adicionar/remover canal bloqueado').setChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'quarantinerole')).setPlaceholder('Selecionar cargo de quarentena')), new discord_js_1.ActionRowBuilder().addComponents(raidState), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'raidmodal')).setLabel('Editar limites do raid').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'accessclear')).setLabel('Limpar listas de acesso').setStyle(discord_js_1.ButtonStyle.Danger)));
    return (0, common_1.navigation)(container, ids, session);
}
function yes(value) { return value ? 'sim' : 'não'; }
//# sourceMappingURL=generalSettingsPage.js.map