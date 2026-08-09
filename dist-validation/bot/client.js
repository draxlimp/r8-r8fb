"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClient = createClient;
const discord_js_1 = require("discord.js");
const intents_1 = require("./intents");
function createClient() { return new discord_js_1.Client({ intents: intents_1.intents, partials: intents_1.partials, allowedMentions: { parse: [] } }); }
//# sourceMappingURL=client.js.map