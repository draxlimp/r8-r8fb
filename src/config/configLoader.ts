import { readFile } from 'node:fs/promises';
import { atomicWriteJson } from '../storage/atomicWriter';
import { KeyedMutex } from '../utils/mutex';
import path from 'node:path';
import type { AppConfig } from '../types/config';

let cached: AppConfig | null = null;
const configMutex = new KeyedMutex();
export async function loadConfig(force = false): Promise<AppConfig> {
  if (cached && !force) return cached;
  const file = path.resolve(process.cwd(), 'config.json');
  const parsed = JSON.parse(await readFile(file, 'utf8')) as Partial<AppConfig>;
  const errors: string[] = [];
  if (!parsed.token || typeof parsed.token !== 'string') errors.push('token ausente');
  if (!parsed.prefix || typeof parsed.prefix !== 'string') errors.push('prefixo ausente');
  if (!Array.isArray(parsed.owners)) errors.push('owners deve ser uma lista');
  if (!parsed.credits || !Array.isArray(parsed.credits.people)) errors.push('credits.people deve ser uma lista');
  if (!parsed.panel || typeof parsed.panel.sessionTimeoutSeconds !== 'number') errors.push('panel.sessionTimeoutSeconds inválido');
  if (errors.length) throw new Error(`Configuração inválida: ${errors.join(', ')}`);
  if (parsed.token === 'COLOQUE_O_TOKEN_AQUI') throw new Error('Defina o token real em config.json antes de iniciar.');
  cached = parsed as AppConfig;
  return cached;
}
export function clearConfigCache(): void { cached = null; }

export async function saveConfig(config: AppConfig): Promise<void> {
  await configMutex.run('global-config', async () => {
    await atomicWriteJson(path.resolve(process.cwd(), 'config.json'), config, true);
    cached = structuredClone(config);
  });
}
