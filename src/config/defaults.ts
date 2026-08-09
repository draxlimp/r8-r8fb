import type {
  ApplicationFormConfig,
  CommandPermissionConfig,
  GuildConfig,
  LogEventConfig,
  MessageAppearance,
  ProtectionConfig,
  RolePanelConfig,
  TicketAppearance
} from '../types/guildConfig';
import { UI_EMOJIS } from '../ui/emojis';

export const SECURITY_LOG_EVENTS = [
  'anti_link','anti_invite','anti_spam','anti_flood','anti_caps','anti_mass_mention','anti_repeated_message','anti_blocked_words','anti_blocked_domain','anti_phishing','anti_forbidden_file','anti_invisible_character','anti_advertising',
  'new_account','suspicious_join','raid_detected','channel_restore','channel_restore_failure','role_restore','role_restore_failure','dangerous_permission_add','administrator_granted','unauthorized_bot',
  'protection_enable','protection_disable','bypass_add','bypass_remove','quarantine_add','quarantine_remove'
] as const;

export const COMMUNITY_LOG_EVENTS = [
  'member_join','member_leave','welcome_sent','welcome_failed','goodbye_sent','goodbye_failed','autorole_applied','autorole_failed',
  'suggestion_created','suggestion_approved','suggestion_rejected','ship_used','fun_canvas_used','telloyn_sent','telloyn_anonymous_sent','telloyn_failed','instagram_post_created','instagram_post_liked','instagram_post_commented','instagram_post_deleted','instagram_post_rejected','twitter_post_created','twitter_post_rejected','auto_clean_deleted','auto_clean_failed','role_panel_published','self_role_update','form_published','form_submitted','form_approved','form_rejected','custom_command_used','mass_role_add','mass_role_remove','mass_role_clear','cl_used','cl_failed','afk_set','afk_removed','reputation_given'
] as const;

export const MODERATION_LOG_EVENTS = [
  'member_ban','member_unban','member_kick','timeout_add','timeout_remove','member_warn','warning_remove','message_clear','channel_lock','channel_unlock','channel_nuke','slowmode_update','nickname_update','member_role_add','member_role_remove','groles_opened'
] as const;

export const TICKET_LOG_EVENTS = [
  'ticket_panel_published','ticket_opened','ticket_claimed','ticket_unclaimed','ticket_member_added','ticket_member_removed','ticket_call_created','ticket_transferred','ticket_priority','ticket_renamed','ticket_closed','ticket_reopened','ticket_deleted','ticket_transcript','ticket_rating'
] as const;

export const VOICE_LOG_EVENTS = [
  'voice_join','voice_leave','voice_move','voice_disconnect','voice_mute','voice_unmute','voice_deaf','voice_undeaf','voice_stream_start','voice_stream_stop','mass_voice_move','mass_voice_disconnect','temporary_voice_create','temporary_voice_delete'
] as const;

export const SERVER_LOG_EVENTS = [
  'message_delete','message_update','bulk_message_delete','bot_add','bot_remove','channel_create','channel_delete','channel_update','channel_move','channel_permissions_update','category_create','category_delete','category_update','thread_create','thread_update','thread_delete',
  'role_create','role_delete','role_update','role_move','roles_removed','quarantine_role_add','guild_name_update','guild_icon_update','guild_banner_update','guild_description_update','verification_level_update','community_update','official_channels_update','security_update','automod_create','automod_update','automod_delete',
  'webhook_create','webhook_update','webhook_delete','integration_create','integration_delete','application_add','emoji_create','emoji_update','emoji_delete','sticker_create','sticker_update','sticker_delete','sound_create','sound_update','sound_delete','invite_create','invite_delete'
] as const;

export const SYSTEM_LOG_EVENTS = [
  'bot_start','reconnect','internal_error','api_error','rate_limit','missing_permission','config_update','panel_open','access_denied','session_expired','backup_create','restore_execute','restore_failure','command_denied','command_error'
] as const;

export const LOG_CATEGORIES = {
  security: SECURITY_LOG_EVENTS,
  community: COMMUNITY_LOG_EVENTS,
  moderation: MODERATION_LOG_EVENTS,
  tickets: TICKET_LOG_EVENTS,
  voice: VOICE_LOG_EVENTS,
  server: SERVER_LOG_EVENTS,
  system: SYSTEM_LOG_EVENTS
} as const;

