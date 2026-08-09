import type { Client } from 'discord.js';
import type { AppConfig } from '../types/config';
import { handleClearCommand } from './clService';
import { applyAutoroles, executeMassRoleOperation, type MassRoleOperation, type MassRoleResult } from './roleService';
import { TicketService } from '../tickets/ticketService';
import type { ApplicationFormConfig, GuildConfig, RolePanelConfig, TicketPanelConfig } from '../types/guildConfig';
import { CommandManager } from '../commands/commandManager';
import { sendGoodbye, sendWelcome } from './messageService';
import { handleTemporaryVoice } from './temporaryVoiceService';
import { RolePanelService } from './rolePanelService';
import { ApplicationService } from './applicationService';
import { TelloynService } from './telloynService';
import { InstagramService } from './instagramService';
import { ActivityService } from './activityService';
import { RoleBackupService } from './roleBackupService';
import { TwitterService } from './twitterService';
import { AutoCleanService } from './autoCleanService';
import { ModerationTracker } from './moderationTracker';

export class CommunityManager {
  readonly tickets: TicketService;
  readonly commands: CommandManager;
  readonly rolePanels: RolePanelService;
  readonly forms: ApplicationService;
  readonly telloyn: TelloynService;
  readonly instagram: InstagramService;
  readonly activity: ActivityService;
  readonly roleBackups: RoleBackupService;
  readonly twitter: TwitterService;
  readonly autoClean: AutoCleanService;
  readonly moderationTracker: ModerationTracker;

  constructor(private readonly client: Client, private readonly app: AppConfig) {
    this.tickets = new TicketService(app);
    this.activity = new ActivityService();
    this.roleBackups = new RoleBackupService();
    this.commands = new CommandManager(app, this.tickets, this.activity, this.roleBackups);
    this.rolePanels = new RolePanelService();
    this.forms = new ApplicationService();
    this.telloyn = new TelloynService();
    this.instagram = new InstagramService();
    this.twitter = new TwitterService();
    this.autoClean = new AutoCleanService();
    this.moderationTracker = new ModerationTracker();
  }

  async handleMessage(message: any): Promise<boolean> {
    await this.tickets.trackMessage(message);
    if (await this.instagram.handleMessage(message)) return true;
    if (await this.twitter.handleMessage(message)) return true;
    await this.autoClean.handleMessage(message);
    if (await handleClearCommand(message, this.app)) return true;
    return this.commands.handleMessage(message);
  }

  async handleInteraction(interaction: any): Promise<boolean> {
    if (await this.tickets.handleInteraction(interaction)) return true;
    if (await this.rolePanels.handleInteraction(interaction)) return true;
    if (await this.forms.handleInteraction(interaction)) return true;
    if (await this.telloyn.handleInteraction(interaction)) return true;
    if (await this.instagram.handleInteraction(interaction)) return true;
    if (await this.roleBackups.handleInteraction(interaction)) return true;
    return this.commands.handleInteraction(interaction);
  }

  async handleMemberAdd(member: any): Promise<void> {
    await this.activity.handleMemberAdd(member);
    await applyAutoroles(member);
    await sendWelcome(member);
  }

  async handleMemberRemove(member: any): Promise<void> {
    await sendGoodbye(member);
  }


  async handleGuildBanAdd(ban:any):Promise<void>{ await this.moderationTracker.handleBanAdd(ban); }
  async handleGuildBanRemove(ban:any):Promise<void>{ await this.moderationTracker.handleBanRemove(ban); }
  async handleModerationMemberUpdate(oldMember:any,newMember:any):Promise<void>{ await this.moderationTracker.handleMemberUpdate(oldMember,newMember); }

  async handleVoiceStateUpdate(oldState: any, newState: any): Promise<void> {
    await this.activity.handleVoiceStateUpdate(oldState, newState);
    await handleTemporaryVoice(oldState, newState);
  }

  async initializeGuild(guild:any):Promise<void>{
    await this.activity.initializeGuild(guild);
  }

  async maintainGuild(guild:any):Promise<void>{
    await this.tickets.maintainGuild(guild);
    await this.activity.maintainTemporaryActions(guild);
  }

  async refreshFastGuild(guild:any):Promise<void>{
    await this.activity.refreshVoiceBoard(guild);
  }

  async publishTicketPanel(guild: any, panel: TicketPanelConfig): Promise<{ channelId: string; messageId: string }> {
    return this.tickets.publishPanel(guild, panel);
  }

  async publishRolePanel(guild: any, panel: RolePanelConfig): Promise<{ channelId: string; messageId: string }> {
    return this.rolePanels.publishPanel(guild, panel);
  }

  async publishApplicationForm(guild: any, form: ApplicationFormConfig): Promise<{ channelId: string; messageId: string }> {
    return this.forms.publishForm(guild, form);
  }


  async publishTelloynPanel(guild: any, config: GuildConfig['community']['telloyn']): Promise<{ channelId: string; messageId: string }> {
    return this.telloyn.publishPanel(guild, config);
  }

  async createRoleBackup(guild:any,actorId:string,config?:GuildConfig){ return this.roleBackups.create(guild,actorId,config); }
  async restoreLatestRoleBackup(guild:any,actorId:string,config?:GuildConfig){ return this.roleBackups.restoreLatest(guild,actorId,config); }

  async runMassRoleOperation(input: {
    guild: any;
    actor: any;
    config: GuildConfig;
    operation: MassRoleOperation;
    roleId?: string;
    onProgress?: (processed: number, total: number, changed: number, failed: number) => Promise<void>;
  }): Promise<MassRoleResult> {
    return executeMassRoleOperation(input);
  }
}
