import { ContainerBuilder, MessageFlags, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder } from 'discord.js';
import type { Incident } from '../types/incident';

const EVENT_LABELS: Record<string, string> = {
  member_ban: 'Membro banido', member_unban: 'Banimento removido', member_kick: 'Membro expulso',
  timeout_add: 'Timeout aplicado', timeout_remove: 'Timeout removido', member_warn: 'Advertência aplicada',
  warning_remove: 'Advertência removida', message_clear: 'Mensagens apagadas', cl_used: 'Limpeza de mensagens',
  channel_lock: 'Canal fechado', channel_unlock: 'Canal liberado', voice_join: 'Entrada em call', voice_leave: 'Saída de call',
  ticket_opened: 'Ticket aberto', ticket_closed: 'Ticket fechado', ticket_reopened: 'Ticket reaberto',
  ticket_claimed: 'Ticket assumido', ticket_transcript: 'Transcript gerado',
  telloyn_sent: 'Telloyn público enviado', telloyn_anonymous_sent: 'Telloyn anônimo enviado',
  instagram_post_created: 'Publicação criada', instagram_post_liked: 'Curtida atualizada',
  instagram_post_commented: 'Comentário publicado', instagram_post_deleted: 'Publicação excluída',
  twitter_post_created: 'Publicação no X enviada', twitter_post_rejected: 'Publicação no X bloqueada',
  auto_clean_deleted: 'Mensagem apagada automaticamente', auto_clean_failed: 'Falha na limpeza automática',
  command_denied: 'Comando bloqueado', command_error: 'Erro em comando',
  member_role_add: 'Cargo adicionado', member_role_remove: 'Cargo removido'
};

export function renderIncident(incident: Incident, guildName = 'Servidor'): any {
  const lines: string[] = [`## ${escapeText(guildName)}`, `### ${friendlyEvent(incident.event)}`];
  if (incident.executorId) lines.push(`**Responsável:** <@${incident.executorId}>`);
  if (incident.targetId) lines.push(`**Alvo:** <@${incident.targetId}>`);
  if (incident.channelId) lines.push(`**Canal:** <#${incident.channelId}>`);

  const usefulDetails = formatDetails(incident.details);
  if (usefulDetails.length) lines.push(...usefulDetails);

  const result = resultLabel(incident.actionResult);
  if (result) lines.push(`**Resultado:** ${result}`);
  lines.push(`-# ${incident.id} • <t:${Math.floor(Date.parse(incident.createdAt) / 1000)}:F>`);

  const container = new ContainerBuilder()
    .setAccentColor(severityColor(incident.severity))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

  return { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

function friendlyEvent(value: string): string {
  return EVENT_LABELS[value] ?? value.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
function formatDetails(details: Record<string, unknown>): string[] {
  const labels: Record<string, string> = {
    reason: 'Motivo', durationSeconds: 'Duração', caseId: 'Caso', amount: 'Quantidade', roleId: 'Cargo',
    command: 'Comando', source: 'Origem', anonymous: 'Anônimo', rating: 'Avaliação', ticketId: 'Ticket'
  };
  const lines: string[] = [];
  for (const [key, raw] of Object.entries(details ?? {})) {
    if (!(key in labels) || raw === null || raw === undefined || raw === '') continue;
    let value = String(raw);
    if (key === 'durationSeconds' && Number.isFinite(Number(raw))) value = formatSeconds(Number(raw));
    if (key === 'roleId' && /^\d{16,22}$/.test(value)) value = `<@&${value}>`;
    value = value.slice(0, 700);
    lines.push(`**${labels[key]}:** ${value}`);
  }
  return lines.slice(0, 6);
}
function resultLabel(value: string): string | null {
  const map: Record<string, string> = { success: 'Concluído', failure: 'Falhou', blocked: 'Bloqueado', added: 'Adicionado', removed: 'Removido', simulated: 'Simulado' };
  if (!value || value === 'pending' || value === 'not_requested') return null;
  return map[value] ?? value;
}
function formatSeconds(seconds: number): string {
  if (seconds >= 86400) return `${Math.round(seconds / 86400)} dia(s)`;
  if (seconds >= 3600) return `${Math.round(seconds / 3600)} hora(s)`;
  if (seconds >= 60) return `${Math.round(seconds / 60)} minuto(s)`;
  return `${seconds} segundo(s)`;
}
function escapeText(value: string): string { return value.replace(/[\n\r]/g, ' ').slice(0, 100); }
function severityColor(severity: Incident['severity']): number {
  return ({ info:0x5865F2, low:0x57F287, medium:0xFEE75C, high:0xF0A44B, critical:0xED4245, emergency:0x8B0000 })[severity];
}
