interface Entry { timestamps: number[]; values: Array<{ at: number; value: string }> }
export class ThresholdEngine {
  private readonly entries = new Map<string, Entry>();
  hit(guildId: string, module: string, actorId: string, quantity: number, intervalSeconds: number, value?: string): { exceeded: boolean; count: number } {
    const key = `${guildId}:${module}:${actorId}`; const now = Date.now(); const cutoff = now - intervalSeconds * 1000;
    const entry = this.entries.get(key) ?? { timestamps: [], values: [] };
    entry.timestamps = entry.timestamps.filter(t => t >= cutoff); entry.timestamps.push(now);
    entry.values = entry.values.filter(v => v.at >= cutoff); if (value !== undefined) entry.values.push({ at: now, value: normalize(value) });
    this.entries.set(key, entry); return { exceeded: entry.timestamps.length >= quantity, count: entry.timestamps.length };
  }
  hitRepeated(guildId: string, module: string, actorId: string, quantity: number, intervalSeconds: number, value: string): { exceeded: boolean; count: number } {
    const result = this.hit(guildId, module, actorId, Number.MAX_SAFE_INTEGER, intervalSeconds, value);
    const entry = this.entries.get(`${guildId}:${module}:${actorId}`)!; const normalized = normalize(value);
    const count = entry.values.filter(v => v.value === normalized && normalized.length > 0).length;
    return { exceeded: count >= quantity, count };
  }
  count(guildId: string, module: string, actorId: string, intervalSeconds: number): number {
    const entry = this.entries.get(`${guildId}:${module}:${actorId}`); if (!entry) return 0;
    const cutoff = Date.now() - intervalSeconds * 1000; entry.timestamps = entry.timestamps.filter(t => t >= cutoff); return entry.timestamps.length;
  }
  clear(guildId: string, module: string, actorId: string): void { this.entries.delete(`${guildId}:${module}:${actorId}`); }
}
function normalize(value: string): string { return value.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 500); }
export const thresholdEngine = new ThresholdEngine();
