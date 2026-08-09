"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shipCompatibility = void 0;
exports.createShipCard = createShipCard;
const canvas_1 = require("@napi-rs/canvas");
const shipCompatibility_1 = require("./shipCompatibility");
var shipCompatibility_2 = require("./shipCompatibility");
Object.defineProperty(exports, "shipCompatibility", { enumerable: true, get: function () { return shipCompatibility_2.shipCompatibility; } });
async function createShipCard(first, second, guildId = '', guildName = 'Comunidade') {
    const percentage = (0, shipCompatibility_1.shipCompatibility)(first.id, second.id, guildId);
    const canvas = (0, canvas_1.createCanvas)(1280, 720);
    const ctx = canvas.getContext('2d');
    const background = ctx.createLinearGradient(0, 0, 1280, 720);
    background.addColorStop(0, '#0a0a0f');
    background.addColorStop(0.5, '#18101a');
    background.addColorStop(1, '#0d0a12');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1280, 720);
    const glow = ctx.createRadialGradient(640, 340, 20, 640, 340, 430);
    glow.addColorStop(0, 'rgba(255, 73, 134, 0.20)');
    glow.addColorStop(1, 'rgba(255, 73, 134, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#a8a8b3';
    ctx.font = '700 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(trim(guildName, 48), 640, 48);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 45px Arial';
    ctx.fillText('Compatibilidade', 640, 98);
    const firstImage = first.avatarUrl ? await safeLoad(first.avatarUrl) : null;
    const secondImage = second.avatarUrl ? await safeLoad(second.avatarUrl) : null;
    drawPersonCard(ctx, first, firstImage, 70, 145, '#ff4f8b');
    drawPersonCard(ctx, second, secondImage, 850, 145, '#b66cff');
    ctx.save();
    ctx.shadowColor = 'rgba(255, 65, 126, 0.38)';
    ctx.shadowBlur = 34;
    const centerGradient = ctx.createLinearGradient(505, 0, 775, 0);
    centerGradient.addColorStop(0, '#ff4f8b');
    centerGradient.addColorStop(1, '#b66cff');
    ctx.fillStyle = centerGradient;
    roundRect(ctx, 493, 206, 294, 264, 54);
    ctx.fill();
    ctx.restore();
    drawHeart(ctx, 640, 255, 55, 'rgba(255,255,255,0.23)', 0, 1);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 86px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${percentage}%`, 640, 365);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '700 20px Arial';
    ctx.fillText('MATCH', 640, 411);
    const trackX = 240;
    const trackY = 566;
    const trackWidth = 800;
    ctx.fillStyle = '#2b2730';
    roundRect(ctx, trackX, trackY, trackWidth, 28, 14);
    ctx.fill();
    const fillWidth = Math.max(28, trackWidth * (percentage / 100));
    const meter = ctx.createLinearGradient(trackX, 0, trackX + trackWidth, 0);
    meter.addColorStop(0, '#ff4f8b');
    meter.addColorStop(1, '#b66cff');
    ctx.fillStyle = meter;
    roundRect(ctx, trackX, trackY, fillWidth, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 28px Arial';
    ctx.fillText(shipMessage(percentage), 640, 646);
    ctx.fillStyle = '#777481';
    ctx.font = '500 17px Arial';
    ctx.fillText(`${trim(first.username, 20)}  +  ${trim(second.username, 20)}`, 640, 682);
    return { buffer: Buffer.from(await canvas.encode('png')), percentage };
}
function drawPersonCard(ctx, user, image, x, y, accent) {
    ctx.fillStyle = 'rgba(255,255,255,0.055)';
    roundRect(ctx, x, y, 360, 360, 36);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, 360, 360, 36);
    ctx.stroke();
    drawAvatar(ctx, image, x + 60, y + 34, 240, initials(user.displayName), accent);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 30px Arial';
    ctx.fillText(trim(user.displayName, 20), x + 180, y + 310);
    ctx.fillStyle = '#8b8992';
    ctx.font = '500 19px Arial';
    ctx.fillText(`@${trim(user.username, 24)}`, x + 180, y + 342);
}
function shipMessage(value) {
    if (value >= 95)
        return 'Combinação lendária';
    if (value >= 80)
        return 'Corações em perfeita sintonia';
    if (value >= 60)
        return 'Uma conexão muito boa';
    if (value >= 40)
        return 'A sintonia pode surpreender';
    if (value >= 20)
        return 'Os opostos também se entendem';
    return 'O destino deixou a resposta em aberto';
}
async function safeLoad(url) {
    try {
        return await (0, canvas_1.loadImage)(url);
    }
    catch {
        return null;
    }
}
function drawAvatar(ctx, image, x, y, size, fallback, ring) {
    ctx.save();
    ctx.shadowColor = `${ring}66`;
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#101015';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    if (image)
        drawCover(ctx, image, x, y, size, size);
    else {
        ctx.fillStyle = ring;
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 72px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fallback, x + size / 2, y + size / 2);
    }
    ctx.restore();
    ctx.strokeStyle = ring;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 + 3, 0, Math.PI * 2);
    ctx.stroke();
}
function drawHeart(ctx, cx, cy, size, color, rotation = 0, alpha = 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.36);
    ctx.bezierCurveTo(-size * 1.1, -size * 0.28, -size * 0.72, -size * 1.05, 0, -size * 0.48);
    ctx.bezierCurveTo(size * 0.72, -size * 1.05, size * 1.1, -size * 0.28, 0, size * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}
function drawCover(ctx, image, x, y, width, height) {
    const scale = Math.max(width / image.width, height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
}
function initials(value) {
    return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || '?';
}
function trim(value, maximum) {
    return value.length > maximum ? `${value.slice(0, maximum - 1)}…` : value;
}
function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}
//# sourceMappingURL=shipCanvas.js.map