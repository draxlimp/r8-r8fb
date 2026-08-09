import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import type { AppConfig } from '../types/config';
import type { GuildConfig, ProtectionConfig, Severity } from '../types/guildConfig';
import { guildConfigStore } from '../storage/guildConfigStore';
import { resolveBypass, pruneExpiredBypasses } from './bypassEngine';
import { createIncident, updateIncident } from './incidentManager';
import { executePunishment } from './punishmentEngine';
import { sendIncidentLog } from '../logs/logManager';
import { resolveAudit } from './auditLogResolver';
import { loadGuildSnapshot, captureGuildSnapshot } from '../snapshots/snapshotManager';
import { restoreChannel, restoreRole } from './restorationEngine';
import { thresholdEngine } from './thresholdEngine';
import { logger } from '../utils/logger';

const THRESHOLD_MESSAGE_MODULES = new Set(['anti_spam','anti_flood','anti_repeated_message']);
const DANGEROUS_PERMISSIONS: Array<[bigint,string]> = [
  [PermissionFlagsBits.Administrator,'anti_administrator_role'],
  [PermissionFlagsBits.ManageGuild,'anti_manage_guild_role'],
  [PermissionFlagsBits.ManageChannels,'anti_manage_channels_role'],
  [PermissionFlagsBits.ManageRoles,'anti_manage_roles_role'],
  [PermissionFlagsBits.ManageWebhooks,'anti_manage_webhooks_role'],
  [PermissionFlagsBits.BanMembers,'anti_ban_permission_role'],
  [PermissionFlagsBits.KickMembers,'anti_kick_permission_role'],
  [PermissionFlagsBits.ModerateMembers,'anti_moderate_permission_role']
];

export interface AdministrativeEventInput {
  guild:any;
  module:string;
  event:string;
  targetId:string;
  target:any;
  auditType:any;
  severity?:Severity;
  restoreKind?:'channel'|'role';
  details?:Record<string,unknown>;
}

export class ProtectionEngine {
  constructor(private readonly appConfig: AppConfig) {}

  async handleMessage(message:any):Promise<void> {
    if(!message.guild || message.author.bot || !message.member) return;
    const cfg=await guildConfigStore.get(message.guild.id);
    const modules=this.detectMessageModules(message,cfg.protections);
    for(const module of modules){
      const protection=cfg.protections[module];
      if(protection) await this.processMessageModule(message,module,protection);
    }
  }

