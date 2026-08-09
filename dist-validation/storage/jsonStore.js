"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonStore = void 0;
const promises_1 = require("node:fs/promises");
const atomicWriter_1 = require("./atomicWriter");
const mutex_1 = require("../utils/mutex");
class JsonStore {
    fileForKey;
    factory;
    migrate;
    mutex = new mutex_1.KeyedMutex();
    constructor(fileForKey, factory, migrate) {
        this.fileForKey = fileForKey;
        this.factory = factory;
        this.migrate = migrate;
    }
    async get(key) {
        const file = this.fileForKey(key);
        try {
            return this.migrate(JSON.parse(await (0, promises_1.readFile)(file, 'utf8')), key);
        }
        catch (error) {
            if (error?.code !== 'ENOENT')
                await (0, promises_1.rename)(file, `${file}.corrupt-${Date.now()}`).catch(() => undefined);
            const value = this.factory(key);
            await (0, atomicWriter_1.atomicWriteJson)(file, value, false);
            return value;
        }
    }
    async set(key, value) { await this.mutex.run(key, () => (0, atomicWriter_1.atomicWriteJson)(this.fileForKey(key), value, true)); }
    async update(key, updater) {
        return this.mutex.run(key, async () => { const current = await this.get(key); const next = await updater(current); await (0, atomicWriter_1.atomicWriteJson)(this.fileForKey(key), next, true); return next; });
    }
}
exports.JsonStore = JsonStore;
//# sourceMappingURL=jsonStore.js.map