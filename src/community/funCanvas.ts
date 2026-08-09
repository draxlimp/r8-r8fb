import { createCanvas, loadImage } from '@napi-rs/canvas';

export interface FunCanvasUser {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

export type AvatarEffect = 'blur' | 'pixelate' | 'grayscale' | 'invert';

export async function createWantedCard(user: FunCanvasUser): Promise<Buffer> {
  const canvas = createCanvas(900, 1120);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#d8c18e';
  ctx.fillRect(0, 0, 900, 1120);
  ctx.fillStyle = '#f1dfad';
  ctx.fillRect(42, 42, 816, 1036);
  ctx.strokeStyle = '#6c4b27';
  ctx.lineWidth = 12;
  ctx.strokeRect(42, 42, 816, 1036);

  ctx.fillStyle = '#3b2918';
  ctx.textAlign = 'center';
  ctx.font = '900 108px Arial';
  ctx.fillText('WANTED', 450, 155);
  ctx.font = '700 35px Arial';
  ctx.fillText('PROCURA-SE', 450, 208);

  const image = user.avatarUrl ? await safeLoad(user.avatarUrl) : null;
  drawSquareImage(ctx, image, 145, 270, 610, initials(user.displayName), '#5c4126');

  ctx.fillStyle = '#3b2918';
  ctx.font = '800 47px Arial';
  ctx.fillText(trim(user.displayName, 24), 450, 955);
  ctx.font = '600 29px Arial';
  ctx.fillText(`@${trim(user.username, 32)}`, 450, 1003);
  ctx.font = '600 22px Arial';
  ctx.fillText(`ID ${user.id}`, 450, 1047);

  return Buffer.from(await canvas.encode('png'));
}

export async function createJailCard(user: FunCanvasUser, guildName = 'Comunidade'): Promise<Buffer> {
  const canvas = createCanvas(1200, 820);
  const ctx = canvas.getContext('2d');

  const background = ctx.createLinearGradient(0, 0, 0, 820);
  background.addColorStop(0, '#1b1f24');
  background.addColorStop(1, '#090b0d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1200, 820);

  // Parede de identificação da cela.
  ctx.fillStyle = '#c9ced2';
  roundRect(ctx, 125, 70, 950, 650, 28);
  ctx.fill();

  ctx.strokeStyle = 'rgba(25,29,33,0.32)';
  ctx.lineWidth = 3;
  for (let y = 165; y < 660; y += 82) {
    ctx.beginPath();
    ctx.moveTo(165, y);
    ctx.lineTo(1035, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#252a30';
  ctx.font = '700 18px Arial';
  ctx.textAlign = 'left';
  for (let index = 0; index < 6; index += 1) ctx.fillText(`${170 - index * 10} cm`, 175, 160 + index * 82);

  // Corpo de uniforme de presidiário.
  ctx.fillStyle = '#d97824';
  roundRect(ctx, 390, 405, 420, 255, 72);
  ctx.fill();
  ctx.save();
  roundRect(ctx, 390, 405, 420, 255, 72);
  ctx.clip();
  ctx.fillStyle = '#24282d';
  for (let y = 430; y < 670; y += 58) ctx.fillRect(365, y, 470, 22);
  ctx.restore();

  const image = user.avatarUrl ? await safeLoad(user.avatarUrl) : null;
  drawHead(ctx, image, 450, 155, 300, initials(user.displayName));

  // Placa de identificação central.
  ctx.fillStyle = '#f2f2ef';
  roundRect(ctx, 428, 522, 344, 98, 14);
  ctx.fill();
  ctx.strokeStyle = '#20242a';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#20242a';
  ctx.font = '900 30px Arial';
  ctx.fillText(`ID ${user.id.slice(-6)}`, 600, 566);
  ctx.font = '700 20px Arial';
  ctx.fillText(trim(user.displayName, 24), 600, 597);

  ctx.fillStyle = '#d97824';
  ctx.beginPath();
  ctx.ellipse(600, 168, 164, 42, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20242a';
  ctx.fillRect(450, 160, 300, 20);

  // Grades em primeiro plano, com espaço central para o rosto continuar visível.
  ctx.fillStyle = 'rgba(9,11,13,0.96)';
  const bars = [58, 210, 362, 806, 958, 1110];
  for (const x of bars) {
    roundRect(ctx, x, 0, 28, 820, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x + 5, 0, 4, 820);
    ctx.fillStyle = 'rgba(9,11,13,0.96)';
  }
  ctx.fillRect(35, 92, 1130, 28);
  ctx.fillRect(35, 702, 1130, 28);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 31px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(trim(guildName, 42), 600, 776);

  return Buffer.from(await canvas.encode('png'));
}

export async function createProfileCard(user: FunCanvasUser, details: { guildName: string; joinedText: string; roleCount: number }): Promise<Buffer> {
  const canvas = createCanvas(1100, 560);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1100, 560);
  gradient.addColorStop(0, '#111827');
  gradient.addColorStop(1, '#303b62');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1100, 560);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let x = -100; x < 1200; x += 130) { ctx.beginPath(); ctx.arc(x, 40 + (x % 260), 80, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(17,24,39,0.86)';
  roundRect(ctx, 40, 40, 1020, 480, 34); ctx.fill();
  const image = user.avatarUrl ? await safeLoad(user.avatarUrl) : null;
  drawCircleImage(ctx, image, 90, 125, 270, initials(user.displayName), '#5865f2');
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.font = '900 46px Arial'; ctx.fillText(trim(user.displayName, 27), 410, 165);
  ctx.fillStyle = '#aeb8d0'; ctx.font = '600 25px Arial'; ctx.fillText(`@${trim(user.username, 34)}`, 410, 205);
  ctx.fillStyle = '#8ea1ff'; ctx.font = '800 21px Arial'; ctx.fillText(details.guildName.slice(0, 48), 410, 260);
  drawInfoBox(ctx, 410, 300, 270, 105, 'ENTROU', details.joinedText);
  drawInfoBox(ctx, 710, 300, 270, 105, 'CARGOS', String(details.roleCount));
  ctx.fillStyle = '#77829c'; ctx.font = '500 18px Arial'; ctx.fillText(`ID ${user.id}`, 410, 466);
  return Buffer.from(await canvas.encode('png'));
}

export async function createQuoteCard(user: FunCanvasUser, text: string, guildName: string): Promise<Buffer> {
  const canvas = createCanvas(1200, 650);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1200, 650);
  gradient.addColorStop(0, '#0f172a'); gradient.addColorStop(1, '#1e293b');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 650);
  const image = user.avatarUrl ? await safeLoad(user.avatarUrl) : null;
  if (image) {
    ctx.globalAlpha = 0.22;
    const scale = Math.max(650 / image.height, 600 / image.width);
    ctx.drawImage(image, 0, 0, image.width * scale, image.height * scale);
    ctx.globalAlpha = 1;
  }
  const overlay = ctx.createLinearGradient(150, 0, 850, 0);
  overlay.addColorStop(0, 'rgba(15,23,42,0.35)'); overlay.addColorStop(1, 'rgba(15,23,42,0.98)');
  ctx.fillStyle = overlay; ctx.fillRect(0, 0, 1200, 650);
  ctx.fillStyle = '#60a5fa'; ctx.font = '900 100px Georgia'; ctx.textAlign = 'left'; ctx.fillText('“', 590, 155);
  ctx.fillStyle = '#ffffff'; ctx.font = '700 34px Arial';
  drawWrappedText(ctx, text.slice(0, 500), 610, 205, 500, 48, 7);
  ctx.fillStyle = '#93c5fd'; ctx.font = '800 25px Arial'; ctx.fillText(`— ${trim(user.displayName, 28)}`, 610, 535);
  ctx.fillStyle = '#94a3b8'; ctx.font = '500 18px Arial'; ctx.fillText(guildName.slice(0, 55), 610, 572);
  return Buffer.from(await canvas.encode('png'));
}

export async function createAvatarEffectCard(user: FunCanvasUser, effect: AvatarEffect): Promise<Buffer> {
  const canvas = createCanvas(900, 900);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#101318'; ctx.fillRect(0, 0, 900, 900);
  const image = user.avatarUrl ? await safeLoad(user.avatarUrl) : null;
  if (!image) {
    ctx.fillStyle = '#5865f2'; ctx.fillRect(80, 80, 740, 740);
    ctx.fillStyle = '#fff'; ctx.font = '900 220px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(initials(user.displayName), 450, 450);
  } else if (effect === 'pixelate') {
    const temp = createCanvas(48, 48); const tctx = temp.getContext('2d');
    drawCover(tctx, image, 0, 0, 48, 48);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(temp, 80, 80, 740, 740); ctx.imageSmoothingEnabled = true;
  } else {
    drawCover(ctx, image, 80, 80, 740, 740);
    if (effect === 'grayscale' || effect === 'invert') {
      const data = ctx.getImageData(80, 80, 740, 740);
      for (let index = 0; index < data.data.length; index += 4) {
        const r = data.data[index]!, g = data.data[index + 1]!, b = data.data[index + 2]!;
        if (effect === 'grayscale') {
          const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
          data.data[index] = gray; data.data[index + 1] = gray; data.data[index + 2] = gray;
        } else {
          data.data[index] = 255 - r; data.data[index + 1] = 255 - g; data.data[index + 2] = 255 - b;
        }
      }
      ctx.putImageData(data, 80, 80);
    } else if (effect === 'blur') {
      const copy = createCanvas(740, 740); const copyCtx = copy.getContext('2d'); copyCtx.drawImage(canvas, 80, 80, 740, 740, 0, 0, 740, 740);
      ctx.fillStyle = '#101318'; ctx.fillRect(80, 80, 740, 740); ctx.globalAlpha = 0.085;
      for (let dx = -16; dx <= 16; dx += 4) for (let dy = -16; dy <= 16; dy += 4) ctx.drawImage(copy, 80 + dx, 80 + dy);
      ctx.globalAlpha = 1;
    }
  }
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 12; ctx.strokeRect(80, 80, 740, 740);
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(80, 760, 740, 60);
  ctx.fillStyle = '#ffffff'; ctx.font = '800 27px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${effectLabel(effect)} • @${trim(user.username, 25)}`, 450, 790);
  return Buffer.from(await canvas.encode('png'));
}

export async function createAchievementCard(user: FunCanvasUser, achievement: string): Promise<Buffer> {
  const canvas = createCanvas(1100, 420);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1100, 420); gradient.addColorStop(0, '#1f2937'); gradient.addColorStop(1, '#111827');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1100, 420);
  ctx.fillStyle = '#f59e0b'; roundRect(ctx, 34, 34, 1032, 352, 30); ctx.fill();
  ctx.fillStyle = '#161b24'; roundRect(ctx, 46, 46, 1008, 328, 24); ctx.fill();
  const image = user.avatarUrl ? await safeLoad(user.avatarUrl) : null;
  drawCircleImage(ctx, image, 80, 92, 236, initials(user.displayName), '#f59e0b');
  ctx.fillStyle = '#fbbf24'; ctx.textAlign = 'left'; ctx.font = '900 25px Arial'; ctx.fillText('CONQUISTA DESBLOQUEADA', 360, 116);
  ctx.fillStyle = '#ffffff'; ctx.font = '900 39px Arial'; drawWrappedText(ctx, achievement.slice(0, 150), 360, 170, 620, 48, 3);
  ctx.fillStyle = '#9ca3af'; ctx.font = '600 21px Arial'; ctx.fillText(`${user.displayName} • @${user.username}`, 360, 330);
  return Buffer.from(await canvas.encode('png'));
}