export const LOG_EVENTS = [
  ...SECURITY_LOG_EVENTS,
  ...COMMUNITY_LOG_EVENTS,
  ...MODERATION_LOG_EVENTS,
  ...TICKET_LOG_EVENTS,
  ...VOICE_LOG_EVENTS,
  ...SERVER_LOG_EVENTS,
  ...SYSTEM_LOG_EVENTS
] as const;

export const COMMAND_NAMES = [
  'help','ban','softban','tempban','unban','kick','mute','unmute','timeout','untimeout','warn','warnings','unwarn','history','stafflog','staffstats','modtop','activepunishments','reason',
  'clear','purgeuser','purgebots','purgelinks','purgeattachments','purgementions','purgecontains','cl','lock','unlock','nuke','slowmode','nick','addrole','removerole','groles',
  'voicemute','voiceunmute','voicedeafen','move','voicelock','voiceunlock','voiceinfo','security','raidmode','risk','webhookcheck','quarantine','unquarantine',
  'ticket','ticketadd','ticketremove','ticketclaim','ticketunclaim','ticketclose','ticketreopen','ticketdelete','ticketrename','ticketpriority','tickettransfer','ticketpause','ticketresume','ticketinfo','tickettranscript','tickets','ticketsearch','ticketblock','ticketunblock',
  'temprole','roleexpires','rolebackup',
  'avatar','banner','serverbanner','serveravatar','bots','serveradmins','membersearch','rolecount','userinfo','serverinfo','roleinfo','channelinfo','botinfo','ping','uptime','icon','permissions','membercount','boostinfo','boosters','inviteinfo','joined','created','mutualroles','invitecount','topvoice','activity','emojiinfo','roles','inrole','randommember','calc','timestamp','joinposition','memberroles','rolecompare','voicewho','serversecurity','stafflist','permissionshere','serveremojis','serverstickers','snowflake','countdown','massmove','disconnectvoice',
  'suggest','announce','afk','poll','ship','wanted','jail','profilecard','quote','blur','pixelate','grayscale','invert','achievement','rate','highfive','pat','hug','wave','poke','applaud','rep','repinfo','reptop','topic','wouldyourather','rps','coinflip','dice','choose','eightball','say','sayembed','serverstats','serverage','oldest','newest','toproles','randomnumber','case','cases','modlogs'
] as const;

