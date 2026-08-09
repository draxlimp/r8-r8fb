import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  ModalBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailBuilder,
  SectionBuilder,
  UserSelectMenuBuilder
} from 'discord.js';
import { guildConfigStore } from '../storage/guildConfigStore';
import type { GuildConfig, TelloynConfig } from '../types/guildConfig';
import { logCommunityEvent } from './communityLogger';
import { createTelloynCard } from './telloynCanvas';
import { renderCommunityTemplate } from './templateRenderer';

export class TelloynService {
  async handleInteraction(interaction: any): Promise<boolean> {
    if (!interaction.customId?.startsWith('tl|')) return false;
    const [, action] = interaction.customId.split('|');
    if (!interaction.guild) return false;

    if (action === 'open' && interaction.isButton()) {
      const config = await guildConfigStore.get(interaction.guild.id);
      const item = config.community.telloyn;
      if (!item.enabled) {
        await interaction.reply({ content: 'O Telloyn está desativado.', flags: MessageFlags.Ephemeral });
        return true;
      }
      await interaction.showModal(this.createSendModal(item));
      return true;
    }

    if (action === 'submit' && interaction.isModalSubmit()) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await this.submit(interaction);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro interno ao enviar o Telloyn.';
        await interaction.editReply({ content: message, allowedMentions: { parse: [] } }).catch(() => undefined);
      }
      return true;
    }
    return false;
  }

  async publishPanel(guild: any, item: TelloynConfig): Promise<{ channelId: string; messageId: string }> {
    if (!item.channelId) throw new Error('Selecione o canal do Telloyn.');
    const channel = await guild.channels.fetch(item.channelId);
    if (!channel?.isTextBased?.() || !('send' in channel)) throw new Error('O canal do Telloyn não é válido.');

    if (item.publishMessageId) {
      const old = await channel.messages.fetch(item.publishMessageId).catch(() => null);
      if (old) await old.delete().catch(() => undefined);
    }

    const message = await channel.send(this.panelPayload(item, guild));
    return { channelId: channel.id, messageId: message.id };
  }

  panelPayload(item: TelloynConfig, guild: any): any {
    const appearance = item.appearance;
    const context = { user: guild.members?.me?.user ?? guild.client?.user ?? { username:'Comunidade' }, guild };
    const title = renderCommunityTemplate(appearance.title, context) || 'Telloyn';
    const description = renderCommunityTemplate(appearance.description, context) || 'Envie uma mensagem para a comunidade.';
    const container = new ContainerBuilder()
      .setAccentColor(normalizeColor(appearance.color))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title.slice(0, 256)}\n${description.slice(0, 3500)}`));

    const thumbnail = renderCommunityTemplate(appearance.thumbnailUrl ?? '', context);
    if (isHttp(thumbnail)) {
      const section = new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('Escolha como deseja enviar, mencione alguém opcionalmente e escreva sua mensagem.'))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail));
      container.addSectionComponents(section);
    }

    if (appearance.showSeparator) {
      container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    }
    const image = renderCommunityTemplate(appearance.imageUrl ?? '', context);
    if (isHttp(image)) container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image).setDescription('Imagem do painel Telloyn')));
    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
      applyButtonStyle(new ButtonBuilder().setCustomId('tl|open').setLabel(appearance.buttonLabel || 'Enviar Telloyn'), appearance.buttonStyle)
    ));
    return { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
  }

  private createSendModal(item: TelloynConfig): ModalBuilder {
    const options: StringSelectMenuOptionBuilder[] = [];
    if (item.allowPublic) options.push(new StringSelectMenuOptionBuilder().setLabel('Público').setDescription('Mostra seu nome, usuário e foto.').setValue('public'));
    if (item.allowAnonymous) options.push(new StringSelectMenuOptionBuilder().setLabel('Anônimo').setDescription('Oculta sua identidade na publicação.').setValue('anonymous'));
    if (!options.length) options.push(new StringSelectMenuOptionBuilder().setLabel('Público').setValue('public'));

    const modal = new ModalBuilder().setCustomId('tl|submit').setTitle('Telloyn').addLabelComponents(
      new LabelBuilder().setLabel('Como deseja enviar?').setStringSelectMenuComponent(
        new StringSelectMenuBuilder().setCustomId('mode').setPlaceholder('Selecione uma opção').setMinValues(1).setMaxValues(1).addOptions(options)
      )
    );
    if (item.allowMentions) {
      modal.addLabelComponents(new LabelBuilder().setLabel('Mencionar alguém? (opcional)').setUserSelectMenuComponent(
        new UserSelectMenuBuilder().setCustomId('mention').setPlaceholder('Selecione uma pessoa').setRequired(false).setMaxValues(1)
      ));
    }
    modal.addLabelComponents(new LabelBuilder().setLabel('Sua mensagem').setTextInputComponent(
      new TextInputBuilder().setCustomId('message').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(1).setMaxLength(Math.min(4000, Math.max(50, item.maximumMessageLength))).setPlaceholder('Escreva sua mensagem aqui')
    ));
    return modal;
  }

  private async submit(interaction: any): Promise<void> {
    const config = await guildConfigStore.get(interaction.guild.id);
    const item = config.community.telloyn;
    if (!item.enabled || !item.channelId) throw new Error('O Telloyn não está configurado corretamente.');

    const mode = interaction.fields.getStringSelectValues('mode')[0] ?? 'public';
    const anonymous = mode === 'anonymous';
    if (anonymous && !item.allowAnonymous) throw new Error('Envios anônimos estão desativados.');
    if (!anonymous && !item.allowPublic) throw new Error('Envios públicos estão desativados.');

    const message = interaction.fields.getTextInputValue('message').trim();
    if (!message) throw new Error('Escreva uma mensagem.');
    if (message.length > item.maximumMessageLength) throw new Error(`A mensagem deve ter no máximo ${item.maximumMessageLength} caracteres.`);

    const selectedUsers = item.allowMentions ? interaction.fields.getSelectedUsers('mention', false) : null;
    const mentioned = selectedUsers?.first?.() ?? null;
    const member = interaction.member;
    const authorDisplayName = member?.displayName ?? interaction.user.globalName ?? interaction.user.username;
    const mentionedMember = mentioned ? await interaction.guild.members.fetch(mentioned.id).catch(() => null) : null;

    const image = await createTelloynCard({
      anonymous,
      authorName: authorDisplayName,
      authorUsername: interaction.user.username,
      authorAvatarUrl: anonymous ? null : interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
      mentionedName: mentioned ? (mentionedMember?.displayName ?? mentioned.globalName ?? mentioned.username) : null,
      mentionedUsername: mentioned?.username ?? null,
      mentionedAvatarUrl: mentioned?.displayAvatarURL?.({ extension: 'png', size: 128 }) ?? null,
      message,
      guildName: interaction.guild.name
    });

    const fileName = `telloyn-${Date.now()}.png`;
    const attachment = new AttachmentBuilder(image, { name: fileName });
    const container = new ContainerBuilder()
      .setAccentColor(normalizeColor(item.appearance.color))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Telloyn\n**${interaction.guild.name}**`));
    if (mentioned) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Mencionado:** <@${mentioned.id}>`));
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(`attachment://${fileName}`).setDescription('Mensagem do Telloyn')
    ));

    const channel = await interaction.guild.channels.fetch(item.channelId).catch(() => null);
    if (!channel?.isTextBased?.() || !('send' in channel)) throw new Error('O canal configurado para o Telloyn não está disponível.');
    await channel.send({
      components: [container],
      files: [attachment],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [], users: mentioned ? [mentioned.id] : [] }
    });

    await logCommunityEvent({
      guild: interaction.guild,
      config,
      event: anonymous ? 'telloyn_anonymous_sent' : 'telloyn_sent',
      module: 'community_telloyn',
      executorId: interaction.user.id,
      targetId: mentioned?.id ?? null,
      severity: 'info',
      actionResult: 'success',
      details: { anonymous }
    });
    await guildConfigStore.set(interaction.guild.id, config);
    await interaction.editReply({ content: 'Seu Telloyn foi enviado com sucesso.', allowedMentions: { parse: [] } });
  }
}

function normalizeColor(value: string): number {
  const clean = value.replace('#', '');
  return /^[0-9a-f]{6}$/i.test(clean) ? Number.parseInt(clean, 16) : 0x111111;
}
function isHttp(value: string): boolean { return /^https?:\/\//i.test(value); }
function applyButtonStyle(button: ButtonBuilder, style: TelloynConfig['appearance']['buttonStyle']): ButtonBuilder {
  const map = { primary: ButtonStyle.Primary, secondary: ButtonStyle.Secondary, success: ButtonStyle.Success, danger: ButtonStyle.Danger } as const;
  return button.setStyle(map[style] ?? ButtonStyle.Primary);
}
