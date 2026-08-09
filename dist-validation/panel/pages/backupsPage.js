"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupsPage = backupsPage;
const discord_js_1 = require("discord.js");
const common_1 = require("../components/common");
function backupsPage(session, ids, cfg, nested = false) {
    const backups = Array.isArray(session.state.backupList) ? session.state.backupList : [];
    const pending = String(session.state.pendingBackupRestore ?? '');
    const report = String(session.state.backupReport ?? '');
    const container = (0, common_1.baseContainer)(cfg.panel.color, 'Backups', `Automático: ${cfg.backups.automatic ? 'ativado' : 'desativado'}\n` +
        `Antes de alterações: ${cfg.backups.beforeChanges ? 'ativado' : 'desativado'}\n` +
        `Retenção: ${cfg.backups.retention}\nÚltimo: ${cfg.backups.lastBackupAt ?? 'nenhum'}`);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Backups incluem a configuração e o snapshot estrutural. Antes de restaurar, o bot cria uma cópia do estado atual.\n\n` +
        `### Backups recentes\n${backups.slice(0, 5).map(item => `**${item.id}** — ${item.createdAt}\n${item.reason}`).join('\n') || 'Atualize a lista para consultar os arquivos disponíveis.'}`));
    if (report)
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`### Resultado da última restauração\n${report}`));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'backupcreate')).setLabel('Criar backup').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'backuplist')).setLabel('Atualizar lista').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'backupexport')).setLabel('Exportar mais recente').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'backuprestore')).setLabel('Restaurar mais recente').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'backuptoggle')).setLabel(cfg.backups.automatic ? 'Desativar automático' : 'Ativar automático').setStyle(discord_js_1.ButtonStyle.Secondary)));
    if (pending) {
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`### Confirmação necessária\nO backup **${pending}** substituirá a configuração atual e tentará recriar recursos ausentes. A ação não recupera mensagens nem IDs antigos.`));
        container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'backuprestoreconfirm')).setLabel('Confirmar restauração').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'backuprestorecancel')).setLabel('Cancelar').setStyle(discord_js_1.ButtonStyle.Secondary)));
    }
    return nested ? (0, common_1.backOnly)((0, common_1.r8Footer)(container), ids, session, 'protectionopen', 'home') : (0, common_1.navigation)(container, ids, session);
}
//# sourceMappingURL=backupsPage.js.map