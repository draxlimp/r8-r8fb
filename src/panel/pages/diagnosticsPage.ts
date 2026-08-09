import { ActionRowBuilder, ButtonBuilder, ButtonStyle, TextDisplayBuilder } from 'discord.js';
import type { GuildConfig } from '../../types/guildConfig';
import type { CustomIdManager } from '../customIdManager';
import type { PanelSession } from '../sessionManager';
import { backOnly, baseContainer, navigation, r8Footer } from '../components/common';

export function diagnosticsPage(session: PanelSession, ids: CustomIdManager, cfg: GuildConfig, nested = false): any {
  const report = session.state.diagnosticReport as string | undefined;
  const container = baseContainer(
    cfg.panel.color,
    'Diagnóstico',
    'Verifica conexão, latência, hierarquia, permissões, armazenamento, logs e snapshots.'
  );
  if (report) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(report));

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'diagnose')).setLabel('Executar diagnóstico').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'snapshottest')).setLabel('Testar snapshots').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'storagetest')).setLabel('Testar armazenamento').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'diagnosticexport')).setLabel('Exportar relatório').setStyle(ButtonStyle.Secondary)
    )
  );
  return nested ? backOnly(r8Footer(container), ids, session, 'protectionopen', 'home') : navigation(container, ids, session);
}
