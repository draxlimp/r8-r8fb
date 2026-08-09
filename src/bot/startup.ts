import type { Client } from 'discord.js';
import type { AppConfig } from '../types/config';
import { PanelManager } from '../panel/panelManager';
import { ProtectionEngine } from '../protection/protectionEngine';
import { registerEvents } from '../events/registerEvents';
import { startPresenceRotation } from './presence';
import { logger } from '../utils/logger';
import { guildConfigStore } from '../storage/guildConfigStore';
import { createBackup } from '../storage/backupStore';
import { loadGuildSnapshot } from '../snapshots/snapshotManager';
import { pruneExpiredBypasses } from '../protection/bypassEngine';
import { canManageRole } from '../permissions/hierarchyChecker';
import { CommunityManager } from '../community/communityManager';
import { hydrateUiEmojis } from '../ui/emojis';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function startup(client: Client, app: AppConfig): Promise<void> {
  const community = new CommunityManager(client, app);
  const panel = await PanelManager.create(client, app, community);
  const engine = new ProtectionEngine(app);
  registerEvents(client, app, panel, engine, community);

  client.once('clientReady', ready => {
    void initializeReadyClient(ready, app, engine, community).catch(error =>
      logger.critical('Falha na inicialização após conexão.', { error: error instanceof Error ? error.message : String(error) })
    );
  });

  await client.login(app.token);
}

async function initializeReadyClient(client: any, app: AppConfig, engine: ProtectionEngine, community: CommunityManager): Promise<void> {
  const emojiStatus = await hydrateUiEmojis(client);
  if (emojiStatus.repaired.length) logger.info('IDs de emoji atualizados automaticamente.', { repaired: emojiStatus.repaired });
  if (emojiStatus.fallback.length) logger.warn('Alguns emojis personalizados não estão acessíveis; usando fallback seguro.', { missing: emojiStatus.fallback });
  startPresenceRotation(client, app);
  logger.info('Bot conectado ao Discord.', { user: client.user.tag, guilds: client.guilds.cache.size });

  for (const guild of client.guilds.cache.values()) {
    await guildConfigStore.get(guild.id);
    await community.initializeGuild(guild).catch(error => logger.warn('Inicialização de atividade falhou.', { guildId:guild.id, error:String(error) }));
    await engine.refreshSnapshot(guild).catch(error =>
      logger.warn('Snapshot inicial falhou.', { guildId: guild.id, error: String(error) })
    );
    await maintainGuild(guild, app, engine, community).catch(error =>
      logger.warn('Manutenção inicial falhou.', { guildId: guild.id, error: String(error) })
    );
  }

  const maintenanceTimer = setInterval(() => {
    for (const guild of client.guilds.cache.values()) {
      void maintainGuild(guild, app, engine, community).catch(error =>
        logger.warn('Manutenção periódica falhou.', { guildId: guild.id, error: String(error) })
      );
    }
  }, 60_000);
  maintenanceTimer.unref();

  const fastTimer = setInterval(() => {
    for (const guild of client.guilds.cache.values()) {
      void community.refreshFastGuild(guild).catch(error =>
        logger.warn('Atualização rápida da comunidade falhou.', { guildId:guild.id, error:String(error) })
      );
    }
  }, 10_000);
  fastTimer.unref();
}

async function maintainGuild(guild: any, app: AppConfig, engine: ProtectionEngine, community: CommunityManager): Promise<void> {
  const cfg = await guildConfigStore.get(guild.id);
  let changed = false;

  const expiredBypasses = pruneExpiredBypasses(cfg);
  if (expiredBypasses.length) changed = true;

  if (cfg.raid.activeUntil && Date.parse(cfg.raid.activeUntil) <= Date.now()) {
    cfg.raid.activeUntil = null;
    if (cfg.raid.state !== 'automatic') cfg.raid.state = 'disabled';
    changed = true;
  }

  for (const [memberId, quarantine] of Object.entries(cfg.quarantine.active)) {
    if (!quarantine.expiresAt || Date.parse(quarantine.expiresAt) > Date.now()) continue;
    const member = await guild.members.fetch(memberId).catch(() => null);
    if (member) {
      const quarantineRole = cfg.quarantine.roleId ? guild.roles.cache.get(cfg.quarantine.roleId) : null;
      if (quarantineRole && canManageRole(guild, quarantineRole).ok) {
        await member.roles.remove(quarantineRole, `Quarentena expirada | ${quarantine.incidentId}`).catch(() => undefined);
      }
      if (cfg.quarantine.restorePreviousRoles) {
        const restorable = quarantine.previousRoles
          .map(roleId => guild.roles.cache.get(roleId))
          .filter((role: any) => role && canManageRole(guild, role).ok);
        if (restorable.length) await member.roles.add(restorable, `Restauração de quarentena | ${quarantine.incidentId}`).catch(() => undefined);
      }
    }
    delete cfg.quarantine.active[memberId];
    changed = true;
  }

  const snapshotDue = cfg.snapshots.enabled && (
    !cfg.snapshots.lastRefreshAt ||
    Date.now() - Date.parse(cfg.snapshots.lastRefreshAt) >= Math.max(1, cfg.snapshots.refreshMinutes) * 60_000
  );
  if (snapshotDue) {
    await engine.refreshSnapshot(guild);
    cfg.snapshots.lastRefreshAt = new Date().toISOString();
    changed = true;
  }

  const backupDue = app.storage.automaticBackup && cfg.backups.automatic && (
    !cfg.backups.lastBackupAt || Date.now() - Date.parse(cfg.backups.lastBackupAt) >= DAY_MS
  );
  if (backupDue) {
    const latestSnapshot = await loadGuildSnapshot(guild.id);
    await createBackup(guild.id, cfg, guild.client.user.id, 'Backup automático diário', Math.min(cfg.backups.retention, app.storage.maximumBackups), latestSnapshot ?? undefined);
    cfg.backups.lastBackupAt = new Date().toISOString();
    changed = true;
  }

  if (changed) await guildConfigStore.set(guild.id, cfg);

  await community.maintainGuild(guild);
}
