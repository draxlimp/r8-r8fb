import { guildConfigStore } from '../storage/guildConfigStore';
import type { AutoCleanRule, GuildConfig } from '../types/guildConfig';
import { logCommunityEvent } from './communityLogger';

const LINK_PATTERN = /(?:https?:\/\/|www\.|discord\.gg\/|discord(?:app)?\.com\/invite\/)/i;
const IMAGE_LINK_PATTERN = /https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:\?\S*)?/i;

export class AutoCleanService {
  async handleMessage(message: any): Promise<boolean> {
    if (!message.guild) return false;
    const config = await guildConfigStore.get(message.guild.id);
    const rules = config.community.autoClean.rules.filter(rule => rule.enabled && rule.channelId === message.channelId);
    if (!rules.length) return false;

    let scheduled = false;
    for (const rule of rules) {
      if (!this.matches(message, rule)) continue;
      this.schedule(message, config, rule);
      scheduled = true;
    }
    return scheduled;
  }

  private matches(message: any, rule: AutoCleanRule): boolean {
    if (rule.ignorePinned && message.pinned) return false;
    if (message.webhookId && !rule.includeWebhooks) return false;
    if (message.author?.bot && !message.webhookId && !rule.includeBots) return false;
    const content = String(message.content ?? '').trim();
    const attachmentCount = Number(message.attachments?.size ?? 0);
    if (rule.mode === 'all') return true;
    if (rule.mode === 'images') {
      const hasImageAttachment = [...(message.attachments?.values?.() ?? [])].some((entry: any) => String(entry.contentType ?? '').startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(String(entry.name ?? '')));
      return hasImageAttachment || IMAGE_LINK_PATTERN.test(content);
    }
    if (rule.mode === 'text') return Boolean(content) && attachmentCount === 0;
    return LINK_PATTERN.test(content);
  }

  private schedule(message: any, config: GuildConfig, rule: AutoCleanRule): void {
    const delay = Math.max(5, Math.min(2_592_000, rule.delaySeconds)) * 1000;
    const timer: any = setTimeout(async () => {
      try {
        if (message.deletable === false) throw new Error('A mensagem não pode ser apagada pelo bot.');
        await message.delete();
        if (rule.logDeletions) {
          await logCommunityEvent({
            guild: message.guild,
            config,
            event: 'auto_clean_deleted',
            module: 'community_auto_clean',
            executorId: message.author?.id ?? null,
            channelId: message.channelId,
            targetId: message.id,
            severity: 'info',
            actionResult: 'success',
            details: { ruleId: rule.id, mode: rule.mode, delaySeconds: rule.delaySeconds }
          }).catch(() => undefined);
        }
      } catch (error) {
        await logCommunityEvent({
          guild: message.guild,
          config,
          event: 'auto_clean_failed',
          module: 'community_auto_clean',
          executorId: message.author?.id ?? null,
          channelId: message.channelId,
          targetId: message.id,
          severity: 'low',
          actionResult: 'failure',
          details: { ruleId: rule.id, error: error instanceof Error ? error.message : String(error) }
        }).catch(() => undefined);
      }
    }, delay);
    timer.unref?.();
  }
}
