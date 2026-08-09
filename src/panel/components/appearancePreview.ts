import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder
} from 'discord.js';
import type { MessageAppearance, TicketAppearance } from '../../types/guildConfig';
import { renderTicketTemplate } from '../../tickets/templateRenderer';
import { renderCommunityTemplate } from '../../community/templateRenderer';
import { resolveConfiguredEmoji } from '../../ui/emojis';

export function addTicketPreview(container: any, appearance: TicketAppearance, context: any, label: string): void {
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Prévia real — ${label}\n-# A prévia abaixo é apenas visual; os controles ficam desativados.`));
  const title = renderTicketTemplate(appearance.title, context) || 'Sem título';
  const description = renderTicketTemplate(appearance.description, context) || 'Sem descrição';
  const text = `**${title.slice(0, 256)}**\n${description.slice(0, 1800)}`;
  const thumbnail = renderTicketTemplate(appearance.thumbnailUrl ?? '', context);
  if (isHttp(thumbnail)) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail))
    );
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  }
  if (appearance.showSeparator) container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  const image = renderTicketTemplate(appearance.imageUrl ?? '', context);
  if (isHttp(image)) container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image).setDescription('Imagem da prévia')));
  if (appearance.footer) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${renderTicketTemplate(appearance.footer, context).slice(0, 2048)}`));

  const previewButton = new ButtonBuilder()
    .setCustomId(`preview:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'ticket'}`)
    .setLabel((appearance.buttonLabel || (label.toLowerCase().includes('interno') ? 'Ação do ticket' : 'Abrir ticket')).slice(0, 80))
    .setStyle(toButtonStyle(appearance.buttonStyle))
    .setDisabled(true);
  const configuredEmoji = resolveConfiguredEmoji(appearance.buttonEmoji);
  if (configuredEmoji) previewButton.setEmoji(configuredEmoji);
  container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(previewButton));
}

export function addCommunityPreview(container: any, appearance: MessageAppearance, context: any, label: string): void {
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Prévia real — ${label}\n-# Esta visualização é privada e não possui controles clicáveis.`));
  const title = renderCommunityTemplate(appearance.title, context) || 'Sem título';
  const description = renderCommunityTemplate(appearance.description, context) || 'Sem descrição';
  const text = `**${title.slice(0, 256)}**\n${description.slice(0, 1800)}`;
  const thumbnail = renderCommunityTemplate(appearance.thumbnailUrl ?? '', context);
  if (isHttp(thumbnail)) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail))
    );
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  }
  if (appearance.showSeparator) container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  const image = renderCommunityTemplate(appearance.imageUrl ?? '', context);
  if (isHttp(image)) container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image).setDescription('Imagem da prévia')));
  if (appearance.footer) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${renderCommunityTemplate(appearance.footer, context).slice(0, 2048)}`));
}

function toButtonStyle(style: string | undefined): number {
  if (style === 'success') return ButtonStyle.Success;
  if (style === 'danger') return ButtonStyle.Danger;
  if (style === 'secondary') return ButtonStyle.Secondary;
  return ButtonStyle.Primary;
}

function isHttp(value: string): boolean { return /^https?:\/\//i.test(value); }
