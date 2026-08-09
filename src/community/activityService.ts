import { EmbedBuilder } from 'discord.js';
import type { GuildConfig } from '../types/guildConfig';
import { guildConfigStore } from '../storage/guildConfigStore';
import { logger } from '../utils/logger';
import { formatVoiceTime, voiceLeaderboard, voiceSeconds } from './activityMath';
export { formatVoiceTime } from './activityMath';

export class ActivityService {
  private readonly inviteUses = new Map<string, Map<string, number>>();

  async initializeGuild(guild: any): Promise<void> {
    await this.captureInvites(guild);
    const now = new Date().toISOString();
    await guildConfigStore.update(guild.id, config => {
      const current = config.community.voiceActivity;
      const activeSince: Record<string, string> = {};
      for (const userId of this.currentVoiceMemberIds(guild)) activeSince[userId] = now;
      // Sessões abertas de uma execução anterior não podem continuar contando
      // durante o período em que o bot esteve offline. Reiniciamos somente o
      // trecho em andamento e preservamos o tempo já consolidado.
      current.activeSince = activeSince;
      return config;
    });
  }

  async handleMemberAdd(member: any): Promise<void> {
    const previous = this.inviteUses.get(member.guild.id) ?? new Map<string, number>();
    const current = await member.guild.invites.fetch().catch(() => null);
    if (!current) return;
    let inviterId: string | null = null;
    for (const invite of current.values()) {
      const oldUses = previous.get(invite.code) ?? 0;
      const newUses = invite.uses ?? 0;
      if (newUses > oldUses && invite.inviterId) {
        inviterId = invite.inviterId;
        break;
      }
    }
    this.inviteUses.set(member.guild.id, new Map([...current.values()].map((invite: any) => [invite.code, invite.uses ?? 0])));
    if (!inviterId) return;
    const config = await guildConfigStore.get(member.guild.id);
    config.community.inviteJoins[inviterId] = (config.community.inviteJoins[inviterId] ?? 0) + 1;
    await guildConfigStore.set(member.guild.id, config);
  }

  async handleVoiceStateUpdate(oldState: any, newState: any): Promise<void> {
    if (newState.member?.user?.bot || oldState.member?.user?.bot) return;
    if (oldState.channelId === newState.channelId) return;

    const userId = newState.id;
    const now = Date.now();
    await guildConfigStore.update(newState.guild.id, config => {
      const item = config.community.voiceActivity;

      if (oldState.channelId) {
        const startedAt = item.activeSince[userId];
        if (startedAt) {
          const elapsed = this.elapsedSeconds(startedAt, now);
          item.totalsSeconds[userId] = (item.totalsSeconds[userId] ?? 0) + elapsed;
          delete item.activeSince[userId];
        }
      }

      if (newState.channelId) item.activeSince[userId] = new Date(now).toISOString();
      return config;
    });
  }

  getVoiceSeconds(config: GuildConfig, userId: string, now = Date.now()): number {
    return voiceSeconds(config, userId, now);
  }

  topVoice(config: GuildConfig, limit = 10): Array<{ userId: string; seconds: number }> {
    return voiceLeaderboard(config, limit);
  }

