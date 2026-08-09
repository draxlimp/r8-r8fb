"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomIdManager = void 0;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
class CustomIdManager {
    secret;
    constructor(secret) {
        this.secret = secret;
    }
    static async create() { const dir = node_path_1.default.resolve('data', 'system'); const file = node_path_1.default.join(dir, 'panel-secret.json'); await (0, promises_1.mkdir)(dir, { recursive: true }); let hex; try {
        hex = JSON.parse(await (0, promises_1.readFile)(file, 'utf8')).secret;
    }
    catch {
        hex = (0, node_crypto_1.randomBytes)(32).toString('hex');
        await (0, promises_1.writeFile)(file, JSON.stringify({ secret: hex }, null, 2) + '\n', 'utf8');
    } return new CustomIdManager(Buffer.from(hex, 'hex')); }
    encode(sessionId, action, arg = '') { const safeArg = arg.replace(/\|/g, '').slice(0, 45); const body = `p|${sessionId}|${action}|${safeArg}`; const sig = (0, node_crypto_1.createHmac)('sha256', this.secret).update(body).digest('base64url').slice(0, 8); return `${body}|${sig}`; }
    decode(value) { const parts = value.split('|'); if (parts.length !== 5 || parts[0] !== 'p')
        return null; const body = parts.slice(0, 4).join('|'); const sig = (0, node_crypto_1.createHmac)('sha256', this.secret).update(body).digest('base64url').slice(0, 8); if (sig !== parts[4])
        return null; return { sessionId: parts[1], action: parts[2], arg: parts[3] }; }
}
exports.CustomIdManager = CustomIdManager;
//# sourceMappingURL=customIdManager.js.map