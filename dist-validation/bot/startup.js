"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startup = startup;
const panelManager_1 = require("../panel/panelManager");
const protectionEngine_1 = require("../protection/protectionEngine");
const registerEvents_1 = require("../events/registerEvents");
const presence_1 = require("./presence");
const logger_1 = require("../utils/logger");
const guildConfigStore_1 = require("../storage/guildConfigStore");
const backupStore_1 = require("../storage/backupStore");
const snapshotManager_1 = require("../snapshots/snapshotManager");
const bypassEngine_1 = require("../protection/bypassEngine");
const hierarchyChecker_1 = require("../permissions/hierarchyChecker");
const communityManager_1 = require("../community/communityManager");
const emojis_1 = require("../ui/emojis");
const DAY_MS = 24 * 60 * 60 * 1000;
async function startup(client, app) {
    const community = new communityManager_1.CommunityManager(client, app);
    const panel = await panelManager_1.PanelManager.create(client, app, community);
    const engine = new protectionEngine_1.ProtectionEngine(app);
    (0, registerEvents_1.registerEvents)(client, app, panel, engine, community);
    client.once('clientReady', ready => {
        void initializeReadyClient(ready, app, engine, community).catch(error => logger_1.logger.critical('Falha na inicialização após conexão.', { error: error instanceof Error ? error.message : String(error) }));
    });
    await client.login(app.token);
}
async function initializeReadyClient(client, app, engine, community) {
    const emojiStatus = await (0, emojis_1.hydrateUiEmojis)(client);
    if (emojiStatus.repaired.length)
        logger_1.logger.info('IDs de emoji atualizados automaticamente.', { repaired: emojiStatus.repaired });
    if (emojiStatus.fallback.length)
        logger_1.logger.warn('Alguns emojis personalizados não estão acessíveis; usando fallback seguro.', { missing: emojiStatus.fallback });
    (0, presence_1.startPresenceRotation)(client, app);
    logger_1.logger.info('Bot conectado ao Discord.', { user: client.user.tag, guilds: client.guilds.cache.size });
    for (const guild of client.guilds.cache.values()) {
        await guildConfigStore_1.guildConfigStore.get(guild.id);
        await community.initializeGuild(guild).catch(error => logger_1.logger.warn('Inicialização de atividade falhou.', { guildId: guild.id, error: String(error) }));
        await engine.refreshSnapshot(guild).catch(error => logger_1.logger.warn('Snapshot inicial falhou.', { guildId: guild.id, error: String(error) }));
        await maintainGuild(guild, app, engine, community).catch(error => logger_1.logger.warn('Manutenção inicial falhou.', { guildId: guild.id, error: String(error) }));
    }
    const maintenanceTimer = setInterval(() => {
        for (const guild of client.guilds.cache.values()) {
            void maintainGuild(guild, app, engine, community).catch(error => logger_1.logger.warn('Manutenção periódica falhou.', { guildId: guild.id, error: String(error) }));
        }
    }, 60_000);
    maintenanceTimer.unref();
    const fastTimer = setInterval(() => {
        for (const guild of client.guilds.cache.values()) {
            void community.refreshFastGuild(guild).catch(error => logger_1.logger.warn('Atualização rápida da comunidade falhou.', { guildId: guild.id, error: String(error) }));
        }
    }, 10_000);
    fastTimer.unref();
}
async function maintainGuild(guild, app, engine, community) {
    const cfg = await guildConfigStore_1.guildConfigStore.get(guild.id);
    let changed = false;
    const expiredBypasses = (0, bypassEngine_1.pruneExpiredBypasses)(cfg);
    if (expiredBypasses.length)
        changed = true;
    if (cfg.raid.activeUntil && Date.parse(cfg.raid.activeUntil) <= Date.now()) {
        cfg.raid.activeUntil = null;
        if (cfg.raid.state !== 'automatic')
            cfg.raid.state = 'disabled';
        changed = true;
    }
    for (const [memberId, quarantine] of Object.entries(cfg.quarantine.active)) {
        if (!quarantine.expiresAt || Date.parse(quarantine.expiresAt) > Date.now())
            continue;
        const member = await guild.members.fetch(memberId).catch(() => null);
        if (member) {
            const quarantineRole = cfg.quarantine.roleId ? guild.roles.cache.get(cfg.quarantine.roleId) : null;
            if (quarantineRole && (0, hierarchyChecker_1.canManageRole)(guild, quarantineRole).ok) {
                await member.roles.remove(quarantineRole, `Quarentena expirada | ${quarantine.incidentId}`).catch(() => undefined);
            }
            if (cfg.quarantine.restorePreviousRoles) {
                const restorable = quarantine.previousRoles
                    .map(roleId => guild.roles.cache.get(roleId))
                    .filter((role) => role && (0, hierarchyChecker_1.canManageRole)(guild, role).ok);
                if (restorable.length)
                    await member.roles.add(restorable, `Restauração de quarentena | ${quarantine.incidentId}`).catch(() => undefined);
            }
        }
        delete cfg.quarantine.active[memberId];
        changed = true;
    }
    const snapshotDue = cfg.snapshots.enabled && (!cfg.snapshots.lastRefreshAt ||
        Date.now() - Date.parse(cfg.snapshots.lastRefreshAt) >= Math.max(1, cfg.snapshots.refreshMinutes) * 60_000);
    if (snapshotDue) {
        await engine.refreshSnapshot(guild);
        cfg.snapshots.lastRefreshAt = new Date().toISOString();
        changed = true;
    }
    const backupDue = app.storage.automaticBackup && cfg.backups.automatic && (!cfg.backups.lastBackupAt || Date.now() - Date.parse(cfg.backups.lastBackupAt) >= DAY_MS);
    if (backupDue) {
        const latestSnapshot = await (0, snapshotManager_1.loadGuildSnapshot)(guild.id);
        await (0, backupStore_1.createBackup)(guild.id, cfg, guild.client.user.id, 'Backup automático diário', Math.min(cfg.backups.retention, app.storage.maximumBackups), latestSnapshot ?? undefined);
        cfg.backups.lastBackupAt = new Date().toISOString();
        changed = true;
    }
    if (changed)
        await guildConfigStore_1.guildConfigStore.set(guild.id, cfg);
    await community.maintainGuild(guild);
}
//# sourceMappingURL=startup.js.map