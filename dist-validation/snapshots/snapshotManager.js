"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureGuildSnapshot = captureGuildSnapshot;
exports.loadGuildSnapshot = loadGuildSnapshot;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const atomicWriter_1 = require("../storage/atomicWriter");
const channelSnapshot_1 = require("./channelSnapshot");
const roleSnapshot_1 = require("./roleSnapshot");
async function captureGuildSnapshot(guild) {
    const snapshot = { guildId: guild.id, name: guild.name, icon: guild.icon, banner: guild.banner, verificationLevel: guild.verificationLevel, explicitContentFilter: guild.explicitContentFilter, channels: {}, roles: {}, capturedAt: new Date().toISOString(), version: 1 };
    for (const channel of guild.channels.cache.values())
        snapshot.channels[channel.id] = (0, channelSnapshot_1.captureChannel)(channel);
    for (const role of guild.roles.cache.values())
        if (role.id !== guild.id)
            snapshot.roles[role.id] = (0, roleSnapshot_1.captureRole)(role);
    const dir = node_path_1.default.resolve('data', 'snapshots', guild.id);
    await (0, promises_1.mkdir)(dir, { recursive: true });
    await (0, atomicWriter_1.atomicWriteJson)(node_path_1.default.join(dir, 'latest.json'), snapshot, true);
    return snapshot;
}
async function loadGuildSnapshot(guildId) { try {
    return JSON.parse(await (0, promises_1.readFile)(node_path_1.default.resolve('data', 'snapshots', guildId, 'latest.json'), 'utf8'));
}
catch {
    return null;
} }
//# sourceMappingURL=snapshotManager.js.map