import { PermissionFlagsBits } from 'discord.js';
import type { AppConfig } from '../types/config';
import { guildConfigStore } from '../storage/guildConfigStore';
import { logCommunityEvent } from './communityLogger';
import { logger } from '../utils/logger';
import { UI_LOADING_MENTION } from '../ui/emojis';

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export interface ClearResult {
  scanned: number;
  matched: number;
  deleted: number;
  failed: number;
  targetId: string;
}

export async function handleClearCommand(message: any, app: AppConfig): Promise<boolean> {
  if (!message.guild || !message.member || message.author?.bot) return false;
  const prefix = escapeRegExp(app.prefix);
  const match = message.content.trim().match(new RegExp(`^${prefix}cl(?:\\s+<@!?(\\d+)>)?\\s*$`, 'i'));
  if (!match) return false;

  const config = await guildConfigStore.get(message.guild.id);
  if (!config.community.cl.enabled) {
    await temporaryReply(message,'O comando de limpeza está desativado neste servidor.');
    return true;
  }

  if (!message.channel?.isTextBased?.() || !('messages' in message.channel)) {
    await temporaryReply(message,'Este comando só pode ser usado em um canal de texto.');
    return true;
  }

  const mentionedId = match[1] ?? null;
  const targetId = mentionedId ?? message.author.id;
  const clearingAnotherUser = targetId !== message.author.id;
  const hasConfiguredRole = message.member.roles.cache.some((role: any) => config.community.cl.allowedRoleIds.includes(role.id));
  const hasManageMessages = config.community.cl.allowManageMessages && message.member.permissions.has(PermissionFlagsBits.ManageMessages);

  if (clearingAnotherUser && !hasConfiguredRole && !hasManageMessages) {
    await temporaryReply(message,'Você só pode limpar suas próprias mensagens. Para limpar as mensagens de outra pessoa, é necessário possuir um cargo autorizado ou a permissão Gerenciar Mensagens.');
    return true;
  }

  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target) {
    await temporaryReply(message,'Não encontrei o usuário marcado neste servidor.');
    return true;
  }

  const status = await message.channel.send(`${UI_LOADING_MENTION} Limpeza iniciada para **${target.user.username}**. Aguarde a conclusão.`);
  try {
    const result = await clearUserMessages(message.channel, targetId, config.community.cl.scanLimit, status.id);
    if (config.community.cl.deleteCommandMessage && message.deletable) await message.delete().catch(() => undefined);
    await status.edit(`Limpeza concluída. Mensagens encontradas: ${result.matched}. Excluídas: ${result.deleted}. Falhas: ${result.failed}.`);
    setTimeout(() => void status.delete().catch(() => undefined), 5_000);
    await logCommunityEvent({
      guild: message.guild,
      config,
      event: 'cl_used',
      module: 'community_cl',
      executorId: message.author.id,
      targetId,
      channelId: message.channel.id,
      severity: clearingAnotherUser ? 'medium' : 'info',
      details: { scanned: result.scanned, matched: result.matched, deleted: result.deleted, failed: result.failed }
    });
    await guildConfigStore.set(message.guild.id, config);
  } catch (error) {
    logger.error('Falha no comando CL.', { guildId: message.guild.id, channelId: message.channel.id, error: String(error) });
    await status.edit('A limpeza não foi concluída. Verifique as permissões do bot e tente novamente.').catch(() => undefined);
    setTimeout(() => void status.delete().catch(() => undefined), 5_000);
    await logCommunityEvent({
      guild: message.guild,
      config,
      event: 'cl_failed',
      module: 'community_cl',
      executorId: message.author.id,
      targetId,
      channelId: message.channel.id,
      severity: 'high',
      actionResult: 'failed',
      details: { error: error instanceof Error ? error.message : String(error) }
    }).catch(() => undefined);
    await guildConfigStore.set(message.guild.id, config).catch(() => undefined);
  }
  return true;
}

export async function clearUserMessages(channel: any, targetId: string, scanLimit: number, excludedMessageId?: string): Promise<ClearResult> {
  let before: string | undefined;
  let scanned = 0;
  let matched = 0;
  let deleted = 0;
  let failed = 0;
  const limit = Math.min(Math.max(scanLimit, 100), 10_000);

  while (scanned < limit) {
    const fetchLimit = Math.min(100, limit - scanned);
    const batch = await channel.messages.fetch({ limit: fetchLimit, before });
    if (!batch.size) break;
    scanned += batch.size;
    before = batch.last()?.id;

    const matching = [...batch.values()].filter((item: any) => item.author?.id === targetId && item.id !== excludedMessageId);
    matched += matching.length;
    const recent = matching.filter((item: any) => Date.now() - item.createdTimestamp < TWO_WEEKS_MS);
    const old = matching.filter((item: any) => Date.now() - item.createdTimestamp >= TWO_WEEKS_MS);

    if (recent.length && typeof channel.bulkDelete === 'function') {
      const removed = await channel.bulkDelete(recent, true).catch(() => null);
      if (removed) deleted += removed.size;
      else failed += recent.length;
    } else {
      for (const item of recent) {
        const ok = await item.delete().then(() => true).catch(() => false);
        ok ? deleted++ : failed++;
      }
    }

    for (const item of old) {
      const ok = await item.delete().then(() => true).catch(() => false);
      ok ? deleted++ : failed++;
      await delay(250);
    }

    if (batch.size < fetchLimit) break;
    await delay(350);
  }

  return { scanned, matched, deleted, failed, targetId };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function temporaryReply(message: any, content: string): Promise<void> {
  const sent = await message.reply({ content, allowedMentions: { parse: [] } }).catch(() => null);
  if (sent) setTimeout(() => void sent.delete().catch(() => undefined), 5_000);
}
