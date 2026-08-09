"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.homePage = homePage;
const discord_js_1 = require("discord.js");
const common_1 = require("../components/common");
const emojis_1 = require("../../ui/emojis");
function homePage(session, ids, _user, guild, _app, config) {
    const container = (0, common_1.baseContainer)(config.panel.color, config.panel.title || 'R8 Community', `Configuração de **${guild.name}**.`);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('Escolha uma área no menu abaixo. Dentro de cada função, as alterações são feitas por botões e seletores próprios.'));
    const menu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(ids.encode(session.id, 'nav'))
        .setPlaceholder('Selecione uma área')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Comunidade').setDescription('Tickets, mensagens, diversão, cargos e utilidades.').setValue('community').setEmoji(emojis_1.UI_EMOJIS.community), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Proteção').setDescription('Proteções, bypass, backups e diagnóstico.').setValue('protections').setEmoji(emojis_1.UI_EMOJIS.shield), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Logs').setDescription('Canais e eventos registrados pelo bot.').setValue('logs').setEmoji(emojis_1.UI_EMOJIS.paper), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Config Bot').setDescription('Perfil, comandos, aliases e acesso.').setValue('configbot').setEmoji(emojis_1.UI_EMOJIS.settings), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Tutorial').setDescription('Guia completo de configuração e uso.').setValue('tutorial').setEmoji(emojis_1.UI_EMOJIS.tutorial));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(menu), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'close')).setEmoji(emojis_1.UI_EMOJIS.close).setStyle(discord_js_1.ButtonStyle.Danger)));
    return (0, common_1.mainCreditFooter)(container);
}
//# sourceMappingURL=homePage.js.map