"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderPresenceText = renderPresenceText;
exports.applyPresence = applyPresence;
exports.startPresenceRotation = startPresenceRotation;
exports.parsePresenceRotation = parsePresenceRotation;
exports.normalizeRotationInterval = normalizeRotationInterval;
const discord_js_1 = require("discord.js");
const activityMap = {
    playing: discord_js_1.ActivityType.Playing,
    streaming: discord_js_1.ActivityType.Streaming,
    listening: discord_js_1.ActivityType.Listening,
    watching: discord_js_1.ActivityType.Watching,
    competing: discord_js_1.ActivityType.Competing,
    custom: discord_js_1.ActivityType.Custom
};
function renderPresenceText(client, config, template) {
    const guilds = [...(client.guilds?.cache?.values?.() ?? [])];
    const members = guilds.reduce((total, guild) => total + Number(guild.memberCount ?? 0), 0);
    const channels = guilds.reduce((total, guild) => total + Number(guild.channels?.cache?.size ?? 0), 0);
    const uptimeMs = Number(client.uptime ?? 0);
    const uptime = formatShortUptime(uptimeMs);
    const replacements = {
        members: String(members),
        servers: String(guilds.length),
        channels: String(channels),
        prefix: config.prefix,
        bot: String(client.user?.username ?? 'bot'),
        ping: String(Math.max(0, Math.round(Number(client.ws?.ping ?? 0)))),
        uptime
    };
    return String(template ?? '').replace(/\[([a-z]+)\]/gi, (full, key) => replacements[key.toLowerCase()] ?? full).slice(0, 128);
}
function applyPresence(client, config, activity) {
    const selected = activity ?? config.defaultPresence;
    const type = selected.activityType;
    const text = renderPresenceText(client, config, selected.activityText ?? '');
    client.user?.setPresence({
        status: config.defaultPresence.status,
        activities: type === 'none' || !text ? [] : [{
                name: text,
                type: activityMap[type] ?? discord_js_1.ActivityType.Watching,
                url: type === 'streaming' ? selected.streamUrl : undefined
            }]
    });
}
function startPresenceRotation(client, config) {
    let index = 0;
    let nextAt = 0;
    let lastRotationEnabled = null;
    const update = () => {
        const rotation = Array.isArray(config.defaultPresence.rotationActivities)
            ? config.defaultPresence.rotationActivities.filter(item => item && item.activityType !== 'none' && String(item.activityText ?? '').trim())
            : [];
        const enabled = Boolean(config.defaultPresence.rotationEnabled && rotation.length);
        if (enabled) {
            if (lastRotationEnabled === false)
                index = 0;
            applyPresence(client, config, rotation[index % rotation.length]);
            index = (index + 1) % rotation.length;
        }
        else {
            applyPresence(client, config);
            index = 0;
        }
        lastRotationEnabled = enabled;
        nextAt = Date.now() + normalizeRotationInterval(config.defaultPresence.rotationIntervalSeconds) * 1000;
    };
    update();
    const timer = setInterval(() => {
        if (Date.now() >= nextAt)
            update();
    }, 1000);
    timer.unref();
    return timer;
}
function parsePresenceRotation(raw) {
    const result = [];
    for (const line of String(raw ?? '').split(/\r?\n/)) {
        const clean = line.trim();
        if (!clean)
            continue;
        const [typeRaw, ...textParts] = clean.split('|');
        const activityType = String(typeRaw ?? '').trim().toLowerCase();
        const activityText = textParts.join('|').trim();
        if (!['playing', 'streaming', 'listening', 'watching', 'competing', 'custom'].includes(activityType))
            continue;
        if (!activityText)
            continue;
        result.push({ activityType, activityText: activityText.slice(0, 128) });
        if (result.length >= 10)
            break;
    }
    return result;
}
function normalizeRotationInterval(value) {
    const number = Number(value ?? 5);
    if (!Number.isFinite(number))
        return 5;
    return Math.min(300, Math.max(5, Math.floor(number)));
}
function formatShortUptime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (days)
        return `${days}d ${hours}h`;
    if (hours)
        return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}
//# sourceMappingURL=presence.js.map