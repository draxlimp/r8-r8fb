import { appendFile, mkdir, readdir, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { LogLevel } from '../types/config';

const weights: Record<LogLevel, number> = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40, CRITICAL: 50 };
export class Logger {
  constructor(private level: LogLevel = 'INFO', private rotateAfterBytes = 5_242_880, private keepFiles = 10) {}
  setLevel(level: LogLevel): void { this.level = level; }
  configure(level: LogLevel, rotateAfterBytes: number, keepFiles: number): void {
    this.level = level;
    this.rotateAfterBytes = Math.max(1024, rotateAfterBytes);
    this.keepFiles = Math.max(1, keepFiles);
  }
  debug(message: string, meta?: unknown): void { void this.write('DEBUG', message, meta); }
  info(message: string, meta?: unknown): void { void this.write('INFO', message, meta); }
  warn(message: string, meta?: unknown): void { void this.write('WARN', message, meta); }
  error(message: string, meta?: unknown): void { void this.write('ERROR', message, meta); }
  critical(message: string, meta?: unknown): void { void this.write('CRITICAL', message, meta); }
  private sanitize(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    const clone = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    for (const key of Object.keys(clone)) if (/token|secret|authorization/i.test(key)) clone[key] = '[REDACTED]';
    return clone;
  }
  private async write(level: LogLevel, message: string, meta?: unknown): Promise<void> {
    if (weights[level] < weights[this.level]) return;
    const code = Math.random().toString(16).slice(2, 10).toUpperCase();
    const suffix = meta === undefined ? '' : ` ${JSON.stringify(this.sanitize(meta))}`;
    const line = `[${new Date().toISOString()}] [${level}] [${code}] ${message}${suffix}`;
    console[level === 'ERROR' || level === 'CRITICAL' ? 'error' : level === 'WARN' ? 'warn' : 'log'](line);
    try {
      const dir = path.resolve('logs'); await mkdir(dir, { recursive: true });
      const file = path.join(dir, 'r8-protection.log');
      try { if ((await stat(file)).size >= this.rotateAfterBytes) await rename(file, path.join(dir, `r8-protection-${Date.now()}.log`)); } catch {}
      await appendFile(file, line + '\n', 'utf8');
      const files = (await readdir(dir)).filter((f:string) => /^r8-protection-\d+\.log$/.test(f)).sort().reverse();
      for (const old of files.slice(this.keepFiles)) await unlink(path.join(dir, old)).catch(() => undefined);
    } catch {}
  }
}
export const logger = new Logger();
