import { ActionRowBuilder, ButtonBuilder, ButtonStyle, TextDisplayBuilder } from 'discord.js';
import type { GuildConfig } from '../../types/guildConfig';
import type { CustomIdManager } from '../customIdManager';
import type { PanelSession } from '../sessionManager';
import { backOnly, baseContainer, navigation, r8Footer } from '../components/common';

export function backupsPage(session: PanelSession, ids: CustomIdManager, cfg: GuildConfig, nested = false): any {
  const backups = Array.isArray(session.state.backupList) ? session.state.backupList as Array<{id:string;createdAt:string;reason:string}> : [];
  const pending = String(session.state.pendingBackupRestore ?? '');
  const report = String(session.state.backupReport ?? '');
  const container = baseContainer(
    cfg.panel.color,
    'Backups',
    `Automático: ${cfg.backups.automatic ? 'ativado' : 'desativado'}\n` +
    `Antes de alterações: ${cfg.backups.beforeChanges ? 'ativado' : 'desativado'}\n` +
    `Retenção: ${cfg.backups.retention}\nÚltimo: ${cfg.backups.lastBackupAt ?? 'nenhum'}`
  );

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `Backups incluem a configuração e o snapshot estrutural. Antes de restaurar, o bot cria uma cópia do estado atual.\n\n` +
    `### Backups recentes\n${backups.slice(0, 5).map(item => `**${item.id}** — ${item.createdAt}\n${item.reason}`).join('\n') || 'Atualize a lista para consultar os arquivos disponíveis.'}`
  ));

  if (report) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### Resultado da última restauração\n${report}`));

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'backupcreate')).setLabel('Criar backup').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'backuplist')).setLabel('Atualizar lista').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'backupexport')).setLabel('Exportar mais recente').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'backuprestore')).setLabel('Restaurar mais recente').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'backuptoggle')).setLabel(cfg.backups.automatic ? 'Desativar automático' : 'Ativar automático').setStyle(ButtonStyle.Secondary)
    )
  );

  if (pending) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### Confirmação necessária\nO backup **${pending}** substituirá a configuração atual e tentará recriar recursos ausentes. A ação não recupera mensagens nem IDs antigos.`));
    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'backuprestoreconfirm')).setLabel('Confirmar restauração').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'backuprestorecancel')).setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
    ));
  }

  return nested ? backOnly(r8Footer(container), ids, session, 'protectionopen', 'home') : navigation(container, ids, session);
}
