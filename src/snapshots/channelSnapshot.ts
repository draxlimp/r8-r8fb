export interface ChannelSnapshot {
  id: string; name: string; type: number; position: number; parentId: string | null; topic: string | null; nsfw: boolean; rateLimitPerUser: number;
  bitrate?: number; userLimit?: number; permissionOverwrites: Array<{ id: string; type: number; allow: string; deny: string }>;
  capturedAt: string; version: number;
}
export function captureChannel(channel: any): ChannelSnapshot {
  return {
    id: channel.id, name: channel.name, type: channel.type, position: channel.rawPosition ?? channel.position ?? 0, parentId: channel.parentId ?? null,
    topic: channel.topic ?? null, nsfw: Boolean(channel.nsfw), rateLimitPerUser: channel.rateLimitPerUser ?? 0, bitrate: channel.bitrate, userLimit: channel.userLimit,
    permissionOverwrites: channel.permissionOverwrites?.cache.map((o: any) => ({ id:o.id, type:o.type, allow:o.allow.bitfield.toString(), deny:o.deny.bitfield.toString() })) ?? [],
    capturedAt: new Date().toISOString(), version: 1
  };
}
