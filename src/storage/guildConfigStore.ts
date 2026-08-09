import path from 'node:path';
import {
  COMMAND_NAMES,
  LOG_EVENTS,
  PROTECTION_MODULES,
  createDefaultGuildConfig,
  defaultApplicationForm,
  defaultCommandPermission,
  defaultLogEvent,
  defaultMessageAppearance,
  defaultProtection,
  defaultRolePanel,
  defaultTicketAppearance,
  defaultTelloynAppearance,
  defaultInstagramAppearance
} from '../config/defaults';
import type { ApplicationFormConfig, GuildConfig, RolePanelConfig, TicketPanelConfig } from '../types/guildConfig';
import { JsonStore } from './jsonStore';

function migrateTicketPanel(panel: Partial<TicketPanelConfig>, position: number): TicketPanelConfig {
  const now = new Date().toISOString();
  const base: TicketPanelConfig = {
    id: typeof panel.id === 'string' ? panel.id : `TP-MIGRATED-${position}`,
    name: typeof panel.name === 'string' ? panel.name : `Atendimento ${position}`,
    enabled: panel.enabled ?? true,
    categoryId: panel.categoryId ?? null,
    publishChannelId: panel.publishChannelId ?? null,
    publishMessageId: panel.publishMessageId ?? null,
    creationMode: panel.creationMode === 'thread' ? 'thread' : 'channel',
    openComponent: panel.openComponent === 'select' ? 'select' : 'button',
    threadParentChannelId: panel.threadParentChannelId ?? null,
    supportRoleIds: Array.isArray(panel.supportRoleIds) ? panel.supportRoleIds : [],
    allowedRoleIds: Array.isArray(panel.allowedRoleIds) ? panel.allowedRoleIds : [],
    blockedRoleIds: Array.isArray(panel.blockedRoleIds) ? panel.blockedRoleIds : [],
    blockedUserIds: Array.isArray(panel.blockedUserIds) ? panel.blockedUserIds : [],
    maxOpenPerUser: Number.isFinite(panel.maxOpenPerUser) ? Math.max(1, Number(panel.maxOpenPerUser)) : 1,
    logChannelId: panel.logChannelId ?? null,
    transcriptChannelId: panel.transcriptChannelId ?? null,
    ticketNamePattern: typeof panel.ticketNamePattern === 'string' ? panel.ticketNamePattern : 'ticket-[user.name]-[ticket.number]',
    external: { ...defaultTicketAppearance('external'), ...(panel.external ?? {}) },
    internal: { ...defaultTicketAppearance('internal'), ...(panel.internal ?? {}) },
    questions: Array.isArray(panel.questions) ? panel.questions.slice(0, 5) : [],
    autoCloseMinutes: Number.isFinite(panel.autoCloseMinutes) ? Math.max(0, Number(panel.autoCloseMinutes)) : 0,
    allowReopen: panel.allowReopen ?? true,
    ratingEnabled: panel.ratingEnabled ?? true,
    businessHoursEnabled: panel.businessHoursEnabled ?? false,
    businessHoursText: typeof panel.businessHoursText === 'string' ? panel.businessHoursText : 'Atendimento disponível conforme a equipe estiver online.',
    internalButtons: {
      claim: true,
      unclaim: true,
      close: true,
      reopen: true,
      delete: true,
      addMember: true,
      removeMember: true,
      createVoice: true,
      transfer: true,
      priority: true,
      rename: true,
      transcript: true,
      ...(panel.internalButtons ?? {})
    },
    createdBy: typeof panel.createdBy === 'string' ? panel.createdBy : 'migration',
    createdAt: typeof panel.createdAt === 'string' ? panel.createdAt : now,
    updatedAt: now
  };
  return base;
}