export const DEFAULT_ALIASES: Record<string, string[]> = {
  help: ['ajuda','comandos'],
  ban: ['banir'],
  softban: ['banlimpo'],
  tempban: ['bantemporario'],
  unban: ['desbanir'],
  kick: ['expulsar'],
  mute: ['silenciar'],
  unmute: ['dessilenciar'],
  timeout: ['castigo'],
  untimeout: ['removercastigo'],
  warn: ['aviso','advertir'],
  warnings: ['avisos'],
  unwarn: ['removeraviso'],
  history: ['historico'],
  stafflog: ['staff','acoes','modstaff'],
  staffstats: ['statsstaff','staffstatus'],
  modtop: ['topstaff','rankingstaff'],
  activepunishments: ['punicoesativas','ativosmod'],
  reason: ['motivo'],
  clear: ['limpar','apagar'],
  purgeuser: ['limparusuario'],
  purgebots: ['limparbots'],
  purgelinks: ['limparlinks'],
  purgeattachments: ['limparanexos'],
  purgementions: ['limparmencoes'],
  purgecontains: ['limparcontendo'],
  cl: ['limparuser'],
  lock: ['trancar'],
  unlock: ['destrancar'],
  nuke: ['resetcanal','reiniciarcanal'],
  slowmode: ['lentidao'],
  nick: ['apelido'],
  addrole: ['addcargo'],
  removerole: ['removercargo'],
  groles: ['gerenciarcargos','cargosuser'],
  voicemute: ['mutecall'],
  voiceunmute: ['unmutecall'],
  voicedeafen: ['deafcall'],
  move: ['movercall'],
  voicelock: ['trancarcall'],
  voiceunlock: ['destrancarcall'],
  voiceinfo: ['infocall'],
  security: ['seguranca'],
  raidmode: ['modoraid'],
  risk: ['risco'],
  webhookcheck: ['webhooks'],
  quarantine: ['quarentena'],
  unquarantine: ['desquarentena'],
  avatar: ['av'],
  banner: [],
  serverbanner: ['bannerserver','capaservidor'],
  serveravatar: ['avatarserver','avatarservidor'],
  bots: ['listabots','botsserver'],
  serveradmins: ['admins','administradores'],
  membersearch: ['buscarusuario','buscarmembro'],
  rolecount: ['contarcargo','quantoscargo'],
  userinfo: ['usuario'],
  serverinfo: ['servidor'],
  roleinfo: ['cargo'],
  channelinfo: ['canal'],
  botinfo: ['bot'],
  ping: ['latencia'],
  uptime: ['tempoligado'],
  icon: ['servericon'],
  permissions: ['permissoes'],
  boosters: ['boosterslista','impulsionadores'],
  emojiinfo: ['emoji','infoemoji'],
  roles: ['cargos','listacargos'],
  inrole: ['nocargo','membroscargo'],
  randommember: ['membroaleatorio','randomuser'],
  calc: ['calcular','calculadora'],
  timestamp: ['tempo','discordtime'],
  joinposition: ['posicaoentrada','joinpos'],
  memberroles: ['cargosmembro','rolesuser'],
  rolecompare: ['compararcargos','rolescompare'],
  voicewho: ['quemtanacall','membroscall'],
  serversecurity: ['segurancaservidor','servercheck'],
  stafflist: ['equipe','listastaff'],
  permissionshere: ['permissaocanal','permsaqui'],
  serveremojis: ['emojisserver','listaemojis'],
  serverstickers: ['stickersserver','listastickers'],
  snowflake: ['idinfo','discordid'],
  countdown: ['contagem','contagemregressiva'],
  massmove: ['movercalltodos','movetodos'],
  disconnectvoice: ['desconectarcall','dcvoice'],
  suggest: ['sugerir','sugestao'],
  announce: ['anunciar'],
  afk: ['ausente'],
  poll: ['enquete'],
  ship: ['casal','compatibilidade'],
  wanted: ['procurado'],
  jail: ['prisao','preso'],
  profilecard: ['perfilcard','cardperfil'],
  quote: ['citar','citacao'],
  blur: ['desfocar'],
  pixelate: ['pixelar'],
  grayscale: ['cinza','pretoebranco'],
  invert: ['invertercores'],
  achievement: ['conquista'],
  rate: ['avaliar','nota'],
  highfive: ['tocaqui'],
  pat: ['carinho','cafune'],
  hug: ['abraco','abracar'],
  wave: ['acenar','oi'],
  poke: ['cutucar'],
  applaud: ['aplaudir','palmas'],
  rep: ['reputar','darrep'],
  repinfo: ['reputacao','reps'],
  reptop: ['toprep','rankingrep'],
  topic: ['assunto','papo'],
  wouldyourather: ['escolheria','issoouaquilo'],
  rps: ['jokenpo','pedrapapeltesoura'],
  coinflip: ['moeda','caraoucoroa'],
  dice: ['dado','rolardado'],
  choose: ['escolher','escolha'],
  eightball: ['8ball','bola8'],
  say: ['falar'],
  sayembed: ['embed','falarembed'],
  serverstats: ['stats','estatisticas'],
  serverage: ['idadeserver','idadeservidor'],
  oldest: ['maisantigo','contamaisantiga'],
  newest: ['maisnovo','contamaisnova'],
  toproles: ['topcargos','cargosmaisusados'],
  randomnumber: ['numeroaleatorio','numero'],
  case: ['caso'],
  cases: ['casos'],
  modlogs: ['logsmod'],
  ticket: ['meustickets'],
  ticketadd: ['addticket'],
  ticketremove: ['removeticket'],
  ticketclaim: ['assumirticket'],
  ticketunclaim: ['liberarticket'],
  ticketclose: ['fecharticket'],
  ticketreopen: ['reabrirticket'],
  ticketdelete: ['excluirticket'],
  ticketrename: ['renomearticket'],
  ticketpriority: ['prioridadeticket'],
  tickettransfer: ['transferirticket'],
  ticketpause: ['pausarticket'],
  ticketresume: ['retomarticket'],
  ticketinfo: ['infoticket'],
  tickettranscript: ['transcriptticket'],
  tickets: ['ticketsuser'],
  ticketsearch: ['buscarticket'],
  ticketblock: ['bloquearticket'],
  ticketunblock: ['desbloquearticket'],
  temprole: ['cargotemporario'],
  roleexpires: ['cargosexpiram'],
  rolebackup: ['backupcargos'],
  membercount: ['membros'],
  boostinfo: ['boosts'],
  inviteinfo: ['convite'],
  joined: ['entrou'],
  created: ['criado'],
  mutualroles: ['cargosemcomum'],
  invitecount: ['convites'],
  topvoice: ['topvoz'],
  activity: ['atividade']
};

