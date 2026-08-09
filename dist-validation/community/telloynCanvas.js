"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTelloynCard = createTelloynCard;
const canvas_1 = require("@napi-rs/canvas");
const WIDTH = 1200;
const PADDING = 72;
async function createTelloynCard(input) {
    const lines = wrapText(input.message, 58);
    const height = Math.max(520, 370 + lines.length * 46);
    const canvas = (0, canvas_1.createCanvas)(WIDTH, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, WIDTH, height);
    ctx.strokeStyle = '#e6e6e8';
    ctx.lineWidth = 3;
    roundedRect(ctx, 20, 20, WIDTH - 40, height - 40, 34);
    ctx.stroke();
    ctx.fillStyle = '#111111';
    ctx.font = '700 44px Arial';
    ctx.fillText('Telloyn', PADDING, 86);
    ctx.fillStyle = '#6b6b73';
    ctx.font = '500 23px Arial';
    ctx.fillText(input.guildName.slice(0, 55), PADDING, 122);
    ctx.strokeStyle = '#ededf0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PADDING, 151);
    ctx.lineTo(WIDTH - PADDING, 151);
    ctx.stroke();
    const avatarX = PADDING;
    const avatarY = 188;
    const avatarSize = 104;
    if (!input.anonymous && input.authorAvatarUrl) {
        const avatar = await safeLoadImage(input.authorAvatarUrl);
        if (avatar)
            drawCircleImage(ctx, avatar, avatarX, avatarY, avatarSize);
        else
            drawAnonymousAvatar(ctx, avatarX, avatarY, avatarSize);
    }
    else {
        drawAnonymousAvatar(ctx, avatarX, avatarY, avatarSize);
    }
    ctx.fillStyle = '#17171a';
    ctx.font = '700 31px Arial';
    ctx.fillText((input.anonymous ? 'Anônimo' : input.authorName).slice(0, 34), avatarX + avatarSize + 28, avatarY + 42);
    ctx.fillStyle = '#777780';
    ctx.font = '500 22px Arial';
    ctx.fillText((input.anonymous ? '@anonimo' : `@${input.authorUsername}`).slice(0, 42), avatarX + avatarSize + 28, avatarY + 76);
    const messageTop = avatarY + avatarSize + 62;
    ctx.fillStyle = '#202024';
    ctx.font = '500 30px Arial';
    lines.forEach((line, index) => ctx.fillText(line, PADDING, messageTop + index * 46));
    if (input.mentionedName) {
        const boxWidth = 420;
        const boxHeight = 92;
        const boxX = WIDTH - PADDING - boxWidth;
        const boxY = height - PADDING - boxHeight;
        ctx.fillStyle = '#f5f5f7';
        roundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 22);
        ctx.fill();
        const mentionAvatarSize = 58;
        const mentionAvatarX = boxX + 17;
        const mentionAvatarY = boxY + 17;
        const mentionAvatar = input.mentionedAvatarUrl ? await safeLoadImage(input.mentionedAvatarUrl) : null;
        if (mentionAvatar)
            drawCircleImage(ctx, mentionAvatar, mentionAvatarX, mentionAvatarY, mentionAvatarSize);
        else
            drawAnonymousAvatar(ctx, mentionAvatarX, mentionAvatarY, mentionAvatarSize);
        ctx.fillStyle = '#6f6f77';
        ctx.font = '600 16px Arial';
        ctx.fillText('MENCIONADO', boxX + 91, boxY + 29);
        ctx.fillStyle = '#17171a';
        ctx.font = '700 20px Arial';
        ctx.fillText(input.mentionedName.slice(0, 26), boxX + 91, boxY + 54);
        ctx.fillStyle = '#777780';
        ctx.font = '500 16px Arial';
        ctx.fillText(input.mentionedUsername ? `@${input.mentionedUsername}`.slice(0, 34) : '', boxX + 91, boxY + 76);
    }
    ctx.fillStyle = '#9a9aa1';
    ctx.font = '500 17px Arial';
    return Buffer.from(await canvas.encode('png'));
}
function wrapText(text, maxChars) {
    const paragraphs = text.replace(/\r/g, '').split('\n');
    const output = [];
    for (const paragraph of paragraphs) {
        if (!paragraph.trim()) {
            output.push('');
            continue;
        }
        const words = paragraph.split(/\s+/);
        let line = '';
        for (const word of words) {
            if (word.length > maxChars) {
                if (line)
                    output.push(line);
                for (let index = 0; index < word.length; index += maxChars)
                    output.push(word.slice(index, index + maxChars));
                line = '';
                continue;
            }
            const candidate = line ? `${line} ${word}` : word;
            if (candidate.length > maxChars) {
                output.push(line);
                line = word;
            }
            else
                line = candidate;
        }
        if (line)
            output.push(line);
    }
    return output.slice(0, 22);
}
async function safeLoadImage(url) {
    try {
        return await (0, canvas_1.loadImage)(url);
    }
    catch {
        return null;
    }
}
function drawCircleImage(ctx, image, x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    const scale = Math.max(size / image.width, size / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    ctx.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height);
    ctx.restore();
}
function drawAnonymousAvatar(ctx, x, y, size) {
    ctx.fillStyle = '#17171a';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.floor(size * 0.42)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('T', x + size / 2, y + size / 2 + 2);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
}
function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}
//# sourceMappingURL=telloynCanvas.js.map