"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveIncident = saveIncident;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
async function saveIncident(incident) {
    const dir = node_path_1.default.resolve('data', 'incidents', incident.guildId);
    await (0, promises_1.mkdir)(dir, { recursive: true });
    await (0, promises_1.writeFile)(node_path_1.default.join(dir, `${incident.id}.json`), JSON.stringify(incident, null, 2) + '\n', 'utf8');
}
//# sourceMappingURL=incidentStore.js.map