  async refreshVoiceBoard(guild: any): Promise<void> {
    // Além do evento voiceStateUpdate, fazemos um checkpoint periódico do cache
    // real do Discord. Isso evita perder tempo quando um evento falha, quando o
    // painel salva configuração ao mesmo tempo ou quando o bot acabou de ligar.
    const config = await this.checkpointVoiceActivity(guild);
    const settings = config.community.voiceActivity;
    if (!settings.enabled || !settings.channelId) return;
    const channel = await guild.channels.fetch(settings.channelId).catch(() => null);
    if (!channel?.isTextBased?.() || !('send' in channel)) return;

    const top = this.topVoice(config, 10);
    const activeMembers = this.currentVoiceMemberIds(guild).size;
    const description = top.length
      ? top.map((item, index) => `**${index + 1}.** <@${item.userId}> — **${formatVoiceTime(item.seconds)}**`).join('\n')
      : 'Ainda não há tempo de voz registrado.';
    const embed = new EmbedBuilder()
      .setAuthor({ name: guild.name, iconURL: guild.iconURL({ size: 256 }) ?? undefined })
      .setTitle('Ranking de atividade em voz')
      .setDescription(description)
      .addFields({ name: 'Em call agora', value: String(activeMembers), inline: true })
      .setColor(0x111111)
      .setFooter({ text: `Atualização automática a cada ${settings.updateSeconds} segundos` })
      .setTimestamp();

    let message = settings.messageId ? await channel.messages.fetch(settings.messageId).catch(() => null) : null;
    if (message) await message.edit({ embeds: [embed], allowedMentions: { parse: [] } });
    else {
      message = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      const messageId = message.id;
      await guildConfigStore.update(guild.id, latest => {
        latest.community.voiceActivity.messageId = messageId;
        return latest;
      });
    }
  }

  private async checkpointVoiceActivity(guild: any): Promise<GuildConfig> {
    const now = Date.now();
    const activeIds = this.currentVoiceMemberIds(guild);
    return guildConfigStore.update(guild.id, config => {
      const item = config.community.voiceActivity;

      for (const [userId, startedAt] of Object.entries(item.activeSince)) {
        const elapsed = this.elapsedSeconds(startedAt, now);
        if (elapsed > 0) item.totalsSeconds[userId] = (item.totalsSeconds[userId] ?? 0) + elapsed;
        if (activeIds.has(userId)) {
          // Avança apenas os segundos consolidados e preserva a fração restante,
          // evitando perder tempo a cada checkpoint por arredondamento.
          const parsed = Date.parse(startedAt);
          item.activeSince[userId] = Number.isFinite(parsed) ? new Date(parsed + elapsed * 1000).toISOString() : new Date(now).toISOString();
        } else delete item.activeSince[userId];
      }

      for (const userId of activeIds) {
        if (!item.activeSince[userId]) item.activeSince[userId] = new Date(now).toISOString();
      }
      return config;
    });
  }

  private currentVoiceMemberIds(guild: any): Set<string> {
    const ids = new Set<string>();
    const states = guild?.voiceStates?.cache?.values ? guild.voiceStates.cache.values() : [];
    for (const state of states) {
      if (!state.channelId || state.member?.user?.bot) continue;
      ids.add(state.id);
    }
    return ids;
  }

  private elapsedSeconds(startedAt: string, now: number): number {
    const parsed = Date.parse(startedAt);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor((now - parsed) / 1000));
  }

  async maintainTemporaryActions(guild: any): Promise<void> {
    const config = await guildConfigStore.get(guild.id);
    let changed = false;
    const now = Date.now();

    for (const record of [...config.moderation.temporaryBans]) {
      if (Date.parse(record.expiresAt) > now) continue;
      await guild.bans.remove(record.userId, `Banimento temporário expirado | ${record.reason}`).catch((error: unknown) => {
        logger.warn('Falha ao remover banimento temporário expirado.', { guildId: guild.id, userId: record.userId, error: String(error) });
      });
      config.moderation.temporaryBans = config.moderation.temporaryBans.filter(item => item !== record);
      changed = true;
    }

    for (const record of [...config.community.temporaryRoles]) {
      if (Date.parse(record.expiresAt) > now) continue;
      const member = await guild.members.fetch(record.userId).catch(() => null);
      const role = guild.roles.cache.get(record.roleId);
      if (member && role && role.editable) await member.roles.remove(role, `Cargo temporário expirado | ${record.id}`).catch(() => undefined);
      config.community.temporaryRoles = config.community.temporaryRoles.filter(item => item.id !== record.id);
      changed = true;
    }

    if (changed) await guildConfigStore.set(guild.id, config);
  }

  private async captureInvites(guild: any): Promise<void> {
    const invites = await guild.invites.fetch().catch(() => null);
    if (!invites) return;
    this.inviteUses.set(guild.id, new Map([...invites.values()].map((invite: any) => [invite.code, invite.uses ?? 0])));
  }
}
