import type { ChannelSnapshot } from './channelSnapshot';
import type { RoleSnapshot } from './roleSnapshot';
export interface GuildSnapshot { guildId:string; name:string; icon:string|null; banner:string|null; verificationLevel:number; explicitContentFilter:number; channels:Record<string,ChannelSnapshot>; roles:Record<string,RoleSnapshot>; capturedAt:string; version:number }
