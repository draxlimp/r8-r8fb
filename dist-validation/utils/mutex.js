"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyedMutex = void 0;
class KeyedMutex {
    tails = new Map();
    async run(key, task) {
        const previous = this.tails.get(key) ?? Promise.resolve();
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        const tail = previous.then(() => gate);
        this.tails.set(key, tail);
        await previous;
        try {
            return await task();
        }
        finally {
            release();
            if (this.tails.get(key) === tail)
                this.tails.delete(key);
        }
    }
}
exports.KeyedMutex = KeyedMutex;
//# sourceMappingURL=mutex.js.map