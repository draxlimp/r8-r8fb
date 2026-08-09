export type ModuleMode = 'disabled' | 'enabled' | 'monitor' | 'test';
export type PunishmentType = 'none' | 'log' | 'warn' | 'dm' | 'timeout' | 'quarantine' | 'remove_dangerous_roles' | 'remove_roles' | 'kick' | 'ban' | 'sequence';
export type LogMode = 'default' | 'specific' | 'disabled';
export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical' | 'emergency';

export interface PunishmentConfig {
  type: PunishmentType;
  timeoutSeconds: number;
  reason: string;
  dmMessage: string;
  deleteMessageSeconds: number;
  continueOnFailure: boolean;
  retries: number;
  retryDelayMs: number;
  sequence: PunishmentType[];
}

export interface ProtectionConfig {
  mode: ModuleMode;
  detectUsers: boolean;
  detectBots: boolean;
  ignoreOwner: boolean;
  quantity: number;
  intervalSeconds: number;
  resetSeconds: number;
  sensitivity: 'low' | 'medium' | 'high';
  punishment: PunishmentConfig;
  restore: boolean;
  logEvent: string;
  ignoredChannels: string[];
  ignoredCategories: string[];
  ignoredRoles: string[];
  allowedDomains: string[];
  blockedDomains: string[];
  blockedWords: string[];
  blockedExtensions: string[];
  minimumAccountAgeSeconds: number;
}

export interface LogEventConfig {
  mode: LogMode;
  channelId: string | null;
  secondaryChannelId: string | null;
  mentionRoleId: string | null;
  criticalOnlyMention: boolean;
  minimumSeverity: Severity;
  includeBypass: boolean;
  includeFailures: boolean;
  includeRestorations: boolean;
  showContent: boolean;
  showIds: boolean;
  showAudit: boolean;
  groupRepeated: boolean;
  groupWindowSeconds: number;
}

export interface BypassBehavior {
  ignoreDetection: boolean;
  ignorePunishment: boolean;
  ignoreRestoration: boolean;
  ignoreLimit: boolean;
  continueLogging: boolean;
}

