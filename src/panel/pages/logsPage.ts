import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  SectionBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder
} from 'discord.js';
import { LOG_CATEGORIES } from '../../config/defaults';
import type { GuildConfig } from '../../types/guildConfig';
import type { CustomIdManager } from '../customIdManager';
import type { PanelSession } from '../sessionManager';
import { baseContainer, navigation, r8Footer } from '../components/common';

const CATEGORY_LABELS: Record<string,string> = {
  security:'Segurança', community:'Comunidade', moderation:'Moderação', tickets:'Tickets', voice:'Voz', server:'Servidor', system:'Sistema'
};

export function logsPage(session:PanelSession,ids:CustomIdManager,config:GuildConfig):any {
  const category=String(session.state.logCategory??'home');
  if(category==='home') return renderHome(session,ids,config);
  const events=(LOG_CATEGORIES as Record<string,readonly string[]>)[category];
  if(!events) { session.state.logCategory='home'; return renderHome(session,ids,config); }
  const page=Math.max(0,Math.min(Number(session.state.logsPage??0),Math.max(0,Math.ceil(events.length/3)-1)));
  session.state.logsPage=page;
  const container=baseContainer(config.panel.color,`Logs de ${CATEGORY_LABELS[category]??category}`,`Cada evento possui seu próprio canal. Página ${page+1} de ${Math.max(1,Math.ceil(events.length/3))}.`);
  for(const event of events.slice(page*3,page*3+3)) {
    const item=config.logs.events[event]!;
    const destination=item.mode==='disabled'?'desativado':item.mode==='specific'&&item.channelId?`<#${item.channelId}>`:config.logs.defaultChannelId?`canal padrão <#${config.logs.defaultChannelId}>`:'canal padrão não configurado';
    container.addSectionComponents(new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${friendly(event)}**\nDestino: ${destination}`))
      .setButtonAccessory(new ButtonBuilder().setCustomId(ids.encode(session.id,'logchoosechannel',event)).setLabel('Escolher canal').setStyle(ButtonStyle.Primary)));
    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ids.encode(session.id,'logeventmode',`${event}:default`)).setLabel('Usar padrão').setStyle(item.mode==='default'?ButtonStyle.Success:ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ids.encode(session.id,'logeventmode',`${event}:disabled`)).setLabel('Desativar').setStyle(item.mode==='disabled'?ButtonStyle.Danger:ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ids.encode(session.id,'logtestevent',event)).setLabel('Testar').setStyle(ButtonStyle.Secondary)
    ));
  }
  container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(ids.encode(session.id,'logpage','prev')).setLabel('Anterior').setStyle(ButtonStyle.Secondary).setDisabled(page===0),
    new ButtonBuilder().setCustomId(ids.encode(session.id,'logpage','next')).setLabel('Próxima').setStyle(ButtonStyle.Secondary).setDisabled((page+1)*3>=events.length),
    new ButtonBuilder().setCustomId(ids.encode(session.id,'logcategorybutton','home')).setLabel('Voltar às categorias').setStyle(ButtonStyle.Secondary)
  ));
  return navigation(r8Footer(container),ids,session);
}

function renderHome(session:PanelSession,ids:CustomIdManager,config:GuildConfig):any {
  const active=Object.values(config.logs.events).filter(item=>item.mode!=='disabled').length;
  const specific=Object.values(config.logs.events).filter(item=>item.mode==='specific').length;
  const container=baseContainer(config.panel.color,'Logs',`Canal padrão: ${config.logs.defaultChannelId?`<#${config.logs.defaultChannelId}>`:'não configurado'} • Ativos: **${active}** • Específicos: **${specific}**`);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Escolha uma categoria no menu. Depois, configure cada evento pelo botão ao lado.'));
  const categoryMenu = new StringSelectMenuBuilder()
    .setCustomId(ids.encode(session.id,'logcategory'))
    .setPlaceholder('Selecionar categoria de logs')
    .setMinValues(1).setMaxValues(1)
    .addOptions(...Object.entries(CATEGORY_LABELS).map(([value,label])=>new StringSelectMenuOptionBuilder().setLabel(label).setValue(value)));
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categoryMenu),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id,'logdefault')).setPlaceholder('Selecionar canal padrão de logs').setChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1)
    ),
    row(
      button(ids,session,'logall','on','Ativar todos',ButtonStyle.Success),
      button(ids,session,'logall','default','Aplicar padrão em todos',ButtonStyle.Primary),
      button(ids,session,'logall','off','Desativar todos',ButtonStyle.Danger),
      button(ids,session,'logvalidate','','Validar canais')
    )
  );
  return navigation(r8Footer(container),ids,session);
}

function friendly(value:string):string { return value.split('_').map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' '); }
function button(ids:CustomIdManager,session:PanelSession,action:string,arg:string,label:string,style=ButtonStyle.Secondary):ButtonBuilder { return new ButtonBuilder().setCustomId(ids.encode(session.id,action,arg)).setLabel(label).setStyle(style); }
function row(...buttons:ButtonBuilder[]):ActionRowBuilder<ButtonBuilder>{ return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons); }
