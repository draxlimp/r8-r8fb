import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextDisplayBuilder } from 'discord.js';
import type { AppConfig } from '../../types/config';
import type { GuildConfig } from '../../types/guildConfig';
import type { CustomIdManager } from '../customIdManager';
import type { PanelSession } from '../sessionManager';
import { baseContainer, mainCreditFooter } from '../components/common';
import { UI_EMOJIS } from '../../ui/emojis';

export function homePage(session: PanelSession, ids: CustomIdManager, _user: any, guild: any, _app: AppConfig, config: GuildConfig): any {
  const container = baseContainer(config.panel.color, config.panel.title || 'R8 Community', `Configuração de **${guild.name}**.`);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Escolha uma área no menu abaixo. Dentro de cada função, as alterações são feitas por botões e seletores próprios.'));
  const menu = new StringSelectMenuBuilder()
    .setCustomId(ids.encode(session.id,'nav'))
    .setPlaceholder('Selecione uma área')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Comunidade').setDescription('Tickets, mensagens, diversão, cargos e utilidades.').setValue('community').setEmoji(UI_EMOJIS.community),
      new StringSelectMenuOptionBuilder().setLabel('Proteção').setDescription('Proteções, bypass, backups e diagnóstico.').setValue('protections').setEmoji(UI_EMOJIS.shield),
      new StringSelectMenuOptionBuilder().setLabel('Logs').setDescription('Canais e eventos registrados pelo bot.').setValue('logs').setEmoji(UI_EMOJIS.paper),
      new StringSelectMenuOptionBuilder().setLabel('Config Bot').setDescription('Perfil, comandos, aliases e acesso.').setValue('configbot').setEmoji(UI_EMOJIS.settings),
      new StringSelectMenuOptionBuilder().setLabel('Tutorial').setDescription('Guia completo de configuração e uso.').setValue('tutorial').setEmoji(UI_EMOJIS.tutorial)
    );
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ids.encode(session.id,'close')).setEmoji(UI_EMOJIS.close).setStyle(ButtonStyle.Danger)
    )
  );
  return mainCreditFooter(container);
}
