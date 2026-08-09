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
import { PROTECTION_MODULES } from '../../config/defaults';
import type { GuildConfig } from '../../types/guildConfig';
import type { CustomIdManager } from '../customIdManager';
import type { PanelSession } from '../sessionManager';
import { backOnly, baseContainer, navigation, r8Footer } from '../components/common';

export function bypassPage(session: PanelSession, ids: CustomIdManager, cfg: GuildConfig, nested = false): any {
  const active = cfg.bypasses.filter(entry => !entry.expiresAt || Date.parse(entry.expiresAt) > Date.now());
  const temporary = active.filter(entry => entry.expiresAt);
  const selectedId = String(session.state.selectedBypass ?? '');
  const selected = active.find(entry => entry.id === selectedId);
  const modulePage = Math.max(0, Number(session.state.bypassModulePage ?? 0));
  const pageSize = 25;
  const maxPage = Math.max(0, Math.ceil(PROTECTION_MODULES.length / pageSize) - 1);
  const safePage = Math.min(modulePage, maxPage);
  session.state.bypassModulePage = safePage;

  const container = baseContainer(
    cfg.panel.color,
    'Bypass',
    `Ativos: ${active.length} | Temporários: ${temporary.length} | Bots confiáveis: ${cfg.trustedBots.length}\n` +
    'O padrão continua registrando o incidente e ignora punição e restauração.'
  );

  if (active.length) {
    const entryMenu = new StringSelectMenuBuilder()
      .setCustomId(ids.encode(session.id, 'bypassselect'))
      .setPlaceholder('Selecionar bypass existente')
      .addOptions(active.slice(-25).map(entry => new StringSelectMenuOptionBuilder()
        .setLabel(`${entry.kind}: ${entry.targetId}`.slice(0, 100))
        .setValue(entry.id)
        .setDescription(entry.modules.includes('*') ? 'Todas as proteções' : `${entry.modules.length} módulos`)
        .setDefault(entry.id === selectedId)));
    container.addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(entryMenu));
  }

  if (selected) {
    const scope = selected.modules.includes('*') ? 'todas as proteções' : selected.modules.join(', ');
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `### Bypass selecionado\n` +
      `**ID:** ${selected.id}\n` +
      `**Alvo:** ${mention(selected.kind, selected.targetId)}\n` +
      `**Escopo:** ${scope || 'nenhum módulo'}\n` +
      `**Expiração:** ${selected.expiresAt ? `<t:${Math.floor(Date.parse(selected.expiresAt) / 1000)}:R>` : 'manual'}\n` +
      `**Comportamento:** detecção ${state(selected.behavior.ignoreDetection)}, punição ${state(selected.behavior.ignorePunishment)}, restauração ${state(selected.behavior.ignoreRestoration)}, limite ${state(selected.behavior.ignoreLimit)}, logs ${selected.behavior.continueLogging ? 'mantidos' : 'suprimidos'}`
    ));

    const modules = PROTECTION_MODULES.slice(safePage * pageSize, (safePage + 1) * pageSize);
    const moduleMenu = new StringSelectMenuBuilder()
      .setCustomId(ids.encode(session.id, 'bypassmodule'))
      .setPlaceholder(`Escolher módulo — página ${safePage + 1}/${maxPage + 1}`)
      .addOptions(modules.map(module => new StringSelectMenuOptionBuilder()
        .setLabel(module.replaceAll('_', ' ').slice(0, 100))
        .setValue(module)
        .setDescription(selected.modules.includes('*') || selected.modules.includes(module) ? 'Com bypass' : 'Sem bypass')));

    const durationMenu = new StringSelectMenuBuilder()
      .setCustomId(ids.encode(session.id, 'bypassduration'))
      .setPlaceholder('Definir duração')
      .addOptions([
        ['5 minutos','300'], ['15 minutos','900'], ['30 minutos','1800'], ['1 hora','3600'],
        ['6 horas','21600'], ['12 horas','43200'], ['24 horas','86400'], ['Até remoção manual','permanent']
      ].map(([label, value]) => new StringSelectMenuOptionBuilder().setLabel(label!).setValue(value!)));

    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(moduleMenu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(ids.encode(session.id, 'bprev')).setLabel('Módulos anteriores').setStyle(ButtonStyle.Secondary).setDisabled(safePage === 0),
        new ButtonBuilder().setCustomId(ids.encode(session.id, 'bnext')).setLabel('Próximos módulos').setStyle(ButtonStyle.Secondary).setDisabled(safePage === maxPage),
        new ButtonBuilder().setCustomId(ids.encode(session.id, 'bypassall')).setLabel(selected.modules.includes('*') ? 'Usar módulos específicos' : 'Aplicar a todos').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(ids.encode(session.id, 'bypassremove')).setLabel('Remover bypass').setStyle(ButtonStyle.Danger)
      ),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(durationMenu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        behavior(ids, session, 'detection', 'Ignorar detecção', selected.behavior.ignoreDetection),
        behavior(ids, session, 'punishment', 'Ignorar punição', selected.behavior.ignorePunishment),
        behavior(ids, session, 'restoration', 'Ignorar restauração', selected.behavior.ignoreRestoration),
        behavior(ids, session, 'limit', 'Ignorar limite', selected.behavior.ignoreLimit),
        behavior(ids, session, 'logging', 'Continuar logs', selected.behavior.continueLogging)
      )
    );
  }

  container.addActionRowComponents(
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder().setCustomId(ids.encode(session.id, 'bypassuser')).setPlaceholder('Adicionar usuário com bypass')
    ),
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'bypassrole')).setPlaceholder('Adicionar cargo com bypass')
    ),
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder().setCustomId(ids.encode(session.id, 'trustedbot')).setPlaceholder('Adicionar/remover bot confiável')
    ),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id, 'bypasschannel')).setPlaceholder('Adicionar canal ignorado').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice, ChannelType.GuildForum)
    ),
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id, 'bypasscategory')).setPlaceholder('Adicionar categoria ignorada').setChannelTypes(ChannelType.GuildCategory)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(ids.encode(session.id, 'bypassprune')).setLabel('Remover expirados').setStyle(ButtonStyle.Secondary)
    )
  );

  return nested ? backOnly(r8Footer(container), ids, session, 'protectionopen', 'home') : navigation(container, ids, session);
}

function behavior(ids: CustomIdManager, session: PanelSession, key: string, label: string, enabled: boolean): ButtonBuilder {
  return new ButtonBuilder().setCustomId(ids.encode(session.id, 'bypasstoggle', key)).setLabel(label).setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Secondary);
}
function mention(kind: string, id: string): string {
  if (kind === 'role') return `<@&${id}>`;
  if (kind === 'channel' || kind === 'category') return `<#${id}>`;
  return `<@${id}>`;
}
function state(value: boolean): string { return value ? 'ignorada' : 'avaliada'; }
