import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder } from 'discord.js';
import type { CustomIdManager } from '../customIdManager';
import type { PanelSession } from '../sessionManager';
import { UI_EMOJIS } from '../../ui/emojis';

export function baseContainer(color:string,title:string,description:string):any {
  const container = new ContainerBuilder()
    .setAccentColor(hexToInt(color))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}${description ? `\n${description}` : ''}`));
  if (description) container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  return container;
}

export function navigation(container:any,ids:CustomIdManager,session:PanelSession,includeHome=true):any {
  const row=new ActionRowBuilder<ButtonBuilder>();
  if(includeHome) row.addComponents(new ButtonBuilder().setCustomId(ids.encode(session.id,'home')).setLabel('Início').setEmoji(UI_EMOJIS.home).setStyle(ButtonStyle.Secondary));
  row.addComponents(new ButtonBuilder().setCustomId(ids.encode(session.id,'close')).setEmoji(UI_EMOJIS.close).setStyle(ButtonStyle.Danger));
  container.addActionRowComponents(row);
  return container;
}

export function backOnly(container:any,ids:CustomIdManager,session:PanelSession,action:string,arg=''):any {
  container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(ids.encode(session.id,action,arg)).setLabel('Voltar').setEmoji(UI_EMOJIS.home).setStyle(ButtonStyle.Secondary)
  ));
  return container;
}

/** Mantido para compatibilidade: créditos não aparecem em páginas internas. */
export function r8Footer(container:any):any { return container; }

/** O crédito é exibido exclusivamente no menu principal. */
export function mainCreditFooter(container:any):any {
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent('-# @r8fb'));
  return container;
}

export function statusPayload(title:string,description:string,color='#111111'):any {
  const container=baseContainer(color,title,description);
  return { components:[container], flags:MessageFlags.IsComponentsV2, allowedMentions:{parse:[]} };
}

export function hexToInt(value:string):number {
  const clean=value.replace('#','');
  return /^[0-9a-f]{6}$/i.test(clean)?Number.parseInt(clean,16):0x111111;
}