export const PROTECTION_MODULES = [
  'anti_link','anti_invite','anti_spam','anti_flood','anti_caps','anti_mass_mention','anti_repeated_message','anti_blocked_words','anti_blocked_domain','anti_phishing','anti_forbidden_file','anti_invisible_character','anti_advertising',
  'anti_new_account','anti_mass_join','raid_mode','anti_channel_delete','anti_channel_create','anti_channel_update','anti_channel_move','anti_channel_permissions','anti_category_delete','anti_category_create','anti_category_update','anti_private_channel','anti_nsfw_update','anti_slowmode_update','anti_thread_delete',
  'anti_role_delete','anti_role_create','anti_role_update','anti_role_move','anti_administrator_role','anti_manage_guild_role','anti_manage_channels_role','anti_manage_roles_role','anti_manage_webhooks_role','anti_ban_permission_role','anti_kick_permission_role','anti_moderate_permission_role','anti_dangerous_role_assignment','anti_protected_role_removal',
  'anti_mass_ban','anti_mass_kick','anti_mass_timeout','anti_mass_role_remove','anti_mass_role_add','anti_mass_voice_move','anti_mass_voice_disconnect','anti_mass_nickname',
  'anti_guild_name','anti_guild_icon','anti_guild_banner','anti_guild_description','anti_community_update','anti_verification_update','anti_content_filter_update','anti_official_channels_update','anti_automod_delete','anti_automod_update','anti_event_delete','anti_emoji_delete','anti_sticker_delete','anti_sound_delete',
  'anti_webhook','anti_mass_webhook','anti_unauthorized_bot','anti_suspicious_integration','anti_unauthorized_application'
] as const;

function defaultPunishment(): ProtectionConfig['punishment'] {
  return { type: 'log', timeoutSeconds: 600, reason: 'Proteção automática do servidor', dmMessage: 'Sua ação ativou uma proteção automática.', deleteMessageSeconds: 0, continueOnFailure: true, retries: 1, retryDelayMs: 500, sequence: ['remove_dangerous_roles','quarantine','log'] };
}

export function defaultProtection(module: string): ProtectionConfig {
  const isMessage = ['anti_link','anti_invite','anti_spam','anti_flood','anti_caps','anti_mass_mention','anti_repeated_message','anti_blocked_words','anti_blocked_domain','anti_phishing','anti_forbidden_file','anti_invisible_character','anti_advertising'].includes(module);
  return {
    mode: 'disabled', detectUsers: true, detectBots: true, ignoreOwner: true,
    quantity: module === 'anti_mass_join' ? 8 : 3, intervalSeconds: module === 'anti_mass_join' ? 10 : 15, resetSeconds: 60, sensitivity: 'medium',
    punishment: { ...defaultPunishment(), type: isMessage ? 'timeout' : 'remove_dangerous_roles' },
    restore: !isMessage, logEvent: module.replace(/^anti_new_account$/, 'new_account').replace(/^anti_mass_join$/, 'raid_detected'),
    ignoredChannels: [], ignoredCategories: [], ignoredRoles: [], allowedDomains: [], blockedDomains: [], blockedWords: [], blockedExtensions: ['exe','scr','bat','cmd','ps1','jar'], minimumAccountAgeSeconds: 86400
  };
}

export function defaultLogEvent(): LogEventConfig {
  return { mode: 'default', channelId: null, secondaryChannelId: null, mentionRoleId: null, criticalOnlyMention: true, minimumSeverity: 'info', includeBypass: true, includeFailures: true, includeRestorations: true, showContent: false, showIds: true, showAudit: true, groupRepeated: false, groupWindowSeconds: 10 };
}

