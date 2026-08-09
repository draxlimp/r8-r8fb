"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.clearConfigCache = clearConfigCache;
exports.saveConfig = saveConfig;
const promises_1 = require("node:fs/promises");
const atomicWriter_1 = require("../storage/atomicWriter");
const mutex_1 = require("../utils/mutex");
const node_path_1 = __importDefault(require("node:path"));
let cached = null;
const configMutex = new mutex_1.KeyedMutex();
async function loadConfig(force = false) {
    if (cached && !force)
        return cached;
    const file = node_path_1.default.resolve(process.cwd(), 'config.json');
    const parsed = JSON.parse(await (0, promises_1.readFile)(file, 'utf8'));
    const errors = [];
    if (!parsed.token || typeof parsed.token !== 'string')
        errors.push('token ausente');
    if (!parsed.prefix || typeof parsed.prefix !== 'string')
        errors.push('prefixo ausente');
    if (!Array.isArray(parsed.owners))
        errors.push('owners deve ser uma lista');
    if (!parsed.credits || !Array.isArray(parsed.credits.people))
        errors.push('credits.people deve ser uma lista');
    if (!parsed.panel || typeof parsed.panel.sessionTimeoutSeconds !== 'number')
        errors.push('panel.sessionTimeoutSeconds inválido');
    if (errors.length)
        throw new Error(`Configuração inválida: ${errors.join(', ')}`);
    if (parsed.token === 'COLOQUE_O_TOKEN_AQUI')
        throw new Error('Defina o token real em config.json antes de iniciar.');
    cached = parsed;
    return cached;
}
function clearConfigCache() { cached = null; }
async function saveConfig(config) {
    await configMutex.run('global-config', async () => {
        await (0, atomicWriter_1.atomicWriteJson)(node_path_1.default.resolve(process.cwd(), 'config.json'), config, true);
        cached = structuredClone(config);
    });
}
//# sourceMappingURL=configLoader.js.map