  private detectMessageModules(message:any, protections:Record<string,ProtectionConfig>):string[] {
    const content=String(message.content??'');
    const lower=content.toLowerCase();
    const found:string[]=[];
    const urls=content.match(/https?:\/\/[^\s<]+/gi)??[];
    const invites=content.match(/(?:discord\.gg|discord(?:app)?\.com\/invite)\/[a-z0-9-]+/gi)??[];
    const antiLink=protections.anti_link;
    if(this.active(antiLink) && urls.some(url=>!this.isAllowedUrl(url,antiLink?.allowedDomains??[]))) found.push('anti_link');
    if(invites.length && this.active(protections.anti_invite)) found.push('anti_invite');
    if(this.active(protections.anti_spam) && (content.length>0 || message.attachments?.size>0 || message.stickers?.size>0)) found.push('anti_spam');
    if(this.active(protections.anti_flood) && (content.length>0 || message.attachments?.size>0)) found.push('anti_flood');
    if(this.active(protections.anti_repeated_message) && content.trim().length>0) found.push('anti_repeated_message');
    if(this.active(protections.anti_caps) && content.replace(/[^A-Za-z]/g,'').length>=10 && (content.match(/[A-Z]/g)?.length??0)/Math.max(1,content.match(/[A-Za-z]/g)?.length??0)>=0.75) found.push('anti_caps');
    if(this.active(protections.anti_mass_mention) && (message.mentions.users.size+message.mentions.roles.size)>=(protections.anti_mass_mention?.quantity??5)) found.push('anti_mass_mention');
    if(this.active(protections.anti_blocked_words) && (protections.anti_blocked_words?.blockedWords??[]).some(word=>word&&lower.includes(word.toLowerCase()))) found.push('anti_blocked_words');
    if(this.active(protections.anti_blocked_domain) && urls.some(url=>(protections.anti_blocked_domain?.blockedDomains??[]).some(domain=>this.urlMatchesDomain(url,domain)))) found.push('anti_blocked_domain');
    if(this.active(protections.anti_forbidden_file) && message.attachments.some((attachment:any)=>(protections.anti_forbidden_file?.blockedExtensions??[]).includes(String(attachment.name??'').split('.').pop()?.toLowerCase()??''))) found.push('anti_forbidden_file');
    if(this.active(protections.anti_invisible_character) && /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/.test(content)) found.push('anti_invisible_character');
    if(this.active(protections.anti_phishing) && /(free\s*nitro|steamcommunity[^\s]*gift|discord[^\s]*nitro|claim\s*(?:your)?\s*gift)/i.test(content)) found.push('anti_phishing');
    if(this.active(protections.anti_advertising) && (invites.length>0 || /(?:siga|entre|acesse|compre|promoção).{0,40}https?:\/\//i.test(content))) found.push('anti_advertising');
    return [...new Set(found)];
  }

  private active(protection?:ProtectionConfig):boolean {
    return Boolean(protection&&protection.mode!=='disabled');
  }

  private isAllowedUrl(raw:string,domains:string[]):boolean {
    if(!domains.length) return false;
    return domains.some(domain=>this.urlMatchesDomain(raw,domain));
  }

  private urlMatchesDomain(raw:string,domain:string):boolean {
    try {
      const host=new URL(raw).hostname.toLowerCase().replace(/^www\./,'');
      const normalized=domain.toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0]??'';
      return host===normalized || host.endsWith(`.${normalized}`);
    } catch { return false; }
  }

  private async processMessageModule(message:any,module:string,protection:ProtectionConfig):Promise<void> {
    const cfg=await guildConfigStore.get(message.guild.id);
    const expired=pruneExpiredBypasses(cfg);
    if(expired.length) await guildConfigStore.set(message.guild.id,cfg);
    if(protection.ignoredChannels.includes(message.channel.id)||protection.ignoredCategories.includes(message.channel.parentId)||protection.ignoredRoles.some(id=>message.member.roles.cache.has(id))) return;
    const bypass=resolveBypass(cfg,{botUserId:message.client.user.id,executorId:message.author.id,executorRoleIds:[...message.member.roles.cache.keys()],module,channelId:message.channel.id,categoryId:message.channel.parentId,executorIsBot:message.author.bot},this.appConfig.owners);
    if(bypass.bypassed&&bypass.behavior?.ignoreDetection) {
      if(bypass.behavior.continueLogging) await this.logBypassedMessage(message,module,protection,cfg,bypass);
      return;
    }
    let threshold={exceeded:true,count:1};
    if(THRESHOLD_MESSAGE_MODULES.has(module)){
      if(bypass.bypassed&&bypass.behavior?.ignoreLimit) return;
      threshold=module==='anti_repeated_message'
        ? thresholdEngine.hitRepeated(message.guild.id,module,message.author.id,protection.quantity,protection.intervalSeconds,message.content)
        : thresholdEngine.hit(message.guild.id,module,message.author.id,protection.quantity,protection.intervalSeconds,message.content);
      if(!threshold.exceeded) return;
    }
    const incident=await createIncident({guildId:message.guild.id,module,event:protection.logEvent,severity:module==='anti_phishing'?'critical':'medium',executorId:message.author.id,targetId:message.author.id,channelId:message.channel.id,confidence:'confirmed',configuredAction:protection.punishment.type,details:{count:threshold.count,mode:protection.mode,content:protection.logEvent==='anti_phishing'?'[redacted]':undefined}});
    if(bypass.bypassed){
      incident.bypass=bypass.entry?{entryId:bypass.entry.id,kind:bypass.entry.kind,targetId:bypass.entry.targetId}:null;
      if(bypass.behavior?.ignorePunishment) incident.actionResult='bypassed';
    }
    if(protection.mode==='enabled'&&!bypass.behavior?.ignorePunishment){
      await message.delete().catch(()=>undefined);
      incident.actionResult=await executePunishment(message.guild,message.member,protection,cfg,incident);
    } else incident.actionResult=protection.mode==='test'?'simulated':bypass.bypassed?'bypassed':'logged';
    await sendIncidentLog(message.guild,cfg,incident);
    await guildConfigStore.set(message.guild.id,cfg);
    await updateIncident(incident);
  }

  private async logBypassedMessage(message:any,module:string,protection:ProtectionConfig,cfg:GuildConfig,bypass:any):Promise<void> {
    const incident=await createIncident({guildId:message.guild.id,module,event:protection.logEvent,severity:'info',executorId:message.author.id,targetId:message.author.id,channelId:message.channel.id,confidence:'confirmed',configuredAction:protection.punishment.type,details:{bypassReason:bypass.reason}});
    incident.bypass=bypass.entry?{entryId:bypass.entry.id,kind:bypass.entry.kind,targetId:bypass.entry.targetId}:null;
    incident.actionResult='bypassed_before_detection';
    await sendIncidentLog(message.guild,cfg,incident);
    await updateIncident(incident);
  }

  async handleDestructiveEvent(input:AdministrativeEventInput):Promise<void> {
    await this.handleAdministrativeEvent(input);
  }

  async handleAdministrativeEvent(input:AdministrativeEventInput):Promise<void> {
    const cfg=await guildConfigStore.get(input.guild.id);
    const protection=cfg.protections[input.module];
    if(!protection||protection.mode==='disabled') return;
    const startedAt=Date.now();
    const audit=await resolveAudit(input.guild,input.auditType,input.targetId);
    const member=audit.executorId?await input.guild.members.fetch(audit.executorId).catch(()=>null):null;
    if(input.module.startsWith('anti_mass_')){
      if(!audit.executorId) return;
      const threshold=thresholdEngine.hit(input.guild.id,input.module,audit.executorId,protection.quantity,protection.intervalSeconds,input.targetId);
      if(!threshold.exceeded) return;
      input.details={...(input.details??{}),count:threshold.count,intervalSeconds:protection.intervalSeconds};
    }
    const bypass=resolveBypass(cfg,{botUserId:input.guild.client.user.id,executorId:audit.executorId,executorRoleIds:member?[...member.roles.cache.keys()]:[],module:input.module,executorIsBot:audit.executor?.bot},this.appConfig.owners);
    if(bypass.bypassed&&bypass.behavior?.ignoreDetection&&!bypass.behavior.continueLogging) return;
    const incident=await createIncident({guildId:input.guild.id,module:input.module,event:input.event,severity:input.severity??'high',executorId:audit.executorId,targetId:input.targetId,confidence:audit.confidence,configuredAction:protection.punishment.type,details:{auditEntryId:audit.entryId,auditReason:audit.reason,...(input.details??{})},startedAt});
    if(bypass.bypassed) incident.bypass=bypass.entry?{entryId:bypass.entry.id,kind:bypass.entry.kind,targetId:bypass.entry.targetId}:null;
    const canPunish=audit.confidence==='confirmed'&&protection.mode==='enabled'&&!bypass.behavior?.ignorePunishment;
    incident.actionResult=canPunish?await executePunishment(input.guild,member,protection,cfg,incident):(protection.mode==='test'?'simulated':bypass.bypassed?'bypassed':'logged_uncertain');
    if(protection.restore&&protection.mode!=='test'&&!bypass.behavior?.ignoreRestoration&&input.restoreKind){
      try{
        const snapshot=await loadGuildSnapshot(input.guild.id);
        if(!snapshot) throw new Error('Snapshot não encontrado');
        if(input.restoreKind==='channel'){
          const channelSnapshot=snapshot.channels[input.targetId];
          if(!channelSnapshot) throw new Error('Canal ausente no snapshot');
          const recreated=await restoreChannel(input.guild,channelSnapshot);
          incident.restorationResult=`recreated:${recreated.id}`;
        }else{
          const roleSnapshot=snapshot.roles[input.targetId];
          if(!roleSnapshot) throw new Error('Cargo ausente no snapshot');
          const recreated=await restoreRole(input.guild,roleSnapshot);
          incident.restorationResult=`recreated:${recreated.id}`;
        }
      }catch(error){incident.restorationResult=`failure:${error instanceof Error?error.message:String(error)}`;}
    }
    await sendIncidentLog(input.guild,cfg,incident);
    await guildConfigStore.set(input.guild.id,cfg);
    await updateIncident(incident);
    await captureGuildSnapshot(input.guild).catch(error=>logger.warn('Falha ao atualizar snapshot após incidente.',{guildId:input.guild.id,error:String(error)}));
  }

  async handleChannelUpdate(oldChannel:any,newChannel:any):Promise<void> {
    if(!newChannel.guild) return;
    if(oldChannel.parentId!==newChannel.parentId || oldChannel.rawPosition!==newChannel.rawPosition){
      await this.handleAdministrativeEvent({guild:newChannel.guild,module:'anti_channel_move',event:'channel_move',targetId:newChannel.id,target:newChannel,auditType:AuditLogEvent.ChannelUpdate,severity:'high'}); return;
    }
    if(this.overwritesSignature(oldChannel)!==this.overwritesSignature(newChannel)){
      await this.handleAdministrativeEvent({guild:newChannel.guild,module:'anti_channel_permissions',event:'channel_permissions_update',targetId:newChannel.id,target:newChannel,auditType:AuditLogEvent.ChannelOverwriteUpdate,severity:'critical'}); return;
    }
    if(oldChannel.nsfw!==newChannel.nsfw){await this.handleAdministrativeEvent({guild:newChannel.guild,module:'anti_nsfw_update',event:'channel_update',targetId:newChannel.id,target:newChannel,auditType:AuditLogEvent.ChannelUpdate,severity:'medium'});return;}
    if(oldChannel.rateLimitPerUser!==newChannel.rateLimitPerUser){await this.handleAdministrativeEvent({guild:newChannel.guild,module:'anti_slowmode_update',event:'channel_update',targetId:newChannel.id,target:newChannel,auditType:AuditLogEvent.ChannelUpdate,severity:'medium'});return;}
    await this.handleAdministrativeEvent({guild:newChannel.guild,module:'anti_channel_update',event:'channel_update',targetId:newChannel.id,target:newChannel,auditType:AuditLogEvent.ChannelUpdate,severity:'high'});
  }

  async handleRoleUpdate(oldRole:any,newRole:any):Promise<void> {
    if(oldRole.position!==newRole.position){await this.handleAdministrativeEvent({guild:newRole.guild,module:'anti_role_move',event:'role_move',targetId:newRole.id,target:newRole,auditType:AuditLogEvent.RoleUpdate,severity:'high'});return;}
    for(const [permission,module] of DANGEROUS_PERMISSIONS){
      if(!oldRole.permissions.has(permission)&&newRole.permissions.has(permission)){
        await this.handleAdministrativeEvent({guild:newRole.guild,module,event:permission===PermissionFlagsBits.Administrator?'administrator_granted':'dangerous_permission_add',targetId:newRole.id,target:newRole,auditType:AuditLogEvent.RoleUpdate,severity:'critical',details:{permission:permission.toString()}});return;
      }
    }
    await this.handleAdministrativeEvent({guild:newRole.guild,module:'anti_role_update',event:'role_update',targetId:newRole.id,target:newRole,auditType:AuditLogEvent.RoleUpdate,severity:'high'});
  }

  async handleGuildUpdate(oldGuild:any,newGuild:any):Promise<void> {
    const checks:Array<[boolean,string,string,Severity]> = [
      [oldGuild.name!==newGuild.name,'anti_guild_name','guild_name_update','high'],
      [oldGuild.icon!==newGuild.icon,'anti_guild_icon','guild_icon_update','high'],
      [oldGuild.banner!==newGuild.banner,'anti_guild_banner','guild_banner_update','high'],
      [oldGuild.description!==newGuild.description,'anti_guild_description','guild_description_update','medium'],
      [oldGuild.verificationLevel!==newGuild.verificationLevel,'anti_verification_update','verification_level_update','critical'],
      [oldGuild.explicitContentFilter!==newGuild.explicitContentFilter,'anti_content_filter_update','security_update','high'],
      [String(oldGuild.features)!==String(newGuild.features),'anti_community_update','community_update','high'],
      [oldGuild.rulesChannelId!==newGuild.rulesChannelId||oldGuild.publicUpdatesChannelId!==newGuild.publicUpdatesChannelId,'anti_official_channels_update','official_channels_update','high']
    ];
    const match=checks.find(([changed])=>changed);
    if(match) await this.handleAdministrativeEvent({guild:newGuild,module:match[1],event:match[2],targetId:newGuild.id,target:newGuild,auditType:AuditLogEvent.GuildUpdate,severity:match[3]});
  }

  async handleMemberUpdate(oldMember:any,newMember:any):Promise<void> {
    const oldRoles=new Set<string>(oldMember.roles.cache.keys());
    const newRoles=new Set<string>(newMember.roles.cache.keys());
    const added=[...newRoles].filter(id=>!oldRoles.has(id));
    const removed=[...oldRoles].filter(id=>!newRoles.has(id));
    if(added.length){
      const dangerous=added.some(id=>DANGEROUS_PERMISSIONS.some(([permission])=>newMember.guild.roles.cache.get(id)?.permissions.has(permission)));
      await this.handleAdministrativeEvent({guild:newMember.guild,module:dangerous?'anti_dangerous_role_assignment':'anti_mass_role_add',event:'member_role_add',targetId:newMember.id,target:newMember,auditType:AuditLogEvent.MemberRoleUpdate,severity:dangerous?'critical':'high',details:{roleIds:added}});return;
    }
    if(removed.length){await this.handleAdministrativeEvent({guild:newMember.guild,module:'anti_mass_role_remove',event:'member_role_remove',targetId:newMember.id,target:newMember,auditType:AuditLogEvent.MemberRoleUpdate,severity:'high',details:{roleIds:removed}});return;}
    if(oldMember.communicationDisabledUntilTimestamp!==newMember.communicationDisabledUntilTimestamp){await this.handleAdministrativeEvent({guild:newMember.guild,module:'anti_mass_timeout',event:newMember.communicationDisabledUntilTimestamp?'timeout_add':'timeout_remove',targetId:newMember.id,target:newMember,auditType:AuditLogEvent.MemberUpdate,severity:'high'});return;}
    if(oldMember.nickname!==newMember.nickname){await this.handleAdministrativeEvent({guild:newMember.guild,module:'anti_mass_nickname',event:'nickname_update',targetId:newMember.id,target:newMember,auditType:AuditLogEvent.MemberUpdate,severity:'medium'});}
  }

  async handleVoiceStateUpdate(oldState:any,newState:any):Promise<void> {
    if(!oldState.channelId || oldState.channelId===newState.channelId) return;
    const module=newState.channelId?'anti_mass_voice_move':'anti_mass_voice_disconnect';
    const event=newState.channelId?'mass_voice_move':'mass_voice_disconnect';
    const auditType=newState.channelId?AuditLogEvent.MemberMove:AuditLogEvent.MemberDisconnect;
    await this.handleAdministrativeEvent({guild:newState.guild,module,event,targetId:newState.id,target:newState.member,auditType,severity:'high',details:{oldChannelId:oldState.channelId,newChannelId:newState.channelId}});
  }

  async handleMemberJoin(member:any):Promise<void> {
    const cfg=await guildConfigStore.get(member.guild.id);
    if(member.user.bot){
      if(cfg.trustedBots.includes(member.id)) { await this.logPassiveEvent(member.guild,'bot_add',member.id,{trusted:true}); return; }
      await this.handleAdministrativeEvent({guild:member.guild,module:'anti_unauthorized_bot',event:'unauthorized_bot',targetId:member.id,target:member.user,auditType:AuditLogEvent.BotAdd,severity:'critical'});
      return;
    }
    const ageSeconds=(Date.now()-member.user.createdTimestamp)/1000;
    const accountProtection=cfg.protections.anti_new_account;
    if(accountProtection&&accountProtection.mode!=='disabled'&&ageSeconds<accountProtection.minimumAccountAgeSeconds){
      const incident=await createIncident({guildId:member.guild.id,module:'anti_new_account',event:'new_account',severity:'high',executorId:member.id,targetId:member.id,confidence:'confirmed',configuredAction:accountProtection.punishment.type,details:{accountAgeSeconds:Math.floor(ageSeconds)}});
      incident.actionResult=accountProtection.mode==='enabled'?await executePunishment(member.guild,member,accountProtection,cfg,incident):accountProtection.mode==='test'?'simulated':'logged';
      await sendIncidentLog(member.guild,cfg,incident);await updateIncident(incident);
    } else await this.logPassiveEvent(member.guild,'member_join',member.id,{accountAgeSeconds:Math.floor(ageSeconds)});
    const raid=thresholdEngine.hit(member.guild.id,'anti_mass_join','global',cfg.raid.joinCount,cfg.raid.intervalSeconds);
    if(cfg.raid.state==='automatic'&&raid.exceeded){
      cfg.raid.activeUntil=new Date(Date.now()+cfg.raid.durationSeconds*1000).toISOString();
      const raidProtection=cfg.protections.anti_mass_join;
      if(raidProtection){
        const incident=await createIncident({guildId:member.guild.id,module:'anti_mass_join',event:'raid_detected',severity:'emergency',targetId:member.id,confidence:'confirmed',configuredAction:raidProtection.punishment.type,details:{joins:raid.count}});
        incident.actionResult=raidProtection.mode==='enabled'?await executePunishment(member.guild,member,raidProtection,cfg,incident):raidProtection.mode==='test'?'simulated':'logged';
        await sendIncidentLog(member.guild,cfg,incident);await updateIncident(incident);
      }
    }
    await guildConfigStore.set(member.guild.id,cfg);
  }

  async logPassiveEvent(guild:any,event:string,targetId:string|null,details:Record<string,unknown>={},severity:Severity='info',channelId:string|null=null):Promise<void> {
    const cfg=await guildConfigStore.get(guild.id);
    const logConfig=cfg.logs.events[event];
    if(!logConfig||logConfig.mode==='disabled') return;
    const incident=await createIncident({guildId:guild.id,module:'event_log',event,severity,targetId,channelId,confidence:'confirmed',configuredAction:'log',details});
    incident.actionResult='logged';
    await sendIncidentLog(guild,cfg,incident);
    await guildConfigStore.set(guild.id,cfg);
    await updateIncident(incident);
  }

  async refreshSnapshot(guild:any):Promise<void> {
    const cfg=await guildConfigStore.get(guild.id);
    if(!cfg.snapshots.enabled)return;
    await captureGuildSnapshot(guild);
    cfg.snapshots.lastRefreshAt=new Date().toISOString();
    await guildConfigStore.set(guild.id,cfg);
  }

  private overwritesSignature(channel:any):string {
    const values=channel.permissionOverwrites?.cache?.map((overwrite:any)=>`${overwrite.id}:${overwrite.allow.bitfield}:${overwrite.deny.bitfield}`)??[];
    return [...values].sort().join('|');
  }
}

export const destructiveAuditTypes={
  channelDelete:AuditLogEvent.ChannelDelete,
  roleDelete:AuditLogEvent.RoleDelete,
  channelCreate:AuditLogEvent.ChannelCreate,
  roleCreate:AuditLogEvent.RoleCreate,
  channelUpdate:AuditLogEvent.ChannelUpdate,
  roleUpdate:AuditLogEvent.RoleUpdate,
  guildUpdate:AuditLogEvent.GuildUpdate,
  botAdd:AuditLogEvent.BotAdd,
  webhookCreate:AuditLogEvent.WebhookCreate,
  webhookUpdate:AuditLogEvent.WebhookUpdate,
  webhookDelete:AuditLogEvent.WebhookDelete,
  memberBanAdd:AuditLogEvent.MemberBanAdd,
  memberKick:AuditLogEvent.MemberKick,
  threadDelete:AuditLogEvent.ThreadDelete,
  autoModDelete:AuditLogEvent.AutoModerationRuleDelete,
  autoModUpdate:AuditLogEvent.AutoModerationRuleUpdate,
  eventDelete:AuditLogEvent.GuildScheduledEventDelete,
  emojiDelete:AuditLogEvent.EmojiDelete,
  stickerDelete:AuditLogEvent.StickerDelete,
  soundDelete:AuditLogEvent.SoundboardSoundDelete,
  integrationCreate:AuditLogEvent.IntegrationCreate,
  integrationDelete:AuditLogEvent.IntegrationDelete
};
