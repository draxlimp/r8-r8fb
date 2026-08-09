"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const node_crypto_1 = require("node:crypto");
class SessionManager {
    defaultTimeoutSeconds;
    maxPerUser;
    sessions = new Map();
    constructor(defaultTimeoutSeconds, maxPerUser) {
        this.defaultTimeoutSeconds = defaultTimeoutSeconds;
        this.maxPerUser = maxPerUser;
    }
    create(userId, guildId, channelId, timeoutSeconds = this.defaultTimeoutSeconds) {
        const active = [...this.sessions.values()].filter(session => session.userId === userId && session.guildId === guildId);
        for (const old of active.slice(0, Math.max(0, active.length - this.maxPerUser + 1)))
            this.sessions.delete(old.id);
        const session = {
            id: (0, node_crypto_1.randomBytes)(6).toString('hex'), userId, guildId, channelId, messageId: null, page: 'home',
            createdAt: Date.now(), lastInteractionAt: Date.now(), timeoutSeconds, state: {}, busy: false
        };
        this.sessions.set(session.id, session);
        return session;
    }
    get(id) {
        const session = this.sessions.get(id);
        if (!session)
            return null;
        if (this.expired(session)) {
            this.sessions.delete(id);
            return null;
        }
        return session;
    }
    touch(id) { const session = this.sessions.get(id); if (session)
        session.lastInteractionAt = Date.now(); }
    close(id) { this.sessions.delete(id); }
    expired(session) { return Date.now() - session.lastInteractionAt > session.timeoutSeconds * 1000; }
    cleanup() {
        const removed = [];
        for (const [id, session] of this.sessions)
            if (this.expired(session)) {
                removed.push(session);
                this.sessions.delete(id);
            }
        return removed;
    }
    list() { return [...this.sessions.values()]; }
}
exports.SessionManager = SessionManager;
//# sourceMappingURL=sessionManager.js.map