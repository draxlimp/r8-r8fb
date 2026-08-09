"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityService = exports.formatVoiceTime = void 0;
const discord_js_1 = require("discord.js");
const guildConfigStore_1 = require("../storage/guildConfigStore");
const logger_1 = require("../utils/logger");
const activityMath_1 = require("./activityMath");
var activityMath_2 = require("./activityMath");
Object.defineProperty(exports, "formatVoiceTime", { enumerable: true, get: function () { return activityMath_2.formatVoiceTime; } });
class ActivityService {
    inviteUses = new Map();
    async initializeGuild(guild) {
        await this.captureInvites(guild);
        const now = new Date().toISOString();
        await guildConfigStore_1.guildConfigStore.update(guild.id, config => {
            const current = config.community.voiceActivity;
            const activeSince = {};
            for (const userId of this.currentVoiceMemberIds(guild))
                activeSince[userId] = now;
            // Sessões abertas de uma execução anterior não podem continuar contando
            // durante o período em que o bot esteve offline. Reiniciamos somente o
            // trecho em andamento e preservamos o tempo já consolidado.
            current.activeSince = activeSince;
            return config;
        });
    }
    async handleMemberAdd(member) {
        const previous = this.inviteUses.get(member.guild.id) ?? new Map();
        const current = await member.guild.invites.fetch().catch(() => null);
        if (!current)
            return;
        let inviterId = null;
        for (const invite of current.values()) {
            const oldUses = previous.get(invite.code) ?? 0;
            const newUses = invite.uses ?? 0;
            if (newUses > oldUses && invite.inviterId) {
                inviterId = invite.inviterId;
                break;
            }
        }
        this.inviteUses.set(member.guild.id, new Map([...current.values()].map((invite) => [invite.code, invite.uses ?? 0])));
        if (!inviterId)
            return;
        const config = await guildConfigStore_1.guildConfigStore.get(member.guild.id);
        config.community.inviteJoins[inviterId] = (config.community.inviteJoins[inviterId] ?? 0) + 1;
        await guildConfigStore_1.guildConfigStore.set(member.guild.id, config);
    }
    async handleVoiceStateUpdate(oldState, newState) {
        if (newState.member?.user?.bot || oldState.member?.user?.bot)
            return;
        if (oldState.channelId === newState.channelId)
            return;
        const userId = newState.id;
        const now = Date.now();
        await guildConfigStore_1.guildConfigStore.update(newState.guild.id, config => {
            const item = config.community.voiceActivity;
            if (oldState.channelId) {
                const startedAt = item.activeSince[userId];
                if (startedAt) {
                    const elapsed = this.elapsedSeconds(startedAt, now);
                    item.totalsSeconds[userId] = (item.totalsSeconds[userId] ?? 0) + elapsed;
                    delete item.activeSince[userId];
                }
            }
            if (newState.channelId)
                item.activeSince[userId] = new Date(now).toISOString();
            return config;
        });
    }
    getVoiceSeconds(config, userId, now = Date.now()) {
        return (0, activityMath_1.voiceSeconds)(config, userId, now);
    }
    topVoice(config, limit = 10) {
        return (0, activityMath_1.voiceLeaderboard)(config, limit);
    }
    async refreshVoiceBoard(guild) {
        // Além do evento voiceStateUpdate, fazemos um checkpoint periódico do cache
        // real do Discord. Isso evita perder tempo quando um evento falha, quando o
        // painel salva configuração ao mesmo tempo ou quando o bot acabou de ligar.
        const config = await this.checkpointVoiceActivity(guild);
        const settings = config.community.voiceActivity;
        if (!settings.enabled || !settings.channelId)
            return;
        const channel = await guild.channels.fetch(settings.channelId).catch(() => null);
        if (!channel?.isTextBased?.() || !('send' in channel))
            return;
        const top = this.topVoice(config, 10);
        const activeMembers = this.currentVoiceMemberIds(guild).size;
        const description = top.length
            ? top.map((item, index) => `**${index + 1}.** <@${item.userId}> — **${(0, activityMath_1.formatVoiceTime)(item.seconds)}**`).join('\n')
            : 'Ainda não há tempo de voz registrado.';
        const embed = new discord_js_1.EmbedBuilder()
            .setAuthor({ name: guild.name, iconURL: guild.iconURL({ size: 256 }) ?? undefined })
            .setTitle('Ranking de atividade em voz')
            .setDescription(description)
            .addFields({ name: 'Em call agora', value: String(activeMembers), inline: true })
            .setColor(0x111111)
            .setFooter({ text: `Atualização automática a cada ${settings.updateSeconds} segundos` })
            .setTimestamp();
        let message = settings.messageId ? await channel.messages.fetch(settings.messageId).catch(() => null) : null;
        if (message)
            await message.edit({ embeds: [embed], allowedMentions: { parse: [] } });
        else {
            message = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
            const messageId = message.id;
            await guildConfigStore_1.guildConfigStore.update(guild.id, latest => {
                latest.community.voiceActivity.messageId = messageId;
                return latest;
            });
        }
    }
    async checkpointVoiceActivity(guild) {
        const now = Date.now();
        const activeIds = this.currentVoiceMemberIds(guild);
        return guildConfigStore_1.guildConfigStore.update(guild.id, config => {
            const item = config.community.voiceActivity;
            for (const [userId, startedAt] of Object.entries(item.activeSince)) {
                const elapsed = this.elapsedSeconds(startedAt, now);
                if (elapsed > 0)
                    item.totalsSeconds[userId] = (item.totalsSeconds[userId] ?? 0) + elapsed;
                if (activeIds.has(userId)) {
                    // Avança apenas os segundos consolidados e preserva a fração restante,
                    // evitando perder tempo a cada checkpoint por arredondamento.
                    const parsed = Date.parse(startedAt);
                    item.activeSince[userId] = Number.isFinite(parsed) ? new Date(parsed + elapsed * 1000).toISOString() : new Date(now).toISOString();
                }
                else
                    delete item.activeSince[userId];
            }
            for (const userId of activeIds) {
                if (!item.activeSince[userId])
                    item.activeSince[userId] = new Date(now).toISOString();
            }
            return config;
        });
    }
    currentVoiceMemberIds(guild) {
        const ids = new Set();
        const states = guild?.voiceStates?.cache?.values ? guild.voiceStates.cache.values() : [];
        for (const state of states) {
            if (!state.channelId || state.member?.user?.bot)
                continue;
            ids.add(state.id);
        }
        return ids;
    }
    elapsedSeconds(startedAt, now) {
        const parsed = Date.parse(startedAt);
        if (!Number.isFinite(parsed))
            return 0;
        return Math.max(0, Math.floor((now - parsed) / 1000));
    }
    async maintainTemporaryActions(guild) {
        const config = await guildConfigStore_1.guildConfigStore.get(guild.id);
        let changed = false;
        const now = Date.now();
        for (const record of [...config.moderation.temporaryBans]) {
            if (Date.parse(record.expiresAt) > now)
                continue;
            await guild.bans.remove(record.userId, `Banimento temporário expirado | ${record.reason}`).catch((error) => {
                logger_1.logger.warn('Falha ao remover banimento temporário expirado.', { guildId: guild.id, userId: record.userId, error: String(error) });
            });
            config.moderation.temporaryBans = config.moderation.temporaryBans.filter(item => item !== record);
            changed = true;
        }
        for (const record of [...config.community.temporaryRoles]) {
            if (Date.parse(record.expiresAt) > now)
                continue;
            const member = await guild.members.fetch(record.userId).catch(() => null);
            const role = guild.roles.cache.get(record.roleId);
            if (member && role && role.editable)
                await member.roles.remove(role, `Cargo temporário expirado | ${record.id}`).catch(() => undefined);
            config.community.temporaryRoles = config.community.temporaryRoles.filter(item => item.id !== record.id);
            changed = true;
        }
        if (changed)
            await guildConfigStore_1.guildConfigStore.set(guild.id, config);
    }
    async captureInvites(guild) {
        const invites = await guild.invites.fetch().catch(() => null);
        if (!invites)
            return;
        this.inviteUses.set(guild.id, new Map([...invites.values()].map((invite) => [invite.code, invite.uses ?? 0])));
    }
}
exports.ActivityService = ActivityService;
//# sourceMappingURL=activityService.js.map