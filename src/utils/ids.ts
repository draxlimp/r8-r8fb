import { randomBytes } from 'node:crypto';
export function randomId(bytes = 6): string { return randomBytes(bytes).toString('hex').toUpperCase(); }
export function incidentId(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `INC-${y}-${m}-${d}-${randomId(3)}`;
}
