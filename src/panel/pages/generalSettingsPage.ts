import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  UserSelectMenuBuilder
} from 'discord.js';
import type { GuildConfig } from '../../types/guildConfig';
import type { CustomIdManager } from '../customIdManager';
import type { PanelSession } from '../sessionManager';
import { baseContainer, navigation } from '../components/common';

export function generalSettingsPage(session: PanelSession, ids: CustomIdManager, cfg: GuildConfig): any {
  const container = baseContainer(
    cfg.panel.color,
    'Configurações gerais',
    `Título: ${cfg.panel.title}\nCor: ${cfg.panel.color}\nExpiração: ${cfg.panel.sessionTimeoutSeconds}s\n` +
    `Excluir comando: ${yes(cfg.panel.deleteCommandMessage)}\n` +
    `Dono do servidor: ${yes(cfg.access.allowGuildOwner)} | Administradores: ${yes(cfg.access.allowAdministrators)} | Somente proprietários: ${yes(cfg.access.ownersOnly)}\n` +
    `Modo raid: ${cfg.raid.state} | Quarentena: ${cfg.quarantine.roleId ? `<@&${cfg.quarantine.roleId}>` : 'não configurada'}`
  );

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `### Controle de acesso\n` +
    `Usuários permitidos/bloqueados: ${cfg.access.allowedUsers.length}/${cfg.access.blockedUsers.length}\n` +
    `Cargos permitidos/bloqueados: ${cfg.access.allowedRoles.length}/${cfg.access.blockedRoles.length}\n` +
    `Canais permitidos/bloqueados: ${cfg.access.allowedChannels.length}/${cfg.access.blockedChannels.length}\n\n` +
    `### Histórico recente\n${cfg.history.slice(-5).map(item => `${item.at} — ${item.action}`).join('\n') || 'Sem alterações.'}`
  ));

  const raidState = new StringSelectMenuBuilder()
    .setCustomId(ids.encode(session.id, 'raidstate'))
    .setPlaceholder('Alterar modo raid')
    .addOptions(['disabled','automatic','manual','emergency'].map(value => new StringSelectMenuOptionBuilder()
      .setLabel(value)
      .setValue(value)
      .setDefault(cfg.raid.state === value)));

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'settingsmodal')).setLabel('Editar aparência').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'toggledelete')).setLabel('Alternar exclusão do comando').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'toggleowner')).setLabel('Alternar dono do servidor').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'toggleadmin')).setLabel('Alternar administradores').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'toggleownersonly')).setLabel('Somente proprietários').setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder().setCustomId(ids.encode(session.id, 'allowuser')).setPlaceholder('Adicionar/remover usuário autorizado')
    ),
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder().setCustomId(ids.encode(session.id, 'blockuser')).setPlaceholder('Adicionar/remover usuário bloqueado')
    ),
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'allowrole')).setPlaceholder('Adicionar/remover cargo autorizado')
    ),
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'blockrole')).setPlaceholder('Adicionar/remover cargo bloqueado')
    ),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id, 'allowchannel')).setPlaceholder('Adicionar/remover canal permitido').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id, 'blockchannel')).setPlaceholder('Adicionar/remover canal bloqueado').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'quarantinerole')).setPlaceholder('Selecionar cargo de quarentena')
    ),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(raidState),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'raidmodal')).setLabel('Editar limites do raid').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'accessclear')).setLabel('Limpar listas de acesso').setStyle(ButtonStyle.Danger)
    )
  );

  return navigation(container, ids, session);
}

function yes(value: boolean): string { return value ? 'sim' : 'não'; }
