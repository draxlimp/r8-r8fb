"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHtmlTranscript = createHtmlTranscript;
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = require("node:fs/promises");
const discord_js_1 = require("discord.js");
async function createHtmlTranscript(channel, ticketId, maximumMessages = 10_000) {
    const messages = [];
    let before;
    while (messages.length < maximumMessages) {
        const fetched = await channel.messages.fetch({ limit: Math.min(100, maximumMessages - messages.length), before });
        if (!fetched.size)
            break;
        messages.push(...fetched.values());
        before = fetched.last()?.id;
        if (fetched.size < 100)
            break;
    }
    messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    const fileName = `transcript-${sanitize(ticketId)}-${Date.now()}.html`;
    const directory = node_path_1.default.resolve('data', 'transcripts', channel.guild.id);
    const filePath = node_path_1.default.join(directory, fileName);
    await (0, promises_1.mkdir)(directory, { recursive: true });
    await (0, promises_1.writeFile)(filePath, buildHtml(channel, ticketId, messages), 'utf8');
    return { attachment: new discord_js_1.AttachmentBuilder(filePath, { name: fileName }), filePath, messageCount: messages.length };
}
function buildHtml(channel, ticketId, messages) {
    const rows = messages.map(message => {
        const author = escapeHtml(message.author?.tag ?? message.author?.username ?? 'Usuário desconhecido');
        const avatar = message.author?.displayAvatarURL?.({ extension: 'png', size: 128 }) ?? '';
        const content = escapeHtml(message.cleanContent || message.content || '').replace(/\n/g, '<br>');
        const attachments = [...(message.attachments?.values?.() ?? [])]
            .map((item) => `<a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.name ?? 'anexo')}</a>`)
            .join('<br>');
        const embeds = message.embeds?.length ? `<div class="meta">${message.embeds.length} embed(s) anexado(s)</div>` : '';
        const timestamp = new Date(message.createdTimestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        return `<article class="message">
      <img class="avatar" src="${escapeAttribute(avatar)}" alt="">
      <div class="body"><header><strong>${author}</strong><span>${escapeHtml(timestamp)}</span></header>
      <div class="content">${content || '<em>Mensagem sem texto</em>'}</div>
      ${attachments ? `<div class="attachments">${attachments}</div>` : ''}${embeds}</div>
    </article>`;
    }).join('\n');
    return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Transcript ${escapeHtml(ticketId)}</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0b0b0d;color:#f4f4f5;font-family:Inter,Arial,sans-serif}.wrap{max-width:1100px;margin:auto;padding:32px}.head{border:1px solid #29292e;border-radius:14px;padding:24px;background:#121216;margin-bottom:22px}.head h1{margin:0 0 8px}.head p{margin:4px 0;color:#b5b5bd}.message{display:flex;gap:14px;padding:16px 10px;border-bottom:1px solid #242428}.avatar{width:42px;height:42px;border-radius:50%;background:#222}.body{min-width:0;flex:1}header{display:flex;gap:10px;align-items:baseline}header span{font-size:12px;color:#8e8e99}.content{margin-top:6px;line-height:1.55;overflow-wrap:anywhere}.attachments{margin-top:8px}.attachments a{color:#8ab4ff}.meta{margin-top:8px;color:#a5a5ae;font-size:13px}.credits{text-align:center;color:#8e8e99;padding:26px}</style></head>
<body><main class="wrap"><section class="head"><h1>${escapeHtml(ticketId)}</h1><p>Servidor: ${escapeHtml(channel.guild.name)}</p><p>Canal: ${escapeHtml(channel.name)}</p><p>Mensagens: ${messages.length}</p></section>${rows || '<p>Nenhuma mensagem encontrada.</p>'}</main></body></html>`;
}
function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}
function escapeAttribute(value) { return escapeHtml(value); }
function sanitize(value) { return value.replace(/[^a-z0-9_-]/gi, '-').slice(0, 60); }
//# sourceMappingURL=transcriptService.js.map