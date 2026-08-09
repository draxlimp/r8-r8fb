import { createCanvas, loadImage } from '@napi-rs/canvas';

export interface TwitterCanvasInput {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  message: string;
  guildName: string;
  createdAt: Date;
  mediaUrls: string[];
  totalAttachments: number;
}

export interface TwitterCanvasResult {
  buffer: Buffer;
  embeddedMediaUrls: string[];
}

const WIDTH = 1200;
const PADDING = 68;
const CONTENT_WIDTH = WIDTH - PADDING * 2;

export async function createTwitterCard(input: TwitterCanvasInput): Promise<TwitterCanvasResult> {
  const mediaEntries = await Promise.all(
    input.mediaUrls.slice(0, 4).map(async url => ({ url, image: await safeLoad(url) }))
  );
  const loadedMedia = mediaEntries.filter((entry): entry is { url: string; image: any } => Boolean(entry.image));

  const measuring = createCanvas(WIDTH, 400).getContext('2d');
  measuring.font = '500 34px Arial';
  const lines = wrapMeasuredText(measuring, input.message || '', CONTENT_WIDTH, 18);
  const textHeight = lines.length ? lines.length * 45 + 10 : 0;
  const mediaHeight = loadedMedia.length ? 540 : 0;
  const attachmentLine = Math.max(0, input.totalAttachments - loadedMedia.length) > 0 ? 38 : 0;
  const height = Math.max(430, 242 + textHeight + mediaHeight + attachmentLine + 105);

  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, WIDTH, height);

  ctx.strokeStyle = '#2f3336';
  ctx.lineWidth = 2;
  roundedRect(ctx, 20, 20, WIDTH - 40, height - 40, 34);
  ctx.stroke();

  drawXLogo(ctx, WIDTH - PADDING - 54, 63, 52);

  const avatar = input.avatarUrl ? await safeLoad(input.avatarUrl) : null;
  drawAvatar(ctx, avatar, PADDING, 66, 94, initials(input.displayName));

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f2f2f2';
  ctx.font = '700 31px Arial';
  ctx.fillText(trim(input.displayName, 34), PADDING + 120, 102);

  ctx.fillStyle = '#71767b';
  ctx.font = '500 22px Arial';
  ctx.fillText(`@${trim(input.username, 34)}`, PADDING + 120, 137);

  ctx.fillStyle = '#71767b';
  ctx.font = '500 18px Arial';
  const time = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(input.createdAt);
  ctx.fillText(`${trim(input.guildName, 42)}  ·  ${time}`, PADDING + 120, 169);

  let cursorY = 224;
  if (lines.length) {
    ctx.fillStyle = '#f2f2f2';
    ctx.font = '500 34px Arial';
    for (const line of lines) {
      ctx.fillText(line, PADDING, cursorY);
      cursorY += 45;
    }
    cursorY += 18;
  }

  if (loadedMedia.length) {
    drawMediaGrid(ctx, loadedMedia.map(entry => entry.image), PADDING, cursorY, CONTENT_WIDTH, mediaHeight);
    cursorY += mediaHeight + 28;
  }

  const remainingAttachments = Math.max(0, input.totalAttachments - loadedMedia.length);
  if (remainingAttachments > 0) {
    ctx.fillStyle = '#71767b';
    ctx.font = '500 19px Arial';
    ctx.fillText(`${remainingAttachments} anexo${remainingAttachments === 1 ? '' : 's'} enviado${remainingAttachments === 1 ? '' : 's'} junto com a publicação`, PADDING, cursorY);
    cursorY += 38;
  }

  ctx.strokeStyle = '#2f3336';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PADDING, height - 88);
  ctx.lineTo(WIDTH - PADDING, height - 88);
  ctx.stroke();

  ctx.fillStyle = '#71767b';
  ctx.font = '500 18px Arial';
  ctx.fillText('Publicado no X', PADDING, height - 50);

  ctx.fillStyle = '#f2f2f2';
  ctx.font = '700 18px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(trim(input.guildName, 48), WIDTH - PADDING, height - 50);

  return {
    buffer: Buffer.from(await canvas.encode('png')),
    embeddedMediaUrls: loadedMedia.map(entry => entry.url)
  };
}

function drawXLogo(ctx: any, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size * 0.27, 0);
  ctx.lineTo(size, size);
  ctx.lineTo(size * 0.72, size);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(size * 0.72, 0);
  ctx.lineTo(size, 0);
  ctx.lineTo(size * 0.28, size);
  ctx.lineTo(0, size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawAvatar(ctx: any, image: any | null, x: number, y: number, size: number, fallback: string): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  if (image) drawCover(ctx, image, x, y, size, size);
  else {
    ctx.fillStyle = '#16181c';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.floor(size * 0.38)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fallback, x + size / 2, y + size / 2 + 2);
  }
  ctx.restore();
  ctx.strokeStyle = '#2f3336';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.stroke();
}

function drawMediaGrid(ctx: any, images: any[], x: number, y: number, width: number, height: number): void {
  const gap = 8;
  ctx.save();
  roundedRect(ctx, x, y, width, height, 28);
  ctx.clip();
  ctx.fillStyle = '#16181c';
  ctx.fillRect(x, y, width, height);

  if (images.length === 1) {
    drawCover(ctx, images[0], x, y, width, height);
  } else if (images.length === 2) {
    const half = (width - gap) / 2;
    drawCover(ctx, images[0], x, y, half, height);
    drawCover(ctx, images[1], x + half + gap, y, half, height);
  } else if (images.length === 3) {
    const half = (width - gap) / 2;
    const halfHeight = (height - gap) / 2;
    drawCover(ctx, images[0], x, y, half, height);
    drawCover(ctx, images[1], x + half + gap, y, half, halfHeight);
    drawCover(ctx, images[2], x + half + gap, y + halfHeight + gap, half, halfHeight);
  } else {
    const half = (width - gap) / 2;
    const halfHeight = (height - gap) / 2;
    for (let index = 0; index < 4; index += 1) {
      const col = index % 2;
      const row = Math.floor(index / 2);
      drawCover(ctx, images[index], x + col * (half + gap), y + row * (halfHeight + gap), half, halfHeight);
    }
  }
  ctx.restore();
  ctx.strokeStyle = '#2f3336';
  ctx.lineWidth = 2;
  roundedRect(ctx, x, y, width, height, 28);
  ctx.stroke();
}

function wrapMeasuredText(ctx: any, text: string, maxWidth: number, maxLines: number): string[] {
  if (!text.trim()) return [];
  const output: string[] = [];
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    if (!paragraph.trim()) {
      output.push('');
      if (output.length >= maxLines) break;
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) output.push(line);
      line = word;
      if (output.length >= maxLines) break;
    }
    if (output.length >= maxLines) break;
    if (line) output.push(line);
    if (output.length >= maxLines) break;
  }
  if (output.length === maxLines && text.length > output.join(' ').length) {
    const last = output[maxLines - 1] ?? '';
    output[maxLines - 1] = `${last.slice(0, Math.max(0, last.length - 1))}…`;
  }
  return output;
}

async function safeLoad(url: string): Promise<any | null> {
  try { return await loadImage(url); }
  catch { return null; }
}

function drawCover(ctx: any, image: any, x: number, y: number, width: number, height: number): void {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || '?';
}

function trim(value: string, maximum: number): string {
  return value.length > maximum ? `${value.slice(0, maximum - 1)}…` : value;
}

function roundedRect(ctx: any, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