export interface BypassEntry {
  id: string;
  kind: 'user' | 'role' | 'bot' | 'channel' | 'category';
  targetId: string;
  modules: string[];
  behavior: BypassBehavior;
  reason: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface MessageAppearance {
  title: string;
  description: string;
  color: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  footer: string;
  separator: string;
  showSeparator: boolean;
  authorName: string;
}

export interface TicketAppearance extends MessageAppearance {
  buttonLabel: string;
  buttonStyle: 'primary' | 'secondary' | 'success' | 'danger';
  buttonEmoji: string | null;
}

export interface TicketQuestion {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
  paragraph: boolean;
}

export interface TicketPanelConfig {
  id: string;
  name: string;
  enabled: boolean;
  categoryId: string | null;
  publishChannelId: string | null;
  publishMessageId: string | null;
  creationMode: 'channel' | 'thread';
  openComponent: 'button' | 'select';
  threadParentChannelId: string | null;
  supportRoleIds: string[];
  allowedRoleIds: string[];
  blockedRoleIds: string[];
  blockedUserIds: string[];
  maxOpenPerUser: number;
  logChannelId: string | null;
  transcriptChannelId: string | null;
  ticketNamePattern: string;
  external: TicketAppearance;
  internal: TicketAppearance;
  questions: TicketQuestion[];
  autoCloseMinutes: number;
  allowReopen: boolean;
  ratingEnabled: boolean;
  businessHoursEnabled: boolean;
  businessHoursText: string;
  internalButtons: {
    claim: boolean;
    unclaim: boolean;
    close: boolean;
    reopen: boolean;
    delete: boolean;
    addMember: boolean;
    removeMember: boolean;
    createVoice: boolean;
    transfer: boolean;
    priority: boolean;
    rename: boolean;
    transcript: boolean;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpenTicketRecord {
  id: string;
  panelId: string;
  channelId: string;
  ownerId: string;
  claimedBy: string | null;
  voiceChannelId: string | null;
  addedMemberIds: string[];
  answers: Record<string, string>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: string;
  lastActivityAt: string;
  autoClosePaused: boolean;
  closedAt: string | null;
}

export interface WelcomeMessageConfig {
  enabled: boolean;
  channelId: string | null;
  sendDirectMessage: boolean;
  deleteAfterSeconds: number;
  appearance: MessageAppearance;
}

export interface GoodbyeMessageConfig {
  enabled: boolean;
  channelId: string | null;
  deleteAfterSeconds: number;
  appearance: MessageAppearance;
}


export interface TelloynConfig {
  enabled: boolean;
  channelId: string | null;
  publishMessageId: string | null;
  logChannelId: string | null;
  allowAnonymous: boolean;
  allowPublic: boolean;
  allowMentions: boolean;
  maximumMessageLength: number;
  appearance: TicketAppearance;
}


export interface InstagramEmojiConfig {
  like: string | null;
  comment: string | null;
  details: string | null;
  delete: string | null;
}

export interface InstagramCommentRecord {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface InstagramPostRecord {
  id: string;
  messageId: string;
  channelId: string;
  authorId: string;
  caption: string;
  attachmentUrl: string;
  attachmentName: string;
  mediaType: 'image' | 'video';
  likes: string[];
  comments: InstagramCommentRecord[];
  createdAt: string;
}

export interface InstagramConfig {
  enabled: boolean;
  channelId: string | null;
  allowedRoleId: string | null;
  logChannelId: string | null;
  deleteUnauthorizedMessages: boolean;
  requireAttachment: boolean;
  allowImages: boolean;
  allowVideos: boolean;
  maximumCaptionLength: number;
  maximumCommentsPerPost: number;
  appearance: MessageAppearance;
  emojis: InstagramEmojiConfig;
  posts: Record<string, InstagramPostRecord>;
}


export type AutoCleanMode = 'all' | 'images' | 'text' | 'links';

export interface TwitterConfig {
  enabled: boolean;
  channelId: string | null;
  logChannelId: string | null;
  deleteOriginalMessage: boolean;
  allowAttachments: boolean;
  maximumMessageLength: number;
  webhookName: string;
}

export interface AutoCleanRule {
  id: string;
  name: string;
  enabled: boolean;
  channelId: string | null;
  mode: AutoCleanMode;
  delaySeconds: number;
  includeBots: boolean;
  includeWebhooks: boolean;
  ignorePinned: boolean;
  logDeletions: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutoCleanConfig {
  maximumRules: number;
  rules: AutoCleanRule[];
}

export interface SuggestionConfig {
  enabled: boolean;
  channelId: string | null;
  reviewChannelId: string | null;
  createThread: boolean;
  allowAnonymous: boolean;
}

export interface TemporaryVoiceConfig {
  enabled: boolean;
  creatorChannelId: string | null;
  categoryId: string | null;
  namePattern: string;
  defaultUserLimit: number;
  createdChannels: Record<string, { ownerId: string; createdAt: string }>;
}

export interface ModerationCase {
  id: string;
  action: string;
  targetId: string;
  moderatorId: string;
  reason: string;
  durationSeconds: number | null;
  createdAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
  source?: 'command' | 'discord';
}

export interface TemporaryBanRecord {
  userId: string;
  moderatorId: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
}

export interface TemporaryRoleRecord {
  id: string;
  userId: string;
  roleId: string;
  moderatorId: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
}

export interface RoleBackupRecord {
  id: string;
  createdBy: string;
  createdAt: string;
  roles: Array<{
    originalId: string;
    name: string;
    color: number;
    hoist: boolean;
    position: number;
    permissions: string;
    mentionable: boolean;
    unicodeEmoji: string | null;
  }>;
}

export interface VoiceActivityConfig {
  enabled: boolean;
  channelId: string | null;
  messageId: string | null;
  updateSeconds: number;
  totalsSeconds: Record<string, number>;
  activeSince: Record<string, string>;
}

export interface WarningRecord {
  id: string;
  userId: string;
  moderatorId: string;
  reason: string;
  createdAt: string;
  removedAt: string | null;
  removedBy: string | null;
}

export interface CommandPermissionConfig {
  enabled: boolean;
  allowedRoleIds: string[];
  allowedUserIds: string[];
  allowedChannelIds: string[];
  cooldownSeconds: number;
  deleteCommandMessage: boolean;
}

export interface RolePanelOption {
  roleId: string;
  label: string;
  description: string;
  emoji: string | null;
}

export interface RolePanelConfig {
  id: string;
  name: string;
  enabled: boolean;
  publishChannelId: string | null;
  publishMessageId: string | null;
  title: string;
  description: string;
  color: string;
  placeholder: string;
  minimumSelections: number;
  maximumSelections: number;
  exclusive: boolean;
  requiredRoleIds: string[];
  blockedRoleIds: string[];
  options: RolePanelOption[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationQuestion {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
  paragraph: boolean;
}

export interface ApplicationFormConfig {
  id: string;
  name: string;
  enabled: boolean;
  publishChannelId: string | null;
  publishMessageId: string | null;
  reviewChannelId: string | null;
  title: string;
  description: string;
  color: string;
  buttonLabel: string;
  allowedRoleIds: string[];
  blockedRoleIds: string[];
  approvedRoleIds: string[];
  questions: ApplicationQuestion[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationSubmission {
  id: string;
  formId: string;
  userId: string;
  answers: Record<string, string>;
  status: 'pending' | 'approved' | 'rejected';
  reviewerId: string | null;
  reviewReason: string | null;
  reviewChannelId: string | null;
  reviewMessageId: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface AfkRecord {
  reason: string;
  since: string;
}

export interface ReputationConfig {
  scores: Record<string, number>;
  lastGivenAt: Record<string, string>;
}

export interface CommunityConfig {
  cl: {
    enabled: boolean;
    allowedRoleIds: string[];
    allowManageMessages: boolean;
    deleteCommandMessage: boolean;
    scanLimit: number;
  };
  tickets: {
    maximumPanels: number;
    nextTicketNumber: number;
    panels: TicketPanelConfig[];
    openTickets: Record<string, OpenTicketRecord>;
  };
  welcome: WelcomeMessageConfig;
  goodbye: GoodbyeMessageConfig;
  suggestions: SuggestionConfig;
  telloyn: TelloynConfig;
  instagram: InstagramConfig;
  twitter: TwitterConfig;
  autoClean: AutoCleanConfig;
  temporaryVoice: TemporaryVoiceConfig;
  rolePanels: {
    maximumPanels: number;
    panels: RolePanelConfig[];
  };
  forms: {
    maximumForms: number;
    forms: ApplicationFormConfig[];
    submissions: Record<string, ApplicationSubmission>;
  };
  afkUsers: Record<string, AfkRecord>;
  reputation: ReputationConfig;
  autorole: {
    memberRoleIds: string[];
    botRoleIds: string[];
    everyoneRoleIds: string[];
  };
  temporaryRoles: TemporaryRoleRecord[];
  roleBackups: RoleBackupRecord[];
  voiceActivity: VoiceActivityConfig;
  inviteJoins: Record<string, number>;
  massRoles: {
    allowedRoleIds: string[];
    allowAdministrators: boolean;
    batchDelayMs: number;
  };
}

export interface GuildConfig {
  schemaVersion: number;
  guildId: string;
  updatedAt: string;
  panel: {
    title: string;
    description: string;
    color: string;
    thumbnail: string | null;
    headerImage: string | null;
    footer: string;
    language: 'pt-BR';
    sessionTimeoutSeconds: number;
    deleteCommandMessage: boolean;
  };
  access: {
    allowGuildOwner: boolean;
    allowAdministrators: boolean;
    ownersOnly: boolean;
    allowedUsers: string[];
    allowedRoles: string[];
    blockedUsers: string[];
    blockedRoles: string[];
    allowedChannels: string[];
    blockedChannels: string[];
    history: Array<{ at: string; by: string; action: string }>;
  };
  commands: {
    aliases: Record<string, string[]>;
    permissions: Record<string, CommandPermissionConfig>;
    disabled: string[];
  };
  moderation: {
    nextCaseNumber: number;
    cases: ModerationCase[];
    warnings: WarningRecord[];
    temporaryBans: TemporaryBanRecord[];
  };
  logs: {
    defaultChannelId: string | null;
    events: Record<string, LogEventConfig>;
    lastSentAt: string | null;
    failures: Array<{ at: string; event: string; reason: string }>;
  };
  bypasses: BypassEntry[];
  trustedBots: string[];
  protections: Record<string, ProtectionConfig>;
  community: CommunityConfig;
  quarantine: {
    roleId: string | null;
    createAutomatically: boolean;
    restorePreviousRoles: boolean;
    protectedRoles: string[];
    active: Record<string, { previousRoles: string[]; expiresAt: string | null; incidentId: string }>;
  };
  raid: {
    state: 'disabled' | 'automatic' | 'manual' | 'emergency';
    joinCount: number;
    intervalSeconds: number;
    durationSeconds: number;
    activeUntil: string | null;
  };
  backups: {
    automatic: boolean;
    beforeChanges: boolean;
    retention: number;
    lastBackupAt: string | null;
  };
  snapshots: { enabled: boolean; refreshMinutes: number; lastRefreshAt: string | null };
  history: Array<{ at: string; by: string; action: string; details?: string }>;
}
