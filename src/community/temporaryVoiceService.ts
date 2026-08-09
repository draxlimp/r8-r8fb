import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { guildConfigStore } from '../storage/guildConfigStore';
import { renderCommunityTemplate } from './templateRenderer';
import { logCommunityEvent } from './communityLogger';

export async function handleTemporaryVoice(oldState: any, newState: any): Promise<void> {
  const guild = newState.guild ?? oldState.guild;
  if (!guild) return;
  const config = await guildConfigStore.get(guild.id);
  const settings = config.community.temporaryVoice;

  if (settings.enabled && settings.creatorChannelId && newState.channelId === settings.creatorChannelId && oldState.channelId !== settings.creatorChannelId) {
    const member = newState.member;
    if (member) {
      const name = renderCommunityTemplate(settings.namePattern, { user:member.user, member, guild }).slice(0,100) || `Sala de ${member.displayName}`;
      const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        parent: settings.categoryId ?? newState.channel?.parentId ?? undefined,
        userLimit: settings.defaultUserLimit,
        permissionOverwrites: [
          { id:guild.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect] },
          { id:member.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect,PermissionFlagsBits.Speak,PermissionFlagsBits.MoveMembers,PermissionFlagsBits.ManageChannels] },
          { id:guild.client.user.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect,PermissionFlagsBits.MoveMembers,PermissionFlagsBits.ManageChannels] }
        ],
        reason:`Sala temporária criada para ${member.user.tag}`
      });
      settings.createdChannels[channel.id] = { ownerId:member.id, createdAt:new Date().toISOString() };
      await guildConfigStore.set(guild.id, config);
      await member.voice.setChannel(channel, 'Entrada na sala criadora').catch(async () => {
        delete settings.createdChannels[channel.id];
        await channel.delete('Falha ao mover o proprietário da sala temporária').catch(() => undefined);
      });
      await logCommunityEvent({ guild, config, event:'voice_join', module:'temporary_voice', executorId:member.id, targetId:channel.id, channelId:channel.id, details:{temporary:true,ownerId:member.id} }).catch(()=>undefined);
      await guildConfigStore.set(guild.id, config);
    }
  }

  const oldChannelId = oldState.channelId;
  if (oldChannelId && settings.createdChannels[oldChannelId]) {
    const oldChannel = guild.channels.cache.get(oldChannelId) ?? await guild.channels.fetch(oldChannelId).catch(() => null);
    if (!oldChannel || oldChannel.members?.size === 0) {
      delete settings.createdChannels[oldChannelId];
      if (oldChannel) await oldChannel.delete('Sala temporária vazia').catch(() => undefined);
      await guildConfigStore.set(guild.id, config);
    }
  }
}
