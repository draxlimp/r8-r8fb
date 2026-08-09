import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder
} from 'discord.js';
import { PROTECTION_MODULES } from '../../config/defaults';
import type { GuildConfig } from '../../types/guildConfig';
import type { CustomIdManager } from '../customIdManager';
import type { PanelSession } from '../sessionManager';
import { baseContainer, navigation, r8Footer } from '../components/common';
import { bypassPage } from './bypassPage';
import { backupsPage } from './backupsPage';
import { diagnosticsPage } from './diagnosticsPage';
import { UI_EMOJIS } from '../../ui/emojis';

const labels: Record<string, string> = {
  anti_link:'Anti-Link', anti_invite:'Anti-Convite', anti_spam:'Anti-Spam', anti_flood:'Anti-Flood', anti_caps:'Anti-Caps',
  anti_mass_mention:'Anti-Menção em massa', anti_new_account:'Anti-Conta nova', anti_mass_join:'Anti-Entrada em massa',
  anti_channel_delete:'Anti-Exclusão de canal', anti_role_delete:'Anti-Exclusão de cargo', anti_mass_ban:'Anti-Ban em massa',
  anti_webhook:'Anti-Webhook', anti_unauthorized_bot:'Anti-Bot não autorizado'
};

export function protectionPage(session: PanelSession, ids: CustomIdManager, cfg: GuildConfig): any {
  const section = String(session.state.protectionSection ?? 'home');
  if (section === 'modules') return renderModules(session, ids, cfg);
  if (section === 'bypass') return bypassPage(session, ids, cfg, true);
  if (section === 'backups') return backupsPage(session, ids, cfg, true);
  if (section === 'diagnostics') return diagnosticsPage(session, ids, cfg, true);
  return renderProtectionHome(session, ids, cfg);
}

function renderProtectionHome(session: PanelSession, ids: CustomIdManager, cfg: GuildConfig): any {
  const enabled = Object.values(cfg.protections).filter(item => item.mode !== 'disabled').length;
  const activeBypasses = cfg.bypasses.filter(entry => !entry.expiresAt || Date.parse(entry.expiresAt) > Date.now()).length;
  const container = baseContainer(cfg.panel.color, 'Proteção', 'Segurança, bypass, backups e diagnóstico ficam reunidos aqui.');
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `Proteções ativas: **${enabled}/${Object.keys(cfg.protections).length}**
` +
    `Bypasses ativos: **${activeBypasses}** • Backup automático: **${cfg.backups.automatic ? 'ativado' : 'desativado'}**`
  ));
  const menu = new StringSelectMenuBuilder()
    .setCustomId(ids.encode(session.id,'protectionsection'))
    .setPlaceholder('Selecionar área de proteção')
    .setMinValues(1).setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Módulos de proteção').setDescription('Anti-link, anti-raid, canais, cargos e mensagens.').setValue('modules').setEmoji(UI_EMOJIS.shield),
      new StringSelectMenuOptionBuilder().setLabel('Bypass').setDescription('Usuários, cargos, bots e exceções temporárias.').setValue('bypass').setEmoji(UI_EMOJIS.crown),
      new StringSelectMenuOptionBuilder().setLabel('Backups').setDescription('Cópias, snapshots e restauração.').setValue('backups').setEmoji(UI_EMOJIS.archive),
      new StringSelectMenuOptionBuilder().setLabel('Diagnóstico').setDescription('Permissões, arquivos, canais e estado do bot.').setValue('diagnostics').setEmoji(UI_EMOJIS.chart)
    );
  container.addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  return navigation(r8Footer(container), ids, session);
}

