"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireInstanceLock = acquireInstanceLock;
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
async function acquireInstanceLock() {
    const directory = node_path_1.default.resolve('data', 'system');
    const file = node_path_1.default.join(directory, 'runtime-lock.json');
    await (0, promises_1.mkdir)(directory, { recursive: true });
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const handle = await (0, promises_1.open)(file, 'wx');
            await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2) + '\n', 'utf8');
            await handle.close();
            const release = () => {
                try {
                    if (!(0, node_fs_1.existsSync)(file))
                        return;
                    const current = JSON.parse(require('node:fs').readFileSync(file, 'utf8'));
                    if (current.pid === process.pid)
                        (0, node_fs_1.unlinkSync)(file);
                }
                catch { /* o sistema operacional limpará o arquivo na próxima inicialização */ }
            };
            process.once('exit', release);
            return release;
        }
        catch (error) {
            if (error?.code !== 'EEXIST')
                throw error;
            const stale = await isStale(file);
            if (!stale)
                throw new Error('Outra instância deste bot já está em execução nesta pasta. Feche o processo anterior antes de iniciar novamente.');
            await (0, promises_1.unlink)(file).catch(() => undefined);
        }
    }
    throw new Error('Não foi possível criar o bloqueio de instância única.');
}
async function isStale(file) {
    try {
        const data = JSON.parse(await (0, promises_1.readFile)(file, 'utf8'));
        if (!Number.isInteger(data.pid) || data.pid <= 0)
            return true;
        try {
            process.kill(data.pid, 0);
            return false;
        }
        catch (error) {
            return error?.code === 'ESRCH';
        }
    }
    catch {
        return true;
    }
}
//# sourceMappingURL=instanceLock.js.map