function migrateRolePanel(panel: Partial<RolePanelConfig>, position: number): RolePanelConfig {
  const base = defaultRolePanel(typeof panel.createdBy === 'string' ? panel.createdBy : 'migration', position);
  const options = Array.isArray(panel.options)
    ? panel.options.slice(0, 25).filter(option => option && typeof option.roleId === 'string').map(option => ({
        roleId: String(option.roleId),
        label: String(option.label || 'Cargo').slice(0, 100),
        description: String(option.description || '').slice(0, 100),
        emoji: option.emoji ? String(option.emoji).slice(0, 100) : null
      }))
    : [];
  return {
    ...base,
    ...panel,
    id: typeof panel.id === 'string' ? panel.id : `RP-MIGRATED-${position}`,
    options,
    requiredRoleIds: Array.isArray(panel.requiredRoleIds) ? panel.requiredRoleIds : [],
    blockedRoleIds: Array.isArray(panel.blockedRoleIds) ? panel.blockedRoleIds : [],
    minimumSelections: Math.max(0, Math.min(Number(panel.minimumSelections ?? base.minimumSelections), options.length)),
    maximumSelections: Math.max(1, Math.min(Number(panel.maximumSelections ?? base.maximumSelections), Math.max(1, options.length || 1))),
    updatedAt: new Date().toISOString()
  };
}

function migrateApplicationForm(form: Partial<ApplicationFormConfig>, position: number): ApplicationFormConfig {
  const base = defaultApplicationForm(typeof form.createdBy === 'string' ? form.createdBy : 'migration', position);
  return {
    ...base,
    ...form,
    id: typeof form.id === 'string' ? form.id : `FM-MIGRATED-${position}`,
    allowedRoleIds: Array.isArray(form.allowedRoleIds) ? form.allowedRoleIds : [],
    blockedRoleIds: Array.isArray(form.blockedRoleIds) ? form.blockedRoleIds : [],
    approvedRoleIds: Array.isArray(form.approvedRoleIds) ? form.approvedRoleIds : [],
    questions: Array.isArray(form.questions)
      ? form.questions.slice(0, 5).map((question, index) => ({
          id: typeof question.id === 'string' ? question.id : `Q${index + 1}`,
          label: String(question.label || `Pergunta ${index + 1}`).slice(0, 45),
          placeholder: String(question.placeholder || '').slice(0, 100),
          required: question.required ?? true,
          paragraph: question.paragraph ?? true
        }))
      : base.questions,
    updatedAt: new Date().toISOString()
  };
}


function cleanLegacyAppearance<T extends { footer?: string; separator?: string }>(appearance: T): T {
  if (typeof appearance.footer === 'string' && /r8fb|desenvolvido por/i.test(appearance.footer)) appearance.footer = '';
  if (typeof appearance.separator === 'string' && /^[\s─—_-]+$/.test(appearance.separator)) appearance.separator = '';
  return appearance;
}