export function defaultMessageAppearance(kind: 'welcome' | 'goodbye'): MessageAppearance {
  return {
    title: kind === 'welcome' ? 'Bem-vindo ao [guild.name]' : '[user.name] saiu do servidor',
    description: kind === 'welcome'
      ? 'Olá [user.mention], você é o membro **[guild.member_count]**. Leia as regras e aproveite a comunidade.'
      : '**[user.name]** deixou **[guild.name]** depois de [member.stay].',
    color: '#111111',
    imageUrl: null,
    thumbnailUrl: '[user.avatar]',
    footer: '',
    separator: '',
    showSeparator: true,
    authorName: ''
  };
}

export function defaultTicketAppearance(kind: 'external' | 'internal'): TicketAppearance {
  return {
    title: kind === 'external' ? 'Central de atendimento' : 'Atendimento [ticket.number]',
    description: kind === 'external'
      ? 'Selecione o botão abaixo para abrir um atendimento com a equipe de **[guild.name]**.'
      : 'Olá [user.mention]. Explique com detalhes o que precisa e aguarde a equipe responsável por **[panel.name]**.',
    color: '#111111',
    imageUrl: null,
    thumbnailUrl: null,
    footer: '',
    separator: '',
    showSeparator: true,
    authorName: '',
    buttonLabel: kind === 'external' ? 'Abrir ticket' : 'Atendimento',
    buttonStyle: 'primary',
    buttonEmoji: null
  };
}

export function defaultTelloynAppearance(): TicketAppearance {
  return {
    title: 'Telloyn',
    description: 'Envie uma mensagem pública ou anônima para a comunidade de **[guild.name]**.',
    color: '#111111',
    imageUrl: null,
    thumbnailUrl: null,
    footer: '',
    separator: '',
    showSeparator: true,
    authorName: '',
    buttonLabel: 'Enviar Telloyn',
    buttonStyle: 'primary',
    buttonEmoji: null
  };
}

export function defaultInstagramAppearance(): MessageAppearance {
  return {
    title: 'Instagram',
    description: '',
    color: '#111111',
    imageUrl: null,
    thumbnailUrl: null,
    footer: '',
    separator: '',
    showSeparator: true,
    authorName: ''
  };
}

export function defaultRolePanel(createdBy = 'system', position = 1): RolePanelConfig {
  const now = new Date().toISOString();
  return {
    id: `RP-${position}`,
    name: `Cargos ${position}`,
    enabled: true,
    publishChannelId: null,
    publishMessageId: null,
    title: 'Escolha seus cargos',
    description: 'Selecione abaixo os cargos que deseja receber ou remover.',
    color: '#111111',
    placeholder: 'Selecione seus cargos',
    minimumSelections: 0,
    maximumSelections: 1,
    exclusive: false,
    requiredRoleIds: [],
    blockedRoleIds: [],
    options: [],
    createdBy,
    createdAt: now,
    updatedAt: now
  };
}

export function defaultApplicationForm(createdBy = 'system', position = 1): ApplicationFormConfig {
  const now = new Date().toISOString();
  return {
    id: `FM-${position}`,
    name: `Formulário ${position}`,
    enabled: true,
    publishChannelId: null,
    publishMessageId: null,
    reviewChannelId: null,
    title: 'Inscrição',
    description: 'Clique no botão abaixo para preencher o formulário.',
    color: '#111111',
    buttonLabel: 'Preencher formulário',
    allowedRoleIds: [],
    blockedRoleIds: [],
    approvedRoleIds: [],
    questions: [
      { id: 'Q1', label: 'Por que você deseja participar?', placeholder: 'Explique com detalhes', required: true, paragraph: true }
    ],
    createdBy,
    createdAt: now,
    updatedAt: now
  };
}

export function defaultCommandPermission(): CommandPermissionConfig {
  return { enabled: true, allowedRoleIds: [], allowedUserIds: [], allowedChannelIds: [], cooldownSeconds: 3, deleteCommandMessage: false };
}

