import { readFile, rename } from 'node:fs/promises';
import { atomicWriteJson } from './atomicWriter';
import { KeyedMutex } from '../utils/mutex';

export class JsonStore<T> {
  private readonly mutex = new KeyedMutex();
  constructor(private readonly fileForKey: (key: string) => string, private readonly factory: (key: string) => T, private readonly migrate: (value: unknown, key: string) => T) {}
  async get(key: string): Promise<T> {
    const file = this.fileForKey(key);
    try { return this.migrate(JSON.parse(await readFile(file, 'utf8')), key); }
    catch (error: any) {
      if (error?.code !== 'ENOENT') await rename(file, `${file}.corrupt-${Date.now()}`).catch(() => undefined);
      const value = this.factory(key); await atomicWriteJson(file, value, false); return value;
    }
  }
  async set(key: string, value: T): Promise<void> { await this.mutex.run(key, () => atomicWriteJson(this.fileForKey(key), value, true)); }
  async update(key: string, updater: (current: T) => T | Promise<T>): Promise<T> {
    return this.mutex.run(key, async () => { const current = await this.get(key); const next = await updater(current); await atomicWriteJson(this.fileForKey(key), next, true); return next; });
  }
}
