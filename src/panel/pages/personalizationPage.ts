import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder
} from 'discord.js';
import type { AppConfig } from '../../types/config';
import type { GuildConfig } from '../../types/guildConfig';
import type { CustomIdManager } from '../customIdManager';
import type { PanelSession } from '../sessionManager';
import { baseContainer, navigation } from '../components/common';

export function personalizationPage(session: PanelSession, ids: CustomIdManager, cfg: GuildConfig, client: any, guild: any, app: AppConfig): any {
  const rotation = app.defaultPresence.rotationActivities ?? [];
  const rotationStatus = app.defaultPresence.rotationEnabled && rotation.length
    ? `ativa • ${rotation.length} atividade(s) • ${Math.max(5, Number(app.defaultPresence.rotationIntervalSeconds ?? 5))}s`
    : 'desativada';
  const container = baseContainer(
    cfg.panel.color,
    'Personalização',
    `Bot: ${client.user?.tag ?? 'indisponível'}\n` +
    `Apelido no servidor: ${guild.members.me?.displayName ?? 'indisponível'}\n` +
    `Rotação de atividade: ${rotationStatus}`
  );

  const status = new StringSelectMenuBuilder()
    .setCustomId(ids.encode(session.id, 'presence'))
    .setPlaceholder('Alterar e salvar status')
    .addOptions(['online','idle','dnd','invisible'].map(value =>
      new StringSelectMenuOptionBuilder().setLabel(value).setValue(value)
    ));

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(status),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'rotationmodal')).setLabel('Editar rotação').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'rotationtoggle')).setLabel(app.defaultPresence.rotationEnabled ? 'Pausar rotação' : 'Ativar rotação').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'activitymodal')).setLabel('Atividade fixa').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'nickmodal')).setLabel('Alterar apelido').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'clearactivity')).setLabel('Limpar atividade').setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'globalprofilemodal')).setLabel('Nome e avatar globais').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'removeavatar')).setLabel('Remover avatar global').setStyle(ButtonStyle.Danger)
    )
  );

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    '**Variáveis para atividades**\n' +
    '`[members]` membros • `[servers]` servidores • `[channels]` canais • `[prefix]` prefixo • `[bot]` nome • `[ping]` latência • `[uptime]` tempo ligado\n\n' +
    'Exemplo: `watching | [members] membros na comunidade`'
  ));
  return navigation(container, ids, session);
}
