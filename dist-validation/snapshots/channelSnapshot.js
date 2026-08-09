"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureChannel = captureChannel;
function captureChannel(channel) {
    return {
        id: channel.id, name: channel.name, type: channel.type, position: channel.rawPosition ?? channel.position ?? 0, parentId: channel.parentId ?? null,
        topic: channel.topic ?? null, nsfw: Boolean(channel.nsfw), rateLimitPerUser: channel.rateLimitPerUser ?? 0, bitrate: channel.bitrate, userLimit: channel.userLimit,
        permissionOverwrites: channel.permissionOverwrites?.cache.map((o) => ({ id: o.id, type: o.type, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() })) ?? [],
        capturedAt: new Date().toISOString(), version: 1
    };
}
//# sourceMappingURL=channelSnapshot.js.map