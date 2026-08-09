import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GuildConfig } from '../types/guildConfig';

export interface BackupEnvelope {
  id: string;
  guildId: string;
  createdAt: string;
  createdBy: string;
  reason: string;
  config: GuildConfig;
  snapshot?: unknown;
}
export interface BackupSummary { id:string; createdAt:string; createdBy:string; reason:string; sizeBytes:number }

export async function createBackup(
  guildId: string,
  config: GuildConfig,
  createdBy: string,
  reason: string,
  retention: number,
  snapshot?: unknown
): Promise<BackupEnvelope> {
  const dir = backupDirectory(guildId);
  await mkdir(dir, { recursive: true });
  const backup: BackupEnvelope = {
    id: `BKP-${Date.now()}`,
    guildId,
    createdAt: new Date().toISOString(),
    createdBy,
    reason,
    config: structuredClone(config),
    snapshot
  };
  await writeFile(path.join(dir, `${backup.id}.json`), JSON.stringify(backup, null, 2) + '\n', 'utf8');
  const files = (await readdir(dir)).filter((file:string) => /^BKP-\d+\.json$/.test(file)).sort().reverse();
  for (const file of files.slice(Math.max(1, retention))) await rm(path.join(dir, file), { force: true });
  return backup;
}

export async function readBackup(guildId: string, id: string): Promise<BackupEnvelope> {
  validateBackupId(id);
  const parsed = JSON.parse(await readFile(backupPath(guildId, id), 'utf8')) as BackupEnvelope;
  if (parsed.guildId !== guildId || !parsed.config || typeof parsed.config !== 'object') throw new Error('Backup inválido para este servidor');
  return parsed;
}

export async function listBackups(guildId: string, limit = 20): Promise<BackupSummary[]> {
  const dir = backupDirectory(guildId);
  await mkdir(dir, { recursive: true });
  const files = (await readdir(dir, { withFileTypes: true }))
    .filter((entry:any) => entry.isFile() && /^BKP-\d+\.json$/.test(entry.name))
    .map((entry:any) => entry.name)
    .sort().reverse().slice(0, Math.max(1, limit));
  const result: BackupSummary[] = [];
  for (const file of files) {
    try {
      const raw = await readFile(path.join(dir, file), 'utf8');
      const backup = JSON.parse(raw) as BackupEnvelope;
      result.push({ id:backup.id, createdAt:backup.createdAt, createdBy:backup.createdBy, reason:backup.reason, sizeBytes:raw.length });
    } catch { /* arquivo inválido é ignorado e aparecerá no diagnóstico */ }
  }
  return result;
}

export async function latestBackup(guildId: string): Promise<BackupEnvelope | null> {
  const [latest] = await listBackups(guildId, 1);
  return latest ? readBackup(guildId, latest.id) : null;
}

export function backupPath(guildId: string, id: string): string {
  validateBackupId(id);
  return path.join(backupDirectory(guildId), `${id}.json`);
}

function backupDirectory(guildId: string): string {
  if (!/^\d{5,30}$/.test(guildId) && !/^[A-Za-z0-9_-]{1,64}$/.test(guildId)) throw new Error('ID de servidor inválido');
  return path.resolve('data', 'backups', guildId);
}
function validateBackupId(id: string): void {
  if (!/^BKP-\d+$/.test(id)) throw new Error('ID de backup inválido');
}
