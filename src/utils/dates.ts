export function nowIso(): string { return new Date().toISOString(); }
export function isExpired(iso: string | null, now = Date.now()): boolean { return Boolean(iso && Date.parse(iso) <= now); }
export function durationFromNow(seconds: number): string { return new Date(Date.now() + seconds * 1000).toISOString(); }
