import type { Severity } from './guildConfig';
export type AuditConfidence = 'confirmed' | 'probable' | 'uncertain' | 'unidentified';
export interface Incident {
  id: string;
  guildId: string;
  module: string;
  event: string;
  severity: Severity;
  executorId: string | null;
  targetId: string | null;
  channelId: string | null;
  confidence: AuditConfidence;
  bypass: { entryId: string; kind: string; targetId: string } | null;
  configuredAction: string;
  actionResult: string;
  restorationResult: string;
  details: Record<string, unknown>;
  createdAt: string;
  durationMs: number;
}
