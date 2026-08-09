"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModerationTracker = void 0;
const discord_js_1 = require("discord.js");
const guildConfigStore_1 = require("../storage/guildConfigStore");
const logger_1 = require("../utils/logger");
const AUDIT_WINDOW_MS = 15_000;
class ModerationTracker {
    async handleBanAdd(ban) {
        const guild = ban.guild;
        const entry = await this.findAuditEntry(guild, discord_js_1.AuditLogEvent.MemberBanAdd, ban.user.id);
        if (!entry?.executorId || entry.executorId === guild.client.user?.id)
            return;
        await this.record(guild.id, {
            action: 'ban',
            targetId: ban.user.id,
            moderatorId: entry.executorId,
            reason: entry.reason || 'Banimento realizado diretamente pelo Discord',
            durationSeconds: null,
            source: 'discord'
        });
    }
    async handleBanRemove(ban) {
        const guild = ban.guild;
        const entry = await this.findAuditEntry(guild, discord_js_1.AuditLogEvent.MemberBanRemove, ban.user.id);
        if (!entry?.executorId || entry.executorId === guild.client.user?.id)
            return;
        const cfg = await guildConfigStore_1.guildConfigStore.get(guild.id);
        const active = [...cfg.moderation.cases].reverse().find(item => item.targetId === ban.user.id && ['ban', 'tempban'].includes(item.action) && !item.revokedAt);
        if (active) {
            active.revokedAt = new Date().toISOString();
            active.revokedBy = entry.executorId;
        }
        await this.pushCase(cfg, guild.id, {
            action: 'unban',
            targetId: ban.user.id,
            moderatorId: entry.executorId,
            reason: entry.reason || 'Banimento removido diretamente pelo Discord',
            durationSeconds: null,
            source: 'discord'
        });
    }
    async handleMemberUpdate(oldMember, newMember) {
        const oldUntil = Number(oldMember.communicationDisabledUntilTimestamp ?? 0);
        const newUntil = Number(newMember.communicationDisabledUntilTimestamp ?? 0);
        const now = Date.now();
        const timeoutAdded = newUntil > now && newUntil !== oldUntil;
        const timeoutRemoved = oldUntil > now && (!newUntil || newUntil <= now);
        if (!timeoutAdded && !timeoutRemoved)
            return;
        const entry = await this.findAuditEntry(newMember.guild, discord_js_1.AuditLogEvent.MemberUpdate, newMember.id);
        if (!entry?.executorId || entry.executorId === newMember.guild.client.user?.id)
            return;
        const cfg = await guildConfigStore_1.guildConfigStore.get(newMember.guild.id);
        if (timeoutAdded) {
            const seconds = Math.max(1, Math.ceil((newUntil - now) / 1000));
            await this.pushCase(cfg, newMember.guild.id, {
                action: 'timeout',
                targetId: newMember.id,
                moderatorId: entry.executorId,
                reason: entry.reason || 'Timeout aplicado diretamente pelo Discord',
                durationSeconds: seconds,
                source: 'discord'
            });
            return;
        }
        const active = [...cfg.moderation.cases].reverse().find(item => item.targetId === newMember.id && item.action === 'timeout' && !item.revokedAt);
        if (active) {
            active.revokedAt = new Date().toISOString();
            active.revokedBy = entry.executorId;
        }
        await this.pushCase(cfg, newMember.guild.id, {
            action: 'untimeout',
            targetId: newMember.id,
            moderatorId: entry.executorId,
            reason: entry.reason || 'Timeout removido diretamente pelo Discord',
            durationSeconds: null,
            source: 'discord'
        });
    }
    async findAuditEntry(guild, type, targetId) {
        try {
            const logs = await guild.fetchAuditLogs({ type, limit: 8 });
            const entries = [...logs.entries.values()];
            return entries.find((entry) => {
                const entryTargetId = entry.targetId ?? entry.target?.id;
                const created = Number(entry.createdTimestamp ?? 0);
                return entryTargetId === targetId && created > 0 && Date.now() - created <= AUDIT_WINDOW_MS;
            }) ?? null;
        }
        catch (error) {
            logger_1.logger.debug('Não foi possível consultar o Audit Log para histórico da staff.', { guildId: guild.id, error: String(error) });
            return null;
        }
    }
    async record(guildId, input) {
        const cfg = await guildConfigStore_1.guildConfigStore.get(guildId);
        await this.pushCase(cfg, guildId, input);
    }
    async pushCase(cfg, guildId, input) {
        const number = cfg.moderation.nextCaseNumber++;
        const item = {
            id: `CASE-${String(number).padStart(6, '0')}`,
            ...input,
            createdAt: new Date().toISOString(),
            revokedAt: null,
            revokedBy: null
        };
        cfg.moderation.cases.push(item);
        cfg.moderation.cases = cfg.moderation.cases.slice(-1000);
        await guildConfigStore_1.guildConfigStore.set(guildId, cfg);
    }
}
exports.ModerationTracker = ModerationTracker;
//# sourceMappingURL=moderationTracker.js.map