export function createDefaultGuildConfig(guildId: string): GuildConfig {
  return {
    schemaVersion: 13,
    guildId,
    updatedAt: new Date().toISOString(),
    panel: {
      title: 'R8 Community',
      description: 'Gerencie comunidade, proteção, logs e o bot.',
      color: '#111111',
      thumbnail: null,
      headerImage: null,
      footer: '',
      language: 'pt-BR',
      sessionTimeoutSeconds: 3600,
      deleteCommandMessage: true
    },
    access: { allowGuildOwner: true, allowAdministrators: true, ownersOnly: false, allowedUsers: [], allowedRoles: [], blockedUsers: [], blockedRoles: [], allowedChannels: [], blockedChannels: [], history: [] },
    commands: {
      aliases: Object.fromEntries(Object.entries(DEFAULT_ALIASES).map(([name, aliases]) => [name, [...aliases]])),
      permissions: Object.fromEntries(COMMAND_NAMES.map(name => [name, defaultCommandPermission()])),
      disabled: []
    },
    moderation: { nextCaseNumber: 1, cases: [], warnings: [], temporaryBans: [] },
    logs: { defaultChannelId: null, events: Object.fromEntries(LOG_EVENTS.map(event => [event, defaultLogEvent()])), lastSentAt: null, failures: [] },
    bypasses: [],
    trustedBots: [],
    protections: Object.fromEntries(PROTECTION_MODULES.map(module => [module, defaultProtection(module)])),
    community: {
      cl: { enabled: true, allowedRoleIds: [], allowManageMessages: true, deleteCommandMessage: true, scanLimit: 5000 },
      tickets: { maximumPanels: 10, nextTicketNumber: 1, panels: [], openTickets: {} },
      welcome: { enabled: false, channelId: null, sendDirectMessage: false, deleteAfterSeconds: 0, appearance: defaultMessageAppearance('welcome') },
      goodbye: { enabled: false, channelId: null, deleteAfterSeconds: 0, appearance: defaultMessageAppearance('goodbye') },
      suggestions: { enabled: false, channelId: null, reviewChannelId: null, createThread: true, allowAnonymous: false },
      telloyn: { enabled: false, channelId: null, publishMessageId: null, logChannelId: null, allowAnonymous: true, allowPublic: true, allowMentions: true, maximumMessageLength: 1200, appearance: defaultTelloynAppearance() },
      instagram: {
        enabled: false, channelId: null, allowedRoleId: null, logChannelId: null,
        deleteUnauthorizedMessages: true, requireAttachment: true, allowImages: true, allowVideos: true,
        maximumCaptionLength: 1800, maximumCommentsPerPost: 100, appearance: defaultInstagramAppearance(),
        emojis: { like: UI_EMOJIS.heart, comment: UI_EMOJIS.topic, details: UI_EMOJIS.more, delete: UI_EMOJIS.trash },
        posts: {}
      },
      twitter: {
        enabled: false,
        channelId: null,
        logChannelId: null,
        deleteOriginalMessage: true,
        allowAttachments: true,
        maximumMessageLength: 1800,
        webhookName: 'X'
      },
      autoClean: {
        maximumRules: 10,
        rules: []
      },
      temporaryVoice: { enabled: false, creatorChannelId: null, categoryId: null, namePattern: 'Sala de [user.name]', defaultUserLimit: 0, createdChannels: {} },
      rolePanels: { maximumPanels: 10, panels: [] },
      forms: { maximumForms: 10, forms: [], submissions: {} },
      afkUsers: {},
      reputation: { scores: {}, lastGivenAt: {} },
      temporaryRoles: [],
      roleBackups: [],
      voiceActivity: { enabled: false, channelId: null, messageId: null, updateSeconds: 10, totalsSeconds: {}, activeSince: {} },
      inviteJoins: {},
      autorole: { memberRoleIds: [], botRoleIds: [], everyoneRoleIds: [] },
      massRoles: { allowedRoleIds: [], allowAdministrators: true, batchDelayMs: 250 }
    },
    quarantine: { roleId: null, createAutomatically: true, restorePreviousRoles: true, protectedRoles: [], active: {} },
    raid: { state: 'automatic', joinCount: 8, intervalSeconds: 10, durationSeconds: 900, activeUntil: null },
    backups: { automatic: true, beforeChanges: true, retention: 20, lastBackupAt: null },
    snapshots: { enabled: true, refreshMinutes: 10, lastRefreshAt: null },
    history: []
  };
}