async function safeLoad(url: string): Promise<any | null> { try { return await loadImage(url); } catch { return null; } }

function drawHead(ctx: any, image: any | null, x: number, y: number, size: number, fallback: string): void {
  ctx.save(); ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
  if (image) drawCover(ctx, image, x, y, size, size);
  else { ctx.fillStyle = '#5865f2'; ctx.fillRect(x, y, size, size); ctx.fillStyle = '#fff'; ctx.font = '800 80px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(fallback, x + size / 2, y + size / 2); }
  ctx.restore(); ctx.strokeStyle = '#20242a'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.stroke();
}

function drawSquareImage(ctx: any, image: any | null, x: number, y: number, size: number, fallback: string, fallbackColor: string): void {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
  if (image) drawCover(ctx, image, x, y, size, size);
  else { ctx.fillStyle = fallbackColor; ctx.fillRect(x, y, size, size); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 150px Arial'; ctx.fillText(fallback, x + size / 2, y + size / 2); }
  ctx.restore();
}

function drawCircleImage(ctx: any, image: any | null, x: number, y: number, size: number, fallback: string, fallbackColor: string): void {
  ctx.save(); ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
  if (image) drawCover(ctx, image, x, y, size, size);
  else { ctx.fillStyle = fallbackColor; ctx.fillRect(x, y, size, size); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 72px Arial'; ctx.fillText(fallback, x + size / 2, y + size / 2); }
  ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.stroke();
}

function drawCover(ctx: any, image: any, x: number, y: number, width: number, height: number): void {
  const scale = Math.max(width / image.width, height / image.height); const w = image.width * scale; const h = image.height * scale;
  ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
}

function drawInfoBox(ctx: any, x: number, y: number, width: number, height: number, label: string, value: string): void {
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; roundRect(ctx, x, y, width, height, 18); ctx.fill();
  ctx.fillStyle = '#8794b3'; ctx.font = '700 16px Arial'; ctx.fillText(label, x + 22, y + 32);
  ctx.fillStyle = '#ffffff'; ctx.font = '800 25px Arial'; ctx.fillText(value.slice(0, 20), x + 22, y + 72);
}

function drawWrappedText(ctx: any, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): void {
  const words = text.replace(/\s+/g, ' ').trim().split(' '); let line = ''; let lineIndex = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineIndex * lineHeight); lineIndex += 1; line = word;
      if (lineIndex >= maxLines) return;
    } else line = test;
  }
  if (line && lineIndex < maxLines) ctx.fillText(line, x, y + lineIndex * lineHeight);
}

function effectLabel(effect: AvatarEffect): string { return ({ blur:'Desfoque', pixelate:'Pixelado', grayscale:'Preto e branco', invert:'Cores invertidas' } as const)[effect]; }
function initials(value: string): string { return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || '?'; }
function trim(value: string, maximum: number): string { return value.length > maximum ? `${value.slice(0, maximum - 1)}…` : value; }
function roundRect(ctx: any, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + width, y, x + width, y + height, r); ctx.arcTo(x + width, y + height, x, y + height, r); ctx.arcTo(x, y + height, x, y, r); ctx.arcTo(x, y, x + width, y, r); ctx.closePath();
}
