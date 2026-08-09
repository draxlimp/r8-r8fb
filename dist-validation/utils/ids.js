"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomId = randomId;
exports.incidentId = incidentId;
const node_crypto_1 = require("node:crypto");
function randomId(bytes = 6) { return (0, node_crypto_1.randomBytes)(bytes).toString('hex').toUpperCase(); }
function incidentId(date = new Date()) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `INC-${y}-${m}-${d}-${randomId(3)}`;
}
//# sourceMappingURL=ids.js.map