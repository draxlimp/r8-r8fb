import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  RoleSelectMenuBuilder,
  SectionBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  UserSelectMenuBuilder
} from 'discord.js';
import { COMMAND_NAMES, defaultCommandPermission } from '../../config/defaults';
import type { GuildConfig } from '../../types/guildConfig';
import type { CustomIdManager } from '../customIdManager';
import type { PanelSession } from '../sessionManager';
import { baseContainer, navigation, r8Footer } from '../components/common';
import { UI_EMOJIS } from '../../ui/emojis';

export function botConfigPage(session:PanelSession,ids:CustomIdManager,config:GuildConfig,client:any):any {
  const section=String(session.state.botConfigSection??'home');
  if(section==='aliases') return renderAliases(session,ids,config);
  if(section==='commands') return renderCommands(session,ids,config);
  if(section==='commandaccess') return renderCommandAccess(session,ids,config);

  const container=baseContainer(config.panel.color,'Config Bot','Perfil, acesso, comandos, aliases e aparência do painel.');
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Bot: **${client.user?.tag??'indisponível'}**
Prefixo: **!**
Usuários autorizados: **${config.access.allowedUsers.length}** • Cargos autorizados: **${config.access.allowedRoles.length}**`));
  const menu = new StringSelectMenuBuilder()
    .setCustomId(ids.encode(session.id,'botconfigsection'))
    .setPlaceholder('Selecionar configuração do bot')
    .setMinValues(1).setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Perfil do bot').setDescription('Nome, avatar, presença e atividade.').setValue('profile').setEmoji(UI_EMOJIS.bot),
      new StringSelectMenuOptionBuilder().setLabel('Acesso ao painel').setDescription('Usuários, cargos e canais autorizados.').setValue('access').setEmoji(UI_EMOJIS.shield),
      new StringSelectMenuOptionBuilder().setLabel('Comandos').setDescription('Ativação, cooldown e permissões.').setValue('commands').setEmoji(UI_EMOJIS.tools),
      new StringSelectMenuOptionBuilder().setLabel('Aliases').setDescription('Nomes alternativos dos comandos.').setValue('aliases').setEmoji(UI_EMOJIS.aliases),
      new StringSelectMenuOptionBuilder().setLabel('Aparência do painel').setDescription('Título, cor e comportamento do painel.').setValue('settings').setEmoji(UI_EMOJIS.palette)
    );
  container.addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  return navigation(r8Footer(container),ids,session);
}

function renderAliases(session:PanelSession,ids:CustomIdManager,config:GuildConfig):any {
  const selected=String(session.state.selectedCommand??'help');
  const page=Math.max(0,Math.min(Number(session.state.commandPage??0),Math.ceil(COMMAND_NAMES.length/10)-1));
  session.state.commandPage=page;
  const container=baseContainer(config.panel.color,'Aliases','Selecione um comando e edite seus nomes alternativos.');
  for(let index=page*10;index<Math.min(COMMAND_NAMES.length,page*10+10);index+=5) {
    container.addActionRowComponents(row(...COMMAND_NAMES.slice(index,index+5).map(name=>button(ids,session,'commandselect',name,name,name===selected?ButtonStyle.Primary:ButtonStyle.Secondary))));
  }
  const aliases=config.commands.aliases[selected]??[];
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Comando: **!${selected}**\nAliases: ${aliases.length?aliases.map(alias=>`\`!${alias}\``).join(', '):'nenhum'}`));
  container.addActionRowComponents(
    row(
      button(ids,session,'aliasedit',selected,'Editar aliases',ButtonStyle.Primary),
      button(ids,session,'aliasreset',selected,'Restaurar padrão'),
      button(ids,session,'commandpage','prev','Anterior',ButtonStyle.Secondary,page===0),
      button(ids,session,'commandpage','next','Próxima',ButtonStyle.Secondary,(page+1)*10>=COMMAND_NAMES.length)
    ),
    row(button(ids,session,'botconfigopen','home','Voltar'))
  );
  return r8Footer(container);
}

function renderCommands(session:PanelSession,ids:CustomIdManager,config:GuildConfig):any {
  const page=Math.max(0,Math.min(Number(session.state.commandPage??0),Math.ceil(COMMAND_NAMES.length/5)-1));
  session.state.commandPage=page;
  const container=baseContainer(config.panel.color,'Comandos','Ative, desative e abra as permissões de cada comando.');
  for(const name of COMMAND_NAMES.slice(page*5,page*5+5)) {
    const permission=config.commands.permissions[name];
    container.addSectionComponents(new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**!${name}**\nStatus: ${permission?.enabled&&!config.commands.disabled.includes(name)?'ativado':'desativado'} | Cooldown: ${permission?.cooldownSeconds??0}s`))
      .setButtonAccessory(new ButtonBuilder().setCustomId(ids.encode(session.id,'commandaccess',name)).setLabel('Configurar').setStyle(ButtonStyle.Primary)));
  }
  container.addActionRowComponents(
    row(
      button(ids,session,'commandpage','prev','Anterior',ButtonStyle.Secondary,page===0),
      button(ids,session,'commandpage','next','Próxima',ButtonStyle.Secondary,(page+1)*5>=COMMAND_NAMES.length),
      button(ids,session,'botconfigopen','home','Voltar')
    )
  );
  return r8Footer(container);
}

