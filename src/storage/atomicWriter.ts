import { copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomId } from '../utils/ids';

export async function atomicWriteJson(file: string, value: unknown, backup = true): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomId(3)}.tmp`;
  if (backup) await copyFile(file, `${file}.bak`).catch(() => undefined);
  const data = JSON.stringify(value, null, 2) + '\n';
  await writeFile(temp, data, { encoding: 'utf8', flag: 'wx' });
  try { await rename(temp, file); } catch (error) { await rm(temp, { force: true }); throw error; }
}
