import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import type { GuildConfig, RolePanelConfig } from '../types/guildConfig';
import { resolveConfiguredEmoji } from '../ui/emojis';
import { guildConfigStore } from '../storage/guildConfigStore';
import { logCommunityEvent } from './communityLogger';

const CLEAR_VALUE = '__none__';

export class RolePanelService {
  async handleInteraction(interaction: any): Promise<boolean> {
    if (!interaction.customId?.startsWith('rolepanel|') || !interaction.guild || !interaction.isStringSelectMenu?.()) return false;
    const [, action, panelId] = String(interaction.customId).split('|');
    if (action !== 'select' || !panelId) return false;

    const config = await guildConfigStore.get(interaction.guild.id);
    const panel = config.community.rolePanels.panels.find(item => item.id === panelId);
    if (!panel?.enabled) {
      await interaction.reply({ content: 'Este painel de cargos está desativado.', flags: MessageFlags.Ephemeral });
      return true;
    }
    const member = interaction.member;
    if (panel.blockedRoleIds.some(roleId => member.roles.cache.has(roleId))) {
      await interaction.reply({ content: 'Você não pode usar este painel de cargos.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (panel.requiredRoleIds.length && !panel.requiredRoleIds.some(roleId => member.roles.cache.has(roleId))) {
      await interaction.reply({ content: 'Você não possui o cargo exigido para usar este painel.', flags: MessageFlags.Ephemeral });
      return true;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const configuredIds = panel.options.map(option => option.roleId);
    const requestedIds = interaction.values.includes(CLEAR_VALUE)
      ? []
      : interaction.values.filter((roleId: string) => configuredIds.includes(roleId));
    const targetIds = panel.exclusive ? requestedIds.slice(0, 1) : requestedIds;
    const currentIds = configuredIds.filter(roleId => member.roles.cache.has(roleId));
    const addIds = targetIds.filter((roleId: string) => !currentIds.includes(roleId));
    const removeIds = currentIds.filter((roleId: string) => !targetIds.includes(roleId));

    const manageableAdd = addIds.filter((roleId: string) => interaction.guild.roles.cache.get(roleId)?.editable);
    const manageableRemove = removeIds.filter((roleId: string) => interaction.guild.roles.cache.get(roleId)?.editable);
    if (manageableRemove.length) await member.roles.remove(manageableRemove, `Painel de cargos ${panel.id}`).catch(() => undefined);
    if (manageableAdd.length) await member.roles.add(manageableAdd, `Painel de cargos ${panel.id}`).catch(() => undefined);

    await interaction.editReply(
      `Cargos atualizados. Adicionados: **${manageableAdd.length}** | Removidos: **${manageableRemove.length}**.` +
      ((manageableAdd.length !== addIds.length || manageableRemove.length !== removeIds.length) ? ' Alguns cargos não puderam ser gerenciados pela hierarquia do bot.' : '')
    );
    await logCommunityEvent({
      guild: interaction.guild,
      config,
      event: 'self_role_update',
      module: 'community_role_panels',
      executorId: interaction.user.id,
      targetId: interaction.user.id,
      channelId: interaction.channelId,
      details: { panelId, addedRoleIds: manageableAdd, removedRoleIds: manageableRemove }
    });
    await guildConfigStore.set(interaction.guild.id, config);
    return true;
  }

  async publishPanel(guild: any, panel: RolePanelConfig): Promise<{ channelId: string; messageId: string }> {
    if (!panel.publishChannelId) throw new Error('Selecione o canal de publicação do painel de cargos.');
    if (!panel.options.length) throw new Error('Adicione ao menos um cargo ao painel antes de publicar.');
    const channel = await guild.channels.fetch(panel.publishChannelId);
    if (!channel?.isTextBased?.() || !('send' in channel)) throw new Error('O canal de publicação não é válido.');

    if (panel.publishMessageId) {
      const previous = await channel.messages.fetch(panel.publishMessageId).catch(() => null);
      if (previous) await previous.delete().catch(() => undefined);
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`rolepanel|select|${panel.id}`)
      .setPlaceholder(panel.placeholder.slice(0, 150))
      .setMinValues(1)
      .setMaxValues(panel.exclusive ? 1 : Math.max(1, Math.min(panel.maximumSelections, panel.options.length)));
    for (const option of panel.options.slice(0, panel.exclusive ? 25 : 24)) {
      const item = new StringSelectMenuOptionBuilder().setLabel(option.label.slice(0, 100)).setValue(option.roleId);
      if (option.description) item.setDescription(option.description.slice(0, 100));
      const configuredEmoji = resolveConfiguredEmoji(option.emoji);
      if (configuredEmoji) item.setEmoji(configuredEmoji);
      select.addOptions(item);
    }
    if (!panel.exclusive && panel.options.length <= 24) {
      select.addOptions(new StringSelectMenuOptionBuilder().setLabel('Remover cargos deste painel').setValue(CLEAR_VALUE).setDescription('Remove todos os cargos selecionáveis deste painel.'));
    }

    const message = await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle(panel.title.slice(0, 256))
        .setDescription(panel.description.slice(0, 4096))
        .setColor(normalizeColor(panel.color))],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
      allowedMentions: { parse: [] }
    });
    return { channelId: channel.id, messageId: message.id };
  }
}

function normalizeColor(value: string): number {
  const clean = value.replace('#', '');
  return /^[0-9a-f]{6}$/i.test(clean) ? Number.parseInt(clean, 16) : 0x111111;
}
