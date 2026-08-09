"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureRole = captureRole;
function captureRole(role) { return { id: role.id, name: role.name, color: role.color, position: role.position, permissions: role.permissions.bitfield.toString(), hoist: role.hoist, mentionable: role.mentionable, icon: role.icon ?? null, unicodeEmoji: role.unicodeEmoji ?? null, capturedAt: new Date().toISOString(), version: 1 }; }
//# sourceMappingURL=roleSnapshot.js.map