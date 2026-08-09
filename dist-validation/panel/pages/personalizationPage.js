"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.personalizationPage = personalizationPage;
const discord_js_1 = require("discord.js");
const common_1 = require("../components/common");
function personalizationPage(session, ids, cfg, client, guild, app) {
    const rotation = app.defaultPresence.rotationActivities ?? [];
    const rotationStatus = app.defaultPresence.rotationEnabled && rotation.length
        ? `ativa • ${rotation.length} atividade(s) • ${Math.max(5, Number(app.defaultPresence.rotationIntervalSeconds ?? 5))}s`
        : 'desativada';
    const container = (0, common_1.baseContainer)(cfg.panel.color, 'Personalização', `Bot: ${client.user?.tag ?? 'indisponível'}\n` +
        `Apelido no servidor: ${guild.members.me?.displayName ?? 'indisponível'}\n` +
        `Rotação de atividade: ${rotationStatus}`);
    const status = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(ids.encode(session.id, 'presence'))
        .setPlaceholder('Alterar e salvar status')
        .addOptions(['online', 'idle', 'dnd', 'invisible'].map(value => new discord_js_1.StringSelectMenuOptionBuilder().setLabel(value).setValue(value)));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(status), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'rotationmodal')).setLabel('Editar rotação').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'rotationtoggle')).setLabel(app.defaultPresence.rotationEnabled ? 'Pausar rotação' : 'Ativar rotação').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'activitymodal')).setLabel('Atividade fixa').setStyle(discord_js_1.ButtonStyle.Secondary)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'nickmodal')).setLabel('Alterar apelido').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'clearactivity')).setLabel('Limpar atividade').setStyle(discord_js_1.ButtonStyle.Danger)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'globalprofilemodal')).setLabel('Nome e avatar globais').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'removeavatar')).setLabel('Remover avatar global').setStyle(discord_js_1.ButtonStyle.Danger)));
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('**Variáveis para atividades**\n' +
        '`[members]` membros • `[servers]` servidores • `[channels]` canais • `[prefix]` prefixo • `[bot]` nome • `[ping]` latência • `[uptime]` tempo ligado\n\n' +
        'Exemplo: `watching | [members] membros na comunidade`'));
    return (0, common_1.navigation)(container, ids, session);
}
//# sourceMappingURL=personalizationPage.js.map