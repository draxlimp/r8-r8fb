import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteJson } from '../storage/atomicWriter';
import { captureChannel } from './channelSnapshot';
import { captureRole } from './roleSnapshot';
import type { GuildSnapshot } from './guildSnapshot';
export async function captureGuildSnapshot(guild:any):Promise<GuildSnapshot>{
  const snapshot:GuildSnapshot={guildId:guild.id,name:guild.name,icon:guild.icon,banner:guild.banner,verificationLevel:guild.verificationLevel,explicitContentFilter:guild.explicitContentFilter,channels:{},roles:{},capturedAt:new Date().toISOString(),version:1};
  for(const channel of guild.channels.cache.values()) snapshot.channels[channel.id]=captureChannel(channel);
  for(const role of guild.roles.cache.values()) if(role.id!==guild.id) snapshot.roles[role.id]=captureRole(role);
  const dir=path.resolve('data','snapshots',guild.id); await mkdir(dir,{recursive:true}); await atomicWriteJson(path.join(dir,'latest.json'),snapshot,true); return snapshot;
}
export async function loadGuildSnapshot(guildId:string):Promise<GuildSnapshot|null>{try{return JSON.parse(await readFile(path.resolve('data','snapshots',guildId,'latest.json'),'utf8')) as GuildSnapshot;}catch{return null;}}
