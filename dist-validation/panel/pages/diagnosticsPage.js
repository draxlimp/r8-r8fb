"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diagnosticsPage = diagnosticsPage;
const discord_js_1 = require("discord.js");
const common_1 = require("../components/common");
function diagnosticsPage(session, ids, cfg, nested = false) {
    const report = session.state.diagnosticReport;
    const container = (0, common_1.baseContainer)(cfg.panel.color, 'Diagnóstico', 'Verifica conexão, latência, hierarquia, permissões, armazenamento, logs e snapshots.');
    if (report)
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(report));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'diagnose')).setLabel('Executar diagnóstico').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'snapshottest')).setLabel('Testar snapshots').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'storagetest')).setLabel('Testar armazenamento').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'diagnosticexport')).setLabel('Exportar relatório').setStyle(discord_js_1.ButtonStyle.Secondary)));
    return nested ? (0, common_1.backOnly)((0, common_1.r8Footer)(container), ids, session, 'protectionopen', 'home') : (0, common_1.navigation)(container, ids, session);
}
//# sourceMappingURL=diagnosticsPage.js.map