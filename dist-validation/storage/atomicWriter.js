"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.atomicWriteJson = atomicWriteJson;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const ids_1 = require("../utils/ids");
async function atomicWriteJson(file, value, backup = true) {
    await (0, promises_1.mkdir)(node_path_1.default.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${(0, ids_1.randomId)(3)}.tmp`;
    if (backup)
        await (0, promises_1.copyFile)(file, `${file}.bak`).catch(() => undefined);
    const data = JSON.stringify(value, null, 2) + '\n';
    await (0, promises_1.writeFile)(temp, data, { encoding: 'utf8', flag: 'wx' });
    try {
        await (0, promises_1.rename)(temp, file);
    }
    catch (error) {
        await (0, promises_1.rm)(temp, { force: true });
        throw error;
    }
}
//# sourceMappingURL=atomicWriter.js.map