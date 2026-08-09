"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTemporaryVoice = handleTemporaryVoice;
const discord_js_1 = require("discord.js");
const guildConfigStore_1 = require("../storage/guildConfigStore");
const templateRenderer_1 = require("./templateRenderer");
const communityLogger_1 = require("./communityLogger");
async function handleTemporaryVoice(oldState, newState) {
    const guild = newState.guild ?? oldState.guild;
    if (!guild)
        return;
    const config = await guildConfigStore_1.guildConfigStore.get(guild.id);
    const settings = config.community.temporaryVoice;
    if (settings.enabled && settings.creatorChannelId && newState.channelId === settings.creatorChannelId && oldState.channelId !== settings.creatorChannelId) {
        const member = newState.member;
        if (member) {
            const name = (0, templateRenderer_1.renderCommunityTemplate)(settings.namePattern, { user: member.user, member, guild }).slice(0, 100) || `Sala de ${member.displayName}`;
            const channel = await guild.channels.create({
                name,
                type: discord_js_1.ChannelType.GuildVoice,
                parent: settings.categoryId ?? newState.channel?.parentId ?? undefined,
                userLimit: settings.defaultUserLimit,
                permissionOverwrites: [
                    { id: guild.id, allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.Connect] },
                    { id: member.id, allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.Connect, discord_js_1.PermissionFlagsBits.Speak, discord_js_1.PermissionFlagsBits.MoveMembers, discord_js_1.PermissionFlagsBits.ManageChannels] },
                    { id: guild.client.user.id, allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.Connect, discord_js_1.PermissionFlagsBits.MoveMembers, discord_js_1.PermissionFlagsBits.ManageChannels] }
                ],
                reason: `Sala temporária criada para ${member.user.tag}`
            });
            settings.createdChannels[channel.id] = { ownerId: member.id, createdAt: new Date().toISOString() };
            await guildConfigStore_1.guildConfigStore.set(guild.id, config);
            await member.voice.setChannel(channel, 'Entrada na sala criadora').catch(async () => {
                delete settings.createdChannels[channel.id];
                await channel.delete('Falha ao mover o proprietário da sala temporária').catch(() => undefined);
            });
            await (0, communityLogger_1.logCommunityEvent)({ guild, config, event: 'voice_join', module: 'temporary_voice', executorId: member.id, targetId: channel.id, channelId: channel.id, details: { temporary: true, ownerId: member.id } }).catch(() => undefined);
            await guildConfigStore_1.guildConfigStore.set(guild.id, config);
        }
    }
    const oldChannelId = oldState.channelId;
    if (oldChannelId && settings.createdChannels[oldChannelId]) {
        const oldChannel = guild.channels.cache.get(oldChannelId) ?? await guild.channels.fetch(oldChannelId).catch(() => null);
        if (!oldChannel || oldChannel.members?.size === 0) {
            delete settings.createdChannels[oldChannelId];
            if (oldChannel)
                await oldChannel.delete('Sala temporária vazia').catch(() => undefined);
            await guildConfigStore_1.guildConfigStore.set(guild.id, config);
        }
    }
}
//# sourceMappingURL=temporaryVoiceService.js.map