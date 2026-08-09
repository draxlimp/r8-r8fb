"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const weights = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40, CRITICAL: 50 };
class Logger {
    level;
    rotateAfterBytes;
    keepFiles;
    constructor(level = 'INFO', rotateAfterBytes = 5_242_880, keepFiles = 10) {
        this.level = level;
        this.rotateAfterBytes = rotateAfterBytes;
        this.keepFiles = keepFiles;
    }
    setLevel(level) { this.level = level; }
    configure(level, rotateAfterBytes, keepFiles) {
        this.level = level;
        this.rotateAfterBytes = Math.max(1024, rotateAfterBytes);
        this.keepFiles = Math.max(1, keepFiles);
    }
    debug(message, meta) { void this.write('DEBUG', message, meta); }
    info(message, meta) { void this.write('INFO', message, meta); }
    warn(message, meta) { void this.write('WARN', message, meta); }
    error(message, meta) { void this.write('ERROR', message, meta); }
    critical(message, meta) { void this.write('CRITICAL', message, meta); }
    sanitize(value) {
        if (!value || typeof value !== 'object')
            return value;
        const clone = JSON.parse(JSON.stringify(value));
        for (const key of Object.keys(clone))
            if (/token|secret|authorization/i.test(key))
                clone[key] = '[REDACTED]';
        return clone;
    }
    async write(level, message, meta) {
        if (weights[level] < weights[this.level])
            return;
        const code = Math.random().toString(16).slice(2, 10).toUpperCase();
        const suffix = meta === undefined ? '' : ` ${JSON.stringify(this.sanitize(meta))}`;
        const line = `[${new Date().toISOString()}] [${level}] [${code}] ${message}${suffix}`;
        console[level === 'ERROR' || level === 'CRITICAL' ? 'error' : level === 'WARN' ? 'warn' : 'log'](line);
        try {
            const dir = node_path_1.default.resolve('logs');
            await (0, promises_1.mkdir)(dir, { recursive: true });
            const file = node_path_1.default.join(dir, 'r8-protection.log');
            try {
                if ((await (0, promises_1.stat)(file)).size >= this.rotateAfterBytes)
                    await (0, promises_1.rename)(file, node_path_1.default.join(dir, `r8-protection-${Date.now()}.log`));
            }
            catch { }
            await (0, promises_1.appendFile)(file, line + '\n', 'utf8');
            const files = (await (0, promises_1.readdir)(dir)).filter((f) => /^r8-protection-\d+\.log$/.test(f)).sort().reverse();
            for (const old of files.slice(this.keepFiles))
                await (0, promises_1.unlink)(node_path_1.default.join(dir, old)).catch(() => undefined);
        }
        catch { }
    }
}
exports.Logger = Logger;
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map