function renderCommandAccess(session:PanelSession,ids:CustomIdManager,config:GuildConfig):any {
  const name=String(session.state.selectedCommand??'help');
  const item=config.commands.permissions[name] ?? (config.commands.permissions[name]=defaultCommandPermission());
  const container=baseContainer(config.panel.color,`Configurar !${name}`,'Permissões, canais, cooldown e comportamento do comando.');
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `Status: **${item.enabled?'ativado':'desativado'}**\nCooldown: **${item.cooldownSeconds}s**\n`+
    `Cargos: ${mentions(item.allowedRoleIds,'role')}\nUsuários: ${mentions(item.allowedUserIds,'user')}\nCanais: ${mentions(item.allowedChannelIds,'channel')}\n`+
    `Excluir mensagem do comando: **${item.deleteCommandMessage?'sim':'não'}**`
  ));
  container.addActionRowComponents(
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId(ids.encode(session.id,'commandrole',name)).setPlaceholder('Adicionar/remover cargo autorizado')),
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(new UserSelectMenuBuilder().setCustomId(ids.encode(session.id,'commanduser',name)).setPlaceholder('Adicionar/remover usuário autorizado')),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id,'commandchannel',name)).setPlaceholder('Adicionar/remover canal permitido').setChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement)),
    row(
      button(ids,session,'commandtoggle',name,item.enabled?'Desativar':'Ativar',item.enabled?ButtonStyle.Danger:ButtonStyle.Success),
      button(ids,session,'commandcooldown',name,'Editar cooldown'),
      button(ids,session,'commanddelete',name,'Alternar exclusão'),
      button(ids,session,'commandclearaccess',name,'Limpar acesso',ButtonStyle.Danger)
    ),
    row(button(ids,session,'botconfigopen','commands','Voltar'))
  );
  return r8Footer(container);
}

function button(ids:CustomIdManager,session:PanelSession,action:string,arg:string,label:string,style=ButtonStyle.Secondary,disabled=false):ButtonBuilder { return new ButtonBuilder().setCustomId(ids.encode(session.id,action,arg)).setLabel(label).setStyle(style).setDisabled(disabled); }
function row(...buttons:ButtonBuilder[]):ActionRowBuilder<ButtonBuilder>{ return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons); }
function mentions(values:string[],kind:'role'|'user'|'channel'):string { if(!values.length)return'nenhum'; return values.map(id=>kind==='role'?`<@&${id}>`:kind==='user'?`<@${id}>`:`<#${id}>`).join(', '); }
