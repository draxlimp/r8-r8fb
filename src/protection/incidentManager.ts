import type { Incident, AuditConfidence } from '../types/incident';
import type { Severity } from '../types/guildConfig';
import { incidentId } from '../utils/ids';
import { saveIncident } from '../storage/incidentStore';
export async function createIncident(input: { guildId: string; module: string; event: string; severity: Severity; executorId?: string | null; targetId?: string | null; channelId?: string | null; confidence?: AuditConfidence; configuredAction?: string; details?: Record<string, unknown>; startedAt?: number }): Promise<Incident> {
  const incident: Incident = {
    id: incidentId(), guildId: input.guildId, module: input.module, event: input.event, severity: input.severity,
    executorId: input.executorId ?? null, targetId: input.targetId ?? null, channelId: input.channelId ?? null, confidence: input.confidence ?? 'unidentified', bypass: null,
    configuredAction: input.configuredAction ?? 'log', actionResult: 'pending', restorationResult: 'not_requested', details: input.details ?? {}, createdAt: new Date().toISOString(), durationMs: Date.now() - (input.startedAt ?? Date.now())
  };
  await saveIncident(incident); return incident;
}
export async function updateIncident(incident: Incident): Promise<void> { incident.durationMs = Math.max(incident.durationMs, 0); await saveIncident(incident); }
