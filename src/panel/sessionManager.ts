import { randomBytes } from 'node:crypto';

export interface PanelSession {
  id:string;
  userId:string;
  guildId:string;
  channelId:string;
  messageId:string|null;
  page:string;
  createdAt:number;
  lastInteractionAt:number;
  timeoutSeconds:number;
  state:Record<string,unknown>;
  busy:boolean;
}

export class SessionManager {
  private readonly sessions = new Map<string,PanelSession>();
  constructor(private readonly defaultTimeoutSeconds:number, private readonly maxPerUser:number) {}

  create(userId:string, guildId:string, channelId:string, timeoutSeconds = this.defaultTimeoutSeconds):PanelSession {
    const active = [...this.sessions.values()].filter(session => session.userId === userId && session.guildId === guildId);
    for (const old of active.slice(0, Math.max(0, active.length - this.maxPerUser + 1))) this.sessions.delete(old.id);
    const session:PanelSession = {
      id:randomBytes(6).toString('hex'), userId, guildId, channelId, messageId:null, page:'home',
      createdAt:Date.now(), lastInteractionAt:Date.now(), timeoutSeconds, state:{}, busy:false
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id:string):PanelSession|null {
    const session = this.sessions.get(id);
    if (!session) return null;
    if (this.expired(session)) { this.sessions.delete(id); return null; }
    return session;
  }
  touch(id:string):void { const session = this.sessions.get(id); if (session) session.lastInteractionAt = Date.now(); }
  close(id:string):void { this.sessions.delete(id); }
  expired(session:PanelSession):boolean { return Date.now() - session.lastInteractionAt > session.timeoutSeconds * 1000; }
  cleanup():PanelSession[] {
    const removed:PanelSession[] = [];
    for (const [id, session] of this.sessions) if (this.expired(session)) { removed.push(session); this.sessions.delete(id); }
    return removed;
  }
  list():PanelSession[] { return [...this.sessions.values()]; }
}
