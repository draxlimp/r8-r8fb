"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBackup = createBackup;
exports.readBackup = readBackup;
exports.listBackups = listBackups;
exports.latestBackup = latestBackup;
exports.backupPath = backupPath;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
async function createBackup(guildId, config, createdBy, reason, retention, snapshot) {
    const dir = backupDirectory(guildId);
    await (0, promises_1.mkdir)(dir, { recursive: true });
    const backup = {
        id: `BKP-${Date.now()}`,
        guildId,
        createdAt: new Date().toISOString(),
        createdBy,
        reason,
        config: structuredClone(config),
        snapshot
    };
    await (0, promises_1.writeFile)(node_path_1.default.join(dir, `${backup.id}.json`), JSON.stringify(backup, null, 2) + '\n', 'utf8');
    const files = (await (0, promises_1.readdir)(dir)).filter((file) => /^BKP-\d+\.json$/.test(file)).sort().reverse();
    for (const file of files.slice(Math.max(1, retention)))
        await (0, promises_1.rm)(node_path_1.default.join(dir, file), { force: true });
    return backup;
}
async function readBackup(guildId, id) {
    validateBackupId(id);
    const parsed = JSON.parse(await (0, promises_1.readFile)(backupPath(guildId, id), 'utf8'));
    if (parsed.guildId !== guildId || !parsed.config || typeof parsed.config !== 'object')
        throw new Error('Backup inválido para este servidor');
    return parsed;
}
async function listBackups(guildId, limit = 20) {
    const dir = backupDirectory(guildId);
    await (0, promises_1.mkdir)(dir, { recursive: true });
    const files = (await (0, promises_1.readdir)(dir, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && /^BKP-\d+\.json$/.test(entry.name))
        .map((entry) => entry.name)
        .sort().reverse().slice(0, Math.max(1, limit));
    const result = [];
    for (const file of files) {
        try {
            const raw = await (0, promises_1.readFile)(node_path_1.default.join(dir, file), 'utf8');
            const backup = JSON.parse(raw);
            result.push({ id: backup.id, createdAt: backup.createdAt, createdBy: backup.createdBy, reason: backup.reason, sizeBytes: raw.length });
        }
        catch { /* arquivo inválido é ignorado e aparecerá no diagnóstico */ }
    }
    return result;
}
async function latestBackup(guildId) {
    const [latest] = await listBackups(guildId, 1);
    return latest ? readBackup(guildId, latest.id) : null;
}
function backupPath(guildId, id) {
    validateBackupId(id);
    return node_path_1.default.join(backupDirectory(guildId), `${id}.json`);
}
function backupDirectory(guildId) {
    if (!/^\d{5,30}$/.test(guildId) && !/^[A-Za-z0-9_-]{1,64}$/.test(guildId))
        throw new Error('ID de servidor inválido');
    return node_path_1.default.resolve('data', 'backups', guildId);
}
function validateBackupId(id) {
    if (!/^BKP-\d+$/.test(id))
        throw new Error('ID de backup inválido');
}
//# sourceMappingURL=backupStore.js.map