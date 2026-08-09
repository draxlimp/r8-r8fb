import { createCanvas } from '@napi-rs/canvas';
import { guildConfigStore } from '../storage/guildConfigStore';
import type { TwitterConfig } from '../types/guildConfig';
import { logCommunityEvent } from './communityLogger';
import { createTwitterCard } from './twitterCanvas';

const MAX_ATTACHMENTS = 10;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export class TwitterService {
  private iconBuffer: Buffer | null = null;

  async handleMessage(message: any): Promise<boolean> {
    if (!message.guild || message.author?.bot || message.webhookId) return false;
    const config = await guildConfigStore.get(message.guild.id);
    const item = config.community.twitter;
    if (!item.enabled || !item.channelId || message.channelId !== item.channelId) return false;

    const content = String(message.content ?? '').trim().slice(0, item.maximumMessageLength);
    const attachments = [...message.attachments.values()].slice(0, MAX_ATTACHMENTS);
    if (!content && !attachments.length) {
      if (message.deletable) await message.delete().catch(() => undefined);
      await this.notice(message.channel, message.author.id, 'Escreva uma mensagem ou envie um arquivo para publicar.');
      return true;
    }
    if (!item.allowAttachments && attachments.length) {
      if (message.deletable) await message.delete().catch(() => undefined);
      await this.notice(message.channel, message.author.id, 'O envio de arquivos está desativado neste canal do X.');
      return true;
    }
    if (attachments.some((entry: any) => Number(entry.size ?? 0) > MAX_FILE_BYTES)) {
      if (message.deletable) await message.delete().catch(() => undefined);
      await this.notice(message.channel, message.author.id, 'Um dos arquivos ultrapassa o limite de 25 MB.');
      return true;
    }

    try {
      const webhook = await this.resolveWebhook(message.channel, item);
      const displayName = String(message.member?.displayName ?? message.author.globalName ?? message.author.username ?? 'Usuário').slice(0, 80);
      const mediaCandidates = item.allowAttachments
        ? attachments.filter((entry: any) => isImageAttachment(entry)).slice(0, 4).map((entry: any) => String(entry.url))
        : [];
      const card = await createTwitterCard({
        displayName,
        username: String(message.author.username ?? 'usuario'),
        avatarUrl: message.author.displayAvatarURL?.({ size: 256, extension: 'png' }) ?? null,
        message: content,
        guildName: message.guild.name,
        createdAt: new Date(message.createdTimestamp ?? Date.now()),
        mediaUrls: mediaCandidates,
        totalAttachments: attachments.length
      });
      const embedded = new Set(card.embeddedMediaUrls);
      const forwarded = item.allowAttachments
        ? attachments
            .filter((entry: any) => !embedded.has(String(entry.url)))
            .slice(0, 9)
            .map((entry: any, index: number) => ({ attachment: entry.url, name: safeFileName(entry.name ?? `x-${Date.now()}-${index}`) }))
        : [];
      const cardName = `x-post-${Date.now()}.png`;

      await webhook.send({
        username: displayName,
        avatarURL: message.author.displayAvatarURL?.({ size: 256, extension: 'png' }) ?? undefined,
        files: [{ attachment: card.buffer, name: cardName }, ...forwarded],
        allowedMentions: { parse: [] }
      });

      if (item.deleteOriginalMessage && message.deletable) await message.delete().catch(() => undefined);
      await logCommunityEvent({
        guild: message.guild,
        config,
        event: 'twitter_post_created',
        module: 'community_twitter',
        executorId: message.author.id,
        channelId: message.channelId,
        severity: 'info',
        actionResult: 'success',
        details: { attachments: attachments.length, embeddedImages: card.embeddedMediaUrls.length, characters: content.length }
      }).catch(() => undefined);
    } catch (error) {
      await this.notice(message.channel, message.author.id, 'Não foi possível publicar. Confira as permissões de webhook, mensagens e anexos do bot.');
      await logCommunityEvent({
        guild: message.guild,
        config,
        event: 'twitter_post_rejected',
        module: 'community_twitter',
        executorId: message.author.id,
        channelId: message.channelId,
        severity: 'medium',
        actionResult: 'failure',
        details: { error: error instanceof Error ? error.message : String(error) }
      }).catch(() => undefined);
    }
    await guildConfigStore.set(message.guild.id, config).catch(() => undefined);
    return true;
  }

  private async resolveWebhook(channel: any, item: TwitterConfig): Promise<any> {
    if (typeof channel.fetchWebhooks !== 'function' || typeof channel.createWebhook !== 'function') {
      throw new Error('Este tipo de canal não suporta webhooks.');
    }
    const botId = channel.client?.user?.id;
    const webhooks = await channel.fetchWebhooks();
    const existing = webhooks.find((hook: any) => hook.owner?.id === botId && hook.name === item.webhookName);
    if (existing) return existing;
    return channel.createWebhook({
      name: item.webhookName.slice(0, 80) || 'X',
      avatar: await this.socialIcon(),
      reason: 'Webhook do canal social X da comunidade'
    });
  }

  private async socialIcon(): Promise<Buffer> {
    if (this.iconBuffer) return this.iconBuffer;
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 166px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('X', 128, 132);
    this.iconBuffer = Buffer.from(await canvas.encode('png'));
    return this.iconBuffer;
  }

  private async notice(channel: any, userId: string, text: string): Promise<void> {
    const sent = await channel.send({ content: `<@${userId}> ${text}`, allowedMentions: { users: [userId], parse: [] } }).catch(() => null);
    if (!sent) return;
    const timer: any = setTimeout(() => void sent.delete().catch(() => undefined), 5_000);
    timer.unref?.();
  }
}

function isImageAttachment(entry: any): boolean {
  const type = String(entry.contentType ?? '').toLowerCase();
  if (type.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp)$/i.test(String(entry.name ?? ''));
}

function safeFileName(value: string): string {
  const cleaned = String(value).replace(/[^a-zA-Z0-9._-]/g, '-').slice(-90);
  return cleaned || `x-${Date.now()}.bin`;
}