function renderModules(session: PanelSession, ids: CustomIdManager, cfg: GuildConfig): any {
  const selected = String(session.state.selectedModule ?? '');
  const protection = cfg.protections[selected];
  const page = Math.max(0, Number(session.state.protectionPage ?? 0));
  const pageSize = 25;
  const maxPage = Math.max(0, Math.ceil(PROTECTION_MODULES.length / pageSize) - 1);
  const safePage = Math.min(page, maxPage);
  session.state.protectionPage = safePage;
  const enabled = Object.values(cfg.protections).filter(item => item.mode !== 'disabled').length;
  const container = baseContainer(cfg.panel.color, 'Módulos de proteção', `${enabled} módulos ativos de ${Object.keys(cfg.protections).length}. Página ${safePage + 1} de ${maxPage + 1}.`);

  const slice = PROTECTION_MODULES.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(ids.encode(session.id, 'pmod'))
    .setPlaceholder('Selecionar proteção')
    .addOptions(slice.map(module => new StringSelectMenuOptionBuilder()
      .setLabel((labels[module] ?? module.replaceAll('_', ' ')).slice(0, 100))
      .setValue(module)
      .setDescription(`Modo: ${cfg.protections[module]!.mode}`)));

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
    row(
      button(ids, session, 'pprev', '', 'Página anterior', ButtonStyle.Secondary, safePage === 0),
      button(ids, session, 'pnext', '', 'Próxima página', ButtonStyle.Secondary, safePage === maxPage)
    )
  );

  if (protection) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `### ${labels[selected] ?? selected}\n` +
      `**Modo:** ${protection.mode}\n` +
      `**Limite:** ${protection.quantity} ações em ${protection.intervalSeconds}s\n` +
      `**Detecção:** usuários ${yes(protection.detectUsers)}, bots ${yes(protection.detectBots)}, ignorar dono ${yes(protection.ignoreOwner)}\n` +
      `**Sensibilidade:** ${protection.sensitivity}\n` +
      `**Punição:** ${protection.punishment.type} | timeout ${protection.punishment.timeoutSeconds}s\n` +
      `**Restauração:** ${yes(protection.restore)}\n` +
      `**Exceções:** ${protection.ignoredChannels.length} canais, ${protection.ignoredCategories.length} categorias, ${protection.ignoredRoles.length} cargos\n` +
      `**Filtros:** ${protection.allowedDomains.length} domínios permitidos, ${protection.blockedDomains.length} bloqueados, ${protection.blockedWords.length} palavras`
    ));

    const punishment = new StringSelectMenuBuilder()
      .setCustomId(ids.encode(session.id, 'pun'))
      .setPlaceholder('Alterar punição')
      .addOptions(['none','log','warn','dm','timeout','quarantine','remove_dangerous_roles','remove_roles','kick','ban','sequence']
        .map(value => new StringSelectMenuOptionBuilder().setLabel(value.replaceAll('_', ' ')).setValue(value).setDefault(protection.punishment.type === value)));

    container.addActionRowComponents(
      row(
        button(ids, session, 'mode', 'enabled', 'Ativar', ButtonStyle.Success),
        button(ids, session, 'mode', 'monitor', 'Monitorar', ButtonStyle.Primary),
        button(ids, session, 'mode', 'test', 'Teste', ButtonStyle.Secondary),
        button(ids, session, 'mode', 'disabled', 'Desativar', ButtonStyle.Danger)
      ),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(punishment),
      row(
        button(ids, session, 'limitmodal', '', 'Editar limites', ButtonStyle.Primary),
        button(ids, session, 'pfiltersmodal', '', 'Editar filtros'),
        button(ids, session, 'ppunishmodal', '', 'Detalhes da punição'),
        button(ids, session, 'restore', '', protection.restore ? 'Desativar restauração' : 'Ativar restauração'),
        button(ids, session, 'preset', '', 'Restaurar padrão', ButtonStyle.Danger)
      ),
      row(
        toggle(ids, session, 'users', 'Detectar usuários', protection.detectUsers),
        toggle(ids, session, 'bots', 'Detectar bots', protection.detectBots),
        toggle(ids, session, 'owner', 'Ignorar dono', protection.ignoreOwner),
        button(ids, session, 'psensitivity', '', `Sensibilidade: ${protection.sensitivity}`)
      ),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id, 'pignoredchannel')).setPlaceholder('Adicionar/remover canal ignorado').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice, ChannelType.GuildForum)
      ),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id, 'pignoredcategory')).setPlaceholder('Adicionar/remover categoria ignorada').setChannelTypes(ChannelType.GuildCategory)
      ),
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'pignoredrole')).setPlaceholder('Adicionar/remover cargo ignorado')
      )
    );
  }

  container.addActionRowComponents(row(button(ids, session, 'protectionopen', 'home', 'Voltar à proteção')));
  return r8Footer(container);
}

function yes(value: boolean): string { return value ? 'sim' : 'não'; }
function toggle(ids: CustomIdManager, session: PanelSession, key: string, label: string, enabled: boolean): ButtonBuilder {
  return button(ids, session, 'ptoggle', key, label, enabled ? ButtonStyle.Success : ButtonStyle.Secondary);
}
function button(ids: CustomIdManager, session: PanelSession, action: string, arg: string, label: string, style = ButtonStyle.Secondary, disabled = false): ButtonBuilder {
  return new ButtonBuilder().setCustomId(ids.encode(session.id, action, arg)).setLabel(label).setStyle(style).setDisabled(disabled);
}
function row(...buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder> { return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons); }