function migrate(value: unknown, guildId: string): GuildConfig {
  const base = createDefaultGuildConfig(guildId);
  if (!value || typeof value !== 'object') return base;
  const raw = value as Partial<GuildConfig>;
  const rawCommunity = raw.community;
  const rawTelloyn = (rawCommunity as any)?.telloyn ?? (rawCommunity as any)?.telolin;

  const merged: GuildConfig = {
    ...base,
    ...raw,
    guildId,
    panel: { ...base.panel, ...raw.panel },
    access: { ...base.access, ...raw.access },
    commands: {
      ...base.commands,
      ...raw.commands,
      aliases: { ...base.commands.aliases, ...(raw.commands?.aliases ?? {}) },
      permissions: { ...base.commands.permissions, ...(raw.commands?.permissions ?? {}) },
      disabled: Array.isArray(raw.commands?.disabled) ? raw.commands.disabled : []
    },
    moderation: {
      ...base.moderation,
      ...raw.moderation,
      cases: Array.isArray(raw.moderation?.cases) ? raw.moderation.cases.slice(-1000) : [],
      warnings: Array.isArray(raw.moderation?.warnings) ? raw.moderation.warnings.slice(-1000) : [],
      temporaryBans: Array.isArray(raw.moderation?.temporaryBans) ? raw.moderation.temporaryBans.slice(-1000) : []
    },
    logs: { ...base.logs, ...raw.logs, events: { ...base.logs.events, ...(raw.logs?.events ?? {}) } },
    quarantine: { ...base.quarantine, ...raw.quarantine, active: { ...base.quarantine.active, ...(raw.quarantine?.active ?? {}) } },
    raid: { ...base.raid, ...raw.raid },
    backups: { ...base.backups, ...raw.backups },
    snapshots: { ...base.snapshots, ...raw.snapshots },
    protections: { ...base.protections, ...(raw.protections ?? {}) },
    community: {
      ...base.community,
      ...rawCommunity,
      cl: { ...base.community.cl, ...rawCommunity?.cl },
      tickets: {
        ...base.community.tickets,
        ...rawCommunity?.tickets,
        panels: Array.isArray(rawCommunity?.tickets?.panels)
          ? rawCommunity.tickets.panels.slice(0, 10).map((panel, index) => migrateTicketPanel(panel, index + 1))
          : [],
        openTickets: { ...base.community.tickets.openTickets, ...(rawCommunity?.tickets?.openTickets ?? {}) }
      },
      welcome: {
        ...base.community.welcome,
        ...rawCommunity?.welcome,
        appearance: { ...defaultMessageAppearance('welcome'), ...(rawCommunity?.welcome?.appearance ?? {}) }
      },
      goodbye: {
        ...base.community.goodbye,
        ...rawCommunity?.goodbye,
        appearance: { ...defaultMessageAppearance('goodbye'), ...(rawCommunity?.goodbye?.appearance ?? {}) }
      },
      suggestions: { ...base.community.suggestions, ...rawCommunity?.suggestions },
      telloyn: {
        ...base.community.telloyn,
        ...rawTelloyn,
        appearance: { ...defaultTelloynAppearance(), ...(rawTelloyn?.appearance ?? {}) }
      },
      instagram: {
        ...base.community.instagram,
        ...rawCommunity?.instagram,
        appearance: { ...defaultInstagramAppearance(), ...(rawCommunity?.instagram?.appearance ?? {}) },
        emojis: { ...base.community.instagram.emojis, ...(rawCommunity?.instagram?.emojis ?? {}) },
        posts: { ...base.community.instagram.posts, ...(rawCommunity?.instagram?.posts ?? {}) }
      },
      twitter: {
        ...base.community.twitter,
        ...rawCommunity?.twitter
      },
      autoClean: {
        ...base.community.autoClean,
        ...rawCommunity?.autoClean,
        rules: Array.isArray(rawCommunity?.autoClean?.rules)
          ? rawCommunity.autoClean.rules.slice(0, 10).map((rule: any, index: number) => {
              const now = new Date().toISOString();
              const mode = ['all','images','text','links'].includes(rule?.mode) ? rule.mode : 'all';
              return {
                id: typeof rule?.id === 'string' ? rule.id : `AC-MIGRATED-${index + 1}`,
                name: String(rule?.name || `Limpeza ${index + 1}`).slice(0, 60),
                enabled: rule?.enabled ?? false,
                channelId: typeof rule?.channelId === 'string' ? rule.channelId : null,
                mode,
                delaySeconds: Number.isFinite(rule?.delaySeconds) ? Math.min(2_592_000, Math.max(5, Number(rule.delaySeconds))) : 60,
                includeBots: rule?.includeBots ?? false,
                includeWebhooks: rule?.includeWebhooks ?? false,
                ignorePinned: rule?.ignorePinned ?? true,
                logDeletions: rule?.logDeletions ?? false,
                createdBy: typeof rule?.createdBy === 'string' ? rule.createdBy : 'migration',
                createdAt: typeof rule?.createdAt === 'string' ? rule.createdAt : now,
                updatedAt: now
              };
            })
          : []
      },
      temporaryVoice: {
        ...base.community.temporaryVoice,
        ...rawCommunity?.temporaryVoice,
        createdChannels: { ...base.community.temporaryVoice.createdChannels, ...(rawCommunity?.temporaryVoice?.createdChannels ?? {}) }
      },
      rolePanels: {
        ...base.community.rolePanels,
        ...rawCommunity?.rolePanels,
        panels: Array.isArray(rawCommunity?.rolePanels?.panels)
          ? rawCommunity.rolePanels.panels.slice(0, 10).map((panel, index) => migrateRolePanel(panel, index + 1))
          : []
      },
      forms: {
        ...base.community.forms,
        ...rawCommunity?.forms,
        forms: Array.isArray(rawCommunity?.forms?.forms)
          ? rawCommunity.forms.forms.slice(0, 10).map((form, index) => migrateApplicationForm(form, index + 1))
          : [],
        submissions: { ...base.community.forms.submissions, ...(rawCommunity?.forms?.submissions ?? {}) }
      },
      afkUsers: { ...base.community.afkUsers, ...(rawCommunity?.afkUsers ?? {}) },
      reputation: {
        scores: { ...base.community.reputation.scores, ...((rawCommunity as any)?.reputation?.scores ?? {}) },
        lastGivenAt: { ...base.community.reputation.lastGivenAt, ...((rawCommunity as any)?.reputation?.lastGivenAt ?? {}) }
      },
      temporaryRoles: Array.isArray(rawCommunity?.temporaryRoles) ? rawCommunity.temporaryRoles.slice(-2000) : [],
      roleBackups: Array.isArray(rawCommunity?.roleBackups) ? rawCommunity.roleBackups.slice(-10) : [],
      voiceActivity: {
        ...base.community.voiceActivity,
        ...rawCommunity?.voiceActivity,
        totalsSeconds: { ...base.community.voiceActivity.totalsSeconds, ...(rawCommunity?.voiceActivity?.totalsSeconds ?? {}) },
        activeSince: { ...base.community.voiceActivity.activeSince, ...(rawCommunity?.voiceActivity?.activeSince ?? {}) }
      },
      inviteJoins: { ...base.community.inviteJoins, ...(rawCommunity?.inviteJoins ?? {}) },
      autorole: { ...base.community.autorole, ...rawCommunity?.autorole },
      massRoles: { ...base.community.massRoles, ...rawCommunity?.massRoles }
    }
  };

  cleanLegacyAppearance(merged.community.welcome.appearance);
  cleanLegacyAppearance(merged.community.goodbye.appearance);
  cleanLegacyAppearance(merged.community.telloyn.appearance);
  cleanLegacyAppearance(merged.community.instagram.appearance);
  for (const panel of merged.community.tickets.panels) {
    cleanLegacyAppearance(panel.external);
    cleanLegacyAppearance(panel.internal);
  }

  for (const event of LOG_EVENTS) merged.logs.events[event] = { ...defaultLogEvent(), ...merged.logs.events[event] };
  for (const command of COMMAND_NAMES) {
    merged.commands.aliases[command] = Array.isArray(merged.commands.aliases[command]) ? merged.commands.aliases[command]!.slice(0, 10) : [];
    merged.commands.permissions[command] = { ...defaultCommandPermission(), ...merged.commands.permissions[command] };
  }
  for (const module of PROTECTION_MODULES) {
    const fallback = defaultProtection(module);
    merged.protections[module] = {
      ...fallback,
      ...merged.protections[module],
      punishment: { ...fallback.punishment, ...merged.protections[module]?.punishment }
    };
  }

  for (const ticket of Object.values(merged.community.tickets.openTickets)) {
    ticket.answers ??= {};
    ticket.priority ??= 'normal';
    ticket.lastActivityAt ??= ticket.createdAt;
    ticket.autoClosePaused ??= false;
  }
  for (const submission of Object.values(merged.community.forms.submissions)) {
    submission.reviewChannelId ??= null;
    submission.reviewMessageId ??= null;
  }

  merged.community.tickets.maximumPanels = 10;
  merged.community.rolePanels.maximumPanels = 10;
  merged.community.forms.maximumForms = 10;
  if ((raw.schemaVersion ?? 0) < 5 && merged.panel.sessionTimeoutSeconds <= 300) merged.panel.sessionTimeoutSeconds = 900;
  if ((raw.schemaVersion ?? 0) < 6 && merged.panel.sessionTimeoutSeconds < 1800) merged.panel.sessionTimeoutSeconds = 1800;
  merged.community.autoClean.maximumRules = 10;
  merged.schemaVersion = 13;
  merged.updatedAt = new Date().toISOString();
  return merged;
}

const store = new JsonStore<GuildConfig>(id => path.resolve('data', 'guilds', `${id}.json`), createDefaultGuildConfig, migrate);

export const guildConfigStore = {
  get: (id: string) => store.get(id),
  set: (id: string, value: GuildConfig) => store.set(id, { ...value, updatedAt: new Date().toISOString() }),
  update: (id: string, fn: (value: GuildConfig) => GuildConfig | Promise<GuildConfig>) =>
    store.update(id, async value => ({ ...(await fn(value)), updatedAt: new Date().toISOString() }))
};
