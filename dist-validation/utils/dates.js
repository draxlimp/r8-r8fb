"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nowIso = nowIso;
exports.isExpired = isExpired;
exports.durationFromNow = durationFromNow;
function nowIso() { return new Date().toISOString(); }
function isExpired(iso, now = Date.now()) { return Boolean(iso && Date.parse(iso) <= now); }
function durationFromNow(seconds) { return new Date(Date.now() + seconds * 1000).toISOString(); }
//# sourceMappingURL=dates.js.map