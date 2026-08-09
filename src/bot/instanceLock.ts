import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';

interface LockData { pid: number; startedAt: string; }

export async function acquireInstanceLock(): Promise<() => void> {
  const directory = path.resolve('data', 'system');
  const file = path.join(directory, 'runtime-lock.json');
  await mkdir(directory, { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(file, 'wx');
      await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() } satisfies LockData, null, 2) + '\n', 'utf8');
      await handle.close();
      const release = () => {
        try {
          if (!existsSync(file)) return;
          const current = JSON.parse(require('node:fs').readFileSync(file, 'utf8')) as LockData;
          if (current.pid === process.pid) unlinkSync(file);
        } catch { /* o sistema operacional limpará o arquivo na próxima inicialização */ }
      };
      process.once('exit', release);
      return release;
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;
      const stale = await isStale(file);
      if (!stale) throw new Error('Outra instância deste bot já está em execução nesta pasta. Feche o processo anterior antes de iniciar novamente.');
      await unlink(file).catch(() => undefined);
    }
  }
  throw new Error('Não foi possível criar o bloqueio de instância única.');
}

async function isStale(file: string): Promise<boolean> {
  try {
    const data = JSON.parse(await readFile(file, 'utf8')) as LockData;
    if (!Number.isInteger(data.pid) || data.pid <= 0) return true;
    try { process.kill(data.pid, 0); return false; }
    catch (error: any) { return error?.code === 'ESRCH'; }
  } catch { return true